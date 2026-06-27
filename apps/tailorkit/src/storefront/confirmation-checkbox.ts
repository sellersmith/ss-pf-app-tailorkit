type ConfirmationCheckboxSettings = {
  enabled: boolean
  message: string
}

const DEFAULT_CONFIRMATION_MESSAGE = "I've reviewed my personalization and ready to proceed"
const CONFIRMATION_CONTAINER_CLASS = 'emtlkit-inline-confirmation-checkbox-container'

function parseJSON<T>(value: string | null, fallback: T): T {
  if (!value) return fallback

  try {
    return JSON.parse(value) as T
  } catch (error) {
    console.warn('[TailorKit][PageFly] Error parsing confirmation checkbox settings', error)
    return fallback
  }
}

function appSettingsFor(productPersonalizer?: HTMLElement) {
  const customizer =
    productPersonalizer?.closest('tailorkit-product-personalizer-customizer')
    || document.querySelector('tailorkit-product-personalizer-customizer')

  return parseJSON<Record<string, any>>(customizer?.getAttribute('data-app-settings') || null, {})
}

/** Reads TailorKit confirmation checkbox settings from the app settings metafield payload. */
export function getConfirmationCheckboxSettings(productPersonalizer?: HTMLElement): ConfirmationCheckboxSettings {
  const appSettings = appSettingsFor(productPersonalizer)

  return {
    enabled: appSettings.confirmationCheckbox?.enabled ?? false,
    message: appSettings.confirmationCheckbox?.message || DEFAULT_CONFIRMATION_MESSAGE,
  }
}

function existingContainer(productPersonalizer: HTMLElement) {
  return productPersonalizer.querySelector<HTMLElement>(`.${CONFIRMATION_CONTAINER_CLASS}`)
}

function insertContainer(productPersonalizer: HTMLElement, container: HTMLElement) {
  const anchor =
    productPersonalizer.querySelector('.emtlkit--tab-content-container')
    || productPersonalizer.querySelector('.emtlkit--personalization-area-container')

  if (anchor?.parentElement) {
    anchor.parentElement.insertBefore(container, anchor.nextSibling)
    return
  }

  productPersonalizer.appendChild(container)
}

function renderCheckboxMarkup(container: HTMLElement, settings: ConfirmationCheckboxSettings) {
  container.innerHTML = ''

  const wrapper = document.createElement('div')
  wrapper.className = 'emtlkit-confirmation-checkbox'
  wrapper.setAttribute('data-confirmation-checkbox', 'true')

  const label = document.createElement('label')
  label.className = 'emtlkit-confirmation-checkbox__label'
  label.htmlFor = 'emtlkit-inline-confirmation-checkbox'

  const input = document.createElement('input')
  input.type = 'checkbox'
  input.id = 'emtlkit-inline-confirmation-checkbox'
  input.className = 'emtlkit-confirmation-checkbox__input'
  input.setAttribute('data-confirmation-input', 'true')
  input.addEventListener('change', () => {
    wrapper.classList.remove('emtlkit-confirmation-checkbox--shake')
  })

  const checkmark = document.createElement('span')
  checkmark.className = 'emtlkit-confirmation-checkbox__checkmark'

  const text = document.createElement('span')
  text.className = 'emtlkit-confirmation-checkbox__text'
  text.textContent = settings.message

  label.append(input, checkmark, text)
  wrapper.appendChild(label)
  container.appendChild(wrapper)
}

/** Renders TailorKit's inline confirmation checkbox without importing the original Preact component. */
export function renderTailorKitConfirmationCheckbox(productPersonalizer: HTMLElement) {
  const settings = getConfirmationCheckboxSettings(productPersonalizer)
  const currentContainer = existingContainer(productPersonalizer)

  if (!settings.enabled) {
    currentContainer?.remove()
    return
  }

  const container = currentContainer || document.createElement('div')
  container.className = CONFIRMATION_CONTAINER_CLASS
  renderCheckboxMarkup(container, settings)

  if (!currentContainer) insertContainer(productPersonalizer, container)
}

export function resetTailorKitConfirmationCheckbox(productPersonalizer: HTMLElement) {
  const checkbox = productPersonalizer.querySelector<HTMLInputElement>('input[data-confirmation-input="true"]')
  if (checkbox?.checked) {
    checkbox.checked = false
  }
}

export function isTailorKitConfirmationChecked(productPersonalizer: HTMLElement) {
  return productPersonalizer.querySelector<HTMLInputElement>('input[data-confirmation-input="true"]')?.checked === true
}

export function validateTailorKitConfirmationCheckbox(productPersonalizer: HTMLElement) {
  const settings = getConfirmationCheckboxSettings(productPersonalizer)
  if (!settings.enabled) return true

  const checkbox = productPersonalizer.querySelector<HTMLInputElement>('input[data-confirmation-input="true"]')
  if (!checkbox) return true

  if (checkbox.checked) return true

  const wrapper = checkbox.closest<HTMLElement>('[data-confirmation-checkbox]')
  wrapper?.classList.remove('emtlkit-confirmation-checkbox--shake')
  if (wrapper) void wrapper.offsetWidth
  wrapper?.classList.add('emtlkit-confirmation-checkbox--shake')
  checkbox.focus({ preventScroll: true })
  wrapper?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  return false
}
