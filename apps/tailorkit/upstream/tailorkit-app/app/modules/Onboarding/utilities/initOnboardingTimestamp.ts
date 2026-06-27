import { localStorage } from 'extensions/tailorkit-src/src/assets/utils/localStorage'

/**
 * Initialize onboarding start timestamp if user hasn't completed onboarding yet
 * This ensures COMPLETE_ONBOARDING event can be tracked even when onboarding screen is disabled
 * @param occurredEvents - User's occurred events from app config
 * @returns true if timestamp was initialized, false otherwise
 */
export function initOnboardingTimestamp(occurredEvents?: Record<string, any>): boolean {
  // Check if user has already completed onboarding
  const completedOnboarding = occurredEvents?.completed_onboarding
  if (completedOnboarding) {
    return false
  }

  // Check if timestamp already exists
  const existingTimestamp = localStorage.getItem('TLK_ONBOARDING_START_AT')
  if (existingTimestamp) {
    return false
  }

  // Initialize timestamp since:
  // 1. User hasn't completed onboarding (checked above)
  // 2. Timestamp doesn't exist (checked above)
  localStorage.setItem('TLK_ONBOARDING_START_AT', Date.now().toString())
  return true
}
