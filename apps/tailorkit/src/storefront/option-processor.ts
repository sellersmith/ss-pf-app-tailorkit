import { getDisplayValueWithPricing } from './pricing-sync'

export type TailorKitMetaData = Record<string, Record<string, string>>

export type TailorKitDisplayData = Record<
  string,
  Record<string, { type: string; label: string; value: string }[]>
>

function isJSON(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

function isFieldsetHidden(fieldset: Element) {
  const element = fieldset as HTMLElement
  return element.hidden || element.style.display === 'none' || Boolean(element.closest('[hidden], [style*="display: none"]'))
}

function selectedOptionFor(fieldset: Element) {
  const select = fieldset.querySelector<HTMLSelectElement>('select')
  if (select) return select

  return (
    fieldset.querySelector<HTMLInputElement>('.emtlkit--option-container.active input')
    || fieldset.querySelector<HTMLInputElement>('input:checked')
    || fieldset.querySelector<HTMLInputElement>('input')
  )
}

function selectedOptionIdentifier(option: HTMLInputElement | HTMLSelectElement | null) {
  if (!option) return ''
  if (option instanceof HTMLSelectElement) return option.selectedOptions[0]?.getAttribute('data-id') || option.value
  return option.getAttribute('data-id') || ''
}

function optionValue(fieldset: Element, option: HTMLInputElement | HTMLSelectElement | null) {
  if (option instanceof HTMLSelectElement) {
    return option.selectedOptions[0]?.getAttribute('data-name') || option.value
  }

  return (
    option?.getAttribute('data-name')
    || option?.getAttribute('value')
    || fieldset.getAttribute('data-name')
    || fieldset.getAttribute('value')
    || ''
  )
}

function updateMetaData(args: {
  metaData: TailorKitMetaData
  printAreaId: string
  layerId: string
  layerMetaData: Record<string, unknown>
  newMetaData: Record<string, unknown>
}) {
  const { metaData, printAreaId, layerId, layerMetaData, newMetaData } = args
  metaData[printAreaId][layerId] = JSON.stringify({
    ...layerMetaData,
    ...newMetaData,
  })
}

function addDisplayData(args: {
  displayData: TailorKitDisplayData
  printAreaId: string
  layerId: string
  label: string | null
  type: string
  value: string
}) {
  const { displayData, label, layerId, printAreaId, type, value } = args
  if (!label) return

  displayData[printAreaId] = displayData[printAreaId] || {}
  displayData[printAreaId][layerId] = displayData[printAreaId][layerId] || []
  displayData[printAreaId][layerId].push({ label, type, value })
}

/** Collects TailorKit Liquid fieldset selections into metadata/display data for cart form sync. */
export function collectTailorKitFieldsetData(productPersonalizer: HTMLElement) {
  const metaData: TailorKitMetaData = {}
  const displayData: TailorKitDisplayData = {}
  const fieldsets = productPersonalizer.querySelectorAll('fieldset')

  fieldsets.forEach(fieldset => {
    const layerId = fieldset.getAttribute('data-layer-id')
    const printAreaId = fieldset.getAttribute('data-print-area-id')
    const isExistingPrintAreaAndLayer = printAreaId && layerId

    if (isFieldsetHidden(fieldset)) {
      if (isExistingPrintAreaAndLayer) {
        if (metaData[printAreaId]) delete metaData[printAreaId][layerId]
        if (displayData[printAreaId]) delete displayData[printAreaId][layerId]
      }
      return
    }

    if (!isExistingPrintAreaAndLayer) {
      if (printAreaId) metaData[printAreaId] = {}
      return
    }

    const label = fieldset.getAttribute('data-label')
    const optionType = fieldset.getAttribute('data-option-type') || ''
    const selectedOption = selectedOptionFor(fieldset)
    const selectedOptionId = selectedOptionIdentifier(selectedOption) || fieldset.getAttribute('data-id') || ''
    const existingLayerMetaData = metaData[printAreaId][layerId]
    const layerMetaData = isJSON(existingLayerMetaData) ? JSON.parse(existingLayerMetaData) : { selectedOptionId }
    const value = optionValue(fieldset, selectedOption)

    metaData[printAreaId] = { ...(metaData[printAreaId] || {}) }
    displayData[printAreaId] = { ...(displayData[printAreaId] || {}) }
    updateMetaData({
      metaData,
      printAreaId,
      layerId,
      layerMetaData,
      newMetaData: { selectedOptionId, value },
    })
    addDisplayData({
      displayData,
      printAreaId,
      layerId,
      label,
      type: optionType,
      value: getDisplayValueWithPricing(fieldset, value),
    })
  })

  return { metaData, displayData }
}
