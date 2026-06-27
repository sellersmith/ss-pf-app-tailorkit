import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import { json } from '~/bootstrap/fns/fetch.server'
import { catchAsync } from '~/utils/catchAsync'
import { CHANGELOG_API } from '~/routes/api.google-sheet/constants'
import { GoogleSheetAction, handleGoogleSheetData } from '../api.google-sheet/fn.server'
import { getPersonalizedBlogPosts, getTutorials } from '~/utils/supabase-client.server'
import { getReadStatusesForShop, markMultipleNotificationsAsRead } from '~/models/NotificationReadStatus.server'
import type { Notification, NotificationType } from '~/modules/WhatsNew/types'
import type { IChangeLog } from '~/bootstrap/hooks/useChangelog'
import { THEME_CARDS } from '~/routes/dashboard/components/themes-promo-data'

/**
 * Promotion provider URL from Google Sheet
 * Same as used in usePromotions hook
 */
const PROMOTION_PROVIDER_URL
  = 'https://script.google.com/macros/s/AKfycbwQIRwt1T-ydwVUaQ4Prz5bZ0M510xVVWQ4UYS7f5dwtL2ajWMLevQatNkDxkLIn8Ir/exec'

// Keep promotions aligned with the old Dashboard card (AppsPromotionCard -> usePromotions)
const PROMOTION_POSITION = 'App Promo Card'

type PromotionLike = {
  startDate?: string
  endDate?: string
  position?: string
  [key: string]: unknown
}

function isWithinIsoWindow(startDate: string | undefined, endDate: string | undefined, nowIso: string): boolean {
  return (!startDate || startDate < nowIso) && (!endDate || endDate > nowIso)
}

/**
 * Generate stable ID for changelog notification
 * Must match normalizeChangelog() ID generation
 */
function generateChangelogId(changelog: IChangeLog): string {
  return changelog.version
}

/**
 * Generate stable ID for blog notification
 * Must match normalizeBlog() ID generation
 * Uses key || id || title (no random) to ensure consistency
 */
function generateBlogId(post: { key?: string; id?: string; title?: string }): string {
  // Use key first (most stable), then id, then title as fallback
  // Never use random to ensure badge count matches full data
  return post.key || post.id || post.title || ''
}

/**
 * Generate stable ID for promotion notification
 * Must match normalizePromotion() ID generation
 * Uses key || appName || title (no random) to ensure consistency
 */
function generatePromotionId(promo: { key?: string; appName?: string; title?: string }): string {
  // Use key first (most stable), then appName, then title as fallback
  // Never use random to ensure badge count matches full data
  return promo.key || String(promo.appName || promo.title || '')
}

/**
 * Format changelog content for preview
 */
function formatChangelogContent(changelog: IChangeLog): string {
  const parts: string[] = []

  if (changelog.features && changelog.features.length > 0) {
    parts.push(
      `New features: ${changelog.features
        .slice(0, 2)
        .map(f => f.value)
        .join(', ')}`
    )
  }

  if (changelog.improvements && changelog.improvements.length > 0) {
    parts.push(
      `Improvements: ${changelog.improvements
        .slice(0, 2)
        .map(i => i.value)
        .join(', ')}`
    )
  }

  if (changelog.bugsFixed && changelog.bugsFixed.length > 0) {
    parts.push(
      `Bug fixes: ${changelog.bugsFixed
        .slice(0, 2)
        .map(b => b.value)
        .join(', ')}`
    )
  }

  return parts.length > 0 ? parts.join('. ') : 'TailorKit version update'
}

/**
 * Normalize changelog data to Notification format
 */
function normalizeChangelog(changelog: IChangeLog): Omit<Notification, 'isRead' | 'readAt'> {
  return {
    id: generateChangelogId(changelog),
    type: 'changelog' as const,
    title: `TailorKit version ${changelog.version}`,
    content: formatChangelogContent(changelog),
    date: changelog.date,
    metadata: {
      version: changelog.version,
      features: changelog.features || [],
      improvements: changelog.improvements || [],
      bugsFixed: changelog.bugsFixed || [],
    },
  }
}

/**
 * Normalize blog post to Notification format
 */
function normalizeBlog(post: {
  id?: string
  key?: string
  title: string
  description: string
  published_at?: string
  publishedAt?: string
  image?: string
  button_link?: string
  buttonLink?: string
  startDate?: string
  endDate?: string
  position?: string
  [key: string]: unknown
}): Omit<Notification, 'isRead' | 'readAt'> {
  const link = post.button_link || post.buttonLink
  const date = post.published_at || post.publishedAt || post.startDate || new Date().toISOString()
  return {
    id: generateBlogId(post),
    type: 'blog' as const,
    title: post.title,
    content: post.description || '',
    date,
    thumbnailUrl: post.image,
    link,
    metadata: post,
  }
}

/**
 * Normalize promotion to Notification format
 */
function normalizePromotion(promotion: {
  key?: string
  appName?: string
  title?: string
  appLogo?: string
  image?: string
  description?: string
  startDate?: string
  endDate?: string
  buttonLink?: string
  [key: string]: unknown
}): Omit<Notification, 'isRead' | 'readAt'> {
  const now = new Date().toISOString()
  const date = promotion.startDate || promotion.endDate || now

  return {
    id: generatePromotionId(promotion),
    type: 'promotion' as const,
    title: promotion.appName || promotion.title || 'New Promotion',
    content: promotion.description || '',
    date,
    thumbnailUrl: promotion.appLogo || promotion.image,
    link: promotion.buttonLink,
    metadata: promotion,
  }
}

/**
 * Normalize new feature to Notification format
 * For now, we'll return empty array as new features are handled differently
 * This can be extended later with a config or database source
 */
function normalizeNewFeature(): Omit<Notification, 'isRead' | 'readAt'>[] {
  // New features are currently hardcoded in NewFeatureCard
  // For now, return empty array - can be extended later
  return []
}

/**
 * Normalize tutorial to Notification format
 */
function normalizeTutorial(tutorial: {
  id: string
  name: string
  thumbnail: string
  youtubeUrl: string
  duration?: string
}): Omit<Notification, 'isRead' | 'readAt'> {
  return {
    id: tutorial.id,
    type: 'tutorial' as const,
    title: tutorial.name,
    content: '',
    date: new Date().toISOString(),
    thumbnailUrl: tutorial.thumbnail,
    link: tutorial.youtubeUrl,
    metadata: {
      youtubeUrl: tutorial.youtubeUrl,
      duration: tutorial.duration,
    },
  }
}

/**
 * Fetch all notifications and combine with read status
 */
async function fetchAllNotifications(shopDomain: string): Promise<Notification[]> {
  const blogPosition = 'Dashboard'
  const nowIso = new Date().toISOString()

  // Fetch content from all sources in parallel (same sources as fetchNotificationIds)
  const results = await Promise.allSettled([
    // Fetch changelog from Google Sheet
    (async () => {
      const googleSheetData = await handleGoogleSheetData({ action: GoogleSheetAction.GET })
      const changelog = googleSheetData?.[CHANGELOG_API] || []
      return Array.isArray(changelog) ? changelog : []
    })(),
    // Fetch blog posts using the same RAG pipeline as BlogPromotionCard (/api/blog-posts)
    // This is the slowest part (AI embedding + Supabase query)
    // No fallback - use same data source as badge count for consistency
    (async () => {
      const result = await getPersonalizedBlogPosts(shopDomain, blogPosition, 2)
      return result
    })(),
    // Fetch promotions from Google Sheet
    // Use same filter logic as usePromotions hook: (!position || promotion.position === position) && date check
    (async () => {
      const response = await fetch(PROMOTION_PROVIDER_URL)
      const data = await response.json()
      const items = data.items || []
      return items.filter((promo: PromotionLike) => {
        // Same logic as usePromotions hook
        const matchesPosition = !promo.position || promo.position === PROMOTION_POSITION
        const withinTime = isWithinIsoWindow(promo.startDate, promo.endDate, nowIso)
        return matchesPosition && withinTime
      })
    })(),
    // Fetch tutorials from local JSON file
    (async () => {
      const tutorials = await getTutorials(20)
      return tutorials
    })(),
  ])

  // Extract data from settled promises
  const changelogData = results[0].status === 'fulfilled' ? results[0].value : []
  const blogResult = results[1].status === 'fulfilled' ? results[1].value : { posts: [], intro: {} }
  const promotionData = results[2].status === 'fulfilled' ? results[2].value : []
  const tutorialData = results[3].status === 'fulfilled' ? results[3].value : []

  if (blogResult.posts) {
    blogResult.posts.unshift({
      title: 'CRO Course',
      description:
        'Master conversion optimization for jewelry, luxury goods, seasonal gifts, and corporate buyers with proven tactics that drive real results.',
      published_at: new Date('2025-12-24').toISOString(),
      image: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/TLKSetup_guide_image_8.png?v=1766542027',
      button_link: 'https://ecomate.co/pages/tailorkit-conversion-rate-optimization-course',
      position: 'Dashboard',
    })
  }

  // Normalize all notifications
  const changelogNotifications = changelogData.map(normalizeChangelog)
  const blogNotifications = (blogResult.posts || []).map(normalizeBlog)
  const promotionNotifications = promotionData.map(normalizePromotion)

  // Add local theme promotions (shared data with ThemesPromoCard)
  const themePromotions = THEME_CARDS.map(theme => ({
    key: `theme-${theme.name.toLowerCase()}`,
    appName: `${theme.name} theme`,
    description: theme.description,
    image: theme.mobileMedia,
    buttonText: 'Learn more',
    buttonLink: theme.buttonUrl,
    startDate: '2026-03-04T00:00:00.000Z',
  }))
  promotionNotifications.push(...themePromotions.map(normalizePromotion))
  const newFeatureNotifications = normalizeNewFeature()
  const tutorialNotifications = Array.isArray(tutorialData) ? tutorialData.map(normalizeTutorial) : []

  // Fetch read statuses from MongoDB
  const readStatusMap = await getReadStatusesForShop(shopDomain)

  // Combine all notifications and enrich with read status
  const allNotifications: Notification[] = [
    ...changelogNotifications,
    ...blogNotifications,
    ...promotionNotifications,
    ...newFeatureNotifications,
    ...tutorialNotifications,
  ].map(notification => {
    const statusKey = `${notification.type}:${notification.id}`
    const readAt = readStatusMap.get(statusKey)

    return {
      ...notification,
      isRead: !!readAt,
      readAt: readAt || null,
    }
  })

  // Sort by date (newest first)
  allNotifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return allNotifications
}

/**
 * GET /api/whats-new
 * Fetch all notifications with read status for the current shop
 * Returns both notifications and unreadCount in a single request
 */
export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const notifications = await fetchAllNotifications(shopDomain)
  const unreadCount = notifications.filter(n => !n.isRead).length

  return json({
    notifications,
    unreadCount,
  })
})

/**
 * POST /api/whats-new/mark-read
 * Mark one or more notifications as read
 */
export const action = catchAsync(async ({ request }: ActionFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const { action: actionType, notificationIds, notificationType } = await request.json()

  if (actionType === 'mark-read') {
    if (!notificationIds || !notificationType) {
      return json({ error: 'notificationIds and notificationType are required' }, { status: 400 })
    }

    const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds]

    const count = await markMultipleNotificationsAsRead(
      shopDomain,
      ids.map(id => ({
        notificationId: id,
        notificationType: notificationType as NotificationType,
      }))
    )

    return json({ success: true, count })
  }

  if (actionType === 'mark-all-read') {
    // Get all current notifications
    const allNotifications = await fetchAllNotifications(shopDomain)

    // Mark all unread notifications as read
    const unreadNotifications = allNotifications.filter(n => !n.isRead)

    if (unreadNotifications.length > 0) {
      const count = await markMultipleNotificationsAsRead(
        shopDomain,
        unreadNotifications.map(n => ({
          notificationId: n.id,
          notificationType: n.type,
        }))
      )

      return json({ success: true, count })
    }

    return json({ success: true, count: 0 })
  }

  return json({ error: 'Invalid action' }, { status: 400 })
})
