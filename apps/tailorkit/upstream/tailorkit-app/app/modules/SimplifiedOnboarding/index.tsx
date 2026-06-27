/**
 * Simplified Product Publish Onboarding module.
 * Self-contained, plug-and-play module for the 5-step onboarding wizard.
 *
 * Usage:
 *   import { SimplifiedOnboardingWizard } from '~/modules/SimplifiedOnboarding'
 *   <SimplifiedOnboardingWizard active={true} appConfig={appConfig} onComplete={fn} onSkip={fn} />
 */

export { WizardInPage as SimplifiedOnboardingWizard } from './WizardInPage'
export { WizardInPage as SimplifiedOnboardingInPage } from './WizardInPage'
export { WizardContent } from './WizardContent'
export type { WizardContentProps } from './WizardContent'
export type { SimplifiedOnboardingWizardProps } from './types'
