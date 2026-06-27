import { Badge, BlockStack, Button, Image, InlineStack, Link, Text } from '@shopify/polaris'
import { useMemo, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { CarouselWithPagination } from '~/components/Carousel'
import { FlexColumn } from '~/components/common/Flex'
import { OCCURRED_EVENTS } from '~/routes/api.preferences/constants'
import { openInNewTab } from '~/utils/openInNewTab'
import useDevices from '~/utils/hooks/useDevice'
import CardWithDismiss from './CardWithDismiss'
import { THEME_CARDS, THEMES_VIEW_ALL_URL } from './themes-promo-data'

export default function ThemesPromoCard() {
  const { t } = useTranslation()
  const { isMobileView } = useDevices()
  /* 1 card per page = 4 pages. On desktop, cards are 75% width so the next card peeks in. */
  const desktopItemStyle = useMemo<CSSProperties>(() => (isMobileView ? {} : { width: '75%' }), [isMobileView])

  return (
    <CardWithDismiss
      title={
        isMobileView ? (
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              {t('themes-built-for-artisan-brands-like-yours')}
            </Text>
            <div>
              <Badge tone="info">{t('100-compatible-with-tailorkit')}</Badge>
            </div>
          </BlockStack>
        ) : (
          <InlineStack gap="200" blockAlign="center" wrap={false}>
            <Text as="h2" variant="headingMd">
              {t('themes-built-for-artisan-brands-like-yours')}
            </Text>
            <Badge tone="info">{t('100-compatible-with-tailorkit')}</Badge>
          </InlineStack>
        )
      }
      cardName={OCCURRED_EVENTS.THEMES_PROMO_CARD_DASHBOARD_DISMISSED}
    >
      <BlockStack gap="300">
        <InlineStack gap="200" blockAlign="center">
          <Text as="p" variant="bodyMd">
            {t('give-your-customers-a-storefront-that-feels-as-premium-as-the-products-they-re-designing')}
          </Text>
          <Link url={THEMES_VIEW_ALL_URL} target="_blank" removeUnderline>
            {t('view-all')}
          </Link>
        </InlineStack>

        <CarouselWithPagination
          id="themes-promo"
          numItems={THEME_CARDS.length}
          itemsPerSlide={1}
          disableScrollDetection={false}
          carouselItemStyle={desktopItemStyle}
        >
          {THEME_CARDS.map(theme => (
            <div
              key={theme.name}
              style={
                {
                  height: '100%',
                  '--pc-box-border-color': 'var(--p-color-border)',
                  '--pc-box-border-style': 'solid',
                  '--pc-box-border-radius': 'var(--p-border-radius-200)',
                  '--pc-box-border-width': 'var(--p-border-width-025)',
                  '--pc-box-min-height': '100%',
                  '--pc-box-overflow-x': 'hidden',
                  '--pc-box-overflow-y': 'hidden',
                } as CSSProperties
              }
              className="Polaris-Box"
            >
              {/* Desktop: horizontal layout (image left, content right) */}
              {/* Mobile: vertical layout (image top, content bottom) */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: isMobileView ? 'column' : 'row',
                  height: '100%',
                }}
              >
                {/* Theme preview image — on mobile, flex: 1.5 makes it 1.5x the content height */}
                <div
                  style={{
                    ...(isMobileView ? { width: '100%', flex: 1.5 } : { width: '50%', minHeight: '100%' }),
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  <Image
                    source={isMobileView ? theme.mobileMedia : theme.desktopMedia}
                    alt={theme.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>

                {/* Card content — on mobile, flex: 1 (media is 1.5x this height) */}
                <FlexColumn
                  style={{ flex: 1, padding: 'var(--p-space-400)' }}
                  justify="space-between"
                  gap="var(--p-space-300)"
                >
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">
                      {theme.name}
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {theme.subheading}
                    </Text>
                    <Text as="p" variant="bodyMd">
                      {theme.description}
                    </Text>
                  </BlockStack>

                  <InlineStack align="end">
                    <Button onClick={() => openInNewTab(theme.buttonUrl)}>{t('learn-more')}</Button>
                  </InlineStack>
                </FlexColumn>
              </div>
            </div>
          ))}
        </CarouselWithPagination>
      </BlockStack>
    </CardWithDismiss>
  )
}
