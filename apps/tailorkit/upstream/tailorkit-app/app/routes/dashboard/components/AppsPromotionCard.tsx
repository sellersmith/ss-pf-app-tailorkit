import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  Image,
  InlineStack,
  SkeletonBodyText,
  SkeletonThumbnail,
  Text,
} from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import CardWithDismiss from './CardWithDismiss'
import useDevices from '~/utils/hooks/useDevice'
import { useCallback, useMemo } from 'react'
import { useFetcher } from '@remix-run/react'
import { CarouselWithPagination } from '~/components/Carousel'
import usePromotions from '~/hooks/usePromotions'
import { openInNewTab } from '~/utils/openInNewTab'
import { FlexColumn } from '~/components/common/Flex'
import { OCCURRED_EVENTS } from '~/routes/api.preferences/constants'

function AppsPromotionCard() {
  const { t } = useTranslation()

  const { trackEvent } = useEventsTracking()
  const { isMobileView } = useDevices()
  const referralFetcher = useFetcher()

  const onClickAppHandler = useCallback(
    (appId: string, buttonLink: string) => {
      trackEvent(EVENTS_TRACKING.CLICK_APP_PROMOTION, {
        [EVENTS_PARAMETERS_NAME.APP_PROMOTION]: appId,
      })

      // Fire referral tracking (fire-and-forget). Server filters non-SS-ecosystem apps.
      referralFetcher.submit(
        { targetApp: appId, crossSellPosition: 'apps-promo-card' },
        { method: 'POST', action: '/api/referral', encType: 'application/x-www-form-urlencoded' }
      )

      openInNewTab(buttonLink)
    },
    [trackEvent] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const itemsPerSlide = useMemo(() => (isMobileView ? 1 : 3), [isMobileView])

  const { loading, intro, activePromotions } = usePromotions({ position: 'App Promo Card' })
  const numPromotions = useMemo(() => activePromotions.length, [activePromotions])

  if (!activePromotions || activePromotions.length === 0) return null

  return (
    <CardWithDismiss
      title={intro.heading || t('try-our-other-apps')}
      cardName={OCCURRED_EVENTS.TRY_OUR_OTHER_APPS_CARD_DASHBOARD_DISMISSED}
    >
      <BlockStack gap={'300'}>
        <Text as="p" variant="bodyMd">
          {intro.description || t('try-our-other-apps-description')}
        </Text>

        <CarouselWithPagination
          id="active-promotions"
          numItems={numPromotions}
          itemsPerSlide={itemsPerSlide}
          disableScrollDetection={false}
        >
          {loading
            ? Array.from({ length: itemsPerSlide }).map((_, index) => <PromotionsSkeleton key={index} />)
            : activePromotions.map((app, index) => (
                <div
                  key={index}
                  style={{
                    height: '100%',
                    /** @ts-ignore */
                    '--pc-box-border-color': 'var(--p-color-border)',
                    '--pc-box-border-style': 'solid',
                    '--pc-box-border-radius': 'var(--p-border-radius-200)',
                    '--pc-box-border-width': 'var(--p-border-width-025)',
                    '--pc-box-min-height': '100%',
                    '--pc-box-overflow-x': 'hidden',
                    '--pc-box-overflow-y': 'hidden',
                    '--pc-box-padding-block-start-xs': 'var(--p-space-400)',
                    '--pc-box-padding-block-end-xs': 'var(--p-space-400)',
                    '--pc-box-padding-inline-start-xs': 'var(--p-space-400)',
                    '--pc-box-padding-inline-end-xs': 'var(--p-space-400)',
                    '--pc-box-shadow': 'var(--p-shadow-100)',
                  }}
                  className="Polaris-Box"
                >
                  <FlexColumn style={{ height: '100%' }} justify="space-between" gap="var(--p-space-300)">
                    <InlineStack gap={'300'} blockAlign="center">
                      <BlockStack gap="200">
                        <InlineStack gap={'200'} wrap={false}>
                          <Image
                            source={app.appLogo || app.image}
                            alt={app.appName || app.title}
                            width={48}
                            height={48}
                            style={{ borderRadius: '4px' }}
                          />
                          <BlockStack gap={'100'}>
                            <Text as="h3" variant="headingSm">
                              {app.appName || app.title}
                            </Text>
                            {app.badgeContent && (
                              <Box>
                                <Badge tone="success">{app.badgeContent}</Badge>
                              </Box>
                            )}
                          </BlockStack>
                        </InlineStack>

                        <Text as="p" variant="bodyMd">
                          {t(app.description)}
                        </Text>
                      </BlockStack>
                    </InlineStack>
                    <InlineStack align="end">
                      <Box>
                        <Button onClick={() => onClickAppHandler(app.key || app.appName || app.title, app.buttonLink)}>
                          {app.buttonText || t('install-now')}
                        </Button>
                      </Box>
                    </InlineStack>
                  </FlexColumn>
                </div>
              ))}
        </CarouselWithPagination>
      </BlockStack>
    </CardWithDismiss>
  )
}

function PromotionsSkeleton() {
  return (
    <Card>
      <BlockStack gap={'500'}>
        <BlockStack gap="200">
          <InlineStack gap={'200'} wrap={false}>
            <SkeletonThumbnail />
            <Box paddingBlockStart="200" width="calc(100% - 168px)">
              <SkeletonBodyText lines={1} />
            </Box>
          </InlineStack>

          <SkeletonBodyText />
        </BlockStack>
        <InlineStack align="end">
          <Box width="100px">
            <SkeletonBodyText lines={1} />
          </Box>
        </InlineStack>
      </BlockStack>
    </Card>
  )
}

export default AppsPromotionCard
