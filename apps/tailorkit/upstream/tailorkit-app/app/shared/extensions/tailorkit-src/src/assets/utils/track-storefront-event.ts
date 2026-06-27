import { APP_PROXY_PATH } from '../constants'
import { STORE_FRONT_ACTION } from '../constants/app-actions'
import { fetchWithAdminContext } from '../libraries/fetchWithAdminContext'

/**
 * Track a storefront event via the app proxy TRACK_EVENT handler.
 * Fire-and-forget — errors are silently caught and logged.
 *
 * Consolidates the duplicate `trackStorefrontEvent` helpers that were
 * previously inlined in upload-image.ts, generateImageWithAi.ts, and PromptPresets.tsx.
 */
export function trackStorefrontEvent(eventName: string, properties: Record<string, any>): void {
  const formData = new FormData()
  formData.append('action', STORE_FRONT_ACTION.TRACK_EVENT)
  formData.append('eventName', eventName)
  formData.append('properties', JSON.stringify(properties))

  fetchWithAdminContext(`${APP_PROXY_PATH}/app_proxy/storefront`, {
    method: 'POST',
    body: formData,
  }).catch((err) => {
    console.error('[TK Analytics] trackStorefrontEvent failed:', err)
  })
}

/**
 * Storefront event name constants — mirrors the server-side EVENTS_TRACKING entries.
 * Kept here to avoid hard-coded strings in extension code.
 */
export const STOREFRONT_EVENTS = {
  PRODUCT_PAGE_VIEW: 'storefront_product_page_view',
  PERSONALIZATION_START: 'storefront_personalization_start',
  PERSONALIZATION_COMPLETE: 'storefront_personalization_complete',
  ADD_TO_CART: 'storefront_add_to_cart',
  UPLOAD_IMAGE: 'storefront_upload_image',
  BUILD_WITH_AI: 'storefront_build_with_ai',
  CLIPART_VIEW: 'storefront_clipart_view',
  CLIPART_SELECT: 'storefront_clipart_select',
  QUICK_PROMPT_VIEW: 'storefront_quick_prompt_view',
  QUICK_PROMPT_SELECT: 'storefront_quick_prompt_select',
  QUICK_PROMPT_CONVERT: 'storefront_quick_prompt_convert',
  ERROR: 'storefront_error',
} as const
