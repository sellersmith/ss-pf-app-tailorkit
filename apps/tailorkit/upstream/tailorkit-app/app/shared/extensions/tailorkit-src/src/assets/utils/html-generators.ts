// UI Element Generator Functions

export interface RangeSliderOptions {
  baseId: string
  label: string
  unit: string
  min: number
  max: number
  currentValue: number
  modalIdSuffix: string
}

export const createRangeSliderWithInput = (options: RangeSliderOptions): string => {
  const { baseId, label, unit, min, max, currentValue, modalIdSuffix } = options
  return `
    <div class="emtlkit-control-group">
      <label class="emtlkit-control-label" for="${baseId}-slider${modalIdSuffix}">
        ${label}: 
        <span id="${baseId}-value${modalIdSuffix}">${currentValue}</span>${unit}
      </label>
      <div class="emtlkit-slider-input-group">
        <input type="range" id="${baseId}-slider${modalIdSuffix}" min="${min}" max="${max}" value="${currentValue}" class="emtlkit-slider">
        <input type="number" id="${baseId}-input${modalIdSuffix}" min="${min}" max="${max}" value="${currentValue}" class="emtlkit-input-number">
      </div>
    </div>
  `
}

export interface RadioOption {
  value: string
  label: string
  checked: boolean
}

export interface RadioGroupOptions {
  groupName: string
  groupLabel: string
  options: RadioOption[]
  modalIdSuffix: string
}

export const createRadioGroup = (options: RadioGroupOptions): string => {
  const { groupName, groupLabel, options: radioOptions, modalIdSuffix } = options
  let optionsHtml = ''
  for (const opt of radioOptions) {
    optionsHtml += `<label>
      <input type="radio" name="${groupName}${modalIdSuffix}" value="${opt.value}" ${opt.checked ? 'checked' : ''}> 
      ${opt.label}
      </label>`
  }
  return `
    <div class="emtlkit-control-group">
      <label class="emtlkit-control-label">${groupLabel}</label>
      <div class="emtlkit-radio-group">
        ${optionsHtml}
      </div>
    </div>
  `
}
