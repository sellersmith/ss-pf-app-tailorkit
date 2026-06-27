import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  InlineStack,
  Link,
  ProgressBar,
  SkeletonBodyText,
  Text,
  Tooltip,
} from '@shopify/polaris'
import { ChevronDownIcon, ChevronUpIcon, StarFilledIcon, XIcon } from '@shopify/polaris-icons'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MODAL_ID } from '~/constants/modal'
import { useModal } from '~/utils/hooks/useModal'
import { usePTEStatus } from '../hooks/usePTEStatus'
import { useTranslation } from 'react-i18next'
import { getHighestUnlockedBadge, getTotalProductsTarget, getBadgeTone } from '../utilities/pteBadgeUtils'
import { localStorage } from 'extensions/tailorkit-src/src/assets/utils/localStorage'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { GLOBAL_EVENTS_TRANSMITTER } from '~/constants/events-transmitter'
import { OCCURRED_EVENTS } from '~/routes/api.preferences/constants'
import { BFS_COMPLIANCE } from '~/constants/bfs-compliance'

interface PublishToEarnCardProps {
  /**
   * Position of the card on screen
   * @default 'bottom-left'
   */
  position?: 'bottom-left' | 'bottom-right'
  /**
   * Whether card should be collapsed by default
   * @default false
   */
  defaultCollapsed?: boolean
  /**
   * localStorage key for persisting collapse state
   * @default 'pte-card-collapsed'
   */
  storageKey?: string
  /**
   * Data attribute for card element (for querying/selecting)
   * @default 'pte-card'
   */
  dataAttribute?: string
}

/**
 * PublishToEarnCard Component
 *
 * A floating card that displays Publish to Earn progress and opens a modal when clicked.
 *
 * Features:
 * - Shows published products count (X/7)
 * - Displays badge with "Join now" text and star icon (when no badge unlocked)
 * - Displays unlocked badge name (Creator, Artisan, Master) when achieved
 * - Progress bar visualization
 * - Clickable card that opens PTE modal
 * - Collapsible to show/hide details
 * - Dismissible with XIcon button (dismissed forever)
 * - Configurable position, default collapsed state, and storage key
 */
export default function PublishToEarnCard({
  position = 'bottom-left',
  defaultCollapsed = false,
  storageKey = 'pte-card-collapsed',
  dataAttribute = 'pte-card',
}: PublishToEarnCardProps = {}) {
  const { data, loading } = usePTEStatus()
  const { openModal } = useModal()
  const { t } = useTranslation()
  const cardContentRef = useRef<HTMLDivElement>(null)
  // Create a unique key for sessionStorage based on card name
  const sessionDismissKey = `card-dismissed-session-${OCCURRED_EVENTS.PUBLISH_TO_EARN_CARD_DASHBOARD_DISMISSED}`

  const [isDismiss, setIsDismiss] = useState(() => {
    // Check if card was dismissed in this session
    return sessionStorage.getItem(sessionDismissKey) === 'true'
  })

  // Manage collapse state with localStorage persistence
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      return stored === null ? defaultCollapsed : stored === 'true'
    } catch {
      return defaultCollapsed
    }
  })

  const handleCardClick = useCallback(() => {
    openModal(MODAL_ID.PUBLISH_TO_EARN_MODAL)
  }, [openModal])

  const handleToggleCollapse = useCallback(() => {
    localStorage.setItem(storageKey, String(!isCollapsed))
    setIsCollapsed(!isCollapsed)
  }, [isCollapsed, storageKey])

  /**
   * Handle dismiss card - permanently hide the card via API
   */
  const handleDismiss = useCallback(async () => {
    setIsDismiss(true)
    sessionStorage.setItem(sessionDismissKey, 'true')
  }, [sessionDismissKey])

  // Trigger height change event when card mounts or height changes
  useEffect(() => {
    const cardElement = cardContentRef.current
    if (!cardElement) return

    const updateHeight = () => {
      const rect = cardElement.getBoundingClientRect()
      if (rect.height > 0) {
        Transmitter.trigger(GLOBAL_EVENTS_TRANSMITTER.PTE_CARD_HEIGHT_CHANGED, {
          height: rect.height,
        })
      }
    }

    // Wait for next frame to ensure DOM is fully rendered
    requestAnimationFrame(() => {
      updateHeight()
    })

    // Use ResizeObserver to track height changes
    const resizeObserver = new ResizeObserver(() => {
      updateHeight()
    })

    resizeObserver.observe(cardElement)

    return () => {
      resizeObserver.disconnect()
    }
  }, [isCollapsed, data]) // Re-run when collapse state or data changes

  // Find the highest unlocked badge using utility function
  const highestUnlockedBadge = useMemo(() => getHighestUnlockedBadge(data?.badges), [data?.badges])

  // Calculate total products target dynamically from badges
  const totalProducts = useMemo(() => getTotalProductsTarget(data?.badges), [data?.badges])

  // Determine badge display properties
  const badgeDisplay = useMemo(() => {
    if (!highestUnlockedBadge) {
      return {
        text: t('join-now'),
        tone: 'attention' as const,
        showIcon: true,
      }
    }

    return {
      text: t(highestUnlockedBadge.name),
      tone: getBadgeTone(highestUnlockedBadge.id),
      showIcon: false,
    }
  }, [highestUnlockedBadge, t])

  // Determine title text (Master badge has different title)
  const titleText = useMemo(() => {
    if (highestUnlockedBadge?.id === 'master') {
      return t('congrats-on-your')
    }
    return t('publish-to-earn')
  }, [highestUnlockedBadge, t])

  // Determine description text
  const descriptionText = useMemo(() => {
    if (!highestUnlockedBadge) {
      return `${t('unlock-badges-with-rewards')}`
    }

    if (highestUnlockedBadge.id === 'master') {
      return t('claim-all-your-rewards-now')
    }

    return t('claim-your-rewards-now')
  }, [highestUnlockedBadge, t])

  // Calculate position props based on position prop (must be before early returns)
  const positionProps = useMemo(() => {
    if (position === 'bottom-right') {
      return { insetInlineEnd: '500' as const }
    }
    return { insetInlineStart: '500' as const }
  }, [position])

  // Temporarily hide for Shopify review
  if (BFS_COMPLIANCE.HIDE_PUBLISH_POPOVER_AND_CONFETTI) {
    return null
  }

  // Don't render if dismissed forever
  if (isDismiss) {
    return null
  }

  if (loading) {
    return <PublishToEarnCardSkeleton position={position} defaultCollapsed={defaultCollapsed} />
  }

  // Don't render if still loading or no data
  if (!data || totalProducts === 0) {
    return null
  }

  const { publishedCount } = data
  const progressPercentage = Math.min((publishedCount / totalProducts) * 100, 100)

  return (
    <Box
      position="fixed"
      insetBlockEnd="500"
      {...positionProps}
      zIndex="400"
      maxWidth={'calc(100vw - 92px)'}
      data-pte-card={dataAttribute}
    >
      <div
        ref={cardContentRef}
        onClick={handleCardClick}
        style={{
          cursor: 'pointer',
        }}
        data-pte-card-content
      >
        <Card background="bg-fill-brand" roundedAbove="xs">
          <BlockStack gap="200">
            {/* Header with title, badge, dismiss button, and collapse button */}
            <InlineStack align="space-between" blockAlign="center" gap="200" wrap={false}>
              <InlineStack gap="200" blockAlign="center">
                <Text as="span" variant="bodyMd" fontWeight="semibold" tone="text-inverse">
                  {titleText}
                </Text>
                {/* <div className={`${styles.badgeWrapper} ${styles.glowRadiate}`}>
                  <div className={styles.animatedBadge}> */}
                <Badge tone={badgeDisplay.tone} icon={StarFilledIcon}>
                  {badgeDisplay.text}
                </Badge>
                {/* </div>
                </div> */}
              </InlineStack>
              <InlineStack gap="100" blockAlign="center" wrap={false}>
                <div onClick={e => e.stopPropagation()}>
                  <Button
                    icon={isCollapsed ? ChevronDownIcon : ChevronUpIcon}
                    variant="plain"
                    onClick={handleToggleCollapse}
                    accessibilityLabel={isCollapsed ? t('expand') : t('collapse')}
                    size="slim"
                  />
                </div>
                {!isCollapsed && (
                  <div onClick={e => e.stopPropagation()}>
                    <Tooltip content={t('dismiss')}>
                      <Button
                        icon={XIcon}
                        variant="plain"
                        onClick={handleDismiss}
                        accessibilityLabel={t('dismiss') || 'Dismiss'}
                        size="slim"
                      />
                    </Tooltip>
                  </div>
                )}
              </InlineStack>
            </InlineStack>

            {/* Collapsible content */}
            {!isCollapsed && (
              <>
                {/* Progress section */}
                <BlockStack gap="100">
                  <Text as="span" variant="bodyXs" tone="text-inverse">
                    {Math.min(publishedCount, totalProducts)}/{totalProducts} {t('products')}
                  </Text>
                  <ProgressBar progress={progressPercentage} tone="success" size="small" />
                </BlockStack>

                {/* Description */}
                <Text as="p" variant="bodySm" tone="text-inverse">
                  {descriptionText}.{' '}
                  <Link onClick={handleCardClick} monochrome>
                    {t('view-details')}
                  </Link>
                </Text>
              </>
            )}
          </BlockStack>
        </Card>
      </div>
    </Box>
  )
}

/**
 * Loading skeleton for PublishToEarnCard
 * Displayed while data is being fetched
 */
export function PublishToEarnCardSkeleton({
  position = 'bottom-left',
  defaultCollapsed,
}: {
  position?: 'bottom-left' | 'bottom-right'
  defaultCollapsed?: boolean
} = {}) {
  const positionProps = useMemo(() => {
    if (position === 'bottom-right') {
      return { insetInlineEnd: '500' as const }
    }
    return { insetInlineStart: '500' as const }
  }, [position])

  return (
    <Box
      position="fixed"
      borderRadius={'200'}
      insetBlockEnd="500"
      {...positionProps}
      zIndex="400"
      width="220px"
      maxWidth={'calc(100vw - 92px)'}
    >
      <Card background="bg-fill-brand">
        <BlockStack gap="200">
          <SkeletonBodyText lines={defaultCollapsed ? 1 : 3} />
        </BlockStack>
      </Card>
    </Box>
  )
}
