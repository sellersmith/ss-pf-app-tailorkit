import type { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
export interface PromotionDocument {
  _id: string
  name: string
  endAt?: Date
  startAt?: Date
  campaignId?: string
  ordering: Number
  status: 'active' | 'inactive'
  condition?: {
    usageMetric?: string
    usageThreshold?: number
    maxDaysUsingApp?: number
  }
  reward: {
    type: 'fixed' | 'percent'
    amount?: number // Optional - some rewards don't have coupons (e.g., Artisan/Master badges)
    expiresAfter?: number // Number of days the coupon will be valid after being generated
    discountEndsAfter?: number // Number of months the discount will affect after applying coupon
    lifetime?: Date
    content?: {
      badgeText?: string
      thumbnailUrl?: string
      items?: Array<{
        type?: 'download' | 'link' | 'partner_discount' | 'text'
        title?: string
        description?: string
        textAction?: string
        canExpand?: boolean
        url?: string
        icon?: string
        partnerName?: string
        discountCode?: string
        tooltip?: string
        items?: any[]
      }>
    }
  }
  /**
   * Tracking event configuration
   * Defines what analytics event to track when a promotion is unlocked
   */
  tracking?: {
    // The name of the event to track
    eventName: EVENTS_TRACKING
    // The data to track with the event
    eventData:
      | Record<string, unknown>
      | {
          badge?: string
          threshold?: number
          [key: string]: unknown
        }
  }
}
