/**
 * Wizard navigation: Back / Skip / Next buttons.
 * Uses the existing TailorKit Button component for consistent styling.
 * Dispatches `wizard-navigate` custom events consumed by the controller.
 */

import type { WizardState } from './wizard-store'
import Button from '../commons/button'

export interface WzStepNavConfig {
  optional?: boolean
}

export type WizardNavigateAction = 'back' | 'next' | 'skip'

export class WizardNavigation {
  private container: HTMLElement
  private backBtn: Button
  private skipBtn: Button
  private nextBtn: Button

  constructor(container: HTMLElement) {
    this.container = container
    this.container.className = 'emtlkit--wizard-nav'

    this.backBtn = new Button({
      children: 'Back',
      variant: 'outline',
      onClick: () => this.dispatch('back'),
    })

    this.skipBtn = new Button({
      children: 'Skip',
      variant: 'plain',
      onClick: () => this.dispatch('skip'),
    })

    this.nextBtn = new Button({
      children: 'Next',
      variant: 'primary',
      onClick: () => this.dispatch('next'),
    })

    this.backBtn.appendTo(container)
    this.skipBtn.appendTo(container)

    // Spacer pushes Next button to the right
    const spacer = document.createElement('div')
    spacer.style.flex = '1'
    container.appendChild(spacer)

    this.nextBtn.appendTo(container)
  }

  private dispatch(action: WizardNavigateAction): void {
    this.container.dispatchEvent(
      new CustomEvent('wizard-navigate', {
        detail: { action },
        bubbles: true,
        composed: true,
      })
    )
  }

  /**
   * Re-render button states based on wizard state and current step config.
   */
  update(state: WizardState, stepConfig: WzStepNavConfig | null, isLastStep: boolean, reviewEnabled: boolean): void {
    const { currentStep } = state

    // Back button: disabled on first step
    this.backBtn.setDisabled(currentStep === 0)

    // Skip button: only visible for optional steps
    const isOptional = stepConfig?.optional === true
    const skipEl = this.skipBtn.getElement()
    if (skipEl) skipEl.hidden = !isOptional

    // Next button label
    const nextEl = this.nextBtn.getElement()
    if (nextEl) {
      if (isLastStep && reviewEnabled) {
        nextEl.textContent = 'Review'
      } else if (isLastStep) {
        nextEl.textContent = 'Done'
      } else {
        nextEl.textContent = 'Next'
      }
    }
  }

  /** Visually indicate validation failure (shake the next button). */
  shakeNext(): void {
    const nextEl = this.nextBtn.getElement()
    if (!nextEl) return
    const SHAKE_CLASS = 'emtlkit--wizard-btn-next--shake'
    nextEl.classList.remove(SHAKE_CLASS)
    void nextEl.offsetWidth // reflow
    nextEl.classList.add(SHAKE_CLASS)
    setTimeout(() => nextEl.classList.remove(SHAKE_CLASS), 500)
  }

  /** Enable or disable the Next button. */
  setNextEnabled(enabled: boolean): void {
    this.nextBtn.setDisabled(!enabled)
  }
}
