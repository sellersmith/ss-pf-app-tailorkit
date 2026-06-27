import { Banner, Box, Card, InlineStack, Link, List, Text } from '@shopify/polaris'
import type { TFunction } from 'i18next'
import { memo } from 'react'

interface DimensionAlertData {
  detectedAt: string
  productImageDims: { width: number; height: number }
  setupImageDims: { width: number; height: number }
  productId: string
  mockupViewId: string
}

interface Props {
  dimensionAlert: DimensionAlertData | null | undefined
  shopDomain: string
  onDismiss: () => void
  t: TFunction
}

/**
 * Warning banner shown when current product image dimensions don't match the image used during mockup setup.
 * Alert data comes from Integration.dimensionAlert (set by PRODUCTS_UPDATE webhook handler).
 */
export const ProductImageDimensionBanner = memo(function ProductImageDimensionBanner({
  dimensionAlert,
  shopDomain,
  onDismiss,
  t,
}: Props) {
  if (!dimensionAlert) return null

  const { productImageDims, setupImageDims, productId } = dimensionAlert
  // Guard against old-shape documents (pre-migration: had templateDims instead of setupImageDims)
  if (!setupImageDims) return null
  const shopifyProductUrl = `https://${shopDomain}/admin/products/${productId}`

  return (
    <Box padding="200">
      <Card padding="0">
        <Banner tone="warning" onDismiss={onDismiss}>
          <Text as="p" variant="bodyMd">
            {t('product-image-size-mismatch')}
          </Text>
          <List>
            <List.Item>
              <Text as="span" fontWeight="semibold">
                {t('shopify-product-image')}:
              </Text>{' '}
              {productImageDims.width} x {productImageDims.height}px
            </List.Item>
            <List.Item>
              <Text as="span" fontWeight="semibold">
                {t('setup-image')}:
              </Text>{' '}
              {setupImageDims.width} x {setupImageDims.height}px
            </List.Item>
          </List>
          <InlineStack gap="100" wrap={false}>
            <Text as="p" variant="bodyMd" tone="subdued">
              {t('product-image-mismatch-description')}
            </Text>
            <Link url={shopifyProductUrl} target="_blank" monochrome removeUnderline>
              {t('edit-in-shopify')}
            </Link>
          </InlineStack>
        </Banner>
      </Card>
    </Box>
  )
})
