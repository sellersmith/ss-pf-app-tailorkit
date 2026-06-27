type TailorKitOption = {
  i?: string
  l?: string
  v?: string
  t?: string
  s?: number | boolean
  src?: string
  family?: string
  additionalPricing?: unknown
}

type TailorKitOptionSet = {
  i?: string
  l?: string
  t?: string
  displayStyle?: string
  ol?: TailorKitOption[]
}

const OPTION_LIST_TAGS = [
  'tailorkit-text-options-list',
  'tailorkit-color-options-list',
  'tailorkit-font-options-list',
  'tailorkit-image-options-list',
  'tailorkit-imageless-options-list',
  'tailorkit-multi-layout-dropdown',
]

function parseJSON<T>(value: string | null, fallback: T): T {
  if (!value) return fallback

  try {
    return JSON.parse(value) as T
  } catch (error) {
    console.warn('[TailorKit][PageFly] Cannot parse option list data', error)
    return fallback
  }
}

function optionSetFrom(element: HTMLElement): TailorKitOptionSet {
  return parseJSON<TailorKitOptionSet>(
    element.getAttribute('data-option-set-data') || element.getAttribute('data-options'),
    {}
  )
}

function optionsFor(element: HTMLElement, optionSet: TailorKitOptionSet): TailorKitOption[] {
  const options = Array.isArray(optionSet.ol) ? optionSet.ol : []
  if (element.localName !== 'tailorkit-font-options-list') return options

  const defaultFont = parseJSON<TailorKitOption>(element.getAttribute('data-default-font'), {})
  if (!defaultFont.family && !defaultFont.src) return options

  return [
    {
      i: defaultFont.src || defaultFont.family,
      l: defaultFont.family,
      v: defaultFont.src || defaultFont.family,
      family: defaultFont.family,
      src: defaultFont.src,
      s: options.some(option => option.s) ? 0 : 1,
      additionalPricing: defaultFont.additionalPricing,
    },
    ...options,
  ]
}

function optionId(option: TailorKitOption) {
  return option.i || option.v || option.l || ''
}

function optionLabel(option: TailorKitOption) {
  return option.l || option.family || option.v || option.i || ''
}

function optionValue(option: TailorKitOption) {
  return option.v || option.src || option.l || option.i || ''
}

function selectedOption(options: TailorKitOption[]) {
  return options.find(option => option.s === 1 || option.s === true) || options[0]
}

function writeFieldsetValue(fieldset: HTMLFieldSetElement | null, option: TailorKitOption) {
  if (!fieldset) return

  fieldset.setAttribute('value', optionValue(option))
  fieldset.setAttribute('data-name', optionLabel(option))
  if (option.family) fieldset.setAttribute('data-family', option.family)
  if (option.src) fieldset.setAttribute('data-font-src', option.src)
  if (option.additionalPricing) fieldset.setAttribute('data-pricing', JSON.stringify(option.additionalPricing))
}

function optionVisual(tagName: string, option: TailorKitOption) {
  if (tagName === 'tailorkit-color-options-list') {
    const swatch = document.createElement('span')
    swatch.className = 'emtlkit--color-swatch'
    swatch.style.background = optionValue(option)
    return swatch
  }

  if (tagName === 'tailorkit-image-options-list' && option.t) {
    const image = document.createElement('img')
    image.src = `${option.t}${String(option.t).includes('?') ? '&' : '?'}width=120`
    image.width = 60
    image.height = 60
    image.alt = optionLabel(option)
    image.loading = 'lazy'
    return image
  }

  const text = document.createElement('span')
  text.className = 'emtlkit--option-label'
  text.textContent = optionLabel(option)
  return text
}

function renderSelect(element: HTMLElement, fieldset: HTMLFieldSetElement | null, options: TailorKitOption[]) {
  const select = document.createElement('select')
  select.className = 'emtlkit--option-select'
  const selected = selectedOption(options)

  options.forEach(option => {
    const item = document.createElement('option')
    item.value = optionValue(option)
    item.textContent = optionLabel(option)
    item.dataset.id = optionId(option)
    item.dataset.name = optionLabel(option)
    if (option.additionalPricing) item.dataset.pricing = JSON.stringify(option.additionalPricing)
    if (selected && optionId(option) === optionId(selected)) item.selected = true
    select.appendChild(item)
  })

  select.addEventListener('change', () => {
    const option = options.find(item => optionValue(item) === select.value) || selectedOption(options)
    if (option) writeFieldsetValue(fieldset, option)
  })

  element.replaceChildren(select)
  if (selected) writeFieldsetValue(fieldset, selected)
}

function renderRadioList(element: HTMLElement, fieldset: HTMLFieldSetElement | null, options: TailorKitOption[]) {
  const tagName = element.localName
  const wrapper = document.createElement('div')
  wrapper.className =
    tagName === 'tailorkit-text-options-list'
      ? 'emtlkit--d-grid emtlkit--grid-template-columns-1 emtlkit--gap-4'
      : 'emtlkit--d-flex emtlkit--flex-center emtlkit--gap-8 emtlkit--flex-wrap'
  const selected = selectedOption(options)
  const name =
    fieldset?.querySelector<HTMLInputElement>('input[type="radio"]')?.name
    || `${fieldset?.getAttribute('data-print-area-id') || 'tailorkit'} / ${fieldset?.getAttribute('data-id') || tagName}`

  options.forEach(option => {
    const label = document.createElement('label')
    label.className = 'emtlkit--option-container'
    if (selected && optionId(option) === optionId(selected)) label.classList.add('active')

    const input = document.createElement('input')
    input.type = 'radio'
    input.name = name
    input.value = optionValue(option)
    input.dataset.id = optionId(option)
    input.dataset.name = optionLabel(option)
    if (option.additionalPricing) input.dataset.pricing = JSON.stringify(option.additionalPricing)
    if (selected && optionId(option) === optionId(selected)) input.checked = true
    input.addEventListener('change', () => writeFieldsetValue(fieldset, option))

    label.appendChild(input)
    label.appendChild(optionVisual(tagName, option))
    wrapper.appendChild(label)
  })

  element.replaceChildren(wrapper)
  if (selected) writeFieldsetValue(fieldset, selected)
}

class TailorKitOptionListElement extends HTMLElement {
  private mounted = false

  connectedCallback() {
    if (this.mounted) return
    this.mounted = true

    const optionSet = optionSetFrom(this)
    const options = optionsFor(this, optionSet)
    const fieldset = this.closest('fieldset') as HTMLFieldSetElement | null
    if (!options.length) return

    if (this.localName === 'tailorkit-multi-layout-dropdown') {
      renderSelect(this, fieldset, options)
      return
    }

    renderRadioList(this, fieldset, options)
  }

  disconnectedCallback() {
    this.mounted = false
  }
}

/**
 * Registers lightweight DOM renderers for TailorKit option-list custom elements emitted by Liquid.
 *
 * The six tags share one tag-agnostic behavior (branching on `localName`), but the Custom Elements
 * spec forbids reusing a single constructor for multiple tags ("this constructor has already been
 * used with this registry"). Each tag therefore gets its own empty subclass — a distinct constructor
 * that inherits all behavior, with no logic duplicated.
 */
export function registerOptionListElements() {
  OPTION_LIST_TAGS.forEach(tagName => {
    if (!customElements.get(tagName)) {
      customElements.define(tagName, class extends TailorKitOptionListElement {})
    }
  })
}
