/** Action discriminator for the onboarding flow router endpoint. */
export const ONBOARDING_FLOW_ROUTER_ACTIONS = {
  /** Mark the install intent page as shown (called by the page loader on first render). */
  MARK_INTENT_PAGE_SHOWN: 'MARK_INTENT_PAGE_SHOWN',
  /** Persist the merchant's flow pick from the install intent page. */
  RECORD_INTENT_SELECTION: 'RECORD_INTENT_SELECTION',
  /** Flip demoClickedFirst = true. */
  RECORD_DEMO_CLICKED: 'RECORD_DEMO_CLICKED',
  /** Update the per-shop create-flow dropdown default. */
  SET_LAST_CREATE_FLOW: 'SET_LAST_CREATE_FLOW',
} as const

export type OnboardingFlowRouterAction =
  (typeof ONBOARDING_FLOW_ROUTER_ACTIONS)[keyof typeof ONBOARDING_FLOW_ROUTER_ACTIONS]

export const CREATE_FLOWS = ['quick_setup', 'full_editor', 'charm_builder'] as const
