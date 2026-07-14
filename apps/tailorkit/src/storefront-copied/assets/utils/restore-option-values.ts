/* eslint-disable max-len */
import { fontStorefrontLoader } from '../../shared/components/font-storefront-loader'
import type { TailorKitProductPersonalizer } from '../components/product-personalizer'
import { localStorage } from './localStorage'
import { sessionStorage } from './sessionStorage'

/**
 * Schema of object stored in localStorage for each option-set.
 */
interface SavedOption {
  /** option item id (radio input data-id) */
  id: string
  /** value of the option (text, hex color, image src, font src, …) */
  value: string
  /** display label */
  label?: string
  /** extra metadata (family, pricing, …) */
  extra?: Record<string, any>
}

/** Build storage key for a given fieldset */
export const getOptionSetLocalStorageKey = (
  printAreaId: string,
  layerId: string,
  optionType: string,
  optionSetId: string
): string => `tlk_${printAreaId}_${layerId}_${optionType}_${optionSetId}`

/**
 * Generic helper: mark an option container active & check corresponding radio.
 */
const activateRadioOption = (container: HTMLElement | null) => {
  if (!container) return
  const group = container.parentElement
  group?.querySelector('.emtlkit--option-container.active')?.classList.remove('active')
  container.classList.add('active')
  const radio = container.querySelector<HTMLInputElement>('input[type="radio"]')
  if (radio) radio.checked = true
}

/** Restorer for radio-based (swatch/list) option sets */
const restoreRadio = (fieldset: HTMLFieldSetElement, saved: SavedOption): boolean => {
  const radio
    = fieldset.querySelector<HTMLInputElement>(
      `input[type="radio"][data-id="${saved.id}"]` // id first
    ) || fieldset.querySelector<HTMLInputElement>(`input[type="radio"][value="${saved.value}"]`)

  if (!radio) return false
  activateRadioOption(radio.closest('.emtlkit--option-container'))
  // Update fieldset value so downstream logic is in sync
  const fieldsetValue = radio.value
  const optionId = radio.getAttribute('data-id') || saved.id
  const optionName = radio.getAttribute('data-name') || saved.label || fieldsetValue
  const hostElement = fieldset.closest('tailorkit-product-personalizer') as any
  if (hostElement?.updateFieldset) {
    hostElement.updateFieldset(fieldset, optionId, optionName, fieldsetValue)
  }
  return true
}

/** Restorer for dropdown font_option */
const restoreFont = async (
  element: TailorKitProductPersonalizer,
  fieldset: HTMLFieldSetElement,
  saved: SavedOption
): Promise<boolean> => {
  const button = fieldset.querySelector<HTMLButtonElement>('button.emtlkit--font-selector')
  if (!button) return restoreRadio(fieldset, saved)

  const { value, label, extra } = saved
  const family = extra?.family || extra?.label || label || ''

  // Update preview
  const selectedFontWrapper = button.querySelector('.emtlkit--selected-font-wrapper')
  if (selectedFontWrapper) {
    selectedFontWrapper.innerHTML = `<span class="emtlkit--selected-font" style="font-family: '${family}'">${family}</span> <span style="font-family: ''">${extra?.isDefault ? '(Default)' : ''}</span>`
  }

  // preload font
  if (family && value) {
    try {
      await fontStorefrontLoader.loadFont(family, value)
    } catch {
      /* ignore */
    }
  }

  // update fieldset attrs via official helper
  element.updateFieldset(fieldset, saved.id, label || family, value)
  fieldset.setAttribute('data-family', family)
  if (extra?.isDefault) fieldset.setAttribute('data-default', extra.isDefault)
  return true
}

/** Restorer for dropdown color_option */
const restoreColor = (
  element: TailorKitProductPersonalizer,
  fieldset: HTMLFieldSetElement,
  saved: SavedOption
): boolean => {
  const button = fieldset.querySelector<HTMLButtonElement>('button.emtlkit--color-selector-button')
  if (!button) return restoreRadio(fieldset, saved)

  const colorBox = button.querySelector<HTMLElement>('.emtlkit--color-option-color-box')
  if (colorBox) colorBox.style.backgroundColor = saved.value

  const txt = button.querySelector<HTMLElement>('.emtlkit-button-text')
  if (txt) txt.textContent = saved.label || saved.value

  element.updateFieldset(fieldset, saved.id, saved.label || saved.value, saved.value)
  return true
}

/** Restorer for dropdown text_option */
const restoreText = (
  element: TailorKitProductPersonalizer,
  fieldset: HTMLFieldSetElement,
  saved: SavedOption
): boolean => {
  const button = fieldset.querySelector<HTMLButtonElement>('button.emtlkit--text-selector-button')
  if (!button) return restoreRadio(fieldset, saved)

  const txt = button.querySelector<HTMLElement>('.emtlkit-button-text')
  if (txt) txt.textContent = saved.label || saved.value

  element.updateFieldset(fieldset, saved.id, saved.label || saved.value, saved.value)
  return true
}

/** Restorer for dropdown image_option */
const restoreImage = (
  element: TailorKitProductPersonalizer,
  fieldset: HTMLFieldSetElement,
  saved: SavedOption,
  isImageOption: boolean = true
): boolean => {
  const button = fieldset.querySelector<HTMLButtonElement>('button.emtlkit--image-selector-button')
  const { extra } = saved
  if (!button || extra?.isBuyerOption === 'true') return restoreRadio(fieldset, saved)

  const img = button.querySelector<HTMLImageElement>('img.emtlkit--image-preview')
  if (img) {
    const isShopifyCdn = saved.value.includes('cdn.shopify.com') || saved.value.includes('cdn/shop/files')
    img.src = isShopifyCdn ? `${saved.value}&width=60` : saved.value
  }

  const txt = button.querySelector<HTMLElement>('.emtlkit-button-text')
  if (txt) txt.textContent = saved.label || (isImageOption ? 'Select image' : 'Select mask')

  element.updateFieldset(
    fieldset,
    saved.id,
    saved.label || (isImageOption ? 'Select image' : 'Select mask'),
    saved.value
  )
  return true
}

/** Restorer for text_customer input fields */
const restoreTextCustomer = (
  _element: TailorKitProductPersonalizer,
  fieldset: HTMLFieldSetElement,
  saved: SavedOption
): boolean => {
  const textInput = fieldset.querySelector('tailorkit-text-customer-input')
  if (!textInput) return false

  // Set the value attribute (triggers attributeChangedCallback)
  // which internally calls #setValue that updates both input and fieldset
  textInput.setAttribute('value', saved.value)

  return true
}

/**
 * Restorer for multi_layout_option
 * Restores the selected layout by marking the corresponding radio option as active.
 * Uses the saved layout ID to find and check the matching radio input.
 *
 * @param _element - Product personalizer element (unused)
 * @param fieldset - The multi-layout fieldset containing radio options
 * @param saved - Previously saved layout selection data
 * @returns true if restoration succeeded, false otherwise
 */
const restoreMultiLayout = (
  _element: TailorKitProductPersonalizer,
  fieldset: HTMLFieldSetElement,
  saved: SavedOption
): boolean => {
  return restoreRadio(fieldset, saved)
}

/** Restorer registry */
const restorers: Record<
  string,
  (
    element: TailorKitProductPersonalizer,
    fieldset: HTMLFieldSetElement,
    saved: SavedOption
  ) => Promise<boolean> | boolean
> = {
  text_option: restoreText,
  color_option: restoreColor,
  font_option: restoreFont,
  image_option: restoreImage,
  mask_option: (element, fieldset, saved) => restoreImage(element, fieldset, saved, false),
  text_customer: restoreTextCustomer,
  multi_layout_option: restoreMultiLayout,
}

/**
 * Restore option values from storage (unified implementation).
 * Uses sessionStorage for image options, localStorage for other options.
 * Returns true if at least one option restored.
 */
export const reuseOptionValuesFromLocalStorage = async (element: TailorKitProductPersonalizer): Promise<boolean> => {
  const fieldsets = element.querySelectorAll<HTMLFieldSetElement>('fieldset.emtlkit--option-set')
  let restoredAny = false

  for (const fieldset of Array.from(fieldsets)) {
    const optionType = fieldset.getAttribute('data-option-type') || ''
    const layerId = fieldset.getAttribute('data-layer-id') || ''
    const printAreaId = fieldset.getAttribute('data-print-area-id') || ''
    const optionSetId = fieldset.getAttribute('data-id') || ''

    if (!optionType || !layerId || !printAreaId || !optionSetId) continue

    const key = getOptionSetLocalStorageKey(printAreaId, layerId, optionType, optionSetId)
    // Use sessionStorage for image options to prevent stale data issues
    const storage = optionType === 'image_option' ? sessionStorage : localStorage
    const raw = storage.getItem(key)
    if (!raw) continue

    let saved: SavedOption | null = null
    try {
      saved = JSON.parse(raw)
    } catch {
      /* ignore corrupted */
    }
    if (!saved) continue

    // pick restorer; fallback to generic radio
    const restorer = restorers[optionType] || ((_, fs, s) => restoreRadio(fs, s))
    const ok = await restorer(element, fieldset, saved)
    if (ok) restoredAny = true
  }

  return restoredAny
}
