// utils/clickConditions.ts
export const isTextShapeChange = (target: HTMLElement) => {
  return target.closest('.emtlkit--select-option')?.getAttribute('data-selection') === 'text-shape'
}

export const isImageOptionClick = (target: HTMLElement) => {
  return target.classList.contains('emtlkit-image-option') || !!target.closest('.emtlkit-image-option')
}

export const isMaskOptionClick = (target: HTMLElement) => {
  return target.classList.contains('emtlkit-mask-option') || !!target.closest('.emtlkit-mask-option')
}

export const isImagelessOptionClick = (target: HTMLElement) => {
  return target.classList.contains('emtlkit-imageless-option') || !!target.closest('.emtlkit-imageless-option')
}

export const isTextOptionClick = (target: HTMLElement) => {
  return target.classList.contains('emtlkit-text-option') || !!target.closest('.emtlkit-text-option')
}

export const isColorOptionClick = (target: HTMLElement) => {
  return target.classList.contains('emtlkit-color-option') || !!target.closest('.emtlkit-color-option')
}

export const isFontOptionClick = (target: HTMLElement) => {
  return target.classList.contains('emtlkit--font-option-set') || !!target.closest('.emtlkit--font-option-set')
}

export const isMultiLayoutOptionClick = (target: HTMLElement) => {
  const className = 'emtlkit-multi_layout-option'

  return target.classList.contains(className) || !!target.closest(`.${className}`)
}

export const isGenerateTextWithAI = (target: HTMLElement) => {
  const isContainGenerateTextWithAI = target.classList.contains('emtlkit--generate-text-with-ai')
  const isClosestGenerateTextWithAI = !!target.closest('.emtlkit--generate-text-with-ai')
  const isContainMagicIcon = target.classList.contains('emtlkit--magic-icon')
  const isClosestMagicIcon = !!target.closest('.emtlkit--magic-icon')

  return isContainGenerateTextWithAI || isClosestGenerateTextWithAI || isContainMagicIcon || isClosestMagicIcon
}

export const isUploadButtonClick = (target: HTMLElement) => {
  return target.classList.contains('emtlkit-button--upload')
}

export const isEditUploadedImageButtonClick = (target: HTMLElement) => {
  // Check if the target has data-option-id attribute and is within an uploaded image option
  return target.hasAttribute('data-option-id') && !!target.closest('.emtlkit-image-option')
}

export const isDeleteImageButtonClick = (target: HTMLElement) => {
  // Check if the target is the delete button or within it
  return (
    target.classList.contains('emtlkit-image-option-delete-btn') || !!target.closest('.emtlkit-image-option-delete-btn')
  )
}

export const isGenerateImageWithAI = (target: HTMLElement) => {
  const isContainGenerateImageWithAI = target.classList.contains('emtlkit-button ai-generate')
  const isClosestGenerateImageWithAI = !!target.closest('.emtlkit-button.ai-generate')
  return isContainGenerateImageWithAI || isClosestGenerateImageWithAI
}
