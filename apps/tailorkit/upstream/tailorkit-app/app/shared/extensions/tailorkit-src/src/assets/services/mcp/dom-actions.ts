import { DOMScanner } from './dom-scanner'

export class DOMActions {
  private scanner = new DOMScanner()

  // Click a single option
  async clickOption(selector: string): Promise<boolean> {
    console.log(`🖱️ Clicking: ${selector}`)

    try {
      const element = this.scanner.findElement(selector)

      if (!element) {
        throw new Error(`Element not found: ${selector}`)
      }

      // Scroll into view
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      await this.wait(200)

      // Perform click with events
      this.performClick(element)

      console.log(`✅ Clicked: ${selector}`)
      return true
    } catch (error) {
      console.error(`❌ Click failed: ${selector}`, error)
      return false
    }
  }

  // Select multiple options
  async selectMultipleOptions(selectors: string[]): Promise<boolean> {
    console.log(`🖱️ Selecting multiple:`, selectors)

    let successCount = 0

    for (const selector of selectors) {
      const success = await this.clickOption(selector)
      if (success) successCount++

      await this.wait(150) // Delay between clicks
    }

    const allSuccessful = successCount === selectors.length
    console.log(`✅ Selected ${successCount}/${selectors.length} options`)

    return allSuccessful
  }

  // Navigate to step/section
  async navigateToStep(step: string): Promise<boolean> {
    console.log(`🧭 Navigating to: ${step}`)

    try {
      const stepSelectors = [
        `[data-step="${step}"]`,
        `[data-category="${step}"]`,
        `.step-${step}`,
        `button[data-target="${step}"]`,
      ]

      for (const selector of stepSelectors) {
        const element = document.querySelector(selector) as HTMLElement
        if (element) {
          this.performClick(element)
          await this.wait(300)
          console.log(`✅ Navigated to: ${step}`)
          return true
        }
      }

      // Try text-based navigation
      const buttons = document.querySelectorAll('button, [role="tab"], .tab')
      for (const button of buttons) {
        if (button.textContent?.toLowerCase().includes(step.toLowerCase())) {
          this.performClick(button as HTMLElement)
          await this.wait(300)
          console.log(`✅ Navigated via text: ${step}`)
          return true
        }
      }

      throw new Error(`Step not found: ${step}`)
    } catch (error) {
      console.error(`❌ Navigation failed: ${step}`, error)
      return false
    }
  }

  // Reset selections
  async resetSelections(category?: string): Promise<boolean> {
    console.log(`🔄 Resetting${category ? ` ${category}` : ' all'}`)

    try {
      const resetSelectors = category
        ? [`[data-reset="${category}"]`, `.reset-${category}`]
        : ['[data-reset="all"]', '.reset-all', '[data-action="reset"]']

      for (const selector of resetSelectors) {
        const element = document.querySelector(selector) as HTMLElement
        if (element) {
          this.performClick(element)
          await this.wait(200)
          console.log(`✅ Reset successful`)
          return true
        }
      }

      // Fallback: uncheck selected items
      return this.uncheckSelected()
    } catch (error) {
      console.error(`❌ Reset failed`, error)
      return false
    }
  }

  // Private methods
  private performClick(element: HTMLElement): void {
    // Multiple event types for compatibility
    const events = ['mousedown', 'mouseup', 'click']

    events.forEach(eventType => {
      const event = new MouseEvent(eventType, {
        bubbles: true,
        cancelable: true,
        view: window,
      })
      element.dispatchEvent(event)
    })

    // Handle form inputs
    if (element.tagName === 'INPUT') {
      const input = element as HTMLInputElement
      if (input.type === 'radio' || input.type === 'checkbox') {
        input.checked = true
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }

    // Trigger additional events
    element.dispatchEvent(new Event('change', { bubbles: true }))
    element.dispatchEvent(new Event('input', { bubbles: true }))

    // Visual feedback
    element.classList.add('ai-clicked')
    setTimeout(() => element.classList.remove('ai-clicked'), 1000)
  }

  private async uncheckSelected(): Promise<boolean> {
    const selected = document.querySelectorAll('.selected, [aria-selected="true"], input:checked')

    if (selected.length === 0) {
      return false
    }

    selected.forEach(el => {
      if (el instanceof HTMLElement) {
        el.classList.remove('selected')
        el.removeAttribute('aria-selected')
      }
      if (el instanceof HTMLInputElement) {
        el.checked = false
        el.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })

    console.log(`✅ Unchecked ${selected.length} items`)
    return true
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
