/* eslint-disable max-len */
import type { ProductCardProps } from '../type'
import { useMemo, Fragment } from 'react'
import { EMPTY_OBJECT } from '~/constants'
import { useRootLoaderData } from '~/root'
import { useTranslation } from 'react-i18next'
import { ImageIcon } from '@shopify/polaris-icons'
import { getIdNumberFromIdString } from '~/shopify/fns'
import { Badge, Box, Checkbox, Link, RadioButton, Card, BlockStack, Tooltip, Text } from '@shopify/polaris'
import { getShopifyImageInSpecificWidth } from 'extensions/tailorkit-src/src/assets/fns/shopify-image-url'
import {
  getProductBrandNameAndModel,
  getProductId,
  getProductImage,
  getProductName,
  getProductOptions,
  getProductPrice,
} from '../fns'

/** Narrow read-only shape for the integration-detection heuristic. The broader Product type
 *  in this module is intentionally loose (see type.d.ts); this interface types only the fields
 *  we actually read so the integration check stays type-safe without refactoring Product. */
interface ProductIntegrationShape {
  source?: string
  integrated?: boolean
  variants?: Array<{ integrated?: boolean }>
}

export default function ProductCard({
  source,
  product,
  multiple = false,
  allowIntegratedProducts = false,
  selectedProducts,
  handleProductSelection,
}: ProductCardProps) {
  const { t } = useTranslation()

  const {
    shopData: {
      shopDomain,
      shopConfig: { money_format },
    },
  } = useRootLoaderData()

  const productId = getProductId(product)
  const productName = getProductName(product)
  const productImage = getProductImage(product)
  const productOptions = getProductOptions(product) || EMPTY_OBJECT
  const productPrice = getProductPrice(product, money_format)
  const productBrandNameAndModel = getProductBrandNameAndModel(product)

  // Check if product has any integrated variants (API sets `integrated` per variant, not per product).
  // Excludes dummy products — those are demo placeholders, not real merchant integrations.
  const integrationShape = product as ProductIntegrationShape
  const isIntegrated
    = !allowIntegratedProducts
    && integrationShape.source !== 'dummy'
    && (integrationShape.integrated === true || (integrationShape.variants || []).some(v => v.integrated === true))

  const TitleWrapper = useMemo(() => (source === 'existing' ? Link : Fragment), [source])
  const CheckerComponent = useMemo(() => (multiple ? Checkbox : RadioButton), [multiple])

  const optionTypes = useMemo(() => Object.keys(productOptions).sort((a, b) => a.length - b.length), [productOptions])

  return (
    <Box key={productId} position="relative">
      {
        <Box
          zIndex="1"
          position="absolute"
          insetBlockStart="200"
          insetInlineStart="200"
          visuallyHidden={source !== 'existing'}
        >
          <CheckerComponent
            labelHidden
            label={productName}
            disabled={isIntegrated}
            id={productId.toString()}
            checked={selectedProducts?.includes(productId)}
            onChange={checked => handleProductSelection(productId, checked)}
          />
        </Box>
      }

      {/* Already-personalized indicator — explains why the card is disabled */}
      {isIntegrated && (
        <Box zIndex="1" position="absolute" insetBlockStart="200" insetInlineEnd="200">
          <Tooltip
            content={t('this-product-already-has-personalization-open-it-from-the-personalized-products-page-to-edit')}
          >
            <Badge tone="info">{t('personalized')}</Badge>
          </Tooltip>
        </Box>
      )}

      <Box paddingBlockEnd="200">
        <label
          htmlFor={isIntegrated ? undefined : productId.toString()}
          style={{ cursor: isIntegrated ? 'not-allowed' : 'pointer', opacity: isIntegrated ? 0.5 : 1 }}
        >
          <BlockStack gap="200">
            <Card padding="0">
              {productImage ? (
                <img
                  alt={productName}
                  src={getShopifyImageInSpecificWidth(productImage, 225)}
                  style={{
                    width: '100%',
                    aspectRatio: '1/1',
                    objectFit: 'contain',
                    marginBottom: '-6px',
                  }}
                />
              ) : (
                <ImageIcon />
              )}
            </Card>

            <TitleWrapper
              {...(source === 'existing'
                ? {
                    target: '_blank',
                    monochrome: true,
                    removeUnderline: true,
                    url: `https://${shopDomain}/admin/products/${getIdNumberFromIdString(productId)}`,
                  }
                : {})}
            >
              <Tooltip content={productName}>
                <Text as="h3" variant="bodyMd" fontWeight="medium" truncate>
                  {productName}
                </Text>
              </Tooltip>
            </TitleWrapper>

            {productBrandNameAndModel && (
              <Text as="p" variant="bodySm" tone="subdued">
                {productBrandNameAndModel}
              </Text>
            )}

            <Text as="p" variant="bodySm" tone="subdued">
              {source !== 'existing' ? t('from-price', { price: productPrice }) : productPrice}
            </Text>

            {product.variants?.length ? (
              <Text as="p" variant="bodySm" tone="subdued">
                {product.variants.length > 1
                  ? t('num-variants', { num: product.variants.length })
                  : t('num-variant', { num: product.variants.length })}
              </Text>
            ) : null}

            {optionTypes.map(key => (
              <Text key={key} as="p" variant="bodySm" tone="subdued">
                {`${productOptions[key]} ${productOptions[key] > 1 ? key : key.replace(/ies$/, 'y').replace(/s$/, '')}`}
              </Text>
            ))}
          </BlockStack>
        </label>
      </Box>
    </Box>
  )
}
