import { useContext } from 'react'
import { CheckboxOnboardingContext, type CheckboxOnboardingContextType } from '../providers/CheckboxOnboardingProvider'

/**
 * Hook to access checkbox onboarding context
 * Must be used within CheckboxOnboardingProvider
 */
export function useCheckboxOnboarding(): CheckboxOnboardingContextType {
  const context = useContext(CheckboxOnboardingContext)
  if (!context) {
    throw new Error('useCheckboxOnboarding must be used within CheckboxOnboardingProvider')
  }
  return context
}
