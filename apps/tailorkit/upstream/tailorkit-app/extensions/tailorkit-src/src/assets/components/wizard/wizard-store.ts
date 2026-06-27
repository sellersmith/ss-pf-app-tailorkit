/**
 * Wizard state management — pure in-memory, no localStorage persistence.
 * State resets on page navigation or refresh (buyers restart the wizard).
 */

export interface WizardState {
  currentStep: number
  completedSteps: Set<number>
  skippedSteps: Set<number>
  totalSteps: number
}

type Listener = (state: WizardState) => void

export class WizardStore {
  private state: WizardState
  private listeners: Set<Listener> = new Set()

  constructor(_productId: string, _variantId: string, totalSteps: number) {
    this.state = { currentStep: 0, completedSteps: new Set(), skippedSteps: new Set(), totalSteps }
  }

  private notify(): void {
    const snapshot: WizardState = {
      ...this.state,
      completedSteps: new Set(this.state.completedSteps),
      skippedSteps: new Set(this.state.skippedSteps),
    }
    this.listeners.forEach(fn => fn(snapshot))
  }

  subscribe(callback: Listener): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  getState(): WizardState {
    return {
      ...this.state,
      completedSteps: new Set(this.state.completedSteps),
      skippedSteps: new Set(this.state.skippedSteps),
    }
  }

  goToStep(index: number): void {
    if (index < 0 || index >= this.state.totalSteps) return
    this.state = { ...this.state, currentStep: index }
    this.notify()
  }

  completeStep(index: number): void {
    const completedSteps = new Set(this.state.completedSteps)
    completedSteps.add(index)
    const skippedSteps = new Set(this.state.skippedSteps)
    skippedSteps.delete(index)
    this.state = { ...this.state, completedSteps, skippedSteps }
    this.notify()
  }

  skipStep(index: number): void {
    const skippedSteps = new Set(this.state.skippedSteps)
    skippedSteps.add(index)
    const completedSteps = new Set(this.state.completedSteps)
    completedSteps.delete(index)
    this.state = { ...this.state, completedSteps, skippedSteps }
    this.notify()
  }

  /** Batch: complete current step + advance to next — single notify */
  completeAndAdvance(completedIndex: number, nextIndex: number): void {
    if (nextIndex < 0 || nextIndex >= this.state.totalSteps) return
    const completedSteps = new Set(this.state.completedSteps)
    completedSteps.add(completedIndex)
    const skippedSteps = new Set(this.state.skippedSteps)
    skippedSteps.delete(completedIndex)
    this.state = { ...this.state, currentStep: nextIndex, completedSteps, skippedSteps }
    this.notify()
  }

  /** Batch: skip current step + advance to next — single notify */
  skipAndAdvance(skippedIndex: number, nextIndex: number): void {
    if (nextIndex < 0 || nextIndex >= this.state.totalSteps) return
    const skippedSteps = new Set(this.state.skippedSteps)
    skippedSteps.add(skippedIndex)
    const completedSteps = new Set(this.state.completedSteps)
    completedSteps.delete(skippedIndex)
    this.state = { ...this.state, currentStep: nextIndex, completedSteps, skippedSteps }
    this.notify()
  }

  resetFrom(fromIndex: number): void {
    const completedSteps = new Set([...this.state.completedSteps].filter(i => i < fromIndex))
    const skippedSteps = new Set([...this.state.skippedSteps].filter(i => i < fromIndex))
    this.state = { ...this.state, completedSteps, skippedSteps }
    this.notify()
  }

  reset(): void {
    this.state = {
      currentStep: 0,
      completedSteps: new Set(),
      skippedSteps: new Set(),
      totalSteps: this.state.totalSteps,
    }
    this.notify()
  }
}
