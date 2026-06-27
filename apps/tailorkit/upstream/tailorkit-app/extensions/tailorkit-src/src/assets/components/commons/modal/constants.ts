// Define modal size constants
export const MODAL_SIZES = {
  MEDIUM: 'medium',
  SMALL: 'small',
  LARGE: 'large',
} as const

export type ModalSize = (typeof MODAL_SIZES)[keyof typeof MODAL_SIZES]
