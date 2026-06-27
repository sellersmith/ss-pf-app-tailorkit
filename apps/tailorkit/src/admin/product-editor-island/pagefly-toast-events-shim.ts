import { t } from 'i18next'
import { TOAST } from '../../../upstream/tailorkit-app/app/constants/toasts'

interface ToastOptions {
  duration?: number
  isError?: boolean
  action?: string
  onAction?: () => void
  onDismiss?: () => void
}

interface TailorKitToastBridge {
  toast?: {
    show?: (message: string, options?: ToastOptions) => void
    hide?: (id: string) => void
  }
}

interface PageFlyNotificationPort {
  show(message: string, tone?: 'success' | 'critical' | 'info'): void
}

let pageflyNotificationPort: PageFlyNotificationPort | null = null

/** Bind copied TailorKit toast calls to the current PageFly admin host notification port. */
export function bindPageFlyToastNotifications(port: PageFlyNotificationPort | null) {
  pageflyNotificationPort = port
}

export function getWindowShopify(): TailorKitToastBridge | undefined {
  if (typeof window === 'undefined') return undefined

  return window.opener?.shopify ?? window.shopify
}

export function showToastI18n(key: string, opts?: ToastOptions, i18nOptions?: Record<string, unknown>) {
  const message = t(key, {
    ...(i18nOptions ?? {}),
    defaultValue: t(TOAST.COMMON.ERROR_GENERIC, { defaultValue: 'An error occurred' }),
  })

  showToast(message, opts)
}

export function showGenericErrorToast() {
  showToastI18n('toast.error.generic', { isError: true })
}

export function showToast(message: string, opts?: ToastOptions) {
  const optsWithDuration = { ...opts, duration: opts?.action ? 10000 : 2000 }
  const show = getWindowShopify()?.toast?.show

  if (show) {
    show(message, optsWithDuration)
    return
  }

  pageflyNotificationPort?.show(message, opts?.isError ? 'critical' : 'info')
}

export function hideToast(id: string) {
  getWindowShopify()?.toast?.hide?.(id)
}
