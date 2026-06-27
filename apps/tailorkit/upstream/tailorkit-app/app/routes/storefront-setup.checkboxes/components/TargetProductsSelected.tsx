import { Box, Button, InlineStack, Text, Thumbnail, BlockStack } from '@shopify/polaris'
import { XIcon, ImageIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { useState, useMemo } from 'react'
import { ETriggerProductsType } from '~/enums/checkbox'

interface SelectedProduct {
  id: string
  title: string
  featuredImage?: { url: string }
}

interface SelectedVariant {
  id: string
  title: string
  price?: string
  product: {
    id: string
    title: string
    featuredImage?: { url: string }
  }
}

interface TargetProductsSelectedProps {
  currentTriggerProductsType: ETriggerProductsType
  targetProducts: string[]
  selectedProductsData: SelectedProduct[]
  selectedVariantsData: SelectedVariant[]
  collections?: Array<{ id: string; title: string; image?: { url: string; altText?: string | null } }>
  tags?: string[]
  vendors?: string[]
  productTypes?: string[]
  onRemoveProduct: (productId: string) => void
  onRemoveVariant: (variantId: string) => void
  onRemoveOption: (value: string) => void
  onEditVariants?: (productTitle?: string) => void
}

/**
 * Component for displaying selected target products
 * Similar to OneTick's TargetProductsSelected
 */
export default function TargetProductsSelected({
  currentTriggerProductsType,
  targetProducts,
  selectedProductsData,
  selectedVariantsData,
  collections = [],
  tags = [],
  vendors = [],
  productTypes = [],
  onRemoveProduct,
  onRemoveVariant,
  onRemoveOption,
  onEditVariants,
}: TargetProductsSelectedProps) {
  const { t } = useTranslation()
  const [showMore, setShowMore] = useState(false)

  // Filter deleted products for SPECIFIC_PRODUCTS
  const filteredDeletedTargetProducts = useMemo(() => {
    if (currentTriggerProductsType !== ETriggerProductsType.SPECIFIC_PRODUCTS) return selectedProductsData
    return selectedProductsData.filter((product: any) => !product?.isDeleted)
  }, [currentTriggerProductsType, selectedProductsData])

  // Get available options for lookup
  const getAvailableOptions = useMemo(() => {
    switch (currentTriggerProductsType) {
      case ETriggerProductsType.PRODUCT_COLLECTIONS:
        return collections.map(c => ({ value: c.id, label: c.title, image: c.image }))
      case ETriggerProductsType.PRODUCT_TAGS:
        return tags.map(tag => ({ value: tag, label: tag }))
      case ETriggerProductsType.PRODUCT_VENDORS:
        return vendors.map(v => ({ value: v, label: v }))
      case ETriggerProductsType.PRODUCT_TYPES:
        return productTypes.map(pt => ({ value: pt, label: pt }))
      default:
        return []
    }
  }, [currentTriggerProductsType, collections, tags, vendors, productTypes])

  // Render SPECIFIC_PRODUCTS
  if (currentTriggerProductsType === ETriggerProductsType.SPECIFIC_PRODUCTS) {
    if (filteredDeletedTargetProducts.length === 0) return null

    const hasMoreProducts = filteredDeletedTargetProducts.length > 5
    const displayedProducts
      = hasMoreProducts && !showMore ? filteredDeletedTargetProducts.slice(0, 5) : filteredDeletedTargetProducts
    const hiddenProductsCount = filteredDeletedTargetProducts.length - 5

    return (
      <Box borderColor="border" borderWidth="025" borderRadius="200">
        {displayedProducts.map((product, index) => (
          <Box key={product.id} {...(index ? { borderBlockStartWidth: '025' } : {})} borderColor="border" padding="300">
            <InlineStack wrap={false} gap="200" blockAlign="center" align="space-between">
              <Box width="calc(100% - 80px)">
                <InlineStack wrap={false} gap="200" blockAlign="center" align="start">
                  <Box minWidth="40px">
                    <Thumbnail size="small" source={product.featuredImage?.url || ImageIcon} alt={product.title} />
                  </Box>
                  <Box width="100%">
                    <Text as="span" variant="bodyMd" truncate>
                      {product.title}
                    </Text>
                  </Box>
                </InlineStack>
              </Box>
              <Button
                icon={XIcon}
                variant="plain"
                onClick={() => onRemoveProduct(product.id)}
                accessibilityLabel={t('remove')}
              />
            </InlineStack>
          </Box>
        ))}

        {hasMoreProducts && (
          <Box borderBlockStartWidth="025" borderColor="border" padding="300">
            <Button variant="plain" disclosure={showMore ? 'up' : 'down'} onClick={() => setShowMore(!showMore)}>
              {showMore ? t('show-fewer-products') : t('show-more-products', { count: hiddenProductsCount })}
            </Button>
          </Box>
        )}
      </Box>
    )
  }

  // Render SPECIFIC_VARIANTS
  if (currentTriggerProductsType === ETriggerProductsType.SPECIFIC_VARIANTS) {
    if (selectedVariantsData.length === 0) return null

    const hasMoreVariants = selectedVariantsData.length > 5
    const displayedVariants = hasMoreVariants && !showMore ? selectedVariantsData.slice(0, 5) : selectedVariantsData
    const hiddenVariantsCount = selectedVariantsData.length - 5

    return (
      <Box borderColor="border" borderWidth="025" borderRadius="200">
        {displayedVariants.map((variant, index) => (
          <Box key={variant.id} {...(index ? { borderBlockStartWidth: '025' } : {})} borderColor="border" padding="300">
            <InlineStack wrap={false} gap="200" blockAlign="center" align="space-between">
              <Box width="calc(100% - 80px)">
                <InlineStack wrap={false} gap="200" blockAlign="center" align="start">
                  <Box minWidth="40px">
                    <Thumbnail
                      size="small"
                      source={variant.product?.featuredImage?.url || ImageIcon}
                      alt={variant.title}
                    />
                  </Box>
                  <Box width="100%">
                    <BlockStack gap="0">
                      <Text as="span" variant="bodyMd" truncate>
                        {variant.product?.title}
                      </Text>
                      <Text as="span" variant="bodySm" tone="subdued" truncate>
                        {variant.title}
                      </Text>
                    </BlockStack>
                  </Box>
                </InlineStack>
              </Box>
              <Button
                variant="plain"
                onClick={() => onEditVariants?.(variant.product?.title)}
                accessibilityLabel={t('edit')}
              >
                {t('edit')}
              </Button>
              <Button
                icon={XIcon}
                variant="plain"
                onClick={() => onRemoveVariant(variant.id)}
                accessibilityLabel={t('remove')}
              />
            </InlineStack>
          </Box>
        ))}

        {hasMoreVariants && (
          <Box borderBlockStartWidth="025" borderColor="border" padding="300">
            <Button variant="plain" disclosure={showMore ? 'up' : 'down'} onClick={() => setShowMore(!showMore)}>
              {showMore ? t('show-fewer-products') : t('show-more-products', { count: hiddenVariantsCount })}
            </Button>
          </Box>
        )}
      </Box>
    )
  }

  // Render collections, tags, vendors, types
  if (targetProducts.length === 0) return null

  const hasMoreOptions = targetProducts.length > 5
  const displayedOptions = hasMoreOptions && !showMore ? targetProducts.slice(0, 5) : targetProducts
  const hiddenOptionsCount = targetProducts.length - 5

  // Check if current type should show thumbnail (collections)
  const showThumbnail = currentTriggerProductsType === ETriggerProductsType.PRODUCT_COLLECTIONS

  return (
    <Box borderColor="border" borderWidth="025" borderRadius="200">
      {displayedOptions.map((value, index) => {
        const option = getAvailableOptions.find(opt => opt.value === value)
        const optionImage = (option as any)?.image
        return (
          <Box key={value} {...(index ? { borderBlockStartWidth: '025' } : {})} borderColor="border" padding="300">
            <InlineStack wrap={false} gap="200" blockAlign="center" align="space-between">
              <Box width="calc(100% - 80px)">
                <InlineStack wrap={false} gap="200" blockAlign="center" align="start">
                  {showThumbnail && (
                    <Box width="40px" minWidth="40px">
                      <Thumbnail
                        size="small"
                        source={optionImage?.url || ImageIcon}
                        alt={optionImage?.altText || 'Collection'}
                      />
                    </Box>
                  )}
                  <Box width="100%">
                    <Text as="span" variant="bodyMd" truncate>
                      {option?.label || value}
                    </Text>
                  </Box>
                </InlineStack>
              </Box>
              <Button
                icon={XIcon}
                variant="plain"
                onClick={() => onRemoveOption(value)}
                accessibilityLabel={t('remove')}
              />
            </InlineStack>
          </Box>
        )
      })}

      {hasMoreOptions && (
        <Box borderBlockStartWidth="025" borderColor="border" padding="300">
          <Button variant="plain" disclosure={showMore ? 'up' : 'down'} onClick={() => setShowMore(!showMore)}>
            {showMore ? t('show-fewer-products') : t('show-more-products', { count: hiddenOptionsCount })}
          </Button>
        </Box>
      )}
    </Box>
  )
}
