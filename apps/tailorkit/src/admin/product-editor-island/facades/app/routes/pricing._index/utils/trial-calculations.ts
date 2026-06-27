export interface TrialInfo {
  hasUsedTrial?: boolean
  trialStartedAt?: string | Date | null
  trialEndsAt?: string | Date | null
}

export function calculateRemainingTrialDays(_trialInfo: TrialInfo, maxTrialDays: number) {
  return Math.max(maxTrialDays, 0)
}

export const trialCalculationAdapterMarker = 'app-platform-pruned-route-ui-adapter'
