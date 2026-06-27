import { TOAST } from '~/constants/toasts'
import { t } from 'i18next'

interface ToastOptions {
  /**
   * The length of time in milliseconds the toast message should persist.
   * @defaultValue 5000
   */
  duration?: number
  /**
   * Display an error-styled toast.
   * @defaultValue false
   */
  isError?: boolean
  /**
   * Content of an action button.
   */
  action?: string
  /**
   * Callback fired when the action button is clicked.
   */
  onAction?: () => void
  /**
   * Callback fired when the dismiss icon is clicked
   */
  onDismiss?: () => void
}

export function getWindowShopify() {
  return window.opener?.shopify ?? window.shopify
}

/**
 * Show a toast using an i18n key, useful in non-React modules where `t()` is not available.
 *
 * Note: This intentionally uses a short generic fallback message to align with Shopify
 * toast best practices.
 */
export function showToastI18n(key: string, opts?: ToastOptions, i18nOptions?: Record<string, unknown>) {
  const message = t(key, {
    ...(i18nOptions ?? {}),
    defaultValue: t(TOAST.COMMON.ERROR_GENERIC, { defaultValue: 'An error occurred' }),
  })

  showToast(message, opts)
}

/**
 * Standardized generic error toast. Use this for any dynamic/server error message to
 * avoid surfacing unbounded text in Toast UI.
 */
export function showGenericErrorToast() {
  showToastI18n('toast.error.generic', { isError: true })
}

export function showToast(message: string, opts?: ToastOptions) {
  const _shopify = getWindowShopify()
  const optsWithDuration = { ...opts, duration: opts?.action ? 10000 : 2000 }

  _shopify.toast.show(message, optsWithDuration)
}

export function hideToast(id: string) {
  const _shopify = getWindowShopify()

  _shopify.toast.hide(id)
}
