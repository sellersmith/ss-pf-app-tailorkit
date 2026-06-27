/**
 * Wizard review / summary step.
 * Reads current form values from option set fieldsets and renders a summary.
 * Dispatches `wizard-jump` to allow editing a specific step.
 */

import type { WzStepConfig } from './wizard-progress'

const BASE = 'emtlkit--wizard'

export interface ReviewSection {
  stepIndex: number
  stepLabel: string
  fields: ReviewField[]
}

export interface ReviewField {
  fieldId: string
  label: string
  value: string
  type: 'text' | 'color' | 'image' | 'other'
  colorValue?: string
  imageSrc?: string
}

/**
 * Extract a displayable value from a fieldset.
 */
function extractFieldValue(fieldset: HTMLFieldSetElement): {
  value: string
  type: ReviewField['type']
  colorValue?: string
  imageSrc?: string
} {
  // Checked radio
  const checkedRadio = fieldset.querySelector('input[type="radio"]:checked') as HTMLInputElement | null
  if (checkedRadio) {
    // Check if it's a color option
    const colorSwatch = checkedRadio.closest('[data-color]') as HTMLElement | null
    if (colorSwatch) {
      const colorValue = colorSwatch.getAttribute('data-color') || ''
      const label = checkedRadio.getAttribute('data-label') || checkedRadio.value
      return { value: label, type: 'color', colorValue }
    }

    // Check if it's an image option
    const img = checkedRadio.closest('[data-id]')?.querySelector('img') as HTMLImageElement | null
    if (img) {
      return { value: checkedRadio.getAttribute('data-label') || 'Image', type: 'image', imageSrc: img.src }
    }

    return { value: checkedRadio.getAttribute('data-label') || checkedRadio.value, type: 'other' }
  }

  // Text input
  const textInput = fieldset.querySelector('input[type="text"], textarea') as
    | HTMLInputElement
    | HTMLTextAreaElement
    | null
  if (textInput && textInput.value.trim()) {
    return { value: textInput.value.trim(), type: 'text' }
  }

  // Select
  const select = fieldset.querySelector('select') as HTMLSelectElement | null
  if (select && select.value) {
    const option = select.options[select.selectedIndex]
    return { value: option?.text || select.value, type: 'other' }
  }

  // Fieldset value attribute (set by option set components)
  const attrValue = fieldset.getAttribute('value') || ''
  const attrName = fieldset.getAttribute('data-name') || attrValue
  if (attrValue) {
    return { value: attrName || attrValue, type: 'other' }
  }

  return { value: '', type: 'other' }
}

export class WizardReview {
  private container: HTMLElement
  private stepContainers: HTMLElement[]
  private stepConfigs: WzStepConfig[]

  constructor(container: HTMLElement, stepContainers: HTMLElement[], stepConfigs: WzStepConfig[]) {
    this.container = container
    this.container.className = `${BASE}-review`
    this.stepContainers = stepContainers
    this.stepConfigs = stepConfigs
  }

  /** Re-render the review based on current DOM state. */
  render(): void {
    this.container.innerHTML = ''

    const heading = document.createElement('h3')
    heading.className = `${BASE}-review-heading`
    heading.textContent = 'Review Your Customizations'
    this.container.appendChild(heading)

    const sections = this.buildSections()

    if (sections.length === 0) {
      const empty = document.createElement('p')
      empty.className = `${BASE}-review-empty`
      empty.textContent = 'No customizations selected.'
      this.container.appendChild(empty)
      return
    }

    sections.forEach(section => {
      const sectionEl = this.renderSection(section)
      this.container.appendChild(sectionEl)
    })
  }

  private buildSections(): ReviewSection[] {
    return this.stepContainers
      .map((stepContainer, index) => {
        const config = this.stepConfigs[index]
        const fieldsets = Array.from(
          stepContainer.querySelectorAll<HTMLFieldSetElement>('fieldset.emtlkit--option-set')
        )

        const fields: ReviewField[] = []

        for (const fieldset of fieldsets) {
          const { value, type, colorValue, imageSrc } = extractFieldValue(fieldset)
          if (!value) continue

          const legendEl = fieldset.querySelector('legend')
          const labelEl = fieldset.querySelector('.emtlkit--option-set-label')
          const rawLabel
            = legendEl?.textContent?.trim()
            || labelEl?.getAttribute('data-label')
            || fieldset.getAttribute('data-option-type')
            || 'Field'

          fields.push({
            fieldId: fieldset.getAttribute('data-layer-id') || fieldset.id || String(index),
            label: rawLabel,
            value,
            type,
            colorValue,
            imageSrc,
          })
        }

        return {
          stepIndex: index,
          stepLabel: config?.label || `Step ${index + 1}`,
          fields,
        } as ReviewSection
      })
      .filter(s => s.fields.length > 0)
  }

  private renderSection(section: ReviewSection): HTMLElement {
    const sectionEl = document.createElement('div')
    sectionEl.className = `${BASE}-review-section`
    sectionEl.setAttribute('data-step-index', String(section.stepIndex))

    const header = document.createElement('div')
    header.className = `${BASE}-review-section-header`

    const title = document.createElement('span')
    title.className = `${BASE}-review-section-title`
    title.textContent = section.stepLabel
    header.appendChild(title)

    const editBtn = document.createElement('button')
    editBtn.type = 'button'
    editBtn.className = `${BASE}-review-edit-btn`
    editBtn.textContent = 'Edit'
    editBtn.setAttribute('aria-label', `Edit ${section.stepLabel}`)
    editBtn.addEventListener('click', () => {
      this.container.dispatchEvent(
        new CustomEvent('wizard-jump', {
          detail: { stepIndex: section.stepIndex },
          bubbles: true,
          composed: true,
        })
      )
    })
    header.appendChild(editBtn)
    sectionEl.appendChild(header)

    const fieldList = document.createElement('ul')
    fieldList.className = `${BASE}-review-field-list`

    section.fields.forEach(field => {
      const item = document.createElement('li')
      item.className = `${BASE}-review-field-item`

      const fieldLabel = document.createElement('span')
      fieldLabel.className = `${BASE}-review-field-label`
      fieldLabel.textContent = `${field.label  }:`
      item.appendChild(fieldLabel)

      if (field.type === 'color' && field.colorValue) {
        const swatch = document.createElement('span')
        swatch.className = `${BASE}-review-color-swatch`
        swatch.style.backgroundColor = field.colorValue
        swatch.setAttribute('aria-label', field.value)
        item.appendChild(swatch)

        const valueText = document.createElement('span')
        valueText.className = `${BASE}-review-field-value`
        valueText.textContent = field.value
        item.appendChild(valueText)
      } else if (field.type === 'image' && field.imageSrc) {
        const img = document.createElement('img')
        img.className = `${BASE}-review-image-thumb`
        img.src = field.imageSrc
        img.alt = field.value
        img.loading = 'lazy'
        item.appendChild(img)
      } else {
        const valueText = document.createElement('span')
        valueText.className = `${BASE}-review-field-value`
        valueText.textContent = field.value
        item.appendChild(valueText)
      }

      fieldList.appendChild(item)
    })

    sectionEl.appendChild(fieldList)
    return sectionEl
  }

  /** Show the review container. */
  show(): void {
    this.container.hidden = false
  }

  /** Hide the review container. */
  hide(): void {
    this.container.hidden = true
  }
}
