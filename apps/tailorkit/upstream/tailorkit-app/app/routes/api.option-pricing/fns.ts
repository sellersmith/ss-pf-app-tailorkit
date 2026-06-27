import { EPROVIDER } from '~/constants/fulfillment-providers'

/**
 * Get the handle for the option pricing product
 * @param appHandle - The handle of the app
 * @returns The handle for the option pricing product
 */
export function getOptionPricingProductHandle(appHandle: string) {
  return `${appHandle}-item-personalization`
}

/**
 * Get the excluded vendors
 * @returns The excluded vendors
 */
export function getExcludedVendors() {
  return [EPROVIDER.TAILORKIT_DEMO_PRODUCT]
}
