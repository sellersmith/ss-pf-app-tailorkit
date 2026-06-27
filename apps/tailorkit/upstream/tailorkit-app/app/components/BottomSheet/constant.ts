import { isShopifyMobileApp } from '~/constants/shopify'
export const DEFAULT_SNAP_HEIGHT = typeof window !== 'undefined' ? (window?.innerHeight || 600) * 0.65 : 600 * 0.65
export const MIN_SNAP_HEIGHT = typeof window !== 'undefined' ? (window?.innerHeight || 600) * 0.3 : 600 * 0.3
export const MAX_SNAP_HEIGHT = typeof window !== 'undefined' ? (window?.innerHeight || 600) - 50 : 600 - 50 // not override the editor header bar
export const HEADER_HEIGHT = 72
export const INITIAL_OFFSET_HEIGHT = isShopifyMobileApp() ? 80 : 0
export const HEADER_HEIGHT_WITH_OFFSET = HEADER_HEIGHT + INITIAL_OFFSET_HEIGHT
