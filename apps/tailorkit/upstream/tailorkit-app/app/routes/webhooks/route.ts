import type { ActionFunctionArgs } from '@remix-run/node'
import Customer from '~/models/Customer.server'
import Order from '~/models/Order.server'
import Shop, { clearShopConfigs, getShopData } from '~/models/Shop.server'
import Subscription, { cancelCurrentSubscription, submitDailyUsageCharge } from '~/models/Subscription.server'
import WebhookLog from '~/models/WebhookLog.server'
import { authenticate } from '~/shopify/app.server'
import { ShopifyApiClient } from '~/shopify/graphql/api.server'
import { importOrderAndCustomer, populateAnalytics } from './fns.server'
import { cleanupShopDataAfterUninstalling } from '../api.settings/fns.server'
import { handleProductImageValidation } from './fns/product-image-validation.server'
import { syncFulfillmentOrderToRootOrder } from './fns/fulfillmentWebhookHandlers.server'
import { isDevelopmentStore } from '~/bootstrap/fns/misc'
import {
  findPlanByChargeData,
  trackPlanChange,
  getSubscriptionChangeType,
} from '~/models/helpers/subscription-analytics.server'
import { isOrderBasedPlan } from '~/models/helpers/subscription-helpers.server'
import BillingStateManager from '~/models/helpers/BillingStateManager.server'
import { initializeTrialTracking, isOnActiveDaysTrial } from '~/models/helpers/trial-tracking.server'
import { chargeTrialDebt, accumulateTrialDebt } from '~/models/helpers/trial-debt.server'

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop: shopDomain, admin, payload } = await authenticate.webhook(request)

  // Extract Shopify webhook ID for idempotency check
  const webhookId = request.headers.get('X-Shopify-Webhook-Id')

  // Idempotency check using database-level unique constraint
  // Prevents duplicate processing even with concurrent webhook requests
  let webhookLog

  try {
    // Try to create webhook log
    // Will fail with duplicate key error (code 11000) if same webhook already exists
    webhookLog = await WebhookLog.create({
      topic,
      payload,
      shopDomain,
      admin: admin ? 'AUTHENTICATED' : 'UNAUTHENTICATED',
      webhookId,
    })
  } catch (error: any) {
    // Check for MongoDB duplicate key error
    if (error.code === 11000 || error.name === 'MongoServerError') {
      // Webhook is already being processed or was completed
      throw new Response('Webhook already processed', { status: 200 })
    }
    throw error
  }

  if (!admin) {
    // The admin context isn't returned if the webhook fired after a shop was uninstalled.
    throw new Response()
  }

  try {
    switch (topic) {
      case 'APP_UNINSTALLED': {
        // Clean up shop data — await to ensure cancellation completes before response
        await cleanupShopDataAfterUninstalling(shopDomain)

        break
      }

      case 'SHOP_UPDATE': {
        try {
          const oldShopData = await Shop.findOneAndUpdate(
            { shopDomain },
            { shopConfig: payload },
            { returnDocument: 'before' } // Returns old data before update
          )

          if (oldShopData) {
            // Re-calculate analytics data when the currency of shop is updated
            const oldShopCurrency = oldShopData.shopConfig?.currency
            const newShopCurrency = payload.currency

            if (oldShopCurrency && newShopCurrency && oldShopCurrency !== newShopCurrency) {
              const conditionAggregate = [{ $match: { shopDomain } }]
              await populateAnalytics(conditionAggregate)
            }

            // Automatically cancel the current subscription if the dev store is transferred
            if (isDevelopmentStore(oldShopData.shopConfig) && !isDevelopmentStore(payload)) {
              await cancelCurrentSubscription(shopDomain, true, true, 'dev_store_transfer', 'webhooks/SHOP_UPDATE')
            }
          }
        } catch (err) {
          // Error updating shop config - will be logged in WebhookLog
        }
        break
      }

      /**
       * Legacy cleanup: remove stale product webhook subscriptions
       * that were registered by previous app versions.
       */
      case 'PRODUCTS_CREATE':
      case 'PRODUCTS_DELETE': {
        const api = new ShopifyApiClient(admin)
        const webhooks = await api.getWebhooks()
        const webhookToDelete = webhooks.webhookSubscriptions.edges.find((edge: any) => edge.node.topic === topic)
        if (webhookToDelete) {
          await api.deleteWebhook(webhookToDelete.node.id)
        }
        break
      }

      /**
       * Product image dimension validation.
       * Fires for products tagged with 'tailorkit-personalized' (filter set during webhook registration).
       * Checks if product image aspect ratio matches template dimensions.
       */
      case 'PRODUCTS_UPDATE': {
        // Run async to avoid Shopify's 5-second webhook timeout
        handleProductImageValidation(admin, payload, shopDomain).catch(err => {
          console.error('[DimensionValidation] Webhook handler failed:', {
            shopDomain,
            productId: payload?.id,
            error: err instanceof Error ? err.message : String(err),
          })
        })
        break
      }

      case 'ORDERS_CREATE':
      case 'ORDERS_UPDATED':
      case 'ORDERS_CANCELLED': {
        const api = new ShopifyApiClient(admin)

        // Import and update order
        // Make this task run asynchronous because Shopify will mark this request failed if the response takes longer than 5 seconds
        importOrderAndCustomer(api, payload, shopDomain, topic).catch(() => {
          // Error will be logged via WebhookLog
        })

        break
      }

      case 'ORDERS_DELETE': {
        await Order.deleteOne({ id: payload.id })

        break
      }

      case 'FULFILLMENT_ORDERS_FULFILLMENT_REQUEST_SUBMITTED':
      case 'FULFILLMENT_ORDERS_FULFILLMENT_REQUEST_REJECTED':
      case 'FULFILLMENT_ORDERS_FULFILLMENT_REQUEST_ACCEPTED':
      case 'FULFILLMENT_ORDERS_CANCELLATION_REQUEST_SUBMITTED':
      case 'FULFILLMENT_ORDERS_CANCELLATION_REQUEST_ACCEPTED':
      case 'FULFILLMENT_ORDERS_CANCELLATION_REQUEST_REJECTED': {
        const api = new ShopifyApiClient(admin)

        // Sync fulfillment order to root order
        syncFulfillmentOrderToRootOrder(api, payload, shopDomain).catch(() => {
          // Error will be logged via WebhookLog
        })

        break
      }

      case 'APP_SUBSCRIPTIONS_APPROACHING_CAPPED_AMOUNT': {
        // Get capped amount set by merchants
        const { capped_amount: userCappedAmount } = payload

        // Get shop data
        const shopConfig = await getShopData(shopDomain)

        // Check if the merchant's capped amount is less than the capped amount of their subscription plan
        if (
          shopConfig?.subscription
          && typeof shopConfig.subscription !== 'string'
          && shopConfig.subscription?.plan
          && typeof shopConfig.subscription.plan !== 'string'
          && userCappedAmount < shopConfig.subscription.plan.cappedAmount
        ) {
          // Save the merchant's capped amount to the appropriate subscription
          await Subscription.updateOne({ _id: shopConfig.subscription._id }, { userCappedAmount })

          // TODO: Send an email to notify merchants that their orders will no longer
          // be auto-fulfilled if the capped amount they set is less than the capped
          // amount of their subscription plan.
        }

        break
      }

      case 'APP_SUBSCRIPTIONS_UPDATE': {
        /**
         * Handle Shopify subscription updates
         *
         * Webhook triggers:
         * - Subscription activation (ACTIVE status)
         * - Plan changes (price change in lineItems)
         * - Cancellation (CANCELLED/EXPIRED/FROZEN status)
         * - Status changes
         *
         * For order-based plans, we need to:
         * 1. Initialize billing cycle tracking (billingAnchorDate)
         * 2. Handle plan changes mid-cycle (preserve order counts)
         * 3. Submit final usage charges before cancellation/plan change
         * 4. Track analytics events (Mixpanel)
         */

        // Step 1: Get current active subscription from our database
        const activeSubscription = await Subscription.findOne({ shopDomain, status: 'active' })

        if (!activeSubscription) {
          break
        }

        // Step 2: Verify this webhook is for the current subscription
        // Shopify may send webhooks for old/cancelled subscriptions
        const shopifyChargeId = payload.app_subscription?.admin_graphql_api_id?.split('/')?.pop()

        if (activeSubscription.shopifyCharge?.id !== shopifyChargeId) {
          break
        }

        // Step 3: Extract subscription status from payload
        const status = payload.app_subscription?.status

        if (status === 'CANCELLED' || status === 'EXPIRED' || status === 'FROZEN') {
          /**
           * Handle subscription cancellation (uninstall scenario)
           *
           * CRITICAL: Charge ALL pending usage while access token is still valid
           * - APP_SUBSCRIPTIONS_UPDATE fires BEFORE APP_UNINSTALLED
           * - Access token will be revoked in APP_UNINSTALLED webhook
           * - Cannot charge after token revocation → Must charge here
           *
           * NOTE: Must calculate usage on-demand (not rely on daily cron at 23:00)
           * because user might uninstall before cron runs
           *
           * Handles 2 cases:
           * 1. Trial user → charge accumulated trial debt
           * 2. Paid user → charge daily usage (orders processed since last charge)
           */

          await activeSubscription.populate('plan')
          const plan = activeSubscription.plan as any

          if (plan && isOrderBasedPlan(plan)) {
            const shopData = await getShopData(shopDomain)
            if (shopData) {
              // Check if currently on trial (active-days trial)
              const onTrial = isOnActiveDaysTrial(shopData, plan)

              try {
                if (onTrial) {
                  // Case 1: Trial user - charge trial debt
                  await accumulateTrialDebt(shopDomain, activeSubscription, plan)
                  await chargeTrialDebt(shopDomain, activeSubscription, 'uninstall')
                } else {
                  // Case 2: Paid user - charge daily usage (before uninstall)
                  await submitDailyUsageCharge(shopDomain)
                }
              } catch (error) {
                // Continue with cancellation even if charge fails
                // For trial: debt remains in Shop.trialDebt for manual handling
                // For paid: will be logged for manual review
              }
            }
          }

          // Update subscription status to inactive in our database
          // cancelShopifySubscription = false (already cancelled by Shopify)
          // rememberLastSubscription = false (don't need to remember)
          const reason
            = status === 'CANCELLED'
              ? ('app_subscription_update_cancelled' as const)
              : status === 'EXPIRED'
                ? ('app_subscription_update_expired' as const)
                : ('app_subscription_update_frozen' as const)
          await cancelCurrentSubscription(shopDomain, false, false, reason, 'webhooks/APP_SUBSCRIPTIONS_UPDATE')
        } else if (status === 'ACTIVE') {
          /**
           * Handle subscription activation or plan changes
           *
           * Two main scenarios:
           * 1. New subscription activation (no BillingCycle exists)
           * 2. Plan change (price changed in lineItems)
           *
           * CRITICAL: We initialize BillingCycle BEFORE plan change logic
           * Why? If a new subscription immediately has a plan change, we need
           * billing cycle to exist when submitDailyUsageCharge is called
           *
           * Order-based billing uses BillingCycle collection which tracks:
           * - Cycle start/end dates (30-day periods)
           * - Order counts (initial/current/final)
           * - Accumulated charges (usage fees)
           * - Plan limits (snapshot at cycle start)
           *
           * These are used for incremental charging:
           * - Only charge for NEW orders since last charge
           * - Prevents double-charging
           * - See BillingStateManager for billing logic
           */

          // Step 1: Initialize billing cycle tracking (if not already initialized)
          if (activeSubscription.plan) {
            await activeSubscription.populate('plan')
            const plan = activeSubscription.plan as any

            if (plan && isOrderBasedPlan(plan)) {
              /**
               * Initialize billing cycle for NEW order-based subscriptions
               *
               * This runs when subscription is first activated (no active cycle exists)
               *
               * activated_on: Date when Shopify subscription became ACTIVE
               * This becomes our billing cycle anchor (resets every 30 days)
               *
               * BillingStateManager handles race conditions internally
               */
              const existingCycle = await BillingStateManager.getCurrentState(shopDomain)

              if (!existingCycle) {
                const activatedOn = payload.app_subscription?.activated_on
                const trialEndsOn = payload.app_subscription?.trial_ends_on

                if (activatedOn) {
                  // Use trial_ends_on as cycle start if available
                  // This ensures no usage charges during Shopify-managed trial period
                  const cycleStartDate = trialEndsOn ? new Date(trialEndsOn) : new Date(activatedOn)

                  await BillingStateManager.createCycle(activeSubscription, plan, {
                    isFirstCycle: true,
                    cycleStartDate,
                  })

                  // Initialize V2 active-days trial tracking for order-based plans with trial
                  // Trial starts when subscription becomes ACTIVE (user approved charge)
                  if (isOrderBasedPlan(plan) && trialEndsOn) {
                    await initializeTrialTracking(shopDomain)
                  }

                  // NOTE: Trial → Paid usage reset is handled in subscribe/route.ts
                  // This ensures reset happens immediately when user approves charge,
                  // before webhook processing (which may be delayed or have race conditions)
                }
              }
            }
          }

          /**
           * Step 2: Detect plan changes by comparing recurring prices
           *
           * Plan change detection strategy:
           * - Compare AppRecurringPricing line item prices (old vs new)
           * - If prices differ → plan was upgraded or downgraded
           *
           * Why compare prices instead of plan IDs?
           * - Shopify doesn't send our internal plan IDs
           * - Price is the most reliable indicator of plan change
           * - We'll lookup the actual plan object later using findPlanByChargeData()
           *
           * Line items structure:
           * [
           *   { plan: { pricingDetails: { __typename: 'AppRecurringPricing', price: { amount: '19' } } } },
           *   { plan: { pricingDetails: { __typename: 'AppUsagePricing', terms: 'per order' } } }
           * ]
           */
          const newLineItems = payload.app_subscription?.lineItems || []

          // Extract recurring price from new subscription payload
          const newRecurringPrice = newLineItems.find(
            (item: any) => item.plan?.pricingDetails?.__typename === 'AppRecurringPricing'
          )?.plan?.pricingDetails?.price?.amount

          // Extract recurring price from current subscription (in our database)
          const oldRecurringPrice = activeSubscription.shopifyCharge?.lineItems?.find(
            (item: any) => item.plan?.pricingDetails?.__typename === 'AppRecurringPricing'
          )?.plan?.pricingDetails?.price?.amount

          // Plan changed if both prices exist and are different
          const planChanged = newRecurringPrice && oldRecurringPrice && newRecurringPrice !== oldRecurringPrice

          if (planChanged) {
            /**
             * Step 3: Handle plan change mid-cycle
             *
             * When user upgrades/downgrades during billing cycle:
             * 1. Submit final charge at OLD plan rate (for orders since last charge)
             * 2. Complete old billing cycle with final charge
             * 3. Create new billing cycle with new plan limits
             * 4. CRITICAL: Baseline (orderCount.initial) is ALWAYS preserved
             * 5. Track analytics event
             *
             * Managed by BillingStateManager.handlePlanChange() which:
             * - Marks plan change in old cycle
             * - Completes old cycle with final charges
             * - Creates new cycle preserving baseline (no reset)
             * - Records plan change in PlanChangeRecord
             *
             * Downgrade example:
             * - User on Growth (350 free orders) has used 60 orders in cycle
             * - Downgrades to Starter (50 free orders)
             * - Baseline preserved at 0, so 60 orders against 50 limit → 10 overage
             * - Future orders charged at Starter overage rate ($0.50/order)
             *
             * Upgrade example:
             * - User on Starter (50 free orders) has used 60 orders in cycle (10 overage)
             * - Upgrades to Growth (350 free orders)
             * - Baseline preserved at 0, so 60 orders against 350 limit → still within free quota
             * - Future orders free until 350, then charged at Growth rate ($0.20/order)
             */
            await activeSubscription.populate('plan')
            const currentPlan = activeSubscription.plan as any

            // Check if billing cycle exists for this shop
            const billingState = await BillingStateManager.getCurrentState(shopDomain)

            if (currentPlan && isOrderBasedPlan(currentPlan) && billingState) {
              // Submit final usage charge at OLD plan rate
              // This ensures merchant is charged for orders since last charge before rate changes
              await submitDailyUsageCharge(shopDomain)

              // Get current order count from billing state
              // This is the authoritative source maintained by BillingCycle
              const currentOrderCount = billingState.cycle.orderCount.current

              // Lookup new plan using capability-based detection
              // Uses plan price + lineItems to find matching plan in database
              // See findPlanByChargeData() in subscription-analytics.server.ts
              const newPlanPrice = parseFloat(newRecurringPrice)
              const newPlan = await findPlanByChargeData(newPlanPrice, currentPlan.pricingVersion, newLineItems)

              if (!newPlan) {
                /**
                 * Case 1: Plan not found in database
                 *
                 * This can happen if:
                 * - Merchant changed plan in Shopify admin before we added it to our database
                 * - Custom pricing was applied
                 * - New plan tier was created in Shopify but not synced to our DB
                 *
                 * Fallback strategy:
                 * - Track analytics using price-based comparison (old vs new price)
                 * - Preserve existing plan reference (don't switch to unknown plan)
                 * - Billing continues using old plan settings
                 * - Admin should investigate and manually update plan if needed
                 */

                const oldPlanPrice = parseFloat(oldRecurringPrice)
                const isUpgrade = newPlanPrice > oldPlanPrice
                const shopData = await getShopData(shopDomain)

                if (shopData) {
                  // Track with synthetic plan object: { alias: `plan_$19` }
                  await trackPlanChange(
                    activeSubscription,
                    shopData,
                    currentPlan,
                    { alias: `plan_$${newPlanPrice}` },
                    currentOrderCount,
                    isUpgrade
                  )
                }
                // IMPORTANT: activeSubscription.plan is NOT updated
                // Billing will continue using currentPlan settings
              } else {
                /**
                 * Case 2: Plan found in database (normal case)
                 *
                 * Flow:
                 * 1. Determine change type (upgrade/downgrade/trial→paid)
                 * 2. Track analytics event with full plan details
                 * 3. Switch subscription to new plan
                 *
                 * Change type detection:
                 * - upgrade: Higher price
                 * - downgrade: Lower price
                 * - trial_to_paid: Trial plan (price=0) → Paid plan
                 * - paid_to_trial: Paid plan → Trial plan (rare, usually cancellation)
                 */
                const changeType = getSubscriptionChangeType(currentPlan, newPlan)
                const isUpgrade = changeType === 'upgrade' || changeType === 'trial_to_paid'

                // Track plan change in Mixpanel and add to subscription.planChangeHistory
                const shopData = await getShopData(shopDomain)
                if (shopData) {
                  await trackPlanChange(
                    activeSubscription,
                    shopData,
                    currentPlan,
                    newPlan,
                    currentOrderCount,
                    isUpgrade
                  )
                }

                // NOTE: Trial-to-paid reset logic is handled in isNewSubscription block (line ~325)
                // Reason: Trial has NO Shopify charge, so oldRecurringPrice is undefined
                // This causes planChanged to be FALSE, so this block doesn't run for trial → paid
                // The reset must happen when FIRST Shopify subscription is created (isNewSubscription=true)

                // Switch to new plan - all future billing operations use newPlan settings
                activeSubscription.plan = newPlan._id

                // Handle plan change with BillingStateManager (upgrade/downgrade mid-cycle)
                // Manager handles: complete old cycle, create new cycle with preserved baseline
                await BillingStateManager.handlePlanChange(
                  shopDomain,
                  activeSubscription,
                  activeSubscription,
                  currentPlan,
                  newPlan,
                  isUpgrade,
                  shopData || undefined
                )
              }
            }

            /**
             * Billing cycle consistency note:
             * Baseline (orderCount.initial) does NOT reset on plan change
             * The 30-day billing cycle continues uninterrupted with baseline preserved
             * Only resets when cycle rolls over after 30 days
             */
          }

          /**
           * Step 4: Update subscription with latest data from Shopify
           *
           * Merge strategy:
           * - Preserve existing shopifyCharge fields
           * - Overwrite with new data from payload
           * - This ensures we don't lose historical data
           *
           * shopifyCharge contains:
           * - id, status, lineItems
           * - createdAt, updatedAt, activatedOn
           * - cappedAmount, balanceUsed
           * - Discount/trial information
           */
          activeSubscription.shopifyCharge = {
            ...activeSubscription.shopifyCharge,
            ...payload.app_subscription,
          }

          // Persist all changes to database
          await activeSubscription.save()

          /**
           * NOTE: subscribe_plan event tracking moved to /subscribe route
           *
           * Rationale:
           * - /subscribe route is ALWAYS called when user approves charge (more reliable)
           * - Avoids race condition between webhook and /subscribe route
           * - Centralized tracking logic in one place (easier to maintain/debug)
           * - Has full context about old/new plans, charge details, etc.
           *
           * Webhook still handles:
           * - Billing cycle initialization
           * - Plan change detection and billing logic
           * - Subscription cancellation
           * - Other subscription lifecycle events
           */
        }

        break
      }

      case 'CUSTOMERS_DATA_REQUEST': {
        // Do nothing
        break
      }

      case 'CUSTOMERS_REDACT':
      case 'SHOP_REDACT': {
        // TODO: Do not remove order data because the app will charge
        // usage fees from merchants based on the number of orders.
        //await Order.deleteMany({ shopDomain })

        // Remove all customer data
        await Customer.deleteMany({ shopDomain })

        // Remove all shop data
        clearShopConfigs(shopDomain)

        break
      }

      default: {
        throw new Response('Unhandled webhook topic', { status: 404 })
      }
    }

    // Mark as completed on success
    if (webhookLog?._id) {
      await WebhookLog.updateOne({ _id: webhookLog._id }, { $set: { status: 'completed', processedAt: new Date() } })
    }
  } catch (e) {
    // Mark as failed and store error (only if webhookLog was created)
    if (webhookLog?._id) {
      await WebhookLog.updateOne(
        { _id: webhookLog._id },
        {
          $set: {
            status: 'failed',
            error: { message: (e as Error).message, stack: (e as Error).stack },
            processedAt: new Date(),
          },
        }
      )
    }

    if (e instanceof Response) {
      throw e
    }

    // For critical errors (billing), throw to trigger retry
    throw e
  }

  throw new Response()
}
