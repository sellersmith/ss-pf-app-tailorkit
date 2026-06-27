import Shop from '~/models/Shop.server'
import Subscription from '~/models/Subscription.server'

/**
 * Feature Adoption Analytics Service
 *
 * Tracks and analyzes feature usage across the platform
 * Used to identify underutilized features and measure feature stickiness
 */

export interface DateRange {
  from: Date
  to: Date
}

/**
 * Feature Definition
 *
 * Maps feature keys to display names and descriptions
 */
export const FEATURES = {
  svgExport: {
    name: 'SVG Export',
    description: 'Export designs as SVG format',
    usageField: 'usages.featureUsage.svgExportCount',
  },
  autoFulfillment: {
    name: 'Auto Fulfillment',
    description: 'Automated order fulfillment with Printify',
    usageField: 'usages.featureUsage.autoFulfillmentCount',
  },
  highResPngExport: {
    name: 'High-Res PNG Export',
    description: 'Export high-resolution PNG images',
    usageField: 'usages.featureUsage.highResPngExportCount',
  },
  priorityRequests: {
    name: 'Priority Requests',
    description: 'Priority support and processing',
    usageField: 'usages.featureUsage.priorityRequestsCount',
  },
  bulkAssign: {
    name: 'Bulk Assign',
    description: 'Bulk assignment of templates to products',
    usageField: 'usages.featureUsage.bulkAssignCount',
  },
  aiAssistant: {
    name: 'AI Assistant',
    description: 'AI-powered design assistant',
    usageField: 'usages.usedAIAssistant',
  },
  generativeAI: {
    name: 'Generative AI',
    description: 'AI image generation features',
    usageField: 'usages.usedGenerativeAI',
  },
} as const

export type FeatureKey = keyof typeof FEATURES

/**
 * Feature Adoption Rate Result
 *
 * Shows what percentage of shops use each feature
 */
export interface FeatureAdoptionRate {
  feature: FeatureKey
  featureName: string
  totalShops: number // Total active shops
  usersCount: number // Shops that used this feature
  adoptionRate: number // (usersCount / totalShops) * 100
  averageUsagePerShop: number // Average uses per shop (for count-based features)
  firstUsedDate?: Date // Earliest usage date
  lastUsedDate?: Date // Most recent usage date
}

/**
 * Feature Usage by Plan Tier
 *
 * Breaks down feature usage across pricing tiers
 */
export interface FeatureUsageByPlan {
  feature: FeatureKey
  featureName: string
  byPlan: {
    planName: string
    planId: string
    shopCount: number
    usersCount: number
    adoptionRate: number
    averageUsagePerShop: number
  }[]
  overall: {
    totalShops: number
    usersCount: number
    adoptionRate: number
  }
}

/**
 * Feature Retention Metrics
 *
 * Measures feature stickiness and retention
 */
export interface FeatureRetention {
  feature: FeatureKey
  featureName: string

  // Cohort analysis
  cohorts: {
    month: string // YYYY-MM
    firstTimeUsers: number // Shops that used feature for first time this month
    retainedInNextMonth: number // % that used again in following month
    retentionRate: number // retainedInNextMonth / firstTimeUsers * 100
  }[]

  // Overall retention
  overall: {
    totalUsers: number
    activeLastMonth: number // Used in last 30 days
    activeRetentionRate: number // activeLastMonth / totalUsers * 100
    averageDaysBetweenUse: number
  }
}

/**
 * Get feature adoption rate across all shops
 *
 * @param feature - Feature key to analyze
 * @param dateRange - Optional date range filter
 * @returns Adoption rate metrics
 */
export async function getFeatureAdoptionRate(feature: FeatureKey, dateRange?: DateRange): Promise<FeatureAdoptionRate> {
  const featureConfig = FEATURES[feature]

  // Get all active shops
  const activeShopsQuery: any = { uninstalledAt: { $exists: false } }
  if (dateRange) {
    activeShopsQuery.createdAt = { $lte: dateRange.to }
  }

  const totalShops = await Shop.countDocuments(activeShopsQuery)

  // Query for shops that used this feature
  const usageQuery: any = { ...activeShopsQuery }

  // Boolean features (usedAIAssistant, usedGenerativeAI)
  if (feature === 'aiAssistant' || feature === 'generativeAI') {
    usageQuery[featureConfig.usageField] = true
    const usersCount = await Shop.countDocuments(usageQuery)

    return {
      feature,
      featureName: featureConfig.name,
      totalShops,
      usersCount,
      adoptionRate: totalShops > 0 ? (usersCount / totalShops) * 100 : 0,
      averageUsagePerShop: 0, // N/A for boolean features
    }
  }

  // Count-based features (exports, fulfillments, etc.)
  usageQuery[featureConfig.usageField] = { $gt: 0 }
  const usersCount = await Shop.countDocuments(usageQuery)

  // Calculate average usage
  const shopsWithUsage = await Shop.find(usageQuery).select(featureConfig.usageField)
  let totalUsage = 0
  for (const shop of shopsWithUsage) {
    const usage = getNestedValue(shop, featureConfig.usageField)
    totalUsage += usage || 0
  }
  const averageUsagePerShop = usersCount > 0 ? totalUsage / usersCount : 0

  // Get first and last usage dates
  const shopsWithDates = await Shop.find(usageQuery)
    .select('usages.featureUsage.firstFeatureUsedAt usages.featureUsage.lastFeatureUsedAt')
    .sort({ 'usages.featureUsage.firstFeatureUsedAt': 1 })

  const firstUsed = shopsWithDates[0]?.usages?.featureUsage?.firstFeatureUsedAt
  const lastUsedShop = shopsWithDates[shopsWithDates.length - 1]
  const lastUsed = lastUsedShop?.usages?.featureUsage?.lastFeatureUsedAt

  return {
    feature,
    featureName: featureConfig.name,
    totalShops,
    usersCount,
    adoptionRate: totalShops > 0 ? Math.round((usersCount / totalShops) * 1000) / 10 : 0,
    averageUsagePerShop: Math.round(averageUsagePerShop * 10) / 10,
    firstUsedDate: firstUsed ? new Date(firstUsed) : undefined,
    lastUsedDate: lastUsed ? new Date(lastUsed) : undefined,
  }
}

/**
 * Get feature usage breakdown by pricing plan
 *
 * @param feature - Feature key to analyze
 * @param dateRange - Optional date range filter
 * @returns Usage breakdown by plan tier
 */
export async function getFeatureUsageByPlan(feature: FeatureKey, dateRange?: DateRange): Promise<FeatureUsageByPlan> {
  const featureConfig = FEATURES[feature]

  // Get all active subscriptions with plan data
  const subscriptionQuery: any = { status: 'active' }
  if (dateRange) {
    subscriptionQuery.createdAt = { $lte: dateRange.to }
  }

  const subscriptions = await Subscription.find(subscriptionQuery).populate('plan')

  // Group shops by plan
  const planGroups: Record<string, { planName: string; shopDomains: string[] }> = {}

  for (const sub of subscriptions) {
    const plan = sub.plan as any
    if (!plan) continue

    const planId = plan._id.toString()
    const planName = plan.alias || plan.name

    if (!planGroups[planId]) {
      planGroups[planId] = { planName, shopDomains: [] }
    }
    planGroups[planId].shopDomains.push(sub.shopDomain)
  }

  // Calculate adoption rate for each plan
  const byPlan: FeatureUsageByPlan['byPlan'] = []
  let overallTotalShops = 0
  let overallUsersCount = 0

  for (const [planId, group] of Object.entries(planGroups)) {
    const shopCount = group.shopDomains.length
    overallTotalShops += shopCount

    // Query shops in this plan that used the feature
    const usageQuery: any = {
      shopDomain: { $in: group.shopDomains },
      uninstalledAt: { $exists: false },
    }

    // Boolean features
    if (feature === 'aiAssistant' || feature === 'generativeAI') {
      usageQuery[featureConfig.usageField] = true
      const usersCount = await Shop.countDocuments(usageQuery)
      overallUsersCount += usersCount

      byPlan.push({
        planName: group.planName,
        planId,
        shopCount,
        usersCount,
        adoptionRate: shopCount > 0 ? Math.round((usersCount / shopCount) * 1000) / 10 : 0,
        averageUsagePerShop: 0,
      })
      continue
    }

    // Count-based features
    usageQuery[featureConfig.usageField] = { $gt: 0 }
    const usersCount = await Shop.countDocuments(usageQuery)
    overallUsersCount += usersCount

    // Calculate average usage
    const shopsWithUsage = await Shop.find(usageQuery).select(featureConfig.usageField)
    let totalUsage = 0
    for (const shop of shopsWithUsage) {
      const usage = getNestedValue(shop, featureConfig.usageField)
      totalUsage += usage || 0
    }
    const averageUsagePerShop = usersCount > 0 ? totalUsage / usersCount : 0

    byPlan.push({
      planName: group.planName,
      planId,
      shopCount,
      usersCount,
      adoptionRate: shopCount > 0 ? Math.round((usersCount / shopCount) * 1000) / 10 : 0,
      averageUsagePerShop: Math.round(averageUsagePerShop * 10) / 10,
    })
  }

  return {
    feature,
    featureName: featureConfig.name,
    byPlan,
    overall: {
      totalShops: overallTotalShops,
      usersCount: overallUsersCount,
      adoptionRate: overallTotalShops > 0 ? Math.round((overallUsersCount / overallTotalShops) * 1000) / 10 : 0,
    },
  }
}

/**
 * Get feature retention metrics
 *
 * Measures how "sticky" a feature is by tracking repeat usage
 *
 * @param feature - Feature key to analyze
 * @param months - Number of months to analyze (default: 6)
 * @returns Retention metrics with cohort analysis
 */
export async function getFeatureRetention(feature: FeatureKey, months: number = 6): Promise<FeatureRetention> {
  const featureConfig = FEATURES[feature]

  // For boolean features, we can't calculate retention (one-time flag)
  if (feature === 'aiAssistant' || feature === 'generativeAI') {
    const totalUsers = await Shop.countDocuments({
      [featureConfig.usageField]: true,
      uninstalledAt: { $exists: false },
    })

    return {
      feature,
      featureName: featureConfig.name,
      cohorts: [],
      overall: {
        totalUsers,
        activeLastMonth: totalUsers, // All are "active" since it's a boolean
        activeRetentionRate: 100,
        averageDaysBetweenUse: 0, // N/A
      },
    }
  }

  // For count-based features, analyze cohorts
  const cohorts: FeatureRetention['cohorts'] = []
  const now = new Date()

  // We can't easily track "first time" per month without additional timestamps
  // So we'll use a simplified approach: shops with usage > 0

  // Calculate active last month
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const shopsWithUsage = await Shop.find({
    [featureConfig.usageField]: { $gt: 0 },
    'usages.featureUsage.lastFeatureUsedAt': { $gte: thirtyDaysAgo },
    uninstalledAt: { $exists: false },
  })

  const totalUsers = await Shop.countDocuments({
    [featureConfig.usageField]: { $gt: 0 },
    uninstalledAt: { $exists: false },
  })

  const activeLastMonth = shopsWithUsage.length
  const activeRetentionRate = totalUsers > 0 ? (activeLastMonth / totalUsers) * 100 : 0

  // Calculate average days between use (estimate based on usage count)
  // This is a rough estimate: assume usage is spread evenly
  let totalDaysBetweenUse = 0
  let countWithMultipleUses = 0

  for (const shop of shopsWithUsage) {
    const usage = getNestedValue(shop, featureConfig.usageField) || 0
    const firstUsed = shop.usages?.featureUsage?.firstFeatureUsedAt
    const lastUsed = shop.usages?.featureUsage?.lastFeatureUsedAt

    if (usage > 1 && firstUsed && lastUsed) {
      const daysBetween = (new Date(lastUsed).getTime() - new Date(firstUsed).getTime()) / (1000 * 60 * 60 * 24)
      const avgDays = daysBetween / (usage - 1)
      totalDaysBetweenUse += avgDays
      countWithMultipleUses++
    }
  }

  const averageDaysBetweenUse = countWithMultipleUses > 0 ? totalDaysBetweenUse / countWithMultipleUses : 0

  return {
    feature,
    featureName: featureConfig.name,
    cohorts, // Empty for now - would need additional tracking
    overall: {
      totalUsers,
      activeLastMonth,
      activeRetentionRate: Math.round(activeRetentionRate * 10) / 10,
      averageDaysBetweenUse: Math.round(averageDaysBetweenUse),
    },
  }
}

/**
 * Get all feature adoption rates summary
 *
 * Returns adoption rate for all features
 *
 * @param dateRange - Optional date range filter
 * @returns Array of adoption rates for all features
 */
export async function getAllFeaturesAdoptionRates(dateRange?: DateRange): Promise<FeatureAdoptionRate[]> {
  const results: FeatureAdoptionRate[] = []

  for (const featureKey of Object.keys(FEATURES) as FeatureKey[]) {
    const result = await getFeatureAdoptionRate(featureKey, dateRange)
    results.push(result)
  }

  // Sort by adoption rate (descending)
  results.sort((a, b) => b.adoptionRate - a.adoptionRate)

  return results
}

/**
 * Helper function to get nested object value by dot notation path
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}
