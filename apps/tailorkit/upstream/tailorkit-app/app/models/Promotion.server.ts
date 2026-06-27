import type { PromotionDocument } from './Promotion'
import mongoose from '~/bootstrap/db/connect-db.server'
import type { ShopDocument } from './Shop'
import type { SubscriptionDocument } from './Subscription'
import { ONE_DAY_IN_MILLISECONDS } from '~/constants'
import Coupon, { generateCouponCode } from './Coupon.server'
import Shop, { getShopData } from './Shop.server'
import { postEventToCustomerIo } from '~/modules/customer.io/api.server'
import { CUSTOMERIO_EVENTS } from '~/modules/customer.io/constants'
import { serverInitiator } from '~/bootstrap/fns/initiator'
import promotions from './Promotion.define'
import type { CouponDocument } from './Coupon'
import isDate from 'lodash/isDate'
import { trackEvent } from '~/bootstrap/fns/mixpanel.server'
import { getShopCampaignStats } from './ShopCampaignStats.server'

const promotionSchema = new mongoose.Schema<PromotionDocument>(
  {
    name: {
      type: String,
      index: true,
      required: true,
    },
    startAt: {
      type: Date,
      index: true,
    },
    endAt: {
      type: Date,
      index: true,
    },
    campaignId: {
      type: String,
      index: true,
    },
    status: {
      type: String,
      index: true,
      required: true,
      enum: ['active', 'inactive'],
    },
    condition: {
      usageMetric: String,
      usageThreshold: Number,
      maxDaysUsingApp: Number,
    },
    reward: {
      type: {
        type: String,
        required: true,
        enum: ['fixed', 'percent'],
      },
      amount: {
        type: Number,
        required: false, // Optional - some rewards don't have coupons
      },
      // Number of days the coupon will be valid after being generated
      expiresAfter: Number,
      // Number of months the discount will affect after applying coupon
      discountEndsAfter: Number,
      // Rich content for rewards (downloads, links, partner discounts, etc.)
      content: {
        badgeText: String,
        thumbnailUrl: String,
        items: [
          {
            type: {
              type: String,
              enum: ['download', 'link', 'partner_discount', 'text'],
            },
            title: String,
            description: String,
            textAction: String,
            canExpand: Boolean,
            url: String,
            icon: String,
            partnerName: String,
            discountCode: String,
            tooltip: String,
            items: Array,
          },
        ],
      },
    },
    ordering: {
      type: Number,
      index: true,
    },
    tracking: {
      eventName: String,
      eventData: Object,
    },
  },
  { timestamps: true }
)

// Compound indexes for performance optimization
// Primary index for active campaign queries (used in product publish flow)
// Optimizes: Promotion.find({ status, campaignId: {$exists}, startAt/endAt filters })
promotionSchema.index(
  { status: 1, campaignId: 1, startAt: 1, endAt: 1 },
  { background: true, name: 'active_campaigns_idx' }
)

// Secondary index for admin dashboard campaign lookups
// Optimizes: Promotion.find({ name: {$regex}, campaignId: {$exists} })
promotionSchema.index({ name: 1, campaignId: 1 }, { background: true, name: 'campaign_name_idx' })

const Promotion = mongoose.models.Promotion || mongoose.model<PromotionDocument>('Promotion', promotionSchema)

export default Promotion

/**
 * Apply promotion if qualified
 * @param shopData - The shop data to apply the promotion to
 * @returns - The coupons applied
 */
export async function applyPromotionIfQualified(shopData: null | string | ShopDocument) {
  // Get shop data if not provided
  shopData = typeof shopData === 'string' ? await getShopData(shopData) : shopData

  if (!shopData) {
    return []
  }

  // Get active promotions
  const nowDate = new Date()
  const couponsApplied: CouponDocument[] = []

  const promotions = await Promotion.find(
    {
      $and: [
        { status: 'active' },
        { $or: [{ endAt: null }, { endAt: { $gte: nowDate } }] },
        { $or: [{ startAt: null }, { startAt: { $lte: nowDate } }] },
      ],
    },
    null,
    { sort: { ordering: 1 } }
  )

  // Check if shop usage meets the condition of any active promotion
  const nowMs = nowDate.getTime()
  const { createdAt, shopDomain, subscription } = shopData
  const occurredEvents = shopData.appConfig?.occurredEvents || {}

  for (const promotion of promotions) {
    const { _id, name, condition, reward, tracking } = promotion
    const { usageMetric, maxDaysUsingApp } = condition || {}

    // ✅ USE CENTRALIZED FUNCTION - Single source of truth for badge unlock logic
    const badgeUnlocked = await isBadgeUnlocked(shopData.shopDomain, promotion, shopData)

    if (badgeUnlocked) {
      // Check if the shop has been using the app for the required days
      if (maxDaysUsingApp) {
        const startDate = (subscription as SubscriptionDocument)?.shopifyCharge?.activated_on || createdAt

        const startDateInMilliseconds = (isDate(startDate) ? startDate : new Date(startDate)).getTime()
        const daysUsingApp = (nowMs - startDateInMilliseconds) / ONE_DAY_IN_MILLISECONDS

        if (daysUsingApp > maxDaysUsingApp) {
          continue
        }
      }

      const promotionId = _id.toString()

      // Check for tracking event
      if (tracking && tracking.eventName) {
        // Unique key to track this specific promotion event (e.g., 'pte_badge_unlocked_creator')
        // Use tracking.eventName + unique identifier (like badge name or threshold) if available
        const uniqueEventKey = `${tracking.eventName}_${tracking.eventData?.badge || promotionId}`

        if (!occurredEvents[uniqueEventKey]) {
          // Get current usage for event tracking
          const currentUsage = await getCurrentUsage(shopData.shopDomain, promotion, shopData)

          // Track the event
          trackEvent(shopData, tracking.eventName, {
            ...tracking.eventData,
            [usageMetric as string]: currentUsage,
          }).catch(console.error)

          // Mark as occurred in shop config
          await Shop.updateOne(
            { shopDomain },
            {
              $set: {
                [`appConfig.occurredEvents.${uniqueEventKey}`]: true,
              },
            }
          )

          // Update local occurredEvents to reflect change immediately for subsequent logic if needed
          occurredEvents[uniqueEventKey] = true
        }
      }

      // Apply promotion reward only if not applied yet
      const existedCoupon = await Coupon.findOne({ applyTo: shopDomain, promotionId }, null, {
        sort: { createdAt: -1 },
      })

      if (existedCoupon) {
        couponsApplied.push(existedCoupon)

        continue
      }

      const { type, amount, expiresAfter, discountEndsAfter } = reward

      // Only generate coupon if amount is defined and > 0
      // Some promotions (like Artisan/Master badges) only have content rewards
      if (amount && amount > 0) {
        // Generate a coupon code for the promotion
        const couponCode = generateCouponCode()

        const coupon = await Coupon.create({
          promotionId,
          code: couponCode,
          status: 'active',
          applyTo: [shopDomain],
          name: `${name} Reward`,
          discount: {
            type,
            amount,
          },
          limit: {
            ...(discountEndsAfter ? { discountEndsAfter } : {}),
            ...(expiresAfter ? { expiresAt: new Date(nowMs + expiresAfter * ONE_DAY_IN_MILLISECONDS) } : {}),
          },
        })

        couponsApplied.push(coupon)
      }

      // Send achieved_promotion_reward event to customer.io
      // Only send if coupon was created, otherwise just track the promotion achievement
      if (amount && amount > 0 && couponsApplied.length > 0) {
        const coupon = couponsApplied[couponsApplied.length - 1]
        postEventToCustomerIo({
          shopDomain,
          eventName: CUSTOMERIO_EVENTS.ACHIEVED_PROMOTION_REWARD,
          eventData: {
            couponCode: coupon.code,
            createdAt: coupon?.createdAt || new Date(),
            couponAmount: type === 'fixed' ? `$${amount}` : `${amount}%`,
            ...(expiresAfter ? { couponExpiresAt: coupon.limit?.expiresAt } : {}),
          },
        }).catch(console.error)
      }
    }
  }

  return couponsApplied
}

export async function runCreateDefaultPromotions() {
  if (!process.env.IMPORTED_DEFAULT_PROMOTIONS) {
    ;(async () => {
      // Import default promotions
      for (const promotion of promotions) {
        const { name, ...rest } = promotion

        await Promotion.updateOne({ name }, rest, { upsert: true })
      }

      process.env.IMPORTED_DEFAULT_PROMOTIONS = 'true'
    })()
  }
}

// Add runCreateDefaultPromotions to serverInitiator
serverInitiator.addInitiator(runCreateDefaultPromotions)

/**
 * Helper: Get current usage value for event tracking
 */
async function getCurrentUsage(
  shopDomain: string,
  promotion: PromotionDocument,
  shopData: ShopDocument
): Promise<number | boolean> {
  const { campaignId, condition } = promotion
  const { usageMetric } = condition || {}

  if (!usageMetric) return 0

  // Campaign-based
  if (campaignId && usageMetric === 'totalPublishedIntegrations') {
    const stats = await getShopCampaignStats(shopDomain, campaignId)
    return stats[0]?.peakPublishedCount ?? 0
  }

  // Legacy
  return shopData.usages?.[usageMetric as keyof ShopDocument['usages']] ?? 0
}

/**
 * SINGLE SOURCE OF TRUTH for badge unlock status
 *
 * Centralizes logic for both backend (applyPromotionIfQualified) and frontend (api.achievements).
 * Campaign promotions use peakPublishedCount, legacy promotions use Shop.usages.
 */
export async function isBadgeUnlocked(
  shopDomain: string,
  promotion: PromotionDocument,
  shopData?: ShopDocument | null | string
): Promise<boolean> {
  const { campaignId, condition } = promotion
  const { usageMetric, usageThreshold } = condition || {}

  if (!usageMetric || usageThreshold === undefined) return false

  // Campaign-based: Use peakPublishedCount (persistent badges)
  if (campaignId && usageMetric === 'totalPublishedIntegrations') {
    const stats = await getShopCampaignStats(shopDomain, campaignId)
    return (stats[0]?.peakPublishedCount ?? 0) >= usageThreshold
  }

  // Legacy: Use Shop.usages
  if (shopData && typeof shopData !== 'string') {
    const currentUsage = shopData.usages?.[usageMetric as keyof ShopDocument['usages']] ?? 0
    const isBoolean = typeof currentUsage === 'boolean'
    return isBoolean ? currentUsage === Boolean(usageThreshold) : currentUsage >= usageThreshold
  }

  return false
}
