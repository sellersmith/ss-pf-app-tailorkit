import { BlockStack, Box, Button, Collapsible, Icon, InlineStack, Text } from '@shopify/polaris'
import { InfoIcon } from '@shopify/polaris-icons'
import { memo, useCallback, useMemo, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { PTEBadge, PTEBadgeItem } from '~/api/services/achievements'
import { ProcessCompletedIcon, ProcessingIcon } from '~/assets/icons'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import withTooltip from '~/bootstrap/hoc/withTooltip'
import { CopyToClipboard } from '~/components/CopyToClipboard/CopyToClipboard'
import { showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import useDevices from '~/utils/hooks/useDevice'

interface BadgeCardProps {
  badge: PTEBadge
}

/**
 * Style constants to avoid recreating on every render
 */
const BADGE_IMAGE_STYLE: React.CSSProperties = {
  borderRadius: '8px',
  overflow: 'hidden',
  border: '1px solid var(--p-color-border)',
  objectFit: 'cover',
} as const

const NESTED_LIST_STYLE: React.CSSProperties = {
  paddingLeft: '18px',
  margin: 0,
  listStyle: 'disc',
} as const

/**
 * Memoized IconWithTooltip component (created once outside component)
 */
const IconWithTooltip = withTooltip(Icon)

/**
 * BadgeCard component displays a single badge with its rewards
 */
function BadgeCardComponent({ badge }: BadgeCardProps) {
  const { t } = useTranslation()
  const { trackEvent } = useEventsTracking()
  const { isMobileView } = useDevices()
  const [openExpand, setOpenExpand] = useState<Record<string, boolean>>({})

  // Memoize badge thumbnail extraction
  const badgeThumbnail = useMemo(() => {
    const thumbnail = badge.rewardContent?.thumbnailUrl
    return typeof thumbnail === 'string' ? thumbnail : undefined
  }, [badge.rewardContent?.thumbnailUrl])

  const badgeImageSize = useMemo(() => (isMobileView ? '60px' : '90px'), [isMobileView])

  const isUnlocked = badge.unlocked

  // Memoize unlock message to avoid recreating on every render
  const unlockMessage = useMemo(
    () =>
      isUnlocked
        ? t('congrats-you-ve-unlocked-this-badge')
        : t('publish-threshold-products-to-unlock-this-badge', { threshold: badge.threshold }),
    [isUnlocked, badge.threshold, t]
  )

  // Memoize copy handler to avoid recreating callback
  const handleCopy = useCallback(() => {
    showToast(t(TOAST.COMMON.COPIED_TO_CLIPBOARD))
  }, [t])

  // Separate toggle handler to avoid recreating renderItem on every expand/collapse
  const handleToggleExpand = useCallback((itemTitle: string) => {
    setOpenExpand(prev => {
      const newOpenExpand = { ...prev }
      // Handle undefined case: default is true (expanded), so toggle to false
      newOpenExpand[itemTitle] = !(newOpenExpand[itemTitle] ?? true)
      return newOpenExpand
    })
  }, [])

  // Memoize list style based on items length
  const listStyle = useMemo(() => {
    const itemsLength = badge.rewardContent?.items?.length ?? 0
    return {
      listStyle: itemsLength === 1 ? ('none' as const) : ('disc' as const),
      paddingLeft: itemsLength === 1 ? '0' : '18px',
      margin: 0,
    }
  }, [badge.rewardContent?.items?.length])

  /**
   * Renders a single reward item
   */
  const renderItem = useCallback(
    (item: PTEBadgeItem, itemKey: string) => {
      const isExpanded = openExpand[itemKey] ?? true
      const translatedTitle = item.title ? t(item.title) : undefined
      const translatedTextAction = item.textAction ? t(item.textAction) : undefined
      const translatedTooltip = item.tooltip ? t(item.tooltip) : undefined

      return (
        <InlineStack align="start" blockAlign="center" gap="100">
          <Text as="p" variant="bodyMd">
            {translatedTitle && (
              <Trans
                t={t}
                components={{
                  b: <strong />,
                }}
              >
                {t(translatedTitle)}
              </Trans>
            )}
          </Text>

          {translatedTooltip && <IconWithTooltip source={InfoIcon} tone="subdued" tooltipContent={translatedTooltip} />}

          <InlineStack align="start" blockAlign="center" gap="100" wrap={false}>
            <Text as="p" variant="bodyMd">
              :
            </Text>
            {item.discountText && (
              <Text as="p" variant="bodyMd">
                {t(item.discountText)}
              </Text>
            )}
            {isUnlocked && item.discountText && item.discountCode && (
              <Text as="p" variant="bodyMd">
                —
              </Text>
            )}
            {isUnlocked && item.discountCode && (
              <CopyToClipboard text={item.discountCode} onCopy={handleCopy}>
                <Text as="p" variant="bodyMd">
                  {item.discountCode}
                </Text>
              </CopyToClipboard>
            )}
          </InlineStack>

          {item.url && translatedTextAction && (
            <Button
              variant="plain"
              url={isUnlocked ? item.url : undefined}
              disabled={!isUnlocked}
              target="_blank"
              download={isUnlocked && item.type === 'download' ? item.url : undefined}
              onClick={() => {
                if (isUnlocked && item.url) {
                  trackEvent(EVENTS_TRACKING.CLICK_APP_PROMOTION, {
                    [EVENTS_PARAMETERS_NAME.APP_PROMOTION]: `pte-partner-${item.title || 'unknown'}`,
                  })
                }
              }}
            >
              {translatedTextAction}
            </Button>
          )}

          {item.canExpand && translatedTitle && item.items && item.items.length > 0 && (
            <Button variant="plain" onClick={() => handleToggleExpand(itemKey)}>
              {isExpanded ? t('hide-all') : t('view-all')}
            </Button>
          )}
        </InlineStack>
      )
    },
    [handleCopy, handleToggleExpand, isUnlocked, openExpand, t, trackEvent]
  )

  const rewardItems = badge.rewardContent?.items

  return (
    <BlockStack gap="300">
      {/* Badge Thumbnail */}
      <InlineStack gap="300" wrap={false}>
        {badgeThumbnail && (
          <Box width="fit-content">
            <img
              src={badgeThumbnail}
              alt={badge.name}
              width={badgeImageSize}
              height={badgeImageSize}
              style={BADGE_IMAGE_STYLE}
            />
          </Box>
        )}
        <BlockStack gap="200">
          <InlineStack align="start" blockAlign="center" gap="100" wrap={false}>
            {isUnlocked ? ProcessCompletedIcon : ProcessingIcon}
            <Text as="p" variant="bodyMd" fontWeight="bold">
              {unlockMessage}
            </Text>
          </InlineStack>
          {/* Rewards List */}
          {rewardItems && rewardItems.length > 0 && (
            <ul style={listStyle}>
              {rewardItems.map((item, index) => {
                const itemKey = item.title ?? `item-${index}`
                const isExpanded = openExpand[itemKey] ?? true

                return (
                  <li key={itemKey}>
                    {renderItem(item, itemKey)}
                    {item.canExpand && item.items && item.items.length > 0 && (
                      <BlockStack gap="100">
                        <Collapsible
                          open={isExpanded}
                          id={`collapsible-${itemKey}`}
                          transition={{ duration: '100ms', timingFunction: 'ease-in-out' }}
                          expandOnPrint
                        >
                          <ul style={NESTED_LIST_STYLE}>
                            {item.items.map((nestedItem, nestedIndex) => {
                              const nestedKey = nestedItem.title ?? `${itemKey}-nested-${nestedIndex}`
                              return <li key={nestedKey}>{renderItem(nestedItem, nestedKey)}</li>
                            })}
                          </ul>
                        </Collapsible>
                      </BlockStack>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </BlockStack>
      </InlineStack>
    </BlockStack>
  )
}

/**
 * Memoized BadgeCard component to prevent unnecessary re-renders
 */
export const BadgeCard = memo(BadgeCardComponent)
