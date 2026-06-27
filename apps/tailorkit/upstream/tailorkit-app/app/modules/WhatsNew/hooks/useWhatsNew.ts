import { useCallback, useEffect, useState } from 'react'
import { authenticatedFetch } from '~/shopify/fns.client'
import type { Notification, NotificationTab, WhatsNewResponse } from '../types'

function isWhatsNewResponse(value: unknown): value is WhatsNewResponse {
  if (!value || typeof value !== 'object') return false
  const v = value as { notifications?: unknown; unreadCount?: unknown }
  return Array.isArray(v.notifications) && typeof v.unreadCount === 'number'
}

/**
 * Hook for managing What's New notifications
 * Handles fetching, filtering, and marking notifications as read
 */
export function useWhatsNew(initialData?: WhatsNewResponse | null) {
  const normalizedInitialData = isWhatsNewResponse(initialData) ? initialData : null

  const [notifications, setNotifications] = useState<Notification[]>(normalizedInitialData?.notifications || [])
  const [unreadCount, setUnreadCount] = useState(normalizedInitialData?.unreadCount || 0)
  const [isLoading, setIsLoading] = useState(!normalizedInitialData)
  const [activeTab, setActiveTab] = useState<NotificationTab>('all')

  /**
   * Fetch notifications from API (includes badge count)
   * Single request for both badge count and full data
   */
  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = (await authenticatedFetch('/api/whats-new', {
        preferCache: true,
      })) as WhatsNewResponse | null

      if (isWhatsNewResponse(data)) {
        setNotifications(data.notifications)
        setUnreadCount(data.unreadCount)
      } else {
        console.warn('[WhatsNew] Invalid response shape from /api/whats-new. Received:', data)
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Mark one or more notifications as read
   */
  const markAsRead = useCallback(
    async (notificationIds: string | string[], notificationType: Notification['type']) => {
      const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds]
      try {
        // Optimistically update UI (immediate indicator feedback)
        const idsSet = new Set(ids)
        let changedCount = 0
        const now = new Date()

        setNotifications(prev =>
          prev.map(n => {
            if (idsSet.has(n.id) && n.type === notificationType && !n.isRead) {
              changedCount += 1
              return { ...n, isRead: true, readAt: now }
            }
            return n
          })
        )

        setUnreadCount(prev => Math.max(0, prev - changedCount))

        await authenticatedFetch('/api/whats-new', {
          method: 'POST',
          body: JSON.stringify({
            action: 'mark-read',
            notificationIds: ids,
            notificationType,
          }),
        })
      } catch (error) {
        console.error('Failed to mark notifications as read:', error)
        // Refetch on error to sync state
        await fetchNotifications()
      }
    },
    [fetchNotifications]
  )

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(async () => {
    try {
      // Optimistically update UI (immediate indicator feedback)
      setNotifications(prev => prev.map(n => (n.isRead ? n : { ...n, isRead: true, readAt: new Date() })))
      setUnreadCount(0)

      await authenticatedFetch('/api/whats-new', {
        method: 'POST',
        body: JSON.stringify({
          action: 'mark-all-read',
        }),
      })
    } catch (error) {
      console.error('Failed to mark all as read:', error)
      // Refetch on error to sync state
      await fetchNotifications()
    }
  }, [fetchNotifications])

  /**
   * Filter notifications by active tab
   */
  const filteredNotifications = useCallback(
    (tab: NotificationTab): Notification[] => {
      switch (tab) {
        case 'hot-trends':
          return notifications.filter(n => n.type === 'blog')
        case 'new-features':
          return notifications.filter(n => n.type === 'changelog' || n.type === 'new-feature')
        case 'tutorials':
          return notifications.filter(n => n.type === 'tutorial')
        case 'promotions':
          return notifications.filter(n => n.type === 'promotion')
        case 'unread':
          return notifications.filter(n => !n.isRead)
        case 'all':
        default:
          return notifications
      }
    },
    [notifications]
  )

  // Sync initialData changes to state (when background fetch completes)
  // Or fetch fresh data if initialData is missing/invalid
  useEffect(() => {
    if (isWhatsNewResponse(initialData)) {
      setNotifications(initialData.notifications)
      setUnreadCount(initialData.unreadCount)
      setIsLoading(false)
      return
    }

    // If initialData is missing or invalid, fetch fresh data on mount/update.
    // Single request fetches both badge count and full notifications
    // This prevents a "truthy but empty" initial payload (e.g. {success:false,message:'aborted'})
    // from forcing the UI into a permanent global empty state.
    fetchNotifications().catch(() => {})
  }, [fetchNotifications, initialData])

  return {
    notifications: filteredNotifications(activeTab),
    allNotifications: notifications,
    unreadCount,
    isLoading,
    activeTab,
    setActiveTab,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  }
}
