export const updateFieldsetAttributes = (
  fieldset: HTMLFieldSetElement,
  optionId: string,
  optionName: string,
  optionValue: string
) => {
  fieldset.setAttribute('data-option-id', optionId)
  fieldset.setAttribute('value', optionValue)
  fieldset.setAttribute('data-name', optionName)
}

export const updateImageOptionLabel = (fieldset: HTMLFieldSetElement, optionName: string) => {
  const container = fieldset.closest('.emtlkit--option-set-wrapper')
  const optionSetLabel = container?.querySelector('label')

  if (optionSetLabel) {
    const originLabel = optionSetLabel.getAttribute('data-label')
    optionSetLabel.innerHTML = `${originLabel}: ${optionName}`
  }
}

export const updateMultiLayoutOptionLabel = (fieldset: HTMLFieldSetElement, optionName: string) => {
  const optionSetLabel = fieldset.querySelector('label')

  if (optionSetLabel) {
    const originLabel = fieldset.getAttribute('data-label')

    const html = `${originLabel}: ${optionName}`

    optionSetLabel.innerHTML = html
  }
}
