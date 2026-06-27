// State Manager - Product Personalizer State Management
// File: state-manager.ts

import { DOMScanner, type DOMElement } from './dom-scanner'

export interface ProductPersonalizerDOM {
  availableOptions: DOMElement[]
  // selectedOptions: DOMElement[]
  // currentStep: string
  // productData: any
  // selectionSummary: SelectionSummary
  // validationResult: ValidationResult
}

export interface SelectionSummary {
  totalSelections: number
  categories: Record<string, string[]>
  selections: Array<{
    category: string
    option: string
    selector: string
  }>
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export class StateManager {
  private scanner = new DOMScanner()

  // Get complete personalizer state
  async getPersonalizerDOM(): Promise<ProductPersonalizerDOM> {
    console.log('📊 Getting personalizer DOM...')

    const availableOptions = this.scanner.scanAvailableOptions()
    // const selectedOptions = this.scanner.scanSelectedOptions()
    // const currentStep = this.scanner.getCurrentStep()
    // const productData = this.getProductData()
    // const selectionSummary = this.generateSelectionSummary(selectedOptions)
    // const validationResult = this.validateConfiguration(selectedOptions)

    return {
      availableOptions,
      // selectedOptions,
      // currentStep,
      // productData,
      // selectionSummary,
      // validationResult,
    }
  }

  // Get selection summary
  getSelectionSummary(selectedOptions?: DOMElement[]): SelectionSummary {
    if (!selectedOptions) {
      selectedOptions = this.scanner.scanSelectedOptions()
    }

    return this.generateSelectionSummary(selectedOptions)
  }

  // Validate current configuration
  validateConfiguration(selectedOptions?: DOMElement[]): ValidationResult {
    if (!selectedOptions) {
      selectedOptions = this.scanner.scanSelectedOptions()
    }

    const errors: string[] = []

    // Basic validation
    if (selectedOptions.length === 0) {
      errors.push('No options selected')
    }

    // Category validation
    const categories = this.extractCategories(selectedOptions)
    const requiredCategories = ['human', 'hair', 'skin']

    for (const required of requiredCategories) {
      if (!categories.has(required)) {
        errors.push(`${required} selection is required`)
      }
    }

    // Business rules
    const humanCount = selectedOptions.filter(opt => this.extractCategory(opt) === 'human').length

    if (humanCount > 6) {
      errors.push('Maximum 6 characters allowed')
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  // Get product information
  getProductData(): any {
    try {
      const productData: any = {
        timestamp: new Date().toISOString(),
        url: window.location.href,
      }

      // Extract product info
      const selectors = {
        title: ['h1', '.product-title', '[data-product-title]'],
        price: ['.price', '[data-price]', '.product-price'],
        id: ['[data-product-id]'],
        sku: ['[data-sku]'],
      }

      Object.entries(selectors).forEach(([key, selectorList]) => {
        for (const selector of selectorList) {
          try {
            const element = document.querySelector(selector)
            if (element) {
              if (key === 'id' || key === 'sku') {
                productData[key] = element.getAttribute(`data-${key}`) || element.textContent?.trim()
              } else {
                productData[key] = element.textContent?.trim()
              }
              break
            }
          } catch (error) {
            // Continue to next selector
          }
        }
      })

      return productData
    } catch (error) {
      console.warn('Could not extract product data:', error)
      return { error: 'Could not extract product data' }
    }
  }

  // Private methods
  private generateSelectionSummary(selectedOptions: DOMElement[]): SelectionSummary {
    const summary: SelectionSummary = {
      totalSelections: selectedOptions.length,
      categories: {},
      selections: [],
    }

    selectedOptions.forEach(option => {
      const category = this.extractCategory(option)

      if (!summary.categories[category]) {
        summary.categories[category] = []
      }

      summary.categories[category].push(option.textContent)
      summary.selections.push({
        category,
        option: option.textContent,
        selector: option.selector,
      })
    })

    return summary
  }

  private extractCategories(selectedOptions: DOMElement[]): Set<string> {
    return new Set(selectedOptions.map(opt => this.extractCategory(opt)))
  }

  private extractCategory(option: DOMElement): string {
    // Try data attributes first
    if (option.attributes['data-category']) {
      return option.attributes['data-category']
    }

    if (option.attributes['data-option-category']) {
      return option.attributes['data-option-category']
    }

    // Extract from selector patterns
    const selector = option.selector.toLowerCase()
    if (selector.includes('hair')) return 'hair'
    if (selector.includes('skin')) return 'skin'
    if (selector.includes('human')) return 'human'
    if (selector.includes('clothing')) return 'clothing'
    if (selector.includes('accessories')) return 'accessories'

    // Try parent element
    try {
      const element = document.querySelector(option.selector)
      const parent = element?.closest('[data-category], [data-type]')
      const parentCategory = parent?.getAttribute('data-category') || parent?.getAttribute('data-type')
      if (parentCategory) return parentCategory
    } catch (error) {
      // Ignore
    }

    return 'general'
  }

  public executePersonalizerDomOptions(script: string, recallGetPersonalizerDom: boolean) {
    try {
      console.log('Executing script:', script)

      // eslint-disable-next-line no-new-func
      const executeScript = new Function(script)
      executeScript()

      const action = recallGetPersonalizerDom ? 'need to re-call' : 'no need to re-call'
      const messageToRecallGetPersonalizerDom = `${action} get_personalizer_dom tool at next tool call`
      return `Finished executing script: ${script} and ${messageToRecallGetPersonalizerDom}`
    } catch (error) {
      console.error('Error executing script:', error)
      return null
    }
  }
}
