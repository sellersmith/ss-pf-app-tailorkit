import { isTailorKitConfirmationChecked, validateTailorKitConfirmationCheckbox } from './confirmation-checkbox'
import { readTailorKitStorefrontConfig } from './konva-loader'
import { collectTailorKitFieldsetData, type TailorKitDisplayData, type TailorKitMetaData } from './option-processor'
import {
  collectTailorKitAdditionalPricing,
  dispatchTailorKitPricingUpdated,
  type TailorKitAdditionalPricing,
  TOTAL_ADDITIONAL_COST_DISPLAY_PROPERTY_SUFFIX,
  TOTAL_ADDITIONAL_COST_PROPERTY_SUFFIX,
} from './pricing-sync'

const DEFAULT_PROPERTY_PREFIX = '__pf_tailorkit'
const PRINT_ID_PREFIX = '__print_id__'

function resolvePropertyPrefix() {
  return readTailorKitStorefrontConfig().propertyPrefix || DEFAULT_PROPERTY_PREFIX
}

function generateUniqueId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = (Math.random() * 16) | 0
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

function findTailorKitAddToCartForms() {
  return Array.from(document.querySelectorAll<HTMLFormElement>('form[action*="/cart/add"]'))
}

function clearPreviousInputs(addToCartForm: HTMLFormElement) {
  addToCartForm
    .querySelectorAll('input[data-tailorkit-form-input="true"], input.emtlkit--input[data-name]')
    .forEach(input => input.parentNode?.removeChild(input))
}

function createInputElement(propertyName: string, value: unknown, addToCartForm: HTMLFormElement) {
  const input = document.createElement('input')
  input.type = 'hidden'
  input.name = `properties[${propertyName}]`
  input.value = String(value ?? '')
  input.className = 'emtlkit--input'
  input.dataset.name = propertyName
  input.setAttribute('data-tailorkit-form-input', 'true')
  addToCartForm.appendChild(input)
}

function addBasicFormData(addToCartForm: HTMLFormElement, propertyPrefix: string, productName: string) {
  createInputElement(`${propertyPrefix}_ref_id`, generateUniqueId(), addToCartForm)
  createInputElement(`${propertyPrefix}_product_name`, productName, addToCartForm)
  createInputElement(propertyPrefix, propertyPrefix, addToCartForm)
}

function addMetaDataInputs(addToCartForm: HTMLFormElement, propertyPrefix: string, metaData: TailorKitMetaData) {
  for (const printAreaId in metaData) {
    if (!Object.keys(metaData[printAreaId]).length) {
      createInputElement(`${propertyPrefix} ${printAreaId} empty-option-set`, printAreaId, addToCartForm)
    }

    for (const layerId in metaData[printAreaId]) {
      createInputElement(`${propertyPrefix} ${printAreaId} ${layerId}`, metaData[printAreaId][layerId], addToCartForm)
    }
  }
}

function uniqueLabel(label: string, existingLabels: Record<string, string>) {
  if (!existingLabels[label]) return label

  let index = 2
  let nextLabel = `${label} ${index}`
  while (existingLabels[nextLabel]) {
    index += 1
    nextLabel = `${label} ${index}`
  }
  return nextLabel
}

function addDisplayDataInputs(
  addToCartForm: HTMLFormElement,
  propertyPrefix: string,
  displayData: TailorKitDisplayData
) {
  const labelOptions: Record<string, string> = {}

  for (const printAreaId in displayData) {
    for (const layerId in displayData[printAreaId]) {
      displayData[printAreaId][layerId].forEach(layerOption => {
        const label = uniqueLabel(layerOption.label, labelOptions)
        labelOptions[label] = layerOption.value

        createInputElement(label, layerOption.value, addToCartForm)
        createInputElement(`${propertyPrefix} ${label} ${PRINT_ID_PREFIX}:${printAreaId}`, layerOption.value, addToCartForm)
      })
    }
  }
}

function addPricingInputs(
  addToCartForm: HTMLFormElement,
  propertyPrefix: string,
  pricing: TailorKitAdditionalPricing | null
) {
  if (!pricing) return

  createInputElement(
    `${propertyPrefix}${TOTAL_ADDITIONAL_COST_PROPERTY_SUFFIX}`,
    pricing.totalAdditionalCost.toFixed(2),
    addToCartForm
  )
  createInputElement(`${propertyPrefix}${TOTAL_ADDITIONAL_COST_DISPLAY_PROPERTY_SUFFIX}`, pricing.formattedTotal, addToCartForm)
}

function addConfirmationInput(addToCartForm: HTMLFormElement, productPersonalizer: HTMLElement) {
  const confirmationLabel = '_Confirmation'
  addToCartForm.querySelector(`input[data-name="${confirmationLabel}"]`)?.remove()

  if (isTailorKitConfirmationChecked(productPersonalizer)) {
    createInputElement(confirmationLabel, 'Confirmed', addToCartForm)
  }
}

function isElementHidden(element: Element) {
  const htmlElement = element as HTMLElement
  return htmlElement.hidden || htmlElement.style.display === 'none' || Boolean(htmlElement.closest('[hidden]'))
}

function validateRequiredTextCustomers(productPersonalizer: HTMLElement) {
  const requiredLabels = productPersonalizer.querySelectorAll(
    'fieldset[data-option-type="text_customer"] label.emtlkit--required-indicator'
  )

  for (const labelEl of Array.from(requiredLabels)) {
    const fieldset = labelEl.closest('fieldset')
    if (!fieldset || isElementHidden(fieldset)) continue

    const input = fieldset.querySelector<HTMLInputElement | HTMLTextAreaElement>('input[type="text"], textarea')
    if (input && input.value.trim() === '') {
      input.focus({ preventScroll: true })
      labelEl.classList.remove('emtlkit--required-indicator--shake')
      void (labelEl as HTMLElement).offsetWidth
      labelEl.classList.add('emtlkit--required-indicator--shake')
      return false
    }
  }

  return true
}

function attachRefIdGenerator(
  addToCartForm: HTMLFormElement,
  propertyPrefix: string,
  productName: string,
  productPersonalizer: HTMLElement
) {
  if (addToCartForm.dataset.tlkRefIdHandlerAttached === 'true') return
  addToCartForm.dataset.tlkRefIdHandlerAttached = 'true'

  addToCartForm.addEventListener(
    'submit',
    event => {
      if (!validateRequiredTextCustomers(productPersonalizer)) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        return
      }

      if (!validateTailorKitConfirmationCheckbox(productPersonalizer)) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        return
      }

      const refInput = addToCartForm.querySelector<HTMLInputElement>(`input[data-name="${propertyPrefix}_ref_id"]`)
      if (refInput) {
        refInput.value = generateUniqueId()
      } else {
        createInputElement(`${propertyPrefix}_ref_id`, generateUniqueId(), addToCartForm)
      }

      if (!addToCartForm.querySelector(`input[data-name="${propertyPrefix}_product_name"]`)) {
        createInputElement(`${propertyPrefix}_product_name`, productName, addToCartForm)
      }
      if (!addToCartForm.querySelector(`input[data-name="${propertyPrefix}"]`)) {
        createInputElement(propertyPrefix, propertyPrefix, addToCartForm)
      }
      addConfirmationInput(addToCartForm, productPersonalizer)
    },
    true
  )
}

function resolveProductName(productPersonalizer: HTMLElement) {
  return (
    productPersonalizer.getAttribute('data-product-title')
    || document.querySelector<HTMLHeadingElement>('h1')?.textContent?.trim()
    || 'TailorKit personalized product'
  )
}

/** Syncs TailorKit selected option metadata into Shopify add-to-cart form properties. */
export function syncTailorKitForms(productPersonalizer: HTMLElement) {
  const addToCartForms = findTailorKitAddToCartForms()
  const propertyPrefix = resolvePropertyPrefix()
  const productName = resolveProductName(productPersonalizer)
  const { metaData, displayData } = collectTailorKitFieldsetData(productPersonalizer)
  const pricing = collectTailorKitAdditionalPricing(productPersonalizer)

  addToCartForms.forEach(addToCartForm => {
    clearPreviousInputs(addToCartForm)
    addBasicFormData(addToCartForm, propertyPrefix, productName)
    addMetaDataInputs(addToCartForm, propertyPrefix, metaData)
    addDisplayDataInputs(addToCartForm, propertyPrefix, displayData)
    addPricingInputs(addToCartForm, propertyPrefix, pricing)
    addConfirmationInput(addToCartForm, productPersonalizer)
    attachRefIdGenerator(addToCartForm, propertyPrefix, productName, productPersonalizer)
  })

  dispatchTailorKitPricingUpdated(pricing)

  document.dispatchEvent(
    new CustomEvent('tailorkit:form-sync', {
      detail: { formCount: addToCartForms.length, propertyPrefix },
    })
  )
}
