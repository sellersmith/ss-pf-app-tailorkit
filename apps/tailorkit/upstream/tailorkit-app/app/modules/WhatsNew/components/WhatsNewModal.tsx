import {
  Bleed,
  BlockStack,
  Box,
  Button,
  Divider,
  InlineStack,
  Modal,
  Scrollable,
  Spinner,
  Text,
} from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { useWhatsNewContext } from '../providers/WhatsNewProvider'
import { NotificationItem } from './NotificationItem'
import { TutorialCard } from './TutorialCard'
import { NotificationSkeletonList } from './NotificationSkeleton'
import { NotificationTabs } from './NotificationTabs'
import type { Notification, NotificationTab } from '../types'
import { useModal } from '~/utils/hooks/useModal'
import { MODAL_ID } from '~/constants/modal'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getWhatsNewEmptyStateMessage } from '../utils/getWhatsNewEmptyStateMessage'
import { WHATS_NEW_PAGE_SIZE, WHATS_NEW_MODAL_HEIGHT } from '../constants'

/**
 * Main What's New modal component
 * Displays notifications with tabs, filtering, and mark as read functionality
 */
export function WhatsNewModal() {
  const { t } = useTranslation()
  const { state, closeModal } = useModal()
  const modalState = state?.[MODAL_ID.WHATS_NEW_MODAL]
  const isOpen = modalState?.active || false

  const { notifications, allNotifications, isLoading, activeTab, setActiveTab, markAsRead } = useWhatsNewContext()

  const [visibleCountByTab, setVisibleCountByTab] = useState<Record<NotificationTab, number>>({
    all: WHATS_NEW_PAGE_SIZE,
    'hot-trends': WHATS_NEW_PAGE_SIZE,
    'new-features': WHATS_NEW_PAGE_SIZE,
    tutorials: WHATS_NEW_PAGE_SIZE,
    promotions: WHATS_NEW_PAGE_SIZE,
    unread: WHATS_NEW_PAGE_SIZE,
  })

  // Clamp visible count when the filtered list shrinks (e.g., Unread tab after marking read)
  // Also reset to initial page size when switching tabs or when notifications load from empty
  useEffect(() => {
    setVisibleCountByTab(prev => {
      const current = prev[activeTab] ?? WHATS_NEW_PAGE_SIZE

      // If notifications are empty, reset to initial page size (don't clamp to 0)
      if (notifications.length === 0) {
        return current === WHATS_NEW_PAGE_SIZE ? prev : { ...prev, [activeTab]: WHATS_NEW_PAGE_SIZE }
      }

      // If current count is 0 but we have notifications, reset to initial page size or available count
      if (current === 0) {
        const resetValue = Math.min(WHATS_NEW_PAGE_SIZE, notifications.length)
        return { ...prev, [activeTab]: resetValue }
      }

      // If current count exceeds available notifications, clamp down
      const clamped = Math.min(current, notifications.length)
      return clamped === current ? prev : { ...prev, [activeTab]: clamped }
    })
  }, [activeTab, notifications.length])

  const visibleCount = visibleCountByTab[activeTab] ?? WHATS_NEW_PAGE_SIZE
  const visibleNotifications = useMemo(() => notifications.slice(0, visibleCount), [notifications, visibleCount])
  const hasMore = visibleCount < notifications.length

  const handleLoadMore = useCallback(() => {
    if (!hasMore) return
    setVisibleCountByTab(prev => {
      const current = prev[activeTab] ?? WHATS_NEW_PAGE_SIZE
      const next = Math.min(notifications.length, current + WHATS_NEW_PAGE_SIZE)
      return next === current ? prev : { ...prev, [activeTab]: next }
    })
  }, [activeTab, hasMore, notifications.length])

  // Memoize unread count calculation - optimized to iterate once
  const { totalUnreadCount, unreadCountInActiveTab } = useMemo(() => {
    let total = 0
    let inTab = 0

    const isInActiveTab = (n: Notification): boolean => {
      switch (activeTab) {
        case 'hot-trends':
          return n.type === 'blog'
        case 'new-features':
          return n.type === 'changelog' || n.type === 'new-feature'
        case 'tutorials':
          return n.type === 'tutorial'
        case 'promotions':
          return n.type === 'promotion'
        case 'unread':
          return true
        case 'all':
        default:
          return true
      }
    }

    for (const n of allNotifications) {
      if (!n.isRead) {
        total++
        if (isInActiveTab(n)) inTab++
      }
    }

    return { totalUnreadCount: total, unreadCountInActiveTab: inTab }
  }, [activeTab, allNotifications])

  const emptyStateMessage = useMemo(() => {
    return getWhatsNewEmptyStateMessage({
      t,
      activeTab,
      hasAnyNotifications: allNotifications.length > 0,
      hasUnreadNotifications: totalUnreadCount > 0,
    })
  }, [activeTab, allNotifications.length, t, totalUnreadCount])

  const handleClose = useCallback(() => {
    closeModal(MODAL_ID.WHATS_NEW_MODAL)
  }, [closeModal])

  const handleMarkAllAsRead = useCallback(async () => {
    const isInTab = (n: Notification): boolean => {
      switch (activeTab) {
        case 'hot-trends':
          return n.type === 'blog'
        case 'new-features':
          return n.type === 'changelog' || n.type === 'new-feature'
        case 'tutorials':
          return n.type === 'tutorial'
        case 'promotions':
          return n.type === 'promotion'
        case 'unread':
          return true
        case 'all':
        default:
          return true
      }
    }

    const unreadInTab = allNotifications.filter(n => isInTab(n) && !n.isRead)
    if (unreadInTab.length === 0) return

    const idsByType = unreadInTab.reduce<Record<Notification['type'], string[]>>(
      (acc, n) => {
        acc[n.type] = acc[n.type] || []
        acc[n.type].push(n.id)
        return acc
      },
      {} as Record<Notification['type'], string[]>
    )

    await Promise.all(
      (Object.entries(idsByType) as Array<[Notification['type'], string[]]>).map(([type, ids]) =>
        ids.length ? markAsRead(ids, type) : Promise.resolve()
      )
    )
  }, [activeTab, allNotifications, markAsRead])

  const handleMarkAsRead = useCallback(
    (notificationId: string, notificationType: Notification['type']) => {
      markAsRead(notificationId, notificationType)
    },
    [markAsRead]
  )

  // No need to refetch - data is prefetched in Dashboard and synced via initialData prop
  // The useWhatsNew hook will automatically update when initialData changes

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title={t('what-s-new')}
      noScroll
      secondaryActions={[
        {
          content: t('close'),
          onAction: handleClose,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="200">
          {/* Tabs */}
          <Bleed marginInline="300" marginBlock={'200'}>
            <NotificationTabs activeTab={activeTab} onTabChange={setActiveTab} />
          </Bleed>

          {/* Mark all as read button - shown below tabs */}
          <InlineStack align="end">
            <Button
              variant="plain"
              onClick={handleMarkAllAsRead}
              disabled={unreadCountInActiveTab === 0 || isLoading || notifications.length === 0}
            >
              {t('mark-all-as-read')}
            </Button>
          </InlineStack>

          <Divider borderColor="border" borderWidth="025" />

          {/* Content Area - Fixed height */}
          {isLoading ? (
            <NotificationSkeletonList />
          ) : notifications.length === 0 ? (
            <Box padding="500" minHeight={WHATS_NEW_MODAL_HEIGHT}>
              <InlineStack align="center" gap="200">
                <Text as="p" tone="subdued">
                  {emptyStateMessage}
                </Text>
              </InlineStack>
            </Box>
          ) : (
            <Scrollable
              style={{ height: WHATS_NEW_MODAL_HEIGHT, maxHeight: WHATS_NEW_MODAL_HEIGHT, overflowX: 'hidden' }}
              onScrolledToBottom={handleLoadMore}
            >
              <BlockStack gap="0">
                {visibleNotifications.map((notification, index) =>
                  notification.type === 'tutorial' ? (
                    <TutorialCard
                      key={`${notification.type}-${notification.id}-${index}`}
                      tutorial={notification}
                      onMarkAsRead={handleMarkAsRead}
                    />
                  ) : (
                    <NotificationItem
                      key={`${notification.type}-${notification.id}-${index}`}
                      notification={notification}
                      onMarkAsRead={handleMarkAsRead}
                    />
                  )
                )}
              </BlockStack>
              {hasMore ? (
                <Box padding="200">
                  <InlineStack align="center" gap="200">
                    <Spinner size="small" />
                    <Text as="span" tone="subdued">
                      {t('loading-more')}
                    </Text>
                  </InlineStack>
                </Box>
              ) : null}
            </Scrollable>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  )
}
