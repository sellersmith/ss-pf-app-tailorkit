import { BlockStack, Box, Button, Icon, InlineStack, Spinner, Text, Tooltip } from '@shopify/polaris'
import { ExternalIcon, PlayIcon } from '@shopify/polaris-icons'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ELink } from '~/constants/enum'
import { openInNewTab } from '~/utils/openInNewTab'
import { authenticatedFetch } from '~/shopify/fns.client'
import { getShopifyThumbnail } from '~/utils/loadImage'
import VideoModal from '~/components/VideoTutorial/VideoModal'
import { useModal } from '~/utils/hooks/useModal'
import { MODAL_ID } from '~/constants/modal'
import { getEmbedUrl } from '~/utils/getEmbedUrl'

interface ITutorialItem {
  id: string
  name: string
  thumbnail: string
  youtubeUrl: string
  duration?: string
}

/**
 * TutorialsToolPanel
 * Renders a compact list of tutorial media cards inside the editor sidebar.
 * Visuals follow the Figma spec: thumbnail with play overlay + duration, and a title below.
 * "View all" opens the official YouTube channel in a new tab.
 */
export default function TutorialsToolPanel() {
  const { t } = useTranslation()
  const { openModal } = useModal()
  const [tutorials, setTutorials] = useState<ITutorialItem[]>([])
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setIsLoading(true)
      try {
        const res = await authenticatedFetch('/api/tutorials')
        if (!alive) return

        if (res?.success && Array.isArray(res.data)) {
          setTutorials(res.data)
        }
      } catch (e: any) {
        console.error('Error fetching tutorials:', e)
      } finally {
        setIsLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const handleViewAll = useCallback(() => {
    openInNewTab(ELink.TAILORKIT_OFFICIAL_YOUTUBE)
  }, [])

  /**
   * Opens the video modal with the YouTube video embedded
   * @param url - The YouTube URL to display
   */
  const handleOpenYoutube = useCallback(
    (url: string) => {
      setCurrentVideoUrl(url)
      openModal(MODAL_ID.EDITOR_TUTORIAL_VIDEO_MODAL)
    },
    [openModal]
  )

  return (
    <Box padding="300">
      {isLoading ? (
        <InlineStack align="center" blockAlign="center">
          <Spinner />
        </InlineStack>
      ) : (
        <>
          <BlockStack gap="200">
            <InlineStack>
              <Button variant="plain" icon={ExternalIcon} onClick={handleViewAll}>
                {t('view-all')}
              </Button>
            </InlineStack>

            {/* Media cards */}
            <BlockStack gap="300">
              {tutorials?.map(({ id, thumbnail, name, duration, youtubeUrl }) => (
                <Box
                  key={id}
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
                    onClick={() => youtubeUrl && handleOpenYoutube(youtubeUrl)}
                  >
                    <BlockStack gap="0">
                      {/* Video thumbnail section */}
                      <div
                        style={{
                          height: '158px',
                          backgroundImage: thumbnail ? `url(${getShopifyThumbnail(thumbnail, 600)})` : undefined,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          backgroundRepeat: 'no-repeat',
                          position: 'relative',
                        }}
                      >
                        {/* Play button overlay */}
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
                          {duration ? (
                            <Text as="span" variant="bodyXs" fontWeight="semibold" tone="text-inverse">
                              {duration}
                            </Text>
                          ) : null}
                        </div>
                      </div>

                      {/* Title section */}
                      <Box padding="400">
                        <Tooltip content={name}>
                          <Text as="h3" variant="headingSm" fontWeight="semibold" truncate>
                            {name}
                          </Text>
                        </Tooltip>
                      </Box>
                    </BlockStack>
                  </div>
                </Box>
              ))}
            </BlockStack>
          </BlockStack>

          <VideoModal id={MODAL_ID.EDITOR_TUTORIAL_VIDEO_MODAL} maximumWidth={720} minimumWidth={300}>
            {currentVideoUrl && (
              <iframe
                width="100%"
                style={{ aspectRatio: '16/9' }}
                src={getEmbedUrl(currentVideoUrl)}
                title="Tutorial Video"
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture,fullscreen"
                allowFullScreen={true}
                loading="lazy"
                frameBorder="0"
              />
            )}
          </VideoModal>
        </>
      )}
    </Box>
  )
}
