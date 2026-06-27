import { USER_JOURNEY_STEPS } from '../api.user-journey/constants'

export const LIMIT_RECENT_TEMPLATES = 5

export const TASKS_ONBOARDING_STEPS = {
  WELCOME: {
    id: 'welcome_and_indentify',
    titleKey: 'welcome-identity-title',
    descriptionKey: 'welcome-identity-description',
  },
  SPECIFICATIONS: {
    id: 'specifications',
    titleKey: 'specifications-title',
    descriptionKey: 'specifications-description',
  },
  ACHIEVE_FIRST_SALE: {
    id: 'achieve-first-sale',
    titleKey: 'achieve-first-sale-title',
    descriptionKey: 'achieve-first-sale-description',
  },
}

const USER_MILESTONE_STEP_PRIORITIES = Object.values(USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE).reduce(
  (acc: any, step: any, index: number) => {
    acc[step] = index
    return acc
  },
  {}
)

/**
 * Type-safe helper to get priority for a journey step
 * @throws {Error} If step is not found in priorities
 */
export const getJourneyStepPriority = (step: any): number => {
  const priority = USER_MILESTONE_STEP_PRIORITIES[step]
  if (priority === undefined) {
    throw new Error(`Invalid journey step: ${step}`)
  }
  return priority
}

/**
 * Sorts journey steps by their priority
 * @throws {Error} If any step is not found in priorities
 */
export const sortJourneyStepsByPriority = (steps: any[]): any[] => {
  return [...steps].sort((a, b) => getJourneyStepPriority(a) - getJourneyStepPriority(b))
}

export { USER_MILESTONE_STEP_PRIORITIES }
