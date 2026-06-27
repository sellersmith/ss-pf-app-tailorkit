import { BlockStack, Box, Button, Divider, InlineStack, Text } from '@shopify/polaris'
import { ExternalIcon } from '@shopify/polaris-icons'
import { useFetcher } from '@remix-run/react'
import { formatDate } from 'date-fns'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { openInNewTab } from '~/utils/openInNewTab'
import type { Notification } from '../types'
import { IndicatorIcon } from '~/assets/icons'
import { ListChangeLog } from '~/routes/changelog/ListChangeLogs'
import { NOTIFICATION_PREVIEW_LINE_CLAMP } from '../constants'

/** SS ecosystem app identifiers — used to conditionally fire SS-Referral tracking */
const SS_ECOSYSTEM_APPS = ['vibe', 'pagefly', 'saleshunterthemes'] as const

/** Returns the SS ecosystem target app name if the URL contains a known app, or null */
function getSSTargetApp(url: string): string | null {
  const lowerUrl = url.toLowerCase()
  return SS_ECOSYSTEM_APPS.find(app => lowerUrl.includes(app)) ?? null
}

interface NotificationItemProps {
  notification: Notification
  onMarkAsRead?: (notificationId: string, notificationType: Notification['type']) => void
}

/**
 * Individual notification item component
 * Displays notification with expand/collapse for promotions and external links for blogs
 */
export function NotificationItem({ notification, onMarkAsRead }: NotificationItemProps) {
  const { t } = useTranslation()
  const { trackEvent } = useEventsTracking()
  const referralFetcher = useFetcher()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const descriptionRef = useRef<HTMLDivElement | null>(null)

  const handleViewMore = useCallback(() => {
    // Mark as read when user interacts
    if (!notification.isRead && onMarkAsRead) {
      onMarkAsRead(notification.id, notification.type)
    }

    if (notification.type === 'blog' && notification.link) {
      trackEvent(EVENTS_TRACKING.CLICK_BLOG_PROMOTION, {
        [EVENTS_PARAMETERS_NAME.BLOG_PROMOTION]: notification.title || notification.link,
      })
      // Open external link in new tab for blog posts
      openInNewTab(notification.link)
    } else {
      // Expand content for promotions and new features
      setIsExpanded(prev => !prev)
    }
  }, [notification, onMarkAsRead, trackEvent])

  const promotionCta = useMemo(() => {
    if (notification.type !== 'promotion') return null

    const href = notification.metadata?.buttonLink || notification.metadata?.button_link || notification.link
    if (!href) return null

    const label = notification.metadata?.buttonText || notification.metadata?.button_text || t('install-now')
    return { label, href }
  }, [notification, t])

  const handlePromotionCtaClick = useCallback(() => {
    if (!promotionCta) return

    // Mark as read when user interacts
    if (!notification.isRead && onMarkAsRead) {
      onMarkAsRead(notification.id, notification.type)
    }

    trackEvent(EVENTS_TRACKING.CLICK_APP_PROMOTION, {
      [EVENTS_PARAMETERS_NAME.APP_PROMOTION]: notification.title || promotionCta.href,
    })

    // Fire SS-Referral if target is an SS ecosystem app
    const ssApp = getSSTargetApp(promotionCta.href)
    if (ssApp) {
      referralFetcher.submit(
        { targetApp: ssApp, crossSellPosition: 'whats-new-promotion' },
        { method: 'POST', action: '/api/referral', encType: 'application/x-www-form-urlencoded' }
      )
    }

    openInNewTab(promotionCta.href)
  }, [
    notification.id,
    notification.isRead,
    notification.type,
    notification.title,
    onMarkAsRead,
    promotionCta,
    trackEvent,
    referralFetcher,
  ])

  const formatNotificationDate = useCallback((dateString: string) => {
    try {
      return formatDate(new Date(dateString), 'MMM d, yyyy').replace(/^([A-Z][a-z]+)/, match => match.slice(0, 3))
    } catch {
      return dateString
    }
  }, [])

  const getTypeLabel = useCallback(
    (type: Notification['type']) => {
      switch (type) {
        case 'changelog':
          return t('new-features')
        case 'blog':
          return t('hot-trends')
        case 'promotion':
          return t('promotions')
        case 'new-feature':
          return t('new-features')
        case 'tutorial':
          return t('tutorials')
        default:
          return ''
      }
    },
    [t]
  )

  // For blog posts & promotions with thumbnail, show thumbnail layout
  const hasThumbnail
    = (notification.type === 'blog' || notification.type === 'promotion') && !!notification.thumbnailUrl
  // Keep preview truncation consistent: always clamp to N lines, then show "View more" only if overflowing.
  const lineClamp = NOTIFICATION_PREVIEW_LINE_CLAMP

  const hasExpandableMetadata = useMemo(() => {
    if (!notification.metadata) return false
    if (notification.type === 'changelog') {
      // Type-safe access to changelog metadata
      const meta = notification.metadata
      const features = meta?.features || []
      const improvements = meta?.improvements || []
      const bugsFixed = meta?.bugsFixed || []
      return features.length > 0 || improvements.length > 0 || bugsFixed.length > 0
    }
    if (notification.type === 'promotion') {
      // Type-safe access to promotion metadata
      const meta = notification.metadata
      return !!meta?.content
    }
    return false
  }, [notification])

  const viewMoreLabel = notification.type === 'blog' ? t('view-more') : isExpanded ? t('view-less') : t('view-more')
  const viewMoreDisclosure = notification.type === 'blog' ? undefined : isExpanded ? 'up' : 'down'

  // Show the action if the preview is visually clamped (overflowing) or if there is expandable metadata,
  // or if currently expanded (to allow collapsing).
  const shouldShowViewMoreButton
    = (notification.type === 'blog' ? isOverflowing : isExpanded || isOverflowing || hasExpandableMetadata)
    || (notification.type === 'blog' && notification.link)

  useEffect(() => {
    const el = descriptionRef.current
    if (!el || isExpanded) {
      setIsOverflowing(false)
      return
    }

    const compute = () => {
      // For line-clamp blocks, scrollHeight > clientHeight indicates overflow.
      // For 1-line clamp, scrollWidth > clientWidth also catches edge cases.
      const heightOverflow = el.scrollHeight > el.clientHeight + 1
      const widthOverflow = el.scrollWidth > el.clientWidth + 1
      setIsOverflowing(heightOverflow || widthOverflow)
    }

    compute()

    const ro = new ResizeObserver(() => compute())
    ro.observe(el)
    return () => ro.disconnect()
  }, [isExpanded, notification.content, lineClamp])

  // Render expanded metadata content
  const renderExpandedContent = () => {
    if (!isExpanded || !notification.metadata) return null

    // IMPORTANT: Changelog expanded content is rendered inside the description block
    // so the view more/less button always sits immediately after the description.
    if (notification.type === 'changelog') return null

    const promotionContent = notification.type === 'promotion' ? notification.metadata.content : null

    return (
      <Box paddingBlockStart="100">
        {promotionContent?.description ? (
          <Text variant="bodyMd" as="span">
            {promotionContent.description}
          </Text>
        ) : null}
      </Box>
    )
  }

  const changelogExpandedGroups = useMemo(() => {
    if (notification.type !== 'changelog' || !notification.metadata) return []

    // Type-safe access to changelog metadata
    const meta = notification.metadata
    const features = meta?.features || []
    const improvements = meta?.improvements || []
    const bugsFixed = meta?.bugsFixed || []

    const normalize = (items: Array<{ value: string }>) =>
      items.filter(i => typeof i?.value === 'string' && i.value.trim().length > 0)

    return [
      { title: t('new-features'), items: normalize(features) },
      { title: t('improvements'), items: normalize(improvements) },
      { title: t('fixes'), items: normalize(bugsFixed) },
    ].filter(group => group.items.length > 0)
  }, [notification, t])

  const shouldShowRawContentWhenExpanded = notification.type !== 'changelog'

  return (
    <>
      <Box paddingBlock="200" paddingInline="0">
        <InlineStack gap="100" blockAlign="start" wrap={false}>
          {/* Unread indicator - 8x8px green dot */}
          <Box minWidth="16px" paddingBlockStart="050">
            {!notification.isRead ? (
              <IndicatorIcon width={8} height={8} fill="#29845A" stroke="#29845A" />
            ) : (
              <Box width="8px" />
            )}
          </Box>

          <div style={{ flex: 1, minWidth: 0, width: 'calc(100% - 20px)' }}>
            <BlockStack gap="100">
              {/* Meta */}
              <InlineStack gap="200" blockAlign="center" wrap={false}>
                <Text variant="bodySm" tone="subdued" as="span">
                  {getTypeLabel(notification.type)}
                </Text>
                <Text variant="bodySm" tone="subdued" as="span">
                  •
                </Text>
                <Text variant="bodySm" tone="subdued" as="span">
                  {formatNotificationDate(notification.date)}
                </Text>
              </InlineStack>

              {/* Title (above thumbnail row like Figma) */}
              <Text variant="bodyMd" fontWeight="semibold" as="h3">
                {notification.title}
              </Text>

              {/* Body */}
              {hasThumbnail ? (
                <InlineStack gap="100" blockAlign="start" wrap={false}>
                  <Box
                    width="60px"
                    minWidth="60px"
                    borderRadius="200"
                    borderWidth="025"
                    borderColor="border"
                    overflowX="hidden"
                    background="bg-surface"
                  >
                    <img
                      src={notification.thumbnailUrl}
                      alt={notification.title}
                      style={{ width: '60px', height: '60px', objectFit: 'cover', display: 'block' }}
                    />
                  </Box>

                  <Box width="100%" minWidth="0">
                    <InlineStack gap="200" blockAlign="start">
                      <Box width="100%" minWidth="0">
                        <div
                          ref={descriptionRef}
                          style={{
                            display: '-webkit-box',
                            WebkitBoxOrient: 'vertical',
                            ...(isExpanded ? {} : { WebkitLineClamp: lineClamp }),
                            overflow: 'hidden',
                          }}
                        >
                          <Text variant="bodyMd" as="span">
                            {notification.content}
                          </Text>
                        </div>
                      </Box>
                      {shouldShowViewMoreButton ? (
                        <Box>
                          {notification.type === 'blog' ? (
                            <Box>
                              <Button variant="plain" onClick={handleViewMore} icon={ExternalIcon}>
                                {viewMoreLabel}
                              </Button>
                            </Box>
                          ) : (
                            <Box>
                              <Button variant="plain" onClick={handleViewMore} disclosure={viewMoreDisclosure}>
                                {viewMoreLabel}
                              </Button>
                            </Box>
                          )}
                        </Box>
                      ) : null}
                    </InlineStack>

                    {/* Promotion CTA should sit directly under description (like AppsPromotionCard) */}
                    {notification.type === 'promotion' && promotionCta ? (
                      <Box paddingBlockStart="200">
                        <Button size="slim" onClick={handlePromotionCtaClick}>
                          {promotionCta.label}
                        </Button>
                      </Box>
                    ) : null}
                  </Box>
                </InlineStack>
              ) : (
                <BlockStack gap="100">
                  {!isExpanded || shouldShowRawContentWhenExpanded ? (
                    <div
                      ref={descriptionRef}
                      style={{
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        ...(isExpanded ? {} : { WebkitLineClamp: lineClamp }),
                        overflow: 'hidden',
                      }}
                    >
                      <Text variant="bodyMd" as="span">
                        {notification.content}
                      </Text>
                    </div>
                  ) : (
                    <BlockStack gap="200">
                      {changelogExpandedGroups.map(group => (
                        <ListChangeLog key={group.title} title={group.title} list={group.items} />
                      ))}
                    </BlockStack>
                  )}
                  {shouldShowViewMoreButton ? (
                    <Box>
                      <Button variant="plain" onClick={handleViewMore} disclosure={viewMoreDisclosure}>
                        {viewMoreLabel}
                      </Button>
                    </Box>
                  ) : null}

                  {notification.type === 'promotion' && promotionCta ? (
                    <Box paddingBlockStart="200">
                      <Button size="slim" onClick={handlePromotionCtaClick}>
                        {promotionCta.label}
                      </Button>
                    </Box>
                  ) : null}
                </BlockStack>
              )}

              {renderExpandedContent()}
            </BlockStack>
          </div>
        </InlineStack>
      </Box>
      <Divider />
    </>
  )
}
