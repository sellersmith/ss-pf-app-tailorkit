/**
 * <tailorkit-wizard> Web Component — step-by-step personalization.
 *
 * Architecture: PURE VISIBILITY TOGGLING — never moves DOM nodes.
 * Reads wizard config from `data-wizard-config` attribute.
 * On step change, hides ALL personalizable elements, then shows only
 * the ones belonging to the current step.
 */

import { h, render } from 'preact'
import { WizardStore } from './wizard-store'
import { WizardProgress } from './preact/WizardProgress'
import { WizardNavigation } from './preact/WizardNavigation'
import { validateStep, clearStepErrors } from './wizard-validators'
import { Transmitter } from '../../libraries/transmitter'
import type { WizardState } from './wizard-store'
import type { WizardProgressStep } from './preact/WizardProgress'

interface WizardStep {
  label: string
  elements: HTMLElement[]
}

interface WizardConfigData {
  enabled: boolean
  steps: Array<{
    id: string
    label: string
    items: Array<{ elementIndex: number; itemId?: string; label?: string }>
  }>
}

const HIDDEN_CLASS = 'emtlkit--wizard-step-hidden'
const WAIT_FOR_ELEMENTS_TIMEOUT_MS = 10_000

export class TailorKitWizard extends HTMLElement {
  private store: WizardStore | null = null
  private progressSlot: HTMLElement | null = null
  private navSlot: HTMLElement | null = null
  private steps: WizardStep[] = []
  private allElements: HTMLElement[] = []
  private stepConfigs: WizardProgressStep[] = []
  private containerObserver: MutationObserver | null = null
  private unsubscribeStore: (() => void) | null = null
  private boundLocationChange: (() => void) | null = null
  private waitTimeout: ReturnType<typeof setTimeout> | null = null

  // Stable callback refs (avoid Preact re-renders from new arrow fns)
  private readonly handleBack = () => this.back()
  private readonly handleNext = () => this.next()
  private readonly handleSkip = () => this.skip()
  private readonly handleJump = (i: number) => this.jump(i)

  connectedCallback(): void {
    const container = this.querySelector('.emtlkit--personalization-area-container')
    if (container) {
      this.initialize(container)
    } else {
      // React/framework renders children after connectedCallback — wait one frame
      requestAnimationFrame(() => {
        const c = this.querySelector('.emtlkit--personalization-area-container')
        if (c) this.initialize(c)
      })
    }
  }

  private initialize(container: Element): void {
    // Parse config
    let config: WizardConfigData | null = null
    try {
      config = JSON.parse(this.getAttribute('data-wizard-config') || '')
    } catch {
      /* auto-discover */
    }

    // Collect all personalizable elements
    this.allElements = this.collectElements(container)

    // Determine how many elements the config expects
    const requiredCount = this.getRequiredElementCount(config)

    if (this.allElements.length < requiredCount) {
      this.waitForElements(container, config, requiredCount)
      return
    }

    this.buildAndInit(container, config)
  }

  /** Shared step-building + init logic used by both initialize() and waitForElements() */
  private buildAndInit(container: Element, config: WizardConfigData | null): void {
    // If config is explicitly provided (wizard enabled) but has no steps, treat as empty — do not
    // fall back to auto-discovery. Auto-discovery is only for when no config exists at all (null).
    const hasExplicitConfig = config !== null
    if (hasExplicitConfig && !config.steps?.length) return

    this.steps = config?.steps?.length
      ? this.buildConfigSteps(config)
      : this.allElements.map(el => ({ label: this.extractLabel(el), elements: [el] }))
    if (this.steps.length === 0) return

    // Hide summaries, open details
    container.querySelectorAll('details > summary').forEach(s => {
      ;(s as HTMLElement).style.display = 'none'
    })
    container.querySelectorAll('details').forEach(d => {
      if (d instanceof HTMLDetailsElement) d.open = true
    })

    this.initWizard(container)
  }

  /** Compute the minimum element count the config needs (max elementIndex + 1) */
  private getRequiredElementCount(config: WizardConfigData | null): number {
    // Explicit config with no steps → nothing to wait for (buildAndInit returns early)
    if (config !== null && !config.steps?.length) return 0
    if (!config?.steps?.length) return 1 // auto-discover: need at least 1 element
    // When items carry itemId, use ID-based matching — don't block on element count
    // (conditional logic may hide some elements from the DOM)
    const hasItemIds = config.steps.some(s => s.items.some(i => i.itemId))
    if (hasItemIds) return 1
    let max = -1
    for (const step of config.steps) {
      for (const item of step.items) {
        if (item.elementIndex > max) max = item.elementIndex
      }
    }
    return max + 1
  }

  /** Watch container until enough elements appear, then initialize */
  private waitForElements(container: Element, config: WizardConfigData | null, requiredCount: number): void {
    const observer = new MutationObserver(() => {
      const elements = this.collectElements(container)
      if (elements.length >= requiredCount) {
        observer.disconnect()
        this.clearWaitTimeout()
        this.allElements = elements
        this.buildAndInit(container, config)
      }
    })
    observer.observe(container, { childList: true, subtree: true })
    // Store observer for cleanup
    this.containerObserver = observer

    // Timeout: disconnect observer after 10s to avoid running indefinitely
    this.waitTimeout = setTimeout(() => {
      observer.disconnect()
      this.containerObserver = null
    }, WAIT_FOR_ELEMENTS_TIMEOUT_MS)
  }

  private clearWaitTimeout(): void {
    if (this.waitTimeout) {
      clearTimeout(this.waitTimeout)
      this.waitTimeout = null
    }
  }

  disconnectedCallback(): void {
    this.cleanup()
  }

  private collectElements(container: Element): HTMLElement[] {
    // Storefront uses .emtlkit--option-set-wrapper, admin preview uses .emtlkit--option-set-container
    const wrappers = container.querySelectorAll<HTMLElement>('.emtlkit--option-set-wrapper')
    if (wrappers.length > 0) return Array.from(wrappers)
    const containers = container.querySelectorAll<HTMLElement>('.emtlkit--option-set-container')
    if (containers.length > 0) return Array.from(containers)
    return Array.from(container.querySelectorAll<HTMLElement>('fieldset.emtlkit--option-set'))
  }

  private buildConfigSteps(config: WizardConfigData): WizardStep[] {
    // Build ID→element map for ID-based matching (admin preview adds data-item-id)
    const idToElement = new Map<string, HTMLElement>()
    for (const el of this.allElements) {
      const itemId = el.getAttribute('data-item-id')
      if (itemId) idToElement.set(itemId, el)
    }
    const hasIdMapping = idToElement.size > 0

    return config.steps
      .map(configStep => {
        const elements = configStep.items
          .map(item => {
            // Prefer ID-based matching (handles conditional-logic hidden elements)
            if (hasIdMapping && item.itemId) return idToElement.get(item.itemId)
            // Fall back to positional index (storefront Liquid elements)
            return this.allElements[item.elementIndex]
          })
          .filter((el): el is HTMLElement => el !== null && el !== undefined)
        const unique = [...new Set(elements)]
        return unique.length > 0 ? { label: configStep.label || 'Step', elements: unique } : null
      })
      .filter((s): s is WizardStep => s !== null)
  }

  private extractLabel(el: HTMLElement): string {
    const fieldset = el.querySelector('fieldset.emtlkit--option-set') || el
    for (const sel of ['legend', 'label', '.emtlkit--option-set-label', 'h3', 'h4']) {
      const found = fieldset.querySelector(sel)
      if (found?.textContent?.trim()) return found.textContent.trim()
    }
    return fieldset.getAttribute('data-label') || 'Step'
  }

  private initWizard(container: Element): void {
    const productId = this.getAttribute('data-product-id') || ''
    const variantId = this.getAttribute('data-variant-id') || ''
    this.store = new WizardStore(productId, variantId, this.steps.length)
    this.stepConfigs = this.steps.map(s => ({ label: s.label, optional: false }))

    // Create UI slots inside the container (not the wizard element)
    // so they appear within the personalization box in both storefront and admin
    this.progressSlot = document.createElement('div')
    this.progressSlot.className = 'emtlkit--wizard-progress-slot'
    container.insertBefore(this.progressSlot, container.firstChild)

    this.navSlot = document.createElement('div')
    this.navSlot.className = 'emtlkit--wizard-nav-slot'
    container.appendChild(this.navSlot)

    // Subscribe + events
    this.unsubscribeStore = this.store.subscribe(state => this.onStateChange(state))

    this.boundLocationChange = () => this.onLocationChange()
    document.addEventListener('locationchange', this.boundLocationChange)

    // Initial render
    const state = this.store.getState()
    this.showStep(state.currentStep)
    this.onStateChange(state)

    // Watch for async elements (charm builder)
    this.containerObserver = new MutationObserver(() => this.rescanDeferred(container))
    this.containerObserver.observe(container, { childList: true, subtree: true })
  }

  private rescanDeferred(container: Element): void {
    if (!this.store) return

    const currentElements = this.collectElements(container)
    let changed = false

    // Replace stale elements (React re-renders replace DOM nodes, e.g. charm picker
    // skeleton → loaded state). Detect by checking if managed element is still in DOM.
    // Positional matching is safe: React updates in-place, so the replacement node
    // appears at the same querySelectorAll index as the original.
    for (let i = 0; i < this.allElements.length; i++) {
      const el = this.allElements[i]
      if (!el.isConnected && i < currentElements.length && currentElements[i]) {
        this.allElements[i] = currentElements[i]
        changed = true
      }
    }

    // Add genuinely new elements (async renders that appear after init)
    const managed = new Set(this.allElements)
    for (const el of currentElements) {
      if (managed.has(el)) continue
      this.allElements.push(el)
      el.classList.add(HIDDEN_CLASS)
      changed = true
    }

    // Rebuild steps and re-show current step when elements changed
    if (changed) {
      const config = this.rebuildConfig()
      if (config) {
        this.steps = this.buildConfigSteps(config)
      } else {
        // Auto-discover mode: rebuild 1:1 from updated allElements
        this.steps = this.allElements.map(el => ({ label: this.extractLabel(el), elements: [el] }))
      }
      this.stepConfigs = this.steps.map(s => ({ label: s.label, optional: false }))
      const state = this.store.getState()
      this.showStep(state.currentStep)
    }
  }

  /** Re-parse wizard config from attribute for step rebuild after element replacement */
  private rebuildConfig(): WizardConfigData | null {
    try {
      return JSON.parse(this.getAttribute('data-wizard-config') || '')
    } catch {
      return null
    }
  }

  private showStep(index: number): void {
    for (const el of this.allElements) el.classList.add(HIDDEN_CLASS)
    const step = this.steps[index]
    if (step) for (const el of step.elements) el.classList.remove(HIDDEN_CLASS)
    // Scroll to the progress bar (not the whole wizard element) so the step content stays visible
    this.progressSlot?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  private onStateChange(state: WizardState): void {
    if (this.progressSlot) {
      render(
        h(WizardProgress, {
          steps: this.stepConfigs,
          currentStep: state.currentStep,
          completedSteps: state.completedSteps,
          skippedSteps: state.skippedSteps,
          totalSteps: state.totalSteps,
          allowFreeNavigation: false,
          onJump: this.handleJump,
        }),
        this.progressSlot
      )
    }
    if (this.navSlot) {
      render(
        h(WizardNavigation, {
          currentStep: state.currentStep,
          totalSteps: state.totalSteps,
          isOptional: false,
          onBack: this.handleBack,
          onSkip: this.handleSkip,
          onNext: this.handleNext,
        }),
        this.navSlot
      )
    }
    this.dispatchEvent(
      new CustomEvent('wizard-step-change', {
        detail: { stepIndex: state.currentStep, state },
        bubbles: true,
        composed: true,
      })
    )
  }

  /**
   * A step is "effectively empty" when every element in it is hidden by
   * conditional logic. Two hide mechanisms exist:
   *
   * 1. **Storefront**: `product-personalizer.toggleLayerOptions` sets
   *    `wrapper.style.display = 'none'` (inline). Element stays in DOM.
   *
   * 2. **Admin preview**: `useConditionalLogic` gates React rendering, so
   *    the element is removed from DOM entirely. The cached reference in
   *    `step.elements` becomes detached (`el.isConnected === false`).
   *
   * Both cases need to count as "hidden" for auto-skip to behave the same
   * across surfaces.
   */
  private isStepEffectivelyEmpty(stepIndex: number): boolean {
    const step = this.steps[stepIndex]
    if (!step || step.elements.length === 0) return true
    return step.elements.every(el => !el.isConnected || el.style.display === 'none')
  }

  /**
   * Finds the next non-empty step starting at `from`, walking in `direction`.
   * Returns -1 when no visible step exists in that direction.
   */
  private findVisibleStep(from: number, direction: 1 | -1): number {
    const total = this.steps.length
    let i = from
    while (i >= 0 && i < total) {
      if (!this.isStepEffectivelyEmpty(i)) return i
      i += direction
    }
    return -1
  }

  private next(): void {
    if (!this.store) return
    const { currentStep, totalSteps } = this.store.getState()
    const step = this.steps[currentStep]

    if (step) {
      for (const el of step.elements) {
        const fieldset = el.querySelector('fieldset.emtlkit--option-set') || el
        if (!validateStep(fieldset as HTMLElement, 'all_required').valid) {
          this.shakeNext()
          return
        }
      }
    }

    this.track('wizard_step_completed', { stepIndex: currentStep, stepLabel: step?.label })

    // Skip steps hidden by conditional logic (e.g. customer picked "Text only"
    // so the image-upload step has nothing visible — jump past it).
    // findVisibleStep returns -1 when nothing visible remains, including the
    // case where currentStep is the final step.
    const nextVisible = this.findVisibleStep(currentStep + 1, 1)

    if (nextVisible === -1) {
      this.store.completeStep(currentStep)
      this.track('wizard_completed', { totalSteps })
      this.dispatchEvent(new CustomEvent('wizard-done', { bubbles: true, composed: true }))
      return
    }

    this.store.completeAndAdvance(currentStep, nextVisible)
    this.showStep(nextVisible)
  }

  private back(): void {
    if (!this.store) return
    const { currentStep } = this.store.getState()
    if (currentStep === 0) return

    for (const el of this.steps[currentStep]?.elements || []) {
      clearStepErrors((el.querySelector('fieldset.emtlkit--option-set') || el) as HTMLElement)
    }

    // Walk backward past steps that conditional logic has emptied
    const prevVisible = this.findVisibleStep(currentStep - 1, -1)
    if (prevVisible === -1) return

    this.store.goToStep(prevVisible)
    this.showStep(prevVisible)
  }

  private skip(): void {
    if (!this.store) return
    const { currentStep, totalSteps } = this.store.getState()
    if (currentStep >= totalSteps - 1) return

    this.track('wizard_step_skipped', { stepIndex: currentStep })
    this.store.skipAndAdvance(currentStep, currentStep + 1)
    this.showStep(currentStep + 1)
  }

  private jump(stepIndex: number): void {
    if (!this.store) return
    if (!this.store.getState().completedSteps.has(stepIndex)) return

    this.store.resetFrom(stepIndex + 1)
    this.store.goToStep(stepIndex)
    this.showStep(stepIndex)
  }

  private shakeNext(): void {
    const btn = this.navSlot?.querySelector('.emtlkit-button--primary') as HTMLElement | null
    if (!btn) return
    const cls = 'emtlkit--wizard-btn-next--shake'
    btn.classList.remove(cls)
    void btn.offsetWidth
    btn.classList.add(cls)
    setTimeout(() => btn.classList.remove(cls), 500)
  }

  private onLocationChange(): void {
    this.store?.reset()
    const state = this.store?.getState()
    if (!state) return
    this.showStep(0)
    this.onStateChange(state)
  }

  private track(event: string, props: Record<string, unknown>): void {
    try {
      Transmitter.trigger('tailorkit-storefront-usage', { feature: 'WIZARD', event, ...props })
    } catch {
      /* silent */
    }
  }

  private cleanup(): void {
    this.unsubscribeStore?.()
    if (this.boundLocationChange) {
      document.removeEventListener('locationchange', this.boundLocationChange)
      this.boundLocationChange = null
    }
    this.containerObserver?.disconnect()
    this.containerObserver = null
    this.clearWaitTimeout()

    if (this.progressSlot) {
      render(null, this.progressSlot)
      this.progressSlot = null
    }
    if (this.navSlot) {
      render(null, this.navSlot)
      this.navSlot = null
    }

    for (const el of this.allElements) el.classList.remove(HIDDEN_CLASS)

    const container = this.querySelector('.emtlkit--personalization-area-container')
    container?.querySelectorAll(`.${HIDDEN_CLASS}[data-layer-id]`).forEach(el => el.classList.remove(HIDDEN_CLASS))
    container?.querySelectorAll('details > summary').forEach(s => {
      ;(s as HTMLElement).style.display = ''
    })

    this.store = null
    this.steps = []
    this.allElements = []
  }
}

export function registerWizardComponents(): void {
  if (!customElements.get('tailorkit-wizard')) {
    customElements.define('tailorkit-wizard', TailorKitWizard)
  }
}

// Auto-register when module is imported (same pattern as registerOptionSetElements)
registerWizardComponents()
