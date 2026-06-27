/**
 * Notification types supported by the What's New system
 */
export type NotificationType = 'changelog' | 'blog' | 'promotion' | 'new-feature' | 'tutorial'

/**
 * Metadata structures for different notification types
 */
export interface ChangelogMetadata {
  version: string
  features: Array<{ value: string }>
  improvements: Array<{ value: string }>
  bugsFixed: Array<{ value: string }>
}

export interface BlogMetadata {
  id?: string
  key?: string
  title?: string
  description?: string
  image?: string
  buttonLink?: string
  button_link?: string
  position?: string
  startDate?: string
  endDate?: string
  published_at?: string
  publishedAt?: string
  [key: string]: unknown
}

export interface PromotionMetadata {
  key?: string
  appName?: string
  title?: string
  appLogo?: string
  image?: string
  description?: string
  startDate?: string
  endDate?: string
  buttonText?: string
  button_text?: string
  buttonLink?: string
  button_link?: string
  content?: {
    description?: string
  }
  [key: string]: unknown
}

export interface NewFeatureMetadata {
  [key: string]: unknown
}

export interface TutorialMetadata {
  youtubeUrl: string
  duration?: string
}

/**
 * Base notification interface with common fields
 */
interface BaseNotification {
  id: string
  title: string
  content: string
  date: string
  thumbnailUrl?: string
  link?: string
  isRead: boolean
  readAt?: Date | null
}

/**
 * Discriminated union for notification types with type-safe metadata
 */
export type Notification =
  | (BaseNotification & { type: 'changelog'; metadata?: ChangelogMetadata })
  | (BaseNotification & { type: 'blog'; metadata?: BlogMetadata })
  | (BaseNotification & { type: 'promotion'; metadata?: PromotionMetadata })
  | (BaseNotification & { type: 'new-feature'; metadata?: NewFeatureMetadata })
  | (BaseNotification & { type: 'tutorial'; metadata?: TutorialMetadata })

/**
 * Tab filter type for the modal
 */
export type NotificationTab = 'all' | 'hot-trends' | 'new-features' | 'tutorials' | 'promotions' | 'unread'

/**
 * What's New modal state interface
 */
export interface WhatsNewState {
  notifications: Notification[]
  unreadCount: number
  activeTab: NotificationTab
  isLoading: boolean
  isModalOpen: boolean
}

/**
 * API response for fetching notifications
 */
export interface WhatsNewResponse {
  notifications: Notification[]
  unreadCount: number
}

/**
 * Request payload for marking notifications as read
 */
export interface MarkAsReadRequest {
  notificationIds: string | string[]
  notificationType: NotificationType
}
