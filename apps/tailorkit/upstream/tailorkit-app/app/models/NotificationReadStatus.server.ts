import mongoose from '~/bootstrap/db/connect-db.server'

/**
 * Notification Read Status Document
 * Tracks which notifications have been read by each shop
 */
export interface NotificationReadStatusDocument {
  shopDomain: string
  notificationId: string
  notificationType: 'changelog' | 'blog' | 'promotion' | 'new-feature' | 'tutorial'
  readAt: Date
  createdAt?: Date
  updatedAt?: Date
}

const notificationReadStatusSchema = new mongoose.Schema<NotificationReadStatusDocument>(
  {
    shopDomain: {
      type: String,
      required: true,
      index: true,
    },
    notificationId: {
      type: String,
      required: true,
    },
    notificationType: {
      type: String,
      required: true,
      enum: ['changelog', 'blog', 'promotion', 'new-feature', 'tutorial'],
    },
    readAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: true }
)

// Compound index for efficient queries and unique constraint
notificationReadStatusSchema.index({ shopDomain: 1, notificationType: 1, notificationId: 1 }, { unique: true })

const NotificationReadStatus
  = mongoose.models.NotificationReadStatus
  || mongoose.model<NotificationReadStatusDocument>('NotificationReadStatus', notificationReadStatusSchema)

export default NotificationReadStatus

/**
 * Mark a notification as read for a shop
 * @param shopDomain - The shop domain
 * @param notificationId - The notification ID
 * @param notificationType - The notification type
 * @returns The created or updated read status document
 */
export async function markNotificationAsRead(
  shopDomain: string,
  notificationId: string,
  notificationType: NotificationReadStatusDocument['notificationType']
): Promise<NotificationReadStatusDocument> {
  return NotificationReadStatus.findOneAndUpdate(
    {
      shopDomain,
      notificationId,
      notificationType,
    },
    {
      shopDomain,
      notificationId,
      notificationType,
      readAt: new Date(),
    },
    { upsert: true, new: true }
  )
}

/**
 * Mark multiple notifications as read for a shop
 * @param shopDomain - The shop domain
 * @param notifications - Array of { notificationId, notificationType }
 * @returns Number of notifications marked as read
 */
export async function markMultipleNotificationsAsRead(
  shopDomain: string,
  notifications: Array<{
    notificationId: string
    notificationType: NotificationReadStatusDocument['notificationType']
  }>
): Promise<number> {
  if (notifications.length === 0) return 0

  const bulkOps = notifications.map(({ notificationId, notificationType }) => ({
    updateOne: {
      filter: {
        shopDomain,
        notificationId,
        notificationType,
      },
      update: {
        $set: {
          shopDomain,
          notificationId,
          notificationType,
          readAt: new Date(),
        },
      },
      upsert: true,
    },
  }))

  const result = await NotificationReadStatus.bulkWrite(bulkOps)
  return result.modifiedCount + result.upsertedCount
}

/**
 * Get read statuses for a shop
 * @param shopDomain - The shop domain
 * @returns Map of notification keys to read dates
 */
export async function getReadStatusesForShop(shopDomain: string): Promise<Map<string, Date>> {
  const readStatuses = await NotificationReadStatus.find({ shopDomain })

  const readStatusMap = new Map<string, Date>()
  readStatuses.forEach(status => {
    const key = `${status.notificationType}:${status.notificationId}`
    readStatusMap.set(key, status.readAt)
  })

  return readStatusMap
}

/**
 * Get unread count for a shop
 * @param shopDomain - The shop domain
 * @param allNotificationIds - Array of all notification IDs with their types
 * @returns Number of unread notifications
 */
export async function getUnreadCount(
  shopDomain: string,
  allNotificationIds: Array<{
    notificationId: string
    notificationType: NotificationReadStatusDocument['notificationType']
  }>
): Promise<number> {
  if (allNotificationIds.length === 0) return 0

  const readStatuses = await NotificationReadStatus.find({
    shopDomain,
    $or: allNotificationIds.map(({ notificationId, notificationType }) => ({
      notificationId,
      notificationType,
    })),
  })

  const readSet = new Set<string>()
  readStatuses.forEach(status => {
    const key = `${status.notificationType}:${status.notificationId}`
    readSet.add(key)
  })

  return allNotificationIds.filter(
    ({ notificationId, notificationType }) => !readSet.has(`${notificationType}:${notificationId}`)
  ).length
}
