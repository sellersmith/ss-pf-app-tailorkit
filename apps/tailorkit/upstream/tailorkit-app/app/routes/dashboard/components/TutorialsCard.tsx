import { useTranslation } from 'react-i18next'
import CardWithDismiss from './CardWithDismiss'
import { BlockStack, Box, Button, Icon, InlineStack, Text, Modal } from '@shopify/polaris'
import { useCallback, useMemo, useState } from 'react'
import { PrepareProductsModal } from './ModalPrepareProducts'
import useDevices from '~/utils/hooks/useDevice'
import { ELink } from '~/constants/enum'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { ExternalIcon, LogoYoutubeIcon, PlayIcon } from '@shopify/polaris-icons'
import { SocialVideo } from '~/components/.client/SocialVideoThumbnail'
import { CarouselWithPagination } from '~/components/Carousel'
import { openInNewTab } from '~/utils/openInNewTab'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'
import { OCCURRED_EVENTS } from '~/routes/api.preferences/constants'

export default function TutorialsCard() {
  const { t } = useTranslation()
  const [preparingProductsModalActive, setPreparingProductsModalActive] = useState(false)

  const TUTORIALS = useMemo(
    () => [
      {
        id: 'create-ai-powered-template',
        name: t('create-ai-powered-template'),
        description: t('quickly-launch-personalized-products-with-little-effort'),
        thumbnail: ELink.TUTORIAL_THUMBNAIL_2,
        videoUrl: 'https://cdn.shopify.com/videos/c/o/v/88095ee2b37e4410a785629c10437673.mp4', // Will be supplemented later
        youtubeUrl: ELink.TUTORIAL_YOUTUBE_1,
        duration: '6:21',
        time: 6 * 60 + 21,
      },
      {
        id: 'create-various-image-options-with-ai',
        name: t('create-various-image-options-with-ai'),
        description: t('create-an-ai-powered-template-to-define-what-buyers-can-personalize'),
        videoUrl: 'https://cdn.shopify.com/videos/c/o/v/a0291972a42a4849964c0aa4a5f14e32.mp4', // Will be supplemented later
        thumbnail: ELink.TUTORIAL_THUMBNAIL_1,
        youtubeUrl: ELink.TUTORIAL_YOUTUBE_2,
        duration: '1:30',
        time: 1 * 60 + 30,
      },
      {
        id: 'create-ai-generated-images',
        name: t('create-ai-generated-images'),
        description: t('generate-stunning-images-to-boost-sales-and-customer-loyalty'),
        thumbnail: ELink.TUTORIAL_THUMBNAIL_3,
        videoUrl: 'https://cdn.shopify.com/videos/c/o/v/f60b95f99ff14b17aa6c190257ad0ae0.mp4', // Will be supplemented later
        youtubeUrl: ELink.TUTORIAL_YOUTUBE_3,
        duration: '1:52',
        time: 1 * 60 + 52,
      },
    ],
    [t]
  )

  const [selectedVideo, setSelectedVideo] = useState<(typeof TUTORIALS)[0] | null>(null)
  const { trackEvent } = useEventsTracking()

  const togglePreparingProductsModal = useCallback(() => {
    setPreparingProductsModalActive(prev => !prev)
  }, [])

  const { isMobileView } = useDevices()
  const itemsPerSlide = useMemo(() => (isMobileView ? 1 : 3), [isMobileView])
  const numTutorials = useMemo(() => TUTORIALS.length, [TUTORIALS])

  const handleOpenVideoModal = useCallback(
    (tutorial: (typeof TUTORIALS)[0]) => {
      setSelectedVideo(tutorial)
      trackEvent(EVENTS_TRACKING.VIEW_TUTORIAL, {
        [EVENTS_PARAMETERS_NAME.TUTORIAL_NAME]: tutorial.name,
      })
    },
    [trackEvent]
  )

  const handleCloseVideoModal = useCallback(() => {
    setSelectedVideo(null)
  }, [])

  // Prevent page scroll when video modal is open
  usePreventPageScroll(!!selectedVideo)

  const handleWatchAllTutorials = useCallback(() => {
    window.open(ELink.TAILORKIT_OFFICIAL_YOUTUBE, '_blank')
    trackEvent(EVENTS_TRACKING.VIEW_TUTORIAL, {
      [EVENTS_PARAMETERS_NAME.TUTORIAL_NAME]: t('all-tutorials'),
    })
  }, [trackEvent, t])

  return (
    <>
      <CardWithDismiss
        id="tutorials"
        cardName={OCCURRED_EVENTS.TUTORIALS_CARD_DASHBOARD_DISMISSED}
        dismissForever={false}
        title={
          <Box width={isMobileView ? '95%' : '97%'}>
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">
                {t('tutorials')}
              </Text>
              <Button variant="plain" icon={ExternalIcon} onClick={handleWatchAllTutorials}>
                {t('view-all-tutorials')}
              </Button>
            </InlineStack>
          </Box>
        }
      >
        <BlockStack gap={'300'}>
          <Text as="span" variant="bodyMd">
            {t(
              'explore-helpful-step-by-step-videos-covering-key-features-master-the-app-fast-and-unlock-its-full-value-quickly'
            )}
          </Text>

          {/* Tutorial carousel */}
          <CarouselWithPagination
            id="tutorials-carousel"
            numItems={numTutorials}
            itemsPerSlide={itemsPerSlide}
            disableScrollDetection={false}
          >
            {TUTORIALS.map(tutorial => {
              const { id, thumbnail, name, description, duration } = tutorial

              return (
                <Box
                  key={id}
                  padding="0"
                  minHeight="100%"
                  shadow="100"
                  borderColor="border"
                  borderRadius="200"
                  borderWidth="025"
                  overflowX="hidden"
                  overflowY="hidden"
                >
                  <BlockStack gap="0">
                    {/* Video thumbnail section */}
                    <div
                      style={{
                        height: '158px',
                        backgroundImage: `url(${thumbnail})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        position: 'relative',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleOpenVideoModal(tutorial)}
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
                      >
                        <Icon source={PlayIcon} tone="inherit" />
                        <Text as="span" variant="bodyXs" fontWeight="semibold" tone="text-inverse">
                          {duration}
                        </Text>
                      </div>
                    </div>

                    {/* Content section */}
                    <Box padding="500">
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingSm" fontWeight="semibold">
                          {name}
                        </Text>
                        <Text as="p" variant="bodySm">
                          {description}
                        </Text>
                      </BlockStack>
                    </Box>
                  </BlockStack>
                </Box>
              )
            })}
          </CarouselWithPagination>
        </BlockStack>
      </CardWithDismiss>

      {/* Video Modal */}
      {selectedVideo && (
        <Modal
          secondaryActions={[
            {
              content: t('close'),
              onAction: handleCloseVideoModal,
            },
          ]}
          open={!!selectedVideo}
          onClose={handleCloseVideoModal}
          title={selectedVideo.name}
          size="large"
        >
          <Box>
            {selectedVideo.videoUrl ? (
              <SocialVideo
                videoUrl={selectedVideo.videoUrl}
                thumbnailUrl={selectedVideo.thumbnail}
                videoLength={selectedVideo.time}
                socialAction={{
                  icon: LogoYoutubeIcon,
                  label: t('youtube'),
                  onClick: () => {
                    openInNewTab(selectedVideo.youtubeUrl)
                  },
                }}
                autoPlay={false}
              />
            ) : (
              <Box padding="800" background="bg-surface-secondary">
                <InlineStack align="center">
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Video will be available soon
                  </Text>
                </InlineStack>
              </Box>
            )}
          </Box>
        </Modal>
      )}

      <PrepareProductsModal active={preparingProductsModalActive} onClose={togglePreparingProductsModal} />
    </>
  )
}
