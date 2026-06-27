/**
 * Onboarding step definitions
 */
export const ONBOARDING_STEPS = [
  { key: 'shareKnowledge', title: 'Learn about upselling' },
  { key: 'basicSetup', title: 'Create your first add-on' },
  { key: 'enableThemeHelper', title: 'Enable theme helper' },
] as const

export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number]['key']

/**
 * Action types for onboarding
 */
export const ONBOARDING_ACTIONS = {
  SAVE_PROGRESS: 'SAVE_PROGRESS',
  CREATE_CHECKBOX: 'CREATE_CHECKBOX',
  COMPLETE_ONBOARDING: 'COMPLETE_ONBOARDING',
  SKIP_STEP: 'SKIP_STEP',
  REFRESH_THEME_CONFIG: 'REFRESH_THEME_CONFIG',
} as const

/**
 * Step order for navigation
 */
export const STEP_ORDER: OnboardingStepKey[] = ['shareKnowledge', 'basicSetup', 'enableThemeHelper']

/**
 * Get next step from current step
 */
export function getNextStep(currentStep: OnboardingStepKey): OnboardingStepKey | null {
  const currentIndex = STEP_ORDER.indexOf(currentStep)
  if (currentIndex === -1 || currentIndex >= STEP_ORDER.length - 1) {
    return null
  }
  return STEP_ORDER[currentIndex + 1]
}

/**
 * Get previous step from current step
 */
export function getPreviousStep(currentStep: OnboardingStepKey): OnboardingStepKey | null {
  const currentIndex = STEP_ORDER.indexOf(currentStep)
  if (currentIndex <= 0) {
    return null
  }
  return STEP_ORDER[currentIndex - 1]
}

/**
 * Get step index (1-based for display)
 */
export function getStepNumber(step: OnboardingStepKey): number {
  return STEP_ORDER.indexOf(step) + 1
}

/**
 * Check if step is the last step
 */
export function isLastStep(step: OnboardingStepKey): boolean {
  return STEP_ORDER.indexOf(step) === STEP_ORDER.length - 1
}

/**
 * Check if step is the first step
 */
export function isFirstStep(step: OnboardingStepKey): boolean {
  return STEP_ORDER.indexOf(step) === 0
}
