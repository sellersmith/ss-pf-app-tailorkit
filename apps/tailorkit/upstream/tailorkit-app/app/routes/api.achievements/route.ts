import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import { catchAsync } from '~/utils/catchAsync'
import Promotion, { isBadgeUnlocked } from '~/models/Promotion.server'
import Coupon from '~/models/Coupon.server'
import { ACHIEVEMENT_TYPE, PROMOTION_NAME_PATTERN } from '~/bootstrap/constants/achievements'
import { getShopCampaignStats } from '~/models/ShopCampaignStats.server'

/**
 * Generic achievements API endpoint
 * Usage: GET /api/achievements?type={ACHIEVEMENT_TYPE}
 *
 * Scalable for future achievement types:
 * - publish-to-earn
 * - first-sale
 * - revenue-milestones
 * etc.
 */
export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  if (!type) {
    return json({ success: false, message: 'Missing achievement type' }, { status: 400 })
  }

  switch (type) {
    case ACHIEVEMENT_TYPE.PUBLISH_TO_EARN: {
      // Query active PTE promotions by name pattern
      const ptePromotions = await Promotion.find({
        name: { $regex: PROMOTION_NAME_PATTERN.PUBLISH_TO_EARN },
        status: 'active',
      })

      // Early return if no active PTE promotions
      if (ptePromotions.length === 0) {
        return json({
          success: true,
          type: ACHIEVEMENT_TYPE.PUBLISH_TO_EARN,
          publishedCount: 0,
          campaignId: null,
          badges: [],
        })
      }

      // Determine active campaign
      const now = new Date()
      const activeCampaignPromotion = ptePromotions.find(
        p => p.campaignId && (!p.startAt || p.startAt <= now) && (!p.endAt || p.endAt >= now)
      )

      const campaignId = activeCampaignPromotion?.campaignId

      // Get published count from campaign stats (persistent badges via peakPublishedCount)
      const stats = campaignId ? await getShopCampaignStats(shopDomain, campaignId) : []
      const publishedCount = stats[0]?.peakPublishedCount ?? 0

      const promotionIds = ptePromotions.map(p => p._id.toString())

      // Query coupons generated from PTE promotions
      const pteCoupons = await Coupon.find({
        applyTo: shopDomain,
        promotionId: { $in: promotionIds },
      }).sort({ createdAt: 1 })

      // Map coupons by discount amount for easy lookup
      const couponsByAmount = new Map(pteCoupons.map(c => [c.discount?.amount, c]))

      // Map promotions to badges with full reward content
      const badges = await Promise.all(
        ptePromotions
          .sort((a, b) => (a.condition?.usageThreshold || 0) - (b.condition?.usageThreshold || 0))
          .map(async promotion => {
            const threshold = promotion.condition?.usageThreshold || 0
            const badgeId = threshold === 3 ? 'creator' : threshold === 5 ? 'artisan' : 'master'
            const coupon = promotion.reward?.amount ? couponsByAmount.get(promotion.reward.amount) : null

            // ✅ USE CENTRALIZED FUNCTION - Single source of truth for badge unlock logic
            const unlocked = await isBadgeUnlocked(shopDomain, promotion)

            return {
              id: badgeId,
              name: promotion.reward?.content?.badgeText || badgeId,
              threshold,
              unlocked,
              // Include full reward content
              rewardContent: promotion.reward?.content || null,
              // Include coupon if exists
              coupon: coupon
                ? {
                    code: coupon.code,
                    discount: {
                      type: coupon.discount?.type,
                      amount: coupon.discount?.amount,
                    },
                    limit: coupon.limit,
                  }
                : null,
            }
          })
      )

      return json({
        success: true,
        type: ACHIEVEMENT_TYPE.PUBLISH_TO_EARN,
        publishedCount, // peakPublishedCount from ShopCampaignStats (persistent - never decreases)
        campaignId,
        badges,
      })
    }

    // Future: Add more achievement types here
    // case 'first-sale': {
    //   // Implementation for first sale achievement
    // }
    // case 'revenue-milestones': {
    //   // Implementation for revenue milestones
    // }

    default:
      return json({ success: false, message: 'Invalid achievement type' }, { status: 400 })
  }
})
