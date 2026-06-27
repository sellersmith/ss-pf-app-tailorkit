import { Box, Button, InlineStack, Text, Thumbnail, Tag, BlockStack } from '@shopify/polaris'
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

interface ExcludeProductsSelectedProps {
  excludeTriggerProductsType: ETriggerProductsType
  excludeTriggerProducts: string[]
  selectedExcludeProductsData: SelectedProduct[]
  selectedExcludeVariantsData: SelectedVariant[]
  collections?: Array<{ id: string; title: string; image?: { url: string; altText?: string | null } }>
  tags?: string[]
  vendors?: string[]
  productTypes?: string[]
  onRemoveExcludeProduct: (productId: string) => void
  onRemoveExcludeVariant: (variantId: string) => void
  onRemoveExcludeOption: (value: string) => void
}

/**
 * Component for displaying selected exclude products
 * Similar to OneTick's ExcludeProductsSelected but adapted for TailorKit
 */
export default function ExcludeProductsSelected({
  excludeTriggerProductsType,
  excludeTriggerProducts,
  selectedExcludeProductsData,
  selectedExcludeVariantsData,
  collections = [],
  tags = [],
  vendors = [],
  productTypes = [],
  onRemoveExcludeProduct,
  onRemoveExcludeVariant,
  onRemoveExcludeOption,
}: ExcludeProductsSelectedProps) {
  const { t } = useTranslation()
  const [showMore, setShowMore] = useState(false)

  // Filter deleted products for SPECIFIC_PRODUCTS
  const filteredProducts = useMemo(() => {
    if (excludeTriggerProductsType !== ETriggerProductsType.SPECIFIC_PRODUCTS) return selectedExcludeProductsData
    return selectedExcludeProductsData.filter((product: any) => !product?.isDeleted)
  }, [excludeTriggerProductsType, selectedExcludeProductsData])

  // Get available options for lookup
  const getAvailableOptions = useMemo(() => {
    switch (excludeTriggerProductsType) {
      case ETriggerProductsType.PRODUCT_COLLECTIONS:
        return collections.map(c => ({ value: c.id, label: c.title }))
      case ETriggerProductsType.PRODUCT_TAGS:
        return tags.map(tag => ({ value: tag, label: tag }))
      case ETriggerProductsType.PRODUCT_VENDORS:
        return vendors.map(v => ({ value: v, label: v }))
      case ETriggerProductsType.PRODUCT_TYPES:
        return productTypes.map(pt => ({ value: pt, label: pt }))
      default:
        return []
    }
  }, [excludeTriggerProductsType, collections, tags, vendors, productTypes])

  // Render based on exclude type
  if (excludeTriggerProductsType === ETriggerProductsType.SPECIFIC_PRODUCTS) {
    if (filteredProducts.length === 0) return null

    const hasMoreProducts = filteredProducts.length > 5
    const displayedProducts = hasMoreProducts && !showMore ? filteredProducts.slice(0, 5) : filteredProducts
    const hiddenProductsCount = filteredProducts.length - 5

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
                onClick={() => onRemoveExcludeProduct(product.id)}
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

  if (excludeTriggerProductsType === ETriggerProductsType.SPECIFIC_VARIANTS) {
    if (selectedExcludeVariantsData.length === 0) return null

    const hasMoreVariants = selectedExcludeVariantsData.length > 5
    const displayedVariants
      = hasMoreVariants && !showMore ? selectedExcludeVariantsData.slice(0, 5) : selectedExcludeVariantsData
    const hiddenVariantsCount = selectedExcludeVariantsData.length - 5

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
                icon={XIcon}
                variant="plain"
                onClick={() => onRemoveExcludeVariant(variant.id)}
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

  // For collections, tags, vendors, types
  if (excludeTriggerProducts.length === 0) return null

  const hasMoreOptions = excludeTriggerProducts.length > 5
  const displayedOptions = hasMoreOptions && !showMore ? excludeTriggerProducts.slice(0, 5) : excludeTriggerProducts
  const hiddenOptionsCount = excludeTriggerProducts.length - 5

  // For tags, use Tag component
  if (excludeTriggerProductsType === ETriggerProductsType.PRODUCT_TAGS) {
    return (
      <Box>
        <InlineStack gap="100" wrap>
          {displayedOptions.map(tag => (
            <Tag key={tag} onRemove={() => onRemoveExcludeOption(tag)}>
              {tag}
            </Tag>
          ))}
          {hasMoreOptions && (
            <Button variant="plain" disclosure={showMore ? 'up' : 'down'} onClick={() => setShowMore(!showMore)}>
              {showMore
                ? t('show-fewer-products')
                : `+${hiddenOptionsCount} ${hiddenOptionsCount > 1 ? 'tags' : 'tag'}`}
            </Button>
          )}
        </InlineStack>
      </Box>
    )
  }

  // For collections, vendors, types - use bordered box
  return (
    <Box borderColor="border" borderWidth="025" borderRadius="200">
      {displayedOptions.map((value, index) => {
        const option = getAvailableOptions.find(opt => opt.value === value)
        return (
          <Box key={value} {...(index ? { borderBlockStartWidth: '025' } : {})} borderColor="border" padding="300">
            <InlineStack wrap={false} gap="200" blockAlign="center" align="space-between">
              <Text as="span" variant="bodyMd">
                {option?.label || value}
              </Text>
              <Button
                icon={XIcon}
                variant="plain"
                onClick={() => onRemoveExcludeOption(value)}
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
