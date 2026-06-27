const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface TrialInfo {
  hasUsedTrial: boolean
  trialStartDate?: string
  installDate?: string
}

/**
 * Calculate remaining trial days from trial info and plan trial periods.
 * Handles both active-trial (from trialStartDate) and pre-trial (from installDate) cases.
 * Returns null if no trial info is available.
 */
export function calculateRemainingTrialDays(
  trialInfo: TrialInfo | undefined | null,
  maxTrialDays: number
): number | null {
  if (!trialInfo) return null

  // Already started trial — compute from trial start date
  if (trialInfo.hasUsedTrial && trialInfo.trialStartDate) {
    const elapsedDays = Math.floor((Date.now() - new Date(trialInfo.trialStartDate).getTime()) / MS_PER_DAY)
    return Math.max(0, maxTrialDays - elapsedDays)
  }

  // Pre-trial — compute dynamic days from install date
  if (trialInfo.installDate) {
    const daysSinceInstall = Math.floor((Date.now() - new Date(trialInfo.installDate).getTime()) / MS_PER_DAY)
    return Math.max(0, maxTrialDays - daysSinceInstall)
  }

  return null
}
