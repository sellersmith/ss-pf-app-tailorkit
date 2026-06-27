import { z } from 'zod'
import { Http } from '../core/httpClient'
import { parseWithZod } from '../core/validation'
import { ACHIEVEMENT_TYPE } from '~/bootstrap/constants/achievements'

const PTEBadgeItemZ = z
  .object({
    type: z.enum(['download', 'link', 'partner_discount', 'text']),
    title: z.string().optional(),
    description: z.string().optional(),
    textAction: z.string().optional(),
    url: z.string().optional(),
    icon: z.string().optional(),
    partnerName: z.string().optional(),
    discountCode: z.string().optional(),
    discountText: z.string().optional(),
    tooltip: z.string().optional(),
    canExpand: z.boolean().optional(),
    items: z.array(z.any()).optional(),
  })
  .passthrough()

const PTEBadgeRewardContentZ = z
  .object({
    badgeText: z.string(),
    items: z.array(PTEBadgeItemZ).default([]),
  })
  .passthrough()

const PTEBadgeCouponZ = z
  .object({
    code: z.string(),
    discount: z.object({
      type: z.enum(['fixed', 'percent']),
      amount: z.number(),
    }),
    limit: z
      .object({
        discountEndsAfter: z.number().optional(),
        expiresAt: z.string().optional(),
      })
      .optional(),
  })
  .passthrough()

const PTEBadgeZ = z
  .object({
    id: z.string(),
    name: z.string(),
    threshold: z.number(),
    unlocked: z.boolean(),
    rewardContent: PTEBadgeRewardContentZ.nullable(),
    coupon: PTEBadgeCouponZ.nullable(),
  })
  .passthrough()

const PTEStatusResponseZ = z
  .object({
    success: z.boolean(),
    type: z.string(),
    publishedCount: z.number(),
    badges: z.array(PTEBadgeZ).default([]),
  })
  .passthrough()

export type PTEBadgeItem = z.infer<typeof PTEBadgeItemZ>
export type PTEBadgeRewardContent = z.infer<typeof PTEBadgeRewardContentZ>
export type PTEBadgeCoupon = z.infer<typeof PTEBadgeCouponZ>
export type PTEBadge = z.infer<typeof PTEBadgeZ>
export type PTEStatusResponse = z.infer<typeof PTEStatusResponseZ>

export const AchievementsService = {
  /**
   * Fetch Publish to Earn (PTE) status data
   * Returns published count and badge unlock status
   */
  async getPTEStatus(preferCache: boolean = false): Promise<PTEStatusResponse> {
    const res = await Http.get<unknown>(`/api/achievements?type=${ACHIEVEMENT_TYPE.PUBLISH_TO_EARN}`, {
      preferCache,
    })

    if (!res.ok || !res.data) {
      throw new Error('Failed to fetch PTE status')
    }

    const data = parseWithZod(PTEStatusResponseZ, res.data, 'pte-status-response')
    return data as PTEStatusResponse
  },
}
