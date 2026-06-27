import { useTranslation } from 'react-i18next'
import CardWithDismiss from '../CardWithDismiss'
import {
  InlineStack,
  Text,
  BlockStack,
  Box,
  Button,
  Badge,
  SkeletonBodyText,
  SkeletonDisplayText,
  Tooltip,
} from '@shopify/polaris'
import { CarouselWithPagination } from '~/components/Carousel'
import useDevices from '~/utils/hooks/useDevice'
import { useProductSuggestion } from './hooks/useProductSuggestion'
import { capitalizeFirstLetter } from '~/bootstrap/fns/misc'
import type { ITopSellingProductsResult } from '~/routes/api.products/constants'
import { getCurrencySymbol } from '~/constants/currency-codes'
import numeral from 'numeral'
import { useModal } from '~/utils/hooks/useModal'
import { MODALS } from '~/components/AppBridge/ui-modal/constants'
import { Fragment, useCallback, useMemo } from 'react'
import { formatShopifyObjectIdToNumberId } from '~/utils/shopify'
import { PREFIX_PRODUCT_ID } from '~/constants/shopify'
import { OCCURRED_EVENTS } from '~/routes/api.preferences/constants'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'

const ProductSuggestedItem = (
  props: ITopSellingProductsResult & {
    thumbnailHeight?: number
    onClickOnStartPersonalizing?: (product: ITopSellingProductsResult) => void
  }
) => {
  const {
    title,
    featuredImageUrl,
    source,
    productSource,
    minPrice,
    productId,
    productDetails,
    onClickOnStartPersonalizing,
    thumbnailHeight = 180,
  } = props
  const { t } = useTranslation()
  const { openModal } = useModal()
  const { trackEvent } = useEventsTracking()

  const { amount = 0, currencyCode = 'USD' } = minPrice || {}
  const minPriceFormatted = `${getCurrencySymbol(currencyCode)}${numeral(amount).format('0,0.00')}`

  const openProductSelectorModal = useCallback(() => {
    trackEvent(EVENTS_TRACKING.START_PERSONALIZING_PRODUCT, {
      [EVENTS_PARAMETERS_NAME.START_PERSONALIZING_PRODUCT_FROM]: 'dashboard',
    })
    openModal(MODALS.DASHBOARD.PRODUCT_SELECTOR_MODAL_ID, {
      productId: formatShopifyObjectIdToNumberId(productId, PREFIX_PRODUCT_ID),
      defaultSource: source,
      autoSelectAllVariants: true,
      nonExistingProductData: productDetails,
    })
  }, [trackEvent, openModal, productId, source, productDetails])

  return (
    <div style={{ width: '99%', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '8px',
          height: '100%',
          width: '100%',
        }}
      >
        <BlockStack gap="200">
          <div
            style={{
              position: 'relative',
            }}
          >
            <img
              src={featuredImageUrl}
              alt={title}
              loading="lazy"
              style={{
                width: '100%',
                height: thumbnailHeight,
                objectFit: 'cover',
                borderRadius: '8px',
                border: '1px solid var(--p-color-border)',
              }}
            />
            <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
              <Badge tone={productSource === 'upsell' ? 'success' : 'info'}>
                {productSource === 'upsell' ? t('upsell') : capitalizeFirstLetter(productSource)}
              </Badge>
            </div>
          </div>
          <Tooltip content={title}>
            <div
              style={{
                maxHeight: '40px',
              }}
            >
              <Text as="h4" variant="bodyMd" fontWeight="semibold" truncate>
                {title}
              </Text>
            </div>
          </Tooltip>
        </BlockStack>
        <BlockStack gap="200" align="end">
          <Text as="p" variant="bodySm" fontWeight="regular">
            {t('from-price', { price: minPriceFormatted })}
          </Text>
          <Box width="100%">
            <InlineStack align="start">
              <Button
                fullWidth
                onClick={() => {
                  // Product-contextual create: a specific product is already selected,
                  // so we go straight to ProductSelector (with the product pre-filled)
                  // rather than offering the generic flow dropdown.
                  if (onClickOnStartPersonalizing) onClickOnStartPersonalizing(props)
                  else openProductSelectorModal()
                }}
              >
                {t('start-personalizing')}
              </Button>
            </InlineStack>
          </Box>
        </BlockStack>
      </div>
    </div>
  )
}

export const ProductSuggestedCard = ({
  showInCard = true,
  showIntroText = true,
  defaultProducts = [],
  maxItems = 5,
  thumbnailHeight = 180,
  carouselItemStyle,
  itemsPerSlideProps,
  onClickOnStartPersonalizing,
}: {
  showInCard?: boolean
  showIntroText?: boolean
  defaultProducts?: ITopSellingProductsResult[]
  maxItems?: number
  thumbnailHeight?: number
  carouselItemStyle?: React.CSSProperties
  itemsPerSlideProps?: number
  onClickOnStartPersonalizing?: (product: ITopSellingProductsResult) => void
}) => {
  const { t } = useTranslation()
  const { isSmallMobileView, isMobileView } = useDevices()

  const { products, loading, error } = useProductSuggestion(defaultProducts)
  const ComponentWrapper = showInCard ? CardWithDismiss : Fragment

  // Responsive items per slide logic
  const getItemsPerSlide = useCallback(() => {
    if (itemsPerSlideProps) return itemsPerSlideProps

    if (isSmallMobileView) return 1 // Small mobile: 1 item
    if (isMobileView) return 2 // Tablet/large mobile: 2 items
    return maxItems || 5 // Desktop: 5 items
  }, [itemsPerSlideProps, isSmallMobileView, isMobileView, maxItems])

  const itemsPerSlide = useMemo(() => getItemsPerSlide(), [getItemsPerSlide])

  if (error) {
    console.error('Error loading product suggestions:', error)
    return null // Hide the card if there's an error
  }

  return (
    <ComponentWrapper
      title={t('build-your-strong-product-empire')}
      cardName={OCCURRED_EVENTS.PRODUCT_SUGGESTED_CARD_DASHBOARD_DISMISSED}
      dismissForever={true}
    >
      <BlockStack gap="300">
        {showIntroText && (
          <Text as="p" variant="bodyMd">
            {t('explore-personalized-products-description')}
          </Text>
        )}
        <BlockStack gap="400">
          {loading ? (
            <CarouselWithPagination
              id="product-suggestions-skeleton"
              itemsPerSlide={itemsPerSlide}
              numItems={maxItems || 5}
              disablePagination={true}
            >
              {Array.from({ length: maxItems || 5 }).map((_, index) => (
                <SuggestedProductSkeleton key={`skeleton-${index}`} thumbnailHeight={thumbnailHeight} />
              ))}
            </CarouselWithPagination>
          ) : products.length > 0 ? (
            <CarouselWithPagination
              id="product-suggestions"
              itemsPerSlide={itemsPerSlide}
              numItems={products.length}
              carouselItemStyle={carouselItemStyle}
              paginationStyle="dots"
            >
              {products.map((item, index) => (
                <ProductSuggestedItem
                  key={`${item.productId}-${index}`}
                  {...item}
                  thumbnailHeight={thumbnailHeight}
                  onClickOnStartPersonalizing={onClickOnStartPersonalizing}
                />
              ))}
            </CarouselWithPagination>
          ) : (
            <Box padding="400" width="100%">
              <BlockStack align="center">
                <Text as="p" variant="bodyMd" tone="subdued">
                  {t('no-product-suggestions-available')}
                </Text>
              </BlockStack>
            </Box>
          )}
        </BlockStack>
      </BlockStack>
    </ComponentWrapper>
  )
}

function SuggestedProductSkeleton({ thumbnailHeight = 180 }: { thumbnailHeight?: number }) {
  return (
    <Box width={'100%'}>
      <BlockStack gap="300">
        <div
          className="Polaris-SkeletonThumbnail Polaris-SkeletonThumbnail--sizeLarge"
          style={{
            ['--pc-skeleton-thumbnail-large-size' as string]: '100%',
            height: thumbnailHeight,
            width: '100%',
          }}
        />
        <SkeletonBodyText lines={1} />
        <SkeletonDisplayText size="small" />
      </BlockStack>
    </Box>
  )
}
