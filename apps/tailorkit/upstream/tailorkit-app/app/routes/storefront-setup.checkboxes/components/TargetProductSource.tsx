import {
  InlineGrid,
  Select,
  Combobox,
  Icon,
  Listbox,
  Scrollable,
  Box,
  InlineStack,
  TextField,
  AutoSelection,
  Checkbox,
  RadioButton,
  Text,
  Button,
  Thumbnail,
  BlockStack,
} from '@shopify/polaris'
import { SearchIcon, ImageIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { useCallback, useState, useMemo } from 'react'
import { ETriggerProductsType } from '~/enums/checkbox'
import { TRIGGER_BY_OPTIONS } from './types'

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

interface TargetProductSourceProps {
  currentTriggerProductsType: ETriggerProductsType
  targetProducts: string[]
  selectedProductsData: SelectedProduct[]
  selectedVariantsData: SelectedVariant[]
  collections?: Array<{ id: string; title: string; image?: { url: string; altText?: string | null } }>
  tags?: string[]
  vendors?: string[]
  productTypes?: string[]
  onTargetProductsChange: (products: string[]) => void
  onTriggerTypeChange: (type: ETriggerProductsType) => void
  onExcludeUpsellProductsChange?: (value: boolean) => void
  onOpenProductSelector: () => void
  onOpenVariantSelector: (productTitle?: string) => void
  onErrorClear?: () => void
  singleTriggerSelection?: boolean
}

/**
 * Component for selecting source of target products
 * Similar to OneTick's TargetProductSource
 */
export default function TargetProductSource({
  currentTriggerProductsType,
  targetProducts,
  selectedProductsData,
  selectedVariantsData,
  collections = [],
  tags = [],
  vendors = [],
  productTypes = [],
  onTargetProductsChange,
  onTriggerTypeChange,
  onExcludeUpsellProductsChange,
  onOpenProductSelector,
  onOpenVariantSelector,
  onErrorClear,
  singleTriggerSelection,
}: TargetProductSourceProps) {
  const { t } = useTranslation()
  const [textFieldValue, setTextFieldValue] = useState<string>('')

  // Check if trigger type is specific products or variants
  const isSpecificProducts = currentTriggerProductsType === ETriggerProductsType.SPECIFIC_PRODUCTS
  const isSpecificVariants = currentTriggerProductsType === ETriggerProductsType.SPECIFIC_VARIANTS
  const needsProductOrVariantSelector = isSpecificProducts || isSpecificVariants

  const needsOptionSelector
    = currentTriggerProductsType === ETriggerProductsType.PRODUCT_COLLECTIONS
    || currentTriggerProductsType === ETriggerProductsType.PRODUCT_TAGS
    || currentTriggerProductsType === ETriggerProductsType.PRODUCT_VENDORS
    || currentTriggerProductsType === ETriggerProductsType.PRODUCT_TYPES

  // Get available options based on trigger type
  const allOptions = useMemo(() => {
    switch (currentTriggerProductsType) {
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
  }, [currentTriggerProductsType, collections, tags, vendors, productTypes])

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!textFieldValue) return allOptions
    const searchLower = textFieldValue.toLowerCase()
    return allOptions.filter(opt => opt.label.toLowerCase().includes(searchLower))
  }, [allOptions, textFieldValue])

  const handleSelectOption = useCallback(
    (option: string) => {
      if (targetProducts.includes(option)) {
        onTargetProductsChange(targetProducts.filter(p => p !== option))
      } else {
        onTargetProductsChange(singleTriggerSelection ? [option] : [...targetProducts, option])
      }
      // Clear error when selecting options
      onErrorClear?.()
    },
    [targetProducts, onTargetProductsChange, onErrorClear, singleTriggerSelection]
  )

  // Handle "by products" / "by variants" change - similar to OneTick
  const handleTriggerByChange = useCallback(
    (value: string) => {
      const newType = value as ETriggerProductsType
      onTriggerTypeChange(newType)
      onTargetProductsChange([])
      // Set excludeUpsellProducts to true when changing trigger type (OneTick behavior)
      onExcludeUpsellProductsChange?.(true)
      onErrorClear?.()
    },
    [onTriggerTypeChange, onTargetProductsChange, onExcludeUpsellProductsChange, onErrorClear]
  )

  // Render "by products" / "by variants" selector
  if (needsProductOrVariantSelector) {
    const triggerByType = isSpecificVariants
      ? ETriggerProductsType.SPECIFIC_VARIANTS
      : ETriggerProductsType.SPECIFIC_PRODUCTS

    return (
      <InlineGrid columns={{ md: '1fr 2fr', sm: 1 }} gap="300">
        <Select
          label={t('select')}
          labelInline
          options={TRIGGER_BY_OPTIONS.map(opt => ({
            label: t(opt.label),
            value: opt.value,
          }))}
          value={triggerByType}
          onChange={handleTriggerByChange}
        />
        <InlineStack gap="200" wrap={false} blockAlign="start">
          <Box width="100%">
            <TextField
              label={t('search-products')}
              labelHidden
              type="text"
              value=""
              prefix={<Icon source={SearchIcon} tone="base" />}
              placeholder={t('search-products')}
              autoComplete="off"
              onFocus={isSpecificVariants ? () => onOpenVariantSelector() : onOpenProductSelector}
              readOnly
            />
          </Box>
          <Button onClick={isSpecificVariants ? onOpenVariantSelector : onOpenProductSelector} size="large">
            {t('browse')}
          </Button>
        </InlineStack>
      </InlineGrid>
    )
  }

  // Render Combobox for collections, tags, vendors, types - similar to OneTick
  if (needsOptionSelector) {
    const placeholderMap: Record<ETriggerProductsType, string> = {
      [ETriggerProductsType.PRODUCT_COLLECTIONS]: t('search-collections') || 'Search collections',
      [ETriggerProductsType.PRODUCT_TAGS]: t('search-tags') || 'Search tags',
      [ETriggerProductsType.PRODUCT_VENDORS]: t('search-vendors') || 'Search vendors',
      [ETriggerProductsType.PRODUCT_TYPES]: t('search-types') || 'Search types',
      [ETriggerProductsType.SPECIFIC_PRODUCTS]: '',
      [ETriggerProductsType.SPECIFIC_VARIANTS]: '',
      [ETriggerProductsType.ALL_PRODUCTS]: '',
    }

    return (
      <Combobox
        allowMultiple={!singleTriggerSelection}
        activator={
          <Combobox.TextField
            label={placeholderMap[currentTriggerProductsType]}
            labelHidden
            type="text"
            value={textFieldValue}
            onChange={setTextFieldValue}
            prefix={<Icon source={SearchIcon} tone="base" />}
            autoComplete="off"
            placeholder={placeholderMap[currentTriggerProductsType]}
            clearButton
            onClearButtonClick={() => setTextFieldValue('')}
          />
        }
      >
        <Scrollable style={{ maxHeight: '300px' }}>
          {filteredOptions.length > 0 ? (
            <Listbox autoSelection={AutoSelection.None}>
              {filteredOptions.map(option => {
                // Check if this is a collection (has id and title structure)
                const isCollection = collections.some(c => c.id === option.value)
                const collection = isCollection ? collections.find(c => c.id === option.value) : null
                const showPlaceholderImage = currentTriggerProductsType === ETriggerProductsType.PRODUCT_COLLECTIONS

                return (
                  <Listbox.Option
                    key={option.value}
                    value={option.value}
                    selected={targetProducts.includes(option.value)}
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
                          {singleTriggerSelection ? (
                            <RadioButton
                              label={option.label}
                              labelHidden
                              checked={targetProducts.includes(option.value)}
                              onChange={() => handleSelectOption(option.value)}
                            />
                          ) : (
                            <Checkbox
                              value={option.value}
                              label={option.label}
                              labelHidden
                              onChange={() => handleSelectOption(option.value)}
                              checked={targetProducts.includes(option.value)}
                            />
                          )}

                          {showPlaceholderImage && (
                            <Box width="40px" minWidth="40px" padding="0">
                              <Thumbnail
                                size="small"
                                source={collection?.image?.url || ImageIcon}
                                alt={collection?.image?.altText || 'Collection'}
                              />
                            </Box>
                          )}

                          <Box width={showPlaceholderImage || collection ? 'calc(100% - 90px)' : 'calc(100% - 34px)'}>
                            <BlockStack gap="100">
                              <Text as="span" variant="bodyMd" truncate>
                                {option.label}
                              </Text>
                              {/* Note: OneTick shows productsCount for collections, but we don't have that data */}
                            </BlockStack>
                          </Box>
                        </InlineStack>
                      </Box>
                    </div>
                  </Listbox.Option>
                )
              })}
            </Listbox>
          ) : (
            <Box paddingBlockStart="1600" paddingBlockEnd="1600">
              <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                {textFieldValue
                  ? t('no-results-found') || 'No results found'
                  : t('no-options-available') || 'No options available'}
              </Text>
            </Box>
          )}
        </Scrollable>
      </Combobox>
    )
  }

  return null
}
