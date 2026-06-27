/**
 * Feature flag for the new product onboarding flow.
 *
 * When true: New shops see category selection → product picker → editor → pricing modal.
 * When false: Existing behavior (redirect to /pricing first).
 */
export const ACTIVE_PRODUCT_ONBOARDING_FLAG = true

/**
 * A/B test flag for simplified onboarding.
 *
 * When true, new merchants are randomly assigned to:
 *   - 'control': Current category-first onboarding flow
 *   - 'treatment': New 5-step simplified wizard modal
 *
 * When false, all merchants see the control (current flow).
 */
export const SIMPLIFIED_ONBOARDING_AB_TEST_FLAG = true
