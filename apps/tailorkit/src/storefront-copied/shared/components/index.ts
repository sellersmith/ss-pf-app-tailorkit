// fontStorefrontLoader lives in its own leaf module to break the circular
// dependency with registerOptionSetElements. Re-exported here for backward
// compatibility; new code should import it from './font-storefront-loader'.
// See font-storefront-loader.ts for the full TDZ explanation.
export { fontStorefrontLoader } from './font-storefront-loader'

export { registerOptionSetElements } from './registerOptionSetElements'
export { registerTextCustomerElements } from './TextCustomer'
