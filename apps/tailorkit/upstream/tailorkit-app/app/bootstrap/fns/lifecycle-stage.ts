/**
 * Lifecycle stage computation for feature adoption tracking.
 * Isomorphic — works on both client and server.
 */

export type LifecycleStage = 'new' | 'onboarding' | 'activated' | 'revenue_generating' | 'established'

/**
 * Compute the merchant's lifecycle stage from shop data.
 * Pure function, no DB queries.
 */
export function getLifecycleStage(
  createdAt: Date | string | null | undefined,
  firstIntegrationPublishedAt: Date | string | null | undefined,
  appGeneratedRevenue: number | null | undefined
): LifecycleStage {
  const revenue = appGeneratedRevenue || 0
  if (revenue > 0) return 'revenue_generating'

  if (firstIntegrationPublishedAt) return 'activated'

  const daysSinceInstall = getDaysSinceInstall(createdAt)
  if (daysSinceInstall <= 7) return 'new'
  if (daysSinceInstall <= 30) return 'onboarding'
  return 'established'
}

/**
 * Compute days since app installation.
 */
export function getDaysSinceInstall(createdAt: Date | string | null | undefined): number {
  if (!createdAt) return 0
  const installDate = typeof createdAt === 'string' ? new Date(createdAt) : createdAt
  if (isNaN(installDate.getTime())) return 0
  return Math.floor((Date.now() - installDate.getTime()) / (1000 * 60 * 60 * 24))
}
