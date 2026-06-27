import { FontLoader } from '../../assets/utils/font-loader'

// Must initialize BEFORE re-exporting registerOptionSetElements: that re-export
// triggers FontSwatchElement to load via customElements.define, which can fire
// connectedCallback synchronously for existing DOM elements and reach into
// fontStorefrontLoader during module init — causing a TDZ ReferenceError.
export const fontStorefrontLoader = new FontLoader()

export { registerOptionSetElements } from './registerOptionSetElements'
export { registerTextCustomerElements } from './TextCustomer'
