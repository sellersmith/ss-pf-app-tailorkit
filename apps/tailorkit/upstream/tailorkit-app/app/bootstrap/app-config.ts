// ⚡ Anby - Critical Fix: Review identified proper use of optional chaining for preventing null reference ...
// ⚡ Fixed critical issues that could cause crashes
// 📝 Generated: 2025-06-09 14:23:32

import { safeUrlHandler } from '~/utils/safeUrlHandler'

export const adminPages = ['/admin', '/admin/quotas', '/admin/web-vitals']
// List of unauthenticated public pages
export const unAuthPages = [
  '/',
  '/auth/login',
  '/api/public/print-image-generation',
  '/maintenance-mode',
  ...adminPages,
]

/**
 * Determines if the given URL corresponds to a public (unauthenticated) route.
 * @param url - The URL object or string to check.
 * @returns {boolean} - `true` if the URL is a public route, `false` otherwise.
 */
export const isAuthRoute = (url: URL | string): boolean =>
  safeUrlHandler(url, urlObj => !unAuthPages.includes(urlObj?.pathname?.toLowerCase() || ''))

/**
 * Determines if the given URL corresponds to an API public route.
 * @param url - The URL object or string to check.
 * @returns {boolean} - `true` if the URL starts with `/api/public/`, `false` otherwise.
 */
export const isPublicRoute = (url: URL | string): boolean =>
  safeUrlHandler(url, urlObj => {
    const pathname = urlObj?.pathname?.toLowerCase()
    return pathname?.startsWith('/api/public/') || pathname?.startsWith('/maintenance-mode') || false
  })

/**
 * Defines the navigation menu items.
 * @enum {string}
 * @readonly
 * @enum {string}
 * @readonly
 */
export enum NavMenuItems {
  DASHBOARD = '/dashboard',
  PERSONALIZED_PRODUCTS = '/personalized-products',
  TEMPLATES = '/templates',
  LIBRARIES = '/libraries',
  PRODUCTS = '/products',
  INTEGRATIONS = '/integrations',
  STOREFRONT_SETUP = '/storefront-setup',
  STOREFRONT_SETUP_STOREFRONT = '/storefront-setup/storefront',
  STOREFRONT_SETUP_SALES = '/storefront-setup/sales',
  STOREFRONT_SETUP_AI_TOOLS = '/storefront-setup/ai-tools',
  QUICK_PROMPTS = '/storefront-setup/quick-prompts',
  STOREFRONT_SETUP_STYLING = '/storefront-setup/styling',
  STOREFRONT_SETUP_CHECKBOXES = '/storefront-setup/checkboxes',
  STOREFRONT_SETUP_CHECKBOXES_STYLING = '/storefront-setup/checkboxes/styling',
  STOREFRONT_SETUP_CHECKBOXES_ONBOARDING = '/storefront-setup/checkboxes/onboarding',
  ORDERS = '/orders',
  PROVIDERS = '/settings/providers',
  PROVIDERS_CONNECTION = '/settings/providers/connection',
  PROVIDERS_INTEGRATION = '/settings/providers/integration',
  PROVIDERS_PRODUCT = '/settings/providers/product',
  ANALYTICS = '/analytics',
  PRICING = '/pricing',
  SETTINGS = '/settings',
  COMMUNITY = '/community',
}

// Define navigation menu
export const enabledNavMenuItems: string[] = [
  '/dashboard',
  '/personalized-products',
  '/templates',
  '/libraries',
  '/products',
  // '/integrations',
  '/orders',
  '/settings/providers',
  '/settings/providers/connection',
  '/settings/providers/integration',
  '/settings/providers/product',
  '/analytics',
  '/pricing',
  '/settings',
  '/community',
]
export const disabledNavMenuItems: string[] = ['']
export const rootPage = enabledNavMenuItems[0]

// Define function to check if a navigation menu is enabled
export function isNavMenuItemEnabled(path: string): boolean {
  if (enabledNavMenuItems.includes(path)) {
    return true
  }

  if (disabledNavMenuItems.includes(path)) {
    return false
  }

  if (enabledNavMenuItems.length > 0 && disabledNavMenuItems.length === 0) {
    return false
  }

  if (disabledNavMenuItems.length > 0 && enabledNavMenuItems.length === 0) {
    return true
  }

  return true
}

// Define whether a print area can be linked to all product variants
export const printAreaCanLinkToAllProductVariants = false
