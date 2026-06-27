/**
 * MongoDB $bucket output for badge distribution
 * Represents count of stores at each badge threshold
 *
 * The _id values correspond to MongoDB $bucket boundaries:
 * - 0: Stores with 0 products (shouldn't occur in practice)
 * - 3: Creator badge threshold
 * - 5: Artisan badge threshold
 * - 7: Master badge threshold
 * - 'no_badge': Default bucket for out-of-range values
 */
export interface BadgeBucket {
  _id: 0 | 3 | 5 | 7 | 'no_badge'
  count: number
}

/**
 * MongoDB aggregation output for campaign overview metrics
 */
export interface CampaignOverviewMetrics {
  _id: null
  totalParticipatingStores: number
  totalPublishedProducts: number
  avgPublishedPerStore: number
  maxPublished: number
}

/**
 * MongoDB aggregation output for activity metrics
 * Active = published in last 7 days
 * Dormant = participating but no recent activity
 */
export interface ActivityMetrics {
  _id: null
  activeStores: number
  dormantStores: number
}

/**
 * Complete campaign analytics aggregation result from getCampaignAnalytics()
 * Used by admin dashboard to display campaign performance metrics
 */
export interface CampaignAnalytics {
  overview: CampaignOverviewMetrics[]
  badgeDistribution: BadgeBucket[]
  activityMetrics: ActivityMetrics[]
}
