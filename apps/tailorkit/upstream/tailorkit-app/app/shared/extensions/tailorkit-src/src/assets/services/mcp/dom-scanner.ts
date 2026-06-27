// DOM Scanner - Element Detection and Management
// File: dom-scanner.ts

export interface DOMElement {
  selector: string
  tagName: string
  attributes: Record<string, string>
  textContent: string
  isVisible: boolean
}

export class DOMScanner {
  private readonly productPersonalizerSelector = 'tailorkit-product-personalizer'
  // Core selectors for TailorKit
  private readonly baseSelectors = [
    // 'tailorkit-product-personalizer [data-option]',
    // 'tailorkit-option-set [data-value]',
    // '[data-tailorkit-option]',
    // '.tailorkit-option',
    // '.option',
    // 'button[data-value]',
    // 'input[type="radio"]',
    // 'input[type="checkbox"]',
    // 'tailorkit-product-personalizer',
    `${this.productPersonalizerSelector} .emtlkit--option-set-wrapper fieldset`,
  ]

  // Get available options
  scanAvailableOptions(category?: string): DOMElement[] {
    let selectors = [...this.baseSelectors]

    if (category) {
      const categorySelectors = [
        `tailorkit-option-set-${category} [value]`,
        `[data-category="${category}"]`,
        `.${category}-option`,
      ]
      selectors = [...categorySelectors, ...selectors]
    }

    return this.scanElements(selectors)
  }

  // Get selected options
  scanSelectedOptions(): DOMElement[] {
    const selectedSelectors = [
      '.selected',
      '.active',
      '[aria-selected="true"]',
      '[data-selected="true"]',
      'input:checked',
    ]

    return this.scanElements(selectedSelectors)
  }

  // Find element by various strategies
  findElement(selector: string): HTMLElement | null {
    const strategies = [
      () => document.querySelector(selector) as HTMLElement,
      () => document.querySelector(`[value="${selector}"]`) as HTMLElement,
      () => this.findByText(selector),
      () => document.querySelector(`[aria-label*="${selector}"]`) as HTMLElement,
    ]

    for (const strategy of strategies) {
      try {
        const element = strategy()
        if (element) return element
      } catch (error) {
        // Continue to next strategy
      }
    }

    return null
  }

  // Search elements by query
  searchElements(query: string): DOMElement[] {
    const allElements = this.scanAvailableOptions()
    const searchTerms = query.toLowerCase().split(' ')

    return allElements.filter(element => {
      const searchText = `${element.textContent} ${Object.values(element.attributes).join(' ')}`.toLowerCase()

      return searchTerms.some(term => searchText.includes(term))
    })
  }

  // Get current step/section
  getCurrentStep(): string {
    const stepSelectors = ['.step.active', '.tab.active', '[role="tab"][aria-selected="true"]']

    for (const selector of stepSelectors) {
      const element = document.querySelector(selector)
      if (element) {
        return element.getAttribute('data-step') || element.textContent?.trim() || 'unknown'
      }
    }

    return 'initial'
  }

  // Private methods
  private scanElements(selectors: string[]): DOMElement[] {
    const elements: DOMElement[] = []
    const seen = new Set<string>()

    for (const selector of selectors) {
      try {
        const domElements = document.querySelectorAll(selector)

        // Clone the domElements to ensure we don't mutate the original DOM
        const clonedElements = Array.from(domElements)

        clonedElements.forEach((el, index) => {
          if (el instanceof HTMLElement) {
            // Check if element is within a hidden option-set-wrapper
            if (this.isElementInHiddenOptionSetWrapper(el)) {
              return // Skip this element
            }

            // Remove all display: none elements
            this.removeAllDisplayNoneElements(el)

            const key = this.getElementKey(el)
            if (!seen.has(key)) {
              seen.add(key)
              elements.push(this.elementToMCPElement(el, `${selector}:nth(${index})`))
            }
          }
        })
      } catch (error) {
        // Skip invalid selectors
      }
    }

    return elements
  }

  private findByText(text: string): HTMLElement | null {
    const allOptions = document.querySelectorAll('[value], .option, .choice')

    return (
      (Array.from(allOptions).find(el => el.textContent?.toLowerCase().includes(text.toLowerCase())) as HTMLElement)
      || null
    )
  }

  private elementToMCPElement(element: HTMLElement, selector: string): DOMElement {
    const attributes: Record<string, string> = {}

    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i]
      attributes[attr.name] = attr.value
    }

    const textContent = this.minifyHTML(
      this.removeUnnecessaryTags(
        this.removeUnnecessaryAttributes(
          this.removeUnnecessaryDataAttributes(element.innerHTML?.trim() || '', ['settings', 'popover-options']),
          ['src', 'd', 'class', 'style', 'value']
        ),
        ['script', 'style', 'svg']
      )
    )

    return {
      selector,
      tagName: element.tagName.toLowerCase(),
      attributes,
      textContent,
      isVisible: this.isElementVisible(element),
    }
  }

  private isElementVisible(element: HTMLElement): boolean {
    try {
      const style = window.getComputedStyle(element)
      const rect = element.getBoundingClientRect()

      return (
        style.display !== 'none'
        && style.visibility !== 'hidden'
        && parseFloat(style.opacity) > 0
        && rect.width > 0
        && rect.height > 0
      )
    } catch (error) {
      return false
    }
  }

  private getElementKey(element: HTMLElement): string {
    const id = element.id
    const classes = element.className
    const dataValue = element.getAttribute('value')
    const textContent = element.textContent?.trim().substring(0, 30)

    return `${element.tagName}|${id}|${classes}|${dataValue}|${textContent}`
  }

  public minifyHTML(html: string): string {
    return html
      .replace(/\n/g, '') // Remove newlines
      .replace(/\s{2,}/g, ' ') // Replace multiple spaces with a single space
      .replace(/>\s+</g, '><') // Remove whitespace between tags
      .trim() // Trim leading/trailing spaces
  }

  private removeUnnecessaryDataAttributes(html: string, attributes: string[]): string {
    const regex = new RegExp(`\\s(?:${attributes.map(attr => `data-${attr}`).join('|')})=["'][^"']*["']`, 'g')
    return html.replace(regex, '')
  }

  private removeUnnecessaryAttributes(html: string, attributes: string[]): string {
    const regex = new RegExp(`\\s(?:${attributes.join('|')})=["'][^"']*["']`, 'g')
    return html.replace(regex, '')
  }

  private removeUnnecessaryTags(html: string, tags: string[]): string {
    const regex = new RegExp(`<(${tags.join('|')})[^>]*>.*?<\\/\\1>`, 'gs')
    return html.replace(regex, '')
  }

  private removeAllDisplayNoneElements(element: HTMLElement): void {
    const hiddenElements = element.querySelectorAll('[style*="display: none"]')
    hiddenElements.forEach(hiddenEl => hiddenEl.remove())
  }

  /**
   * Checks if an element is within a hidden .emtlkit--option-set-wrapper
   */
  private isElementInHiddenOptionSetWrapper(element: HTMLElement): boolean {
    try {
      // Find the closest .emtlkit--option-set-wrapper ancestor
      const optionSetWrapper = element.closest('.emtlkit--option-set-wrapper')

      if (!optionSetWrapper) {
        return false // Not within an option set wrapper
      }

      // Check if the wrapper is hidden
      const style = window.getComputedStyle(optionSetWrapper as HTMLElement)
      return style.display === 'none'
    } catch (error) {
      // If there's an error checking visibility, assume it's visible
      return false
    }
  }
}
