/**
 * Wizard progress bar / stepper UI sub-component.
 * Renders a horizontal stepper on desktop and "Step X of Y" + thin bar on mobile.
 * Does NOT use Shadow DOM — renders into its host slot element directly.
 */

import type { WizardState } from './wizard-store'

export interface WzStepConfig {
  label: string
  optional?: boolean
}

const BASE = 'emtlkit--wizard'

export class WizardProgress {
  private container: HTMLElement
  private steps: WzStepConfig[]
  private allowFreeNavigation: boolean

  constructor(container: HTMLElement, steps: WzStepConfig[], allowFreeNavigation = false) {
    this.container = container
    this.steps = steps
    this.allowFreeNavigation = allowFreeNavigation
    this.container.className = `${BASE}-progress-slot`
  }

  /** Re-render progress to match state. */
  update(state: WizardState): void {
    const { currentStep, completedSteps, skippedSteps, totalSteps } = state
    this.container.innerHTML = ''

    // Mobile view: simple text + bar
    const mobileEl = document.createElement('div')
    mobileEl.className = `${BASE}-progress-mobile`

    const mobileText = document.createElement('span')
    mobileText.className = `${BASE}-progress-mobile-text`
    mobileText.textContent = `Step ${currentStep + 1} of ${totalSteps}`
    mobileEl.appendChild(mobileText)

    const mobileBar = document.createElement('div')
    mobileBar.className = `${BASE}-progress-mobile-bar`
    const mobileBarFill = document.createElement('div')
    mobileBarFill.className = `${BASE}-progress-mobile-bar-fill`
    const pct = totalSteps > 0 ? Math.round(((currentStep + 1) / totalSteps) * 100) : 0
    mobileBarFill.style.width = `${pct}%`
    mobileBar.appendChild(mobileBarFill)
    mobileEl.appendChild(mobileBar)
    this.container.appendChild(mobileEl)

    // Desktop stepper
    const desktopEl = document.createElement('div')
    desktopEl.className = `${BASE}-progress-desktop`

    this.steps.forEach((step, index) => {
      const stepEl = this.createStepEl(step, index, currentStep, completedSteps, skippedSteps)
      desktopEl.appendChild(stepEl)

      // Add connector between steps (not after last)
      if (index < this.steps.length - 1) {
        const connector = document.createElement('div')
        const isConnectorFilled = completedSteps.has(index) || skippedSteps.has(index)
        connector.className = `${BASE}-step-connector${isConnectorFilled ? ` ${BASE}-step-connector--filled` : ''}`
        desktopEl.appendChild(connector)
      }
    })

    this.container.appendChild(desktopEl)
  }

  private createStepEl(
    step: WzStepConfig,
    index: number,
    currentStep: number,
    completedSteps: Set<number>,
    skippedSteps: Set<number>
  ): HTMLElement {
    const isActive = index === currentStep
    const isCompleted = completedSteps.has(index)
    const isSkipped = skippedSteps.has(index)

    let stateClass = `${BASE}-step--upcoming`
    if (isActive) stateClass = `${BASE}-step--active`
    else if (isCompleted) stateClass = `${BASE}-step--completed`
    else if (isSkipped) stateClass = `${BASE}-step--skipped`

    const stepEl = document.createElement('div')
    stepEl.className = `${BASE}-step ${stateClass}`
    stepEl.setAttribute('data-step', String(index))
    stepEl.setAttribute('aria-current', isActive ? 'step' : 'false')

    const circle = document.createElement('span')
    circle.className = `${BASE}-step-number`

    if (isCompleted) {
      circle.innerHTML = '&#10003;' // checkmark
      circle.setAttribute('aria-label', 'Completed')
    } else if (isSkipped) {
      circle.innerHTML = '&#8722;' // dash
      circle.setAttribute('aria-label', 'Skipped')
    } else {
      circle.textContent = String(index + 1)
    }

    const label = document.createElement('span')
    label.className = `${BASE}-step-label`
    label.textContent = step.label
    if (step.optional) {
      const optional = document.createElement('small')
      optional.className = `${BASE}-step-optional`
      optional.textContent = ' (Optional)'
      label.appendChild(optional)
    }

    stepEl.appendChild(circle)
    stepEl.appendChild(label)

    // Enable click-to-jump only for completed steps when freeNavigation is on
    if (this.allowFreeNavigation && isCompleted) {
      stepEl.classList.add(`${BASE}-step--clickable`)
      stepEl.setAttribute('role', 'button')
      stepEl.setAttribute('tabindex', '0')
      stepEl.addEventListener('click', () => {
        stepEl.dispatchEvent(
          new CustomEvent('wizard-jump', {
            detail: { stepIndex: index },
            bubbles: true,
            composed: true,
          })
        )
      })
      stepEl.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          stepEl.click()
        }
      })
    }

    return stepEl
  }
}
