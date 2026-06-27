import type { WizardStep } from '~/types/wizard'

/** Maximum number of wizard steps allowed */
export const MAX_WIZARD_STEPS = 10

/** Generates a unique step ID */
export function generateStepId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Creates an empty step with sensible defaults */
export function createEmptyStep(label?: string): WizardStep {
  return {
    id: generateStepId(),
    label: label ?? '',
    items: [],
  }
}
