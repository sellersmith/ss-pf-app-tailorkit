import { showGenericErrorToast } from './toastEvents'
import { getMyShopifySubdomainName } from '~/shopify/fns'
import { openInNewTab } from './openInNewTab'
import type { ShopifyGlobal } from '@shopify/app-bridge-react'
import { ShopifyCountryCode } from '~/constants/countries/country-codes-Shopify'
import { REST_OF_WORLD_CODES } from '~/modules/Fulfillments/Printify/constants'
import type { SAVE_BAR_ID } from '~/constants/save-bar'
import type { MyShopify } from '~/globals'
import { NavMenuItems } from '~/bootstrap/app-config'

/** Check if is browser */
const isBrowser = typeof window !== 'undefined'

/**
 * Retrieves the Shopify instance from the window ShopifyGlobal.
 *
 * @returns {ShopifyGlobal | null} Shopify instance
 */
export const getShopifyInstance = (): (ShopifyGlobal & MyShopify) | null => {
  return isBrowser ? (window.opener?.shopify ?? window.shopify) : null
}

/**
 * Retrieves the Shopify shop domain from the Shopify configuration.
 *
 * @returns {string | null} Shopify Shop Domain
 */
export const getShopifyShopDomain = (): string | undefined | null => {
  const shopify = getShopifyInstance()

  if (!shopify) return null

  return shopify.config.shop
}

/**
 * Navigate to Shopify Admin
 *
 * @example https://admin.shopify.com/store/longpc-tailorkit/{pathName}
 * @param pathName string
 * @returns {void}
 */
export const navigateToShopifyAdmin = (pathName?: string): void => {
  if (!isBrowser) return

  const shopify = getShopifyInstance()

  if (!shopify) {
    showGenericErrorToast()
    return
  }

  const shopifyOrigin = shopify.origin
  const shopDomain = getShopifyShopDomain()

  if (!shopDomain) {
    showGenericErrorToast()
    return
  }

  if (!shopifyOrigin) {
    showGenericErrorToast()
    return
  }

  const store = getMyShopifySubdomainName(shopDomain)

  openInNewTab(`${shopifyOrigin}/store/${store}${pathName}`)
}

/**
 * Get number id of object id
 *
 * @param id string | number
 * @param prefix string
 * @returns string
 */
export function formatShopifyObjectIdToNumberId(id: string | number, prefix: string) {
  if (typeof id === 'number') {
    return id.toString()
  }
  if (!isNaN(Number(id))) {
    return id.toString()
  }
  return id.replace(prefix, '')
}

/**
 * Format number id to Shopify object id
 *
 * @param id string | number
 * @param prefix string
 * @returns string
 */
export function formatNumberIdToShopifyObjectId(id: string | number, prefix: string) {
  if (typeof id === 'number' || !isNaN(Number(id))) {
    return `${prefix}${id}`
  }

  return id
}

/**
 * Type guard to check if a string is a valid country code
 * @param code - The country code to validate
 * @returns boolean indicating if the code is valid
 */
export const isValidShopifyCountryCode = (code: string): code is keyof typeof ShopifyCountryCode => {
  return code in ShopifyCountryCode || REST_OF_WORLD_CODES.includes(code)
}

/**
 * Get the region name for a country code
 * @param code - The country code to look up
 * @returns The region name or undefined if not found
 */
export const getShopifyRegionName = (
  code: keyof typeof ShopifyCountryCode | (typeof REST_OF_WORLD_CODES)[number]
): string => {
  return !REST_OF_WORLD_CODES.includes(code)
    ? ShopifyCountryCode[code as keyof typeof ShopifyCountryCode]
    : 'Rest Of The World'
}

/**
 * Escape special characters in a string for GraphQL
 * @param input - The input string to escape
 * @returns The escaped string
 */
export function sanitizeShopifySearch(input: string = '') {
  return input
    .replace(/[\|\/\\'":+~!*?{}\[\]^()]/g, ' ') // remove special characters
    .replace(/\s+/g, ' ') // normalize spaces
    .trim()
}

/**
 * Opens a save bar
 * @param saveBar - The save bar to open
 */
export function openSaveBar(saveBar: SAVE_BAR_ID) {
  const shopify = getShopifyInstance()

  if (!shopify) {
    showGenericErrorToast()
    return
  }

  const shopifyTailorkit = shopify.tailorkit

  ;(window.shopify as unknown as MyShopify & ShopifyGlobal).tailorkit = {
    ...shopifyTailorkit,
    saveBar,
  }

  shopify.saveBar.show(saveBar)
}

/**
 * Closes a save bar
 * @param saveBar - The save bar to close
 */
export function closeSaveBar(saveBar: SAVE_BAR_ID) {
  const shopify = getShopifyInstance()

  if (!shopify) {
    showGenericErrorToast()
    return
  }

  const shopifyTailorkit = shopify.tailorkit

  ;(window.shopify as unknown as MyShopify & ShopifyGlobal).tailorkit = {
    ...shopifyTailorkit,
    saveBar: null,
  }
  shopify.saveBar.hide(saveBar)
}

/**
 * Get the status of the save bar
 * @returns boolean
 */
export function getSaveBarStatus() {
  const shopifyTailorkit = (shopify as unknown as MyShopify & ShopifyGlobal).tailorkit
  const saveBar = shopifyTailorkit?.saveBar

  if (typeof saveBar === 'function') {
    return false
  }

  return !!saveBar
}

export const MODAL_ROUTES = {
  TEMPLATES: `${NavMenuItems.TEMPLATES}/modal`,
  PERSONALIZED_PRODUCTS: `${NavMenuItems.PERSONALIZED_PRODUCTS}/`,
}

/**
 * Check if the current route is a modal route
 * @param pathname - The current pathname
 * @returns boolean
 */
export function isMaxModalRoute(pathname: string) {
  const routes = Object.values(MODAL_ROUTES)
  return routes.some(route => pathname.startsWith(route))
}

export function isTemplateModalRoute(pathname: string) {
  return pathname.startsWith(MODAL_ROUTES.TEMPLATES)
}

export function isProductEditorModalRoute(pathname: string) {
  return pathname.includes(MODAL_ROUTES.PERSONALIZED_PRODUCTS)
}

export function isOnboardingRoute(search: string) {
  return new URLSearchParams(search).get('onboarding') === 'true'
}

export function isOnboardingEditorRoute(pathname: string, search: string) {
  return pathname.startsWith('/personalized-products/') && isOnboardingRoute(search)
}

export function isBillingApprovedRoute(search: string) {
  return new URLSearchParams(search).get('billing_approved') === 'true'
}
