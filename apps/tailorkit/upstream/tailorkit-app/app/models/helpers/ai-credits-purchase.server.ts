import type { AdminApiContext } from '@shopify/shopify-app-remix/server'
import type { AiCreditPackageDocument } from '../AiCreditPackage'
import type { AiCreditPurchaseDocument } from '../AiCreditPurchase'
import AiCreditPackage from '../AiCreditPackage.server'
import AiCreditPurchase from '../AiCreditPurchase.server'
import Shop, { getShopData } from '../Shop.server'
import ShopifySession from '../ShopifySession.server'
import { getAppHandle } from '~/shopify/fns.server'
import { createShopifyOneTimeCharge } from '~/shopify/graphql/fns.server'
import { createAppUsageRecord, AI_CREDITS_LINE_ITEM_TERM } from '../Subscription.server'
import { validateCoupon } from '../Coupon.server'
import { createAiCreditTransaction } from '../AiCreditTransaction.server'
import { getAiCreditBalanceSummary } from './ai-credit-utils'
import { isDevelopmentStore } from '~/bootstrap/fns/misc'
import { trackChargeUsageFees } from '~/bootstrap/fns/mixpanel.server'
import { USAGE_FEE_TYPES } from '~/bootstrap/constants/eventsTracking'
import { getPlanName } from './subscription-analytics.server'

/**
 * Helper functions for AI Credits Purchase
 * Handles purchase creation, Shopify charge, and callback processing
 */

/**
 * Track AI credit charge event to Mixpanel
 *
 * @param shopDomain - Shop domain
 * @param basePrice - Base package price before discount
 * @param discountedPrice - Final price after discount
 * @param credits - Number of credits purchased
 */
async function trackAiCreditCharge(
  shopDomain: string,
  basePrice: number,
  discountedPrice: number,
  credits: number
): Promise<void> {
  try {
    const shopData = await getShopData(shopDomain)
    const subscriptionDoc = shopData?.subscription as any
    const plan = subscriptionDoc?.plan as any
    if (shopData && plan) {
      await trackChargeUsageFees(
        shopData,
        getPlanName(plan),
        plan.price || 0,
        subscriptionDoc.finalPrice || plan.price || 0,
        USAGE_FEE_TYPES.AI_CREDIT,
        basePrice,
        discountedPrice,
        undefined,
        {
          numIncludedAICredits: plan.aiCreditsPerMonth || 0,
          numAdditionalAICredits: credits,
        }
      )
    }
  } catch {
    // Silently fail tracking - don't block purchase flow
  }
}

/**
 * Get AI credit package price after applying coupon discount
 * Reuses the same coupon validation logic as pricing plans
 *
 * @param packageData - AI credit package object
 * @param couponCode - Optional coupon code
 * @param shopDomain - Shop domain
 * @returns Final price after discount
 */
export async function getPackagePriceAfterDiscount(
  packageData: AiCreditPackageDocument,
  couponCode: string | undefined,
  shopDomain: string
): Promise<number> {
  const couponResult = couponCode ? await validateCoupon(couponCode, shopDomain) : null

  // validateCoupon returns false | CouponDocument
  const coupon = couponResult && typeof couponResult !== 'boolean' ? couponResult : null
  const { discount } = coupon || {}

  let price = packageData.price || 0

  if (price && discount) {
    price = discount.type === 'fixed' ? Math.max(0, price - discount.amount) : price * (1 - discount.amount / 100)
  }

  return Math.max(0, price) // Ensure non-negative
}

/**
 * Create AI credit purchase and initiate Shopify charge
 *
 * Flow:
 * 1. Validate package and shop
 * 2. Block trial users (require plan selection)
 * 3. Calculate final price with coupon
 * 4. Create purchase record
 * 5. Choose charging method:
 *    - Auto-charge via usage record (if AI Credits line item exists)
 *    - Fallback to one-time charge (no line item or trial user)
 * 6. Handle $0 purchases (100% coupon discount)
 *
 * @param admin - Shopify admin API context
 * @param shopDomain - Shop domain
 * @param packageId - AI credit package ID
 * @param couponCode - Optional coupon code
 * @returns Purchase record and charge details or success flag
 */
export async function createAiCreditPurchase(
  admin: AdminApiContext,
  shopDomain: string,
  packageId: string,
  couponCode?: string
): Promise<{
  success: boolean
  purchase?: AiCreditPurchaseDocument | null
  confirmationUrl?: string
  autoCharged?: boolean
  message?: string
  requirePlanSelection?: boolean
}> {
  // 1. Get and validate package
  const packageData = await AiCreditPackage.findOne({ _id: packageId, status: 'active' })
  if (!packageData) {
    return {
      success: false,
      message: 'AI credit package not found or inactive',
    }
  }

  // 2. Get shop data
  const shop = await Shop.findOne({ shopDomain }).populate('subscription')
  if (!shop) {
    return {
      success: false,
      message: 'Shop not found',
    }
  }

  // 3. Check subscription status
  const subscription = shop.subscription as any
  const hasActiveSubscription = subscription?.status === 'active'

  // Block trial users without active subscription
  if (!hasActiveSubscription) {
    return {
      success: false,
      message: 'You must select a plan before purchasing AI credits',
      requirePlanSelection: true,
    }
  }

  // 4. Calculate final price
  const finalPrice = await getPackagePriceAfterDiscount(packageData, couponCode, shopDomain)
  const credits = packageData.credits

  // 5. Create purchase record
  const purchase = await AiCreditPurchase.create({
    shopDomain,
    package: packageData._id,
    credits,
    price: packageData.price,
    couponCode,
    finalPrice,
    status: 'pending',
    appliedToShop: false,
  })

  // 6. Handle $0 purchases (100% coupon discount)
  if (finalPrice === 0) {
    // Get current balance
    const currentShop = await Shop.findOne({ shopDomain })
    const balanceBefore = getAiCreditBalanceSummary(currentShop?.usages?.aiCredit)

    // Directly credit the shop's purchased credits (never resets)
    await Shop.updateOne({ shopDomain }, { $inc: { 'usages.aiCredit.purchasedCredits': credits } })

    const balanceAfter = {
      monthly: balanceBefore.monthly,
      purchased: balanceBefore.purchased + credits,
      total: balanceBefore.total + credits,
    }

    // Create transaction record
    await createAiCreditTransaction({
      shopDomain,
      type: 'credit',
      amount: credits,
      source: 'purchased',
      reason: 'purchase',
      purchaseId: purchase._id.toString(),
      packageName: packageData.name,
      packagePrice: 0,
      balanceBefore,
      balanceAfter,
      description: `Purchased ${credits} credits (free with coupon)`,
      metadata: { couponCode },
    })

    // Mark purchase as completed and applied
    await AiCreditPurchase.updateOne(
      { _id: purchase._id },
      {
        status: 'completed',
        appliedToShop: true,
      }
    )

    return {
      success: true,
      purchase: await AiCreditPurchase.findOne({ _id: purchase._id }),
      autoCharged: true,
      message: 'AI credits added successfully (free with coupon)',
    }
  }

  // 7. Determine charging method
  const hasAiLineItem = subscription.shopifyCharge?.lineItems?.some((item: any) => {
    const pricingDetails = item.plan?.pricingDetails
    return (
      pricingDetails?.__typename === 'AppUsagePricing' && pricingDetails?.terms?.includes(AI_CREDITS_LINE_ITEM_TERM)
    )
  })

  try {
    // Path A: Auto-charge via usage record (when AI Credits line item exists)
    if (hasAiLineItem) {
      const description = `AI Credits Purchase - ${credits} credits${couponCode ? ` (coupon: ${couponCode})` : ''}`

      // Step 1: Create Shopify usage record (charge happens immediately)
      const usageRecord = await createAppUsageRecord(
        shopDomain,
        subscription.shopifyCharge,
        finalPrice,
        description,
        AI_CREDITS_LINE_ITEM_TERM
      )

      // Step 2: Mark purchase as completed (but NOT applied yet)
      await AiCreditPurchase.updateOne(
        { _id: purchase._id },
        {
          status: 'completed',
          appliedToShop: false,
          shopifyCharge: usageRecord,
        }
      )

      // Get current balance before crediting
      const currentShop = await Shop.findOne({ shopDomain })
      const balanceBefore = getAiCreditBalanceSummary(currentShop?.usages?.aiCredit)

      // Step 3: Credit the shop's purchased credits (never resets)
      await Shop.updateOne({ shopDomain }, { $inc: { 'usages.aiCredit.purchasedCredits': credits } })

      const balanceAfter = {
        monthly: balanceBefore.monthly,
        purchased: balanceBefore.purchased + credits,
        total: balanceBefore.total + credits,
      }

      // Create transaction record
      await createAiCreditTransaction({
        shopDomain,
        type: 'credit',
        amount: credits,
        source: 'purchased',
        reason: 'purchase',
        purchaseId: purchase._id.toString(),
        packageName: packageData.name,
        packagePrice: finalPrice,
        balanceBefore,
        balanceAfter,
        description: `Purchased ${credits} credits for $${finalPrice}`,
        metadata: { couponCode, usageRecordId: usageRecord?.id },
      })

      // Step 4: Mark as applied to prevent double-crediting
      await AiCreditPurchase.updateOne({ _id: purchase._id }, { appliedToShop: true })

      // Step 5: Track charge_usage_fees event for AI credits
      await trackAiCreditCharge(shopDomain, packageData.price || 0, finalPrice, credits)

      return {
        success: true,
        purchase: await AiCreditPurchase.findOne({ _id: purchase._id }),
        autoCharged: true,
        message: 'AI credits charged and added successfully',
      }
    }

    // Path B: One-time charge (fallback - requires user approval)
    const { TEST_CHARGE } = process.env
    const session = await ShopifySession.findOne({ shop: shopDomain })
    const appHandle = await getAppHandle(shopDomain, admin)
    const callbackUrl = `https://${shopDomain}/admin/apps/${appHandle}/settings/ai-credits/callback?purchase_id=${purchase._id}`

    const isDevStore = isDevelopmentStore(shop?.shopConfig)
    const isTestCharge = TEST_CHARGE === 'true' || isDevStore
    const chargeResult = await createShopifyOneTimeCharge({
      name: `AI Credits - ${credits} credits${couponCode ? ` (coupon: ${couponCode})` : ''}`,
      price: finalPrice,
      returnUrl: callbackUrl,
      test: isTestCharge,
      shopDomain,
      accessToken: session.accessToken,
    })

    // Save Shopify charge ID
    await AiCreditPurchase.updateOne(
      { _id: purchase._id },
      {
        shopifyCharge: {
          id: chargeResult.chargeId,
          status: chargeResult.status,
        },
      }
    )

    return {
      success: true,
      purchase: await AiCreditPurchase.findOne({ _id: purchase._id }),
      confirmationUrl: chargeResult.confirmationUrl,
      autoCharged: false,
      message: 'Please confirm the charge in Shopify',
    }
  } catch (error) {
    console.error('[createAiCreditPurchase] Charge creation failed:', error)

    // Delete purchase record if Shopify charge creation fails
    await AiCreditPurchase.deleteOne({ _id: purchase._id })

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create charge',
    }
  }
}

/**
 * Process AI credit purchase callback after one-time charge approval
 *
 * Flow:
 * 1. Find purchase record
 * 2. Verify charge status
 * 3. Use atomic conditional update for idempotency (prevent double-crediting)
 * 4. Credit the shop if not already applied
 *
 * @param purchaseId - Purchase record ID
 * @param chargeId - Shopify charge ID
 * @returns Success status and purchase details
 */
export async function processAiCreditPurchaseCallback(
  purchaseId: string,
  chargeId: string
): Promise<{
  success: boolean
  purchase?: AiCreditPurchaseDocument | null
  alreadyApplied?: boolean
  message?: string
}> {
  // 1. Find purchase record
  const purchase = await AiCreditPurchase.findOne({ _id: purchaseId })
  if (!purchase) {
    return {
      success: false,
      message: 'Purchase record not found',
    }
  }

  // 2. Verify charge ID matches
  const storedChargeId = purchase.shopifyCharge?.id
  if (storedChargeId && storedChargeId !== chargeId) {
    return {
      success: false,
      message: 'Charge ID mismatch',
    }
  }

  // 3. Atomic conditional update for idempotency
  // Only update if appliedToShop is false, and set it to true atomically
  const updateResult = await AiCreditPurchase.updateOne(
    {
      _id: purchase._id,
      appliedToShop: false, // Only proceed if not already applied
    },
    {
      $set: {
        status: 'completed',
        appliedToShop: true, // Set this atomically to close the race window
      },
    }
  )

  // If no documents were modified, credits were already applied
  if (updateResult.modifiedCount === 0) {
    return {
      success: true,
      purchase: await AiCreditPurchase.findOne({ _id: purchase._id }),
      alreadyApplied: true,
      message: 'Credits were already applied',
    }
  }

  // 4. Credit the shop's purchased credits (never resets)
  try {
    // Get current balance
    const currentShop = await Shop.findOne({ shopDomain: purchase.shopDomain })
    const balanceBefore = getAiCreditBalanceSummary(currentShop?.usages?.aiCredit)

    await Shop.updateOne(
      { shopDomain: purchase.shopDomain },
      { $inc: { 'usages.aiCredit.purchasedCredits': purchase.credits } }
    )

    const balanceAfter = {
      monthly: balanceBefore.monthly,
      purchased: balanceBefore.purchased + purchase.credits,
      total: balanceBefore.total + purchase.credits,
    }

    // Get package info
    const packageData = await AiCreditPackage.findOne({ _id: purchase.package })

    // Create transaction record
    await createAiCreditTransaction({
      shopDomain: purchase.shopDomain,
      type: 'credit',
      amount: purchase.credits,
      source: 'purchased',
      reason: 'purchase',
      purchaseId: purchase._id.toString(),
      packageName: packageData?.name || 'Unknown Package',
      packagePrice: purchase.finalPrice,
      balanceBefore,
      balanceAfter,
      description: `Purchased ${purchase.credits} credits for $${purchase.finalPrice}`,
      metadata: { chargeId, couponCode: purchase.couponCode },
    })

    // Track charge_usage_fees event for AI credits
    await trackAiCreditCharge(purchase.shopDomain, purchase.price || 0, purchase.finalPrice || 0, purchase.credits)

    return {
      success: true,
      purchase: await AiCreditPurchase.findOne({ _id: purchase._id }),
      message: 'AI credits added successfully',
    }
  } catch (error) {
    console.error('[processAiCreditPurchaseCallback] Failed to credit shop:', error)

    // Rollback both status and appliedToShop flag if crediting fails
    await AiCreditPurchase.updateOne({ _id: purchase._id }, { status: 'pending', appliedToShop: false })

    return {
      success: false,
      message: 'Failed to add credits to shop',
    }
  }
}

/**
 * Get purchase history for a shop
 *
 * @param shopDomain - Shop domain
 * @param options - Query options
 * @returns Array of purchase records
 */
export async function getAiCreditPurchaseHistory(
  shopDomain: string,
  options: {
    limit?: number
    status?: 'pending' | 'completed' | 'failed' | 'refunded'
  } = {}
): Promise<AiCreditPurchaseDocument[]> {
  const { limit = 50, status } = options

  const query: any = { shopDomain }
  if (status) {
    query.status = status
  }

  return AiCreditPurchase.find(query).populate('package').sort({ createdAt: -1 }).limit(limit)
}

/**
 * Get total AI credits purchased by shop
 *
 * @param shopDomain - Shop domain
 * @returns Total credits purchased (completed only)
 */
export async function getTotalAiCreditsPurchased(shopDomain: string): Promise<number> {
  const result = await AiCreditPurchase.aggregate([
    {
      $match: {
        shopDomain,
        status: 'completed',
        appliedToShop: true,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$credits' },
      },
    },
  ])

  return result[0]?.total || 0
}
