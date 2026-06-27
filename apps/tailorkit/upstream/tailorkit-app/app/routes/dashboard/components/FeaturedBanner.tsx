import { useNavigate, useFetcher } from '@remix-run/react'
import { BlockStack, Text, InlineGrid, Card, Image, Box, InlineStack, Button } from '@shopify/polaris'
import type { TFunction } from 'i18next'
import { useMemo } from 'react'
import { Trans } from 'react-i18next'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import usePromotions from '~/hooks/usePromotions'
import { openInNewTab } from '~/utils/openInNewTab'

export default function FeaturedBanner(props: { t: TFunction }) {
  const { t } = props
  const navigate = useNavigate()
  const { trackEvent } = useEventsTracking()
  const referralFetcher = useFetcher()

  const { activePromotions } = usePromotions({ position: 'Featured Banner' })
  const numPromotions = useMemo(() => activePromotions.length, [activePromotions])
  const featuredDesc = useMemo(() => activePromotions[0]?.description?.split(/[\r\n]+/) || [], [activePromotions])

  const onClickHandler = () => {
    const appId = activePromotions[0].key || activePromotions[0].appName || activePromotions[0].title

    trackEvent(EVENTS_TRACKING.CLICK_FEATURED_BANNER, {
      [EVENTS_PARAMETERS_NAME.FEATURED_BANNER]: appId,
    })

    // Fire referral tracking (fire-and-forget). Server filters non-SS-ecosystem apps.
    referralFetcher.submit(
      { targetApp: appId, crossSellPosition: 'featured-banner' },
      { method: 'POST', action: '/api/referral', encType: 'application/x-www-form-urlencoded' }
    )

    if (activePromotions[0].buttonLink.startsWith('http')) {
      openInNewTab(activePromotions[0].buttonLink)
    } else {
      navigate(activePromotions[0].buttonLink, { viewTransition: true })
    }
  }

  if (!numPromotions) return null

  return (
    <Box id="featured-banner">
      <Card>
        <BlockStack gap="200">
          {activePromotions[0].title && (
            <Text as="h3" variant="headingSm">
              {activePromotions[0].title}
            </Text>
          )}

          <InlineGrid gap={'400'} columns={activePromotions[0].image ? { xs: 1, sm: 1, md: '1.2fr 1fr' } : undefined}>
            {activePromotions[0].image && (
              <Image
                width={'100%'}
                source={activePromotions[0].image}
                alt={activePromotions[0].title || activePromotions[0].description}
              />
            )}

            <Box>
              <BlockStack gap={'400'}>
                {featuredDesc.map((paragraph: string, idx: number) => (
                  <Text key={idx} as="span" variant="bodyMd">
                    <Trans
                      t={t}
                      components={{
                        b: <strong />,
                        i: <em />,
                      }}
                    >
                      {paragraph}
                    </Trans>
                  </Text>
                ))}

                {activePromotions[0].buttonLink && (
                  <InlineStack gap={'300'}>
                    <Button variant="primary" onClick={onClickHandler}>
                      {activePromotions[0].buttonText || t('learn-more')}
                    </Button>
                  </InlineStack>
                )}
              </BlockStack>
            </Box>
          </InlineGrid>
        </BlockStack>
      </Card>
    </Box>
  )
}
