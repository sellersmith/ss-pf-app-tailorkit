import type { PTEBadge } from '~/api/services/achievements'

/**
 * Find the highest unlocked badge from a badges array
 * Returns the badge with the highest threshold that is unlocked
 * Returns null if no badges are unlocked
 */
export function getHighestUnlockedBadge(badges: PTEBadge[] | null | undefined): PTEBadge | null {
  if (!badges || badges.length === 0) return null

  const unlockedBadges = badges.filter(badge => badge.unlocked)
  if (unlockedBadges.length === 0) return null

  // Sort by threshold descending to find the highest unlocked one
  return unlockedBadges.sort((a, b) => b.threshold - a.threshold)[0]
}

/**
 * Calculate the total products target from badges array
 * Returns the highest threshold value from all badges
 * Returns 0 if no badges exist
 */
export function getTotalProductsTarget(badges: PTEBadge[] | null | undefined): number {
  if (!badges || badges.length === 0) return 0

  return Math.max(...badges.map(badge => badge.threshold))
}

/**
 * Get badge tone based on badge id
 * Maps badge ids to Polaris Badge tone values
 */
export function getBadgeTone(badgeId: string): 'info' | 'warning' | 'success' {
  const normalizedId = badgeId.toLowerCase()

  if (normalizedId === 'creator') {
    return 'info'
  }
  if (normalizedId === 'artisan') {
    return 'warning'
  }
  if (normalizedId === 'master') {
    return 'success'
  }

  // Default to info if badge id doesn't match
  return 'info'
}
