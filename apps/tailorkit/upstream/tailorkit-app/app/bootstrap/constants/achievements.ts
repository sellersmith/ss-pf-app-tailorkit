/**
 * Achievement types for the achievements API endpoint
 * Usage: GET /api/achievements?type={ACHIEVEMENT_TYPE}
 */
export const ACHIEVEMENT_TYPE = {
  PUBLISH_TO_EARN: 'publish-to-earn',
  // Future achievement types can be added here:
  // FIRST_SALE: 'first-sale',
  // REVENUE_MILESTONES: 'revenue-milestones',
} as const

/**
 * Promotion name patterns for querying promotions by type
 */
export const PROMOTION_NAME_PATTERN = {
  PUBLISH_TO_EARN: /^Publish to Earn -/i,
} as const

/**
 * PTE (Publish to Earn) badge thresholds
 * Used for badge unlock logic and analytics calculations
 *
 * Badge tiers:
 * - Creator: 3+ products published
 * - Artisan: 5+ products published
 * - Master: 7+ products published
 */
export const PTE_BADGE_THRESHOLDS = {
  CREATOR: 3,
  ARTISAN: 5,
  MASTER: 7,
} as const

/**
 * PTE badge threshold array for MongoDB aggregation pipelines
 * Format: [min, creator_threshold, artisan_threshold, master_threshold, max]
 *
 * Used in $bucket aggregation stage to group stores by badge tier
 */
export const PTE_BADGE_BOUNDARIES = [
  0,
  PTE_BADGE_THRESHOLDS.CREATOR,
  PTE_BADGE_THRESHOLDS.ARTISAN,
  PTE_BADGE_THRESHOLDS.MASTER,
  Infinity,
] as const
