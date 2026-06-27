import { BlockStack, Box, Divider, Icon, InlineStack, Text } from '@shopify/polaris'
import { PlayIcon } from '@shopify/polaris-icons'
import { formatDate } from 'date-fns'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { openInNewTab } from '~/utils/openInNewTab'
import { getShopifyThumbnail } from '~/utils/loadImage'
import type { Notification } from '../types'
import { IndicatorIcon } from '~/assets/icons'

interface TutorialCardProps {
  tutorial: Notification
  onMarkAsRead?: (notificationId: string, notificationType: 'tutorial') => void
}

/**
 * Tutorial card component matching Figma design
 * Displays tutorial with thumbnail, play overlay, duration, and title
 * Clicking opens YouTube in new tab and marks as read
 */
export function TutorialCard({ tutorial, onMarkAsRead }: TutorialCardProps) {
  const { t } = useTranslation()

  const formatNotificationDate = useCallback((dateString: string) => {
    try {
      return formatDate(new Date(dateString), 'MMM d, yyyy').replace(/^([A-Z][a-z]+)/, match => match.slice(0, 3))
    } catch {
      return dateString
    }
  }, [])

  const handleClick = useCallback(() => {
    // Mark as read when user clicks
    if (!tutorial.isRead && onMarkAsRead) {
      onMarkAsRead(tutorial.id, 'tutorial')
    }

    // Open YouTube URL in new tab
    const youtubeUrl = tutorial.type === 'tutorial' ? tutorial.metadata?.youtubeUrl || tutorial.link : tutorial.link
    if (youtubeUrl) {
      openInNewTab(youtubeUrl)
    }
  }, [tutorial, onMarkAsRead])

  const duration = tutorial.type === 'tutorial' ? tutorial.metadata?.duration : undefined
  const thumbnailUrl = tutorial.thumbnailUrl

  return (
    <>
      <Box paddingBlock="200" paddingInline="0">
        <InlineStack gap="100" blockAlign="start" wrap={false}>
          {/* Unread indicator - 8x8px green dot */}
          <Box minWidth="16px" paddingBlockStart="050">
            {!tutorial.isRead ? (
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
                  {t('tutorials')}
                </Text>
                <Text variant="bodySm" tone="subdued" as="span">
                  •
                </Text>
                <Text variant="bodySm" tone="subdued" as="span">
                  {formatNotificationDate(tutorial.date)}
                </Text>
              </InlineStack>

              {/* Tutorial card */}
              <Box
                padding="0"
                shadow="100"
                borderColor="border"
                borderRadius="300"
                borderWidth="025"
                overflowX="hidden"
                overflowY="hidden"
              >
                <div
                  style={{
                    cursor: 'pointer',
                  }}
                  onClick={handleClick}
                >
                  <BlockStack gap="0">
                    {/* Video thumbnail section */}
                    <div
                      style={{
                        height: '218px',
                        backgroundImage: thumbnailUrl ? `url(${getShopifyThumbnail(thumbnailUrl, 600)})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        position: 'relative',
                        aspectRatio: '320/218',
                      }}
                    >
                      {/* Play button overlay */}
                      {duration && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '16px',
                            left: '16px',
                            backgroundColor: 'rgba(0, 0, 0, 0.71)',
                            borderRadius: '8px',
                            padding: '4px 8px 4px 4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#fff',
                          }}
                          aria-label={t('watch-tutorial')}
                        >
                          <Icon source={PlayIcon} tone="inherit" />
                          <Text as="span" variant="bodyXs" fontWeight="semibold" tone="text-inverse">
                            {duration}
                          </Text>
                        </div>
                      )}
                    </div>

                    {/* Title section */}
                    <Box padding="400">
                      <Text as="h3" variant="headingSm" fontWeight="semibold" truncate>
                        {tutorial.title}
                      </Text>
                    </Box>
                  </BlockStack>
                </div>
              </Box>
            </BlockStack>
          </div>
        </InlineStack>
      </Box>
      <Divider />
    </>
  )
}
