import {
  BlockStack,
  Checkbox,
  InlineGrid,
  Select,
  Box,
  InlineStack,
  TextField,
  Text,
  Scrollable,
  Icon,
  Combobox,
  Listbox,
  AutoSelection,
  Button,
  Thumbnail,
} from '@shopify/polaris'
import { SearchIcon, ImageIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { useCallback, useMemo, useState } from 'react'
import { ETriggerProductsType } from '~/enums/checkbox'
import { TRIGGER_BY_OPTIONS } from './types'
import ExcludeProductsSelected from './ExcludeProductsSelected'

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

interface ExcludeProductsSourceProps {
  excludeTriggerProductsType: ETriggerProductsType
  excludeTriggerProducts: string[]
  selectedExcludeProductsData: SelectedProduct[]
  selectedExcludeVariantsData: SelectedVariant[]
  collections?: Array<{ id: string; title: string; image?: { url: string; altText?: string | null } }>
  tags?: string[]
  vendors?: string[]
  productTypes?: string[]
  onExcludeTypeChange: (type: ETriggerProductsType) => void
  onExcludeProductsChange: (products: string[]) => void
  onOpenExcludeProductSelector: () => void
  onOpenExcludeVariantSelector: () => void
  onRemoveExcludeProduct: (productId: string) => void
  onRemoveExcludeVariant: (variantId: string) => void
}

const EXCLUDE_PRODUCT_OPTIONS = [
  { label: 'Product collections', value: ETriggerProductsType.PRODUCT_COLLECTIONS },
  { label: 'Product tags', value: ETriggerProductsType.PRODUCT_TAGS },
  { label: 'Product vendors', value: ETriggerProductsType.PRODUCT_VENDORS },
  { label: 'Product types', value: ETriggerProductsType.PRODUCT_TYPES },
  { label: 'Specific products', value: ETriggerProductsType.SPECIFIC_PRODUCTS },
]

/**
 * Component for selecting source of exclude products
 * Similar to OneTick's ExcludeProductSource but adapted for TailorKit
 */
export default function ExcludeProductsSource({
  excludeTriggerProductsType,
  excludeTriggerProducts,
  selectedExcludeProductsData,
  selectedExcludeVariantsData,
  collections = [],
  tags = [],
  vendors = [],
  productTypes = [],
  onExcludeTypeChange,
  onExcludeProductsChange,
  onOpenExcludeProductSelector,
  onOpenExcludeVariantSelector,
  onRemoveExcludeProduct,
  onRemoveExcludeVariant,
}: ExcludeProductsSourceProps) {
  const { t } = useTranslation()
  const [searchValue, setSearchValue] = useState('')

  // Get available options based on exclude type
  const getAvailableOptions = useCallback(() => {
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

  const availableOptions = getAvailableOptions()
  const filteredOptions = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()
    if (!keyword) return availableOptions
    return availableOptions.filter(option => option.label.toLowerCase().includes(keyword))
  }, [availableOptions, searchValue])

  // Check if exclude type is specific products or variants
  const isSpecificProducts = excludeTriggerProductsType === ETriggerProductsType.SPECIFIC_PRODUCTS
  const isSpecificVariants = excludeTriggerProductsType === ETriggerProductsType.SPECIFIC_VARIANTS
  const needsProductOrVariantSelector = isSpecificProducts || isSpecificVariants
  const needsOptionSelector
    = excludeTriggerProductsType === ETriggerProductsType.PRODUCT_COLLECTIONS
    || excludeTriggerProductsType === ETriggerProductsType.PRODUCT_TAGS
    || excludeTriggerProductsType === ETriggerProductsType.PRODUCT_VENDORS
    || excludeTriggerProductsType === ETriggerProductsType.PRODUCT_TYPES

  // Get the "by" type for the selector (products or variants)
  const excludeByType = isSpecificVariants
    ? ETriggerProductsType.SPECIFIC_VARIANTS
    : ETriggerProductsType.SPECIFIC_PRODUCTS

  // Value for exclude type select (show SPECIFIC_PRODUCTS instead of SPECIFIC_VARIANTS)
  const excludeTypeValue = isSpecificVariants ? ETriggerProductsType.SPECIFIC_PRODUCTS : excludeTriggerProductsType

  const handleSelectOption = useCallback(
    (option: string) => {
      if (excludeTriggerProducts.includes(option)) {
        onExcludeProductsChange(excludeTriggerProducts.filter(p => p !== option))
      } else {
        onExcludeProductsChange([...excludeTriggerProducts, option])
      }
    },
    [excludeTriggerProducts, onExcludeProductsChange]
  )

  // Handle "by products" / "by variants" change
  const handleExcludeByChange = useCallback(
    (value: string) => {
      // Clear exclude products when switching between products and variants
      onExcludeProductsChange([])
      onExcludeTypeChange(value as ETriggerProductsType)
    },
    [onExcludeProductsChange, onExcludeTypeChange]
  )

  // Handle exclude type change
  const handleExcludeTypeChange = useCallback(
    (value: string) => {
      onExcludeProductsChange([])
      onExcludeTypeChange(value as ETriggerProductsType)
    },
    [onExcludeProductsChange, onExcludeTypeChange]
  )

  return (
    <BlockStack gap="300">
      <Select
        name="Exclude products"
        label="Exclude products"
        labelHidden
        options={EXCLUDE_PRODUCT_OPTIONS.map(opt => ({
          label: t(opt.value) || opt.label,
          value: opt.value,
        }))}
        onChange={handleExcludeTypeChange}
        value={excludeTypeValue}
      />

      {/* "By products" / "By variants" selector */}
      {needsProductOrVariantSelector && (
        <InlineGrid columns={{ md: '1fr 2fr', sm: 1 }} gap="300">
          <Select
            label={t('select')}
            labelInline
            options={TRIGGER_BY_OPTIONS.map(opt => ({
              label: t(opt.label),
              value: opt.value,
            }))}
            value={excludeByType}
            onChange={handleExcludeByChange}
          />
          <InlineStack gap="200" wrap={false} blockAlign="start">
            <Box width="100%">
              <TextField
                label={t('search-products')}
                labelHidden
                value=""
                placeholder={t('search-products')}
                autoComplete="off"
                onFocus={isSpecificVariants ? onOpenExcludeVariantSelector : onOpenExcludeProductSelector}
                readOnly
              />
            </Box>
            <Button onClick={isSpecificVariants ? onOpenExcludeVariantSelector : onOpenExcludeProductSelector}>
              {t('browse')}
            </Button>
          </InlineStack>
        </InlineGrid>
      )}

      {/* Option selector for collections, tags, vendors, types */}
      {needsOptionSelector && (
        <BlockStack gap="200">
          <Combobox
            allowMultiple
            activator={
              <Combobox.TextField
                label={t('search-types')}
                labelHidden
                value={searchValue}
                onChange={setSearchValue}
                prefix={<Icon source={SearchIcon} tone="base" />}
                autoComplete="off"
                placeholder={t('search-types')}
              />
            }
          >
            <Scrollable shadow style={{ maxHeight: '240px' }}>
              {filteredOptions.length > 0 ? (
                <Listbox autoSelection={AutoSelection.None}>
                  {filteredOptions.map(option => {
                    const isCollection = excludeTriggerProductsType === ETriggerProductsType.PRODUCT_COLLECTIONS
                    const collection = isCollection ? collections.find(c => c.id === option.value) : null
                    const showPlaceholderImage = isCollection

                    return (
                      <Listbox.Option
                        key={option.value}
                        value={option.value}
                        selected={excludeTriggerProducts.includes(option.value)}
                      >
                        <div
                          className="ot-select-item"
                          style={{ width: '100%' }}
                          onClickCapture={e => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleSelectOption(option.value)
                          }}
                        >
                          <Box
                            borderBlockEndWidth="025"
                            borderColor="border"
                            paddingBlockStart="200"
                            paddingBlockEnd="200"
                            paddingInlineStart="400"
                            paddingInlineEnd="400"
                            width="100%"
                          >
                            <InlineStack gap="400" align="start" blockAlign="center" wrap={false}>
                              <Checkbox
                                value={option.value}
                                label={option.label}
                                labelHidden
                                onChange={() => handleSelectOption(option.value)}
                                checked={excludeTriggerProducts.includes(option.value)}
                              />

                              {showPlaceholderImage && (
                                <Box width="40px" minWidth="40px" padding="0">
                                  <Thumbnail
                                    size="small"
                                    source={collection?.image?.url || ImageIcon}
                                    alt={collection?.image?.altText || 'Collection'}
                                  />
                                </Box>
                              )}

                              <Box
                                width={showPlaceholderImage || collection ? 'calc(100% - 90px)' : 'calc(100% - 34px)'}
                              >
                                <Text as="span" variant="bodyMd" truncate>
                                  {option.label}
                                </Text>
                              </Box>
                            </InlineStack>
                          </Box>
                        </div>
                      </Listbox.Option>
                    )
                  })}
                </Listbox>
              ) : (
                <Box padding="200">
                  <Text as="p" variant="bodySm" tone="subdued">
                    {t('no-options-available')}
                  </Text>
                </Box>
              )}
            </Scrollable>
          </Combobox>
        </BlockStack>
      )}

      {/* Selected list */}
      <ExcludeProductsSelected
        excludeTriggerProductsType={excludeTriggerProductsType}
        excludeTriggerProducts={excludeTriggerProducts}
        selectedExcludeProductsData={selectedExcludeProductsData}
        selectedExcludeVariantsData={selectedExcludeVariantsData}
        collections={collections}
        tags={tags}
        vendors={vendors}
        productTypes={productTypes}
        onRemoveExcludeProduct={onRemoveExcludeProduct}
        onRemoveExcludeVariant={onRemoveExcludeVariant}
        onRemoveExcludeOption={handleSelectOption}
      />
    </BlockStack>
  )
}
