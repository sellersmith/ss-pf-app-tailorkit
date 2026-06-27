/**
 * Barrel export for the TailorKit Wizard Web Component system.
 * Import `registerWizardComponents()` and call it to activate the wizard.
 * Phase 05 (tailorkit.ts) imports this file.
 */

export { TailorKitWizard, registerWizardComponents } from './wizard-controller'
export { WizardStore } from './wizard-store'
export type { WizardState } from './wizard-store'
export { validateStep, clearStepErrors } from './wizard-validators'
export type { ValidationResult, ValidationMode } from './wizard-validators'
