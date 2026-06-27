import { CharmPickerElement } from './charm-picker-element'

export const CHARM_PICKER_TAG = 'tailorkit-charm-picker'

export function registerCharmPickerElement() {
  if (typeof globalThis === 'undefined' || !('customElements' in globalThis)) return
  if (!globalThis.customElements.get(CHARM_PICKER_TAG)) {
    globalThis.customElements.define(CHARM_PICKER_TAG, CharmPickerElement)
  }
}

export { CharmPickerElement } from './charm-picker-element'
export { CHARM_CHANGE_EVENT } from './charm-picker-element'
export type {
  StorefrontCharmConfig,
  StorefrontCharmProduct,
  CharmProductFullData,
  CharmChangeDetail,
  CharmSelection,
} from './charm-picker-types'
