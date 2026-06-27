/**
 * Check if the fieldset is hidden
 * @param fieldset - The fieldset element
 * @returns True if the fieldset is hidden, false otherwise
 */
export const isFieldSetHidden = (fieldset: HTMLFieldSetElement) => {
  const optionSetWrapper = fieldset.closest('.emtlkit--option-set-wrapper') as HTMLElement | null
  return optionSetWrapper && optionSetWrapper.style.display === 'none'
}
