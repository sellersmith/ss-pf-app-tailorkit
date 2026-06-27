import {
  Card,
  BlockStack,
  Text,
  Checkbox,
  Button,
  InlineStack,
  Thumbnail,
  Box,
  Badge,
  InlineError,
} from '@shopify/polaris'
import { ImageIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import type { UpsellProduct } from '~/types/checkbox'

interface SelectedVariantData {
  id: string
  title: string
  price?: string
  compareAtPrice?: string
  product: {
    id: string
    title: string
    featuredImage?: { url: string }
  }
}

interface UpsellProductCardProps {
  upsellProducts: UpsellProduct[]
  selectedVariantData: SelectedVariantData | null
  canRemoveWhenTriggersCleared: boolean
  showPersonalizeButton: boolean
  isUpsellProductIntegrated: boolean
  error?: string
  onCanRemoveChange: (value: boolean) => void
  onShowPersonalizeButtonChange: (value: boolean) => void
  onOpenProductSelector: () => void
}

export default function UpsellProductCard({
  upsellProducts,
  selectedVariantData,
  canRemoveWhenTriggersCleared,
  showPersonalizeButton,
  isUpsellProductIntegrated,
  error,
  onCanRemoveChange,
  onShowPersonalizeButtonChange,
  onOpenProductSelector,
}: UpsellProductCardProps) {
  const { t } = useTranslation()

  const hasSelectedProduct = upsellProducts.length > 0 && selectedVariantData

  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h2" variant="headingMd">
          {t('addon-product')}
        </Text>
        <Text as="h2" variant="bodyMd">
          {t('select-product-you-want-to-upsell-cross-sell')}
        </Text>
        {/* Select product button - only show when no product selected */}
        {!hasSelectedProduct && (
          <Box>
            <Button onClick={onOpenProductSelector}>{t('select-product')}</Button>
          </Box>
        )}
        {/* Error display - only show when no product selected */}
        {!hasSelectedProduct && error && <InlineError message={error} fieldID="addon-product" />}
        {/* Selected variant display - OneTick style */}
        {hasSelectedProduct && (
          <>
            <Box borderColor="border" borderWidth="025" borderRadius="200">
              <Box padding="300">
                <InlineStack wrap={false} gap="200" blockAlign="center" align="space-between">
                  <Box width="calc(100% - 100px)">
                    <InlineStack wrap={false} gap="200" blockAlign="center">
                      <Box minWidth="40px">
                        <Thumbnail
                          size="small"
                          source={selectedVariantData.product.featuredImage?.url || ImageIcon}
                          alt={selectedVariantData.product.title}
                        />
                      </Box>
                      <Box width="100%">
                        <BlockStack gap="100" inlineAlign="start">
                          <Box width="100%">
                            <Text as="span" variant="bodyMd" fontWeight="medium" truncate>
                              {selectedVariantData.product.title}
                            </Text>
                          </Box>
                          <InlineStack gap="200">
                            {selectedVariantData.title && selectedVariantData.title !== 'Default Title' && (
                              <Badge>{selectedVariantData.title}</Badge>
                            )}
                            <InlineStack gap="100">
                              {selectedVariantData.price && (
                                <Text as="span" variant="bodyMd">
                                  {selectedVariantData.price}
                                </Text>
                              )}
                              {selectedVariantData.compareAtPrice && (
                                <Text as="span" variant="bodyMd" tone="subdued" textDecorationLine="line-through">
                                  {selectedVariantData.compareAtPrice}
                                </Text>
                              )}
                            </InlineStack>
                          </InlineStack>
                        </BlockStack>
                      </Box>
                    </InlineStack>
                  </Box>
                  <Button onClick={onOpenProductSelector}>{t('change')}</Button>
                </InlineStack>
              </Box>
            </Box>

            <Checkbox
              label={t('remove-when-all-trigger-products-removed-from-cart')}
              checked={canRemoveWhenTriggersCleared}
              onChange={onCanRemoveChange}
            />

            {isUpsellProductIntegrated && (
              <Checkbox
                label={t('show-personalize-button')}
                checked={showPersonalizeButton}
                onChange={onShowPersonalizeButtonChange}
              />
            )}
          </>
        )}
      </BlockStack>
    </Card>
  )
}
