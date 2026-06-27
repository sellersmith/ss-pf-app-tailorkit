import type { NotificationTab } from '../types'

type TranslateFn = (key: string) => string

interface GetWhatsNewEmptyStateMessageParams {
  /**
   * i18next translate function from `useTranslation()`.
   */
  t: TranslateFn
  /**
   * The currently selected tab.
   */
  activeTab: NotificationTab
  /**
   * Whether there is at least one notification across all tabs.
   */
  hasAnyNotifications: boolean
  /**
   * Whether there is at least one unread notification across all tabs.
   */
  hasUnreadNotifications: boolean
}

/**
 * Returns a tab-specific empty state message for the What's New modal.
 * Keeps the UI informative when a specific tab has zero items while other tabs may have data.
 */
export function getWhatsNewEmptyStateMessage({
  t,
  activeTab,
  hasAnyNotifications,
  hasUnreadNotifications,
}: GetWhatsNewEmptyStateMessageParams): string {
  // When the entire feed is empty, always show the global message.
  if (!hasAnyNotifications) return t('no-notifications')

  switch (activeTab) {
    case 'hot-trends':
      return t('no-hot-trends')
    case 'promotions':
      return t('no-promotions')
    case 'new-features':
      return t('no-new-features')
    case 'tutorials':
      return t('no-tutorials')
    case 'unread':
      return hasUnreadNotifications ? t('no-unread-notifications') : t('you-re-all-caught-up')
    case 'all':
    default:
      return t('no-notifications')
  }
}
