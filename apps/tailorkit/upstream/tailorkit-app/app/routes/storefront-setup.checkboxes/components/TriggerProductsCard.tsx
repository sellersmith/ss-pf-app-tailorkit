import { Card, Select, BlockStack, Text, Checkbox, InlineError } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'
import { ETriggerProductsType } from '~/enums/checkbox'
import { TRIGGER_TYPE_OPTIONS } from './types'
import TargetProductSource from './TargetProductSource'
import TargetProductsSelected from './TargetProductsSelected'
import ExcludeTriggerProductOption from './ExcludeTriggerProductOption'

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

interface TriggerProductsCardProps {
  triggerProductsType: ETriggerProductsType
  targetProducts: string[]
  selectedProductsData: SelectedProduct[]
  selectedVariantsData: SelectedVariant[]
  excludeUpsellProducts: boolean
  error?: string
  // When true, hides the "All products" option and only shows "Specific products"
  hideAllProductsOption?: boolean
  // Available options loaded from API
  collections?: Array<{ id: string; title: string; image?: { url: string; altText?: string | null } }>
  tags?: string[]
  vendors?: string[]
  productTypes?: string[]
  // Exclude products props
  excludeTriggerProductsType?: ETriggerProductsType | null
  excludeTriggerProducts?: string[]
  selectedExcludeProductsData?: SelectedProduct[]
  selectedExcludeVariantsData?: SelectedVariant[]
  onTriggerTypeChange: (value: ETriggerProductsType) => void
  onTargetProductsChange: (products: string[]) => void
  onExcludeUpsellProductsChange: (value: boolean) => void
  onOpenProductSelector: () => void
  onOpenVariantSelector: (productTitle?: string) => void
  onRemoveProduct: (productId: string) => void
  onRemoveVariant: (variantId: string) => void
  onExcludeTriggerProductsTypeChange?: (value: ETriggerProductsType | null) => void
  onExcludeTriggerProductsChange?: (products: string[]) => void
  onOpenExcludeProductSelector?: () => void
  onOpenExcludeVariantSelector?: () => void
  onRemoveExcludeProduct?: (productId: string) => void
  onRemoveExcludeVariant?: (variantId: string) => void
  onErrorClear?: () => void
  singleTriggerSelection?: boolean
}

export default function TriggerProductsCard({
  triggerProductsType,
  targetProducts,
  selectedProductsData,
  selectedVariantsData,
  excludeUpsellProducts,
  error,
  hideAllProductsOption = false,
  collections = [],
  tags = [],
  vendors = [],
  productTypes = [],
  excludeTriggerProductsType = null,
  excludeTriggerProducts = [],
  selectedExcludeProductsData = [],
  selectedExcludeVariantsData = [],
  onTriggerTypeChange,
  onTargetProductsChange,
  onExcludeUpsellProductsChange,
  onOpenProductSelector,
  onOpenVariantSelector,
  onRemoveProduct,
  onRemoveVariant,
  onExcludeTriggerProductsTypeChange,
  onExcludeTriggerProductsChange,
  onOpenExcludeProductSelector,
  onOpenExcludeVariantSelector,
  onRemoveExcludeProduct,
  onRemoveExcludeVariant,
  onErrorClear,
  singleTriggerSelection,
}: TriggerProductsCardProps) {
  const { t } = useTranslation()

  // Filter deleted products for SPECIFIC_PRODUCTS only
  const filteredDeletedTargetProducts = useMemo(() => {
    if (triggerProductsType !== ETriggerProductsType.SPECIFIC_PRODUCTS) return selectedProductsData
    return selectedProductsData.filter((product: any) => !product?.isDeleted)
  }, [triggerProductsType, selectedProductsData])

  // Default value logic: if triggerProductsType is null/undefined, infer from targetProducts
  const currentTriggerProductsType = useMemo(() => {
    if (triggerProductsType) return triggerProductsType
    // Check if first target product is ALL_PRODUCTS
    if (filteredDeletedTargetProducts.length > 0) {
      const firstProduct = filteredDeletedTargetProducts[0] as any
      if (
        firstProduct === ETriggerProductsType.ALL_PRODUCTS
        || targetProducts[0] === ETriggerProductsType.ALL_PRODUCTS
      ) {
        return ETriggerProductsType.ALL_PRODUCTS
      }
    }
    return ETriggerProductsType.SPECIFIC_PRODUCTS
  }, [triggerProductsType, filteredDeletedTargetProducts, targetProducts])

  // triggerByProductsType logic: show SPECIFIC_PRODUCTS instead of SPECIFIC_VARIANTS in main select
  const isTriggerByVariants = currentTriggerProductsType === ETriggerProductsType.SPECIFIC_VARIANTS
  const triggerByProductsType = isTriggerByVariants
    ? ETriggerProductsType.SPECIFIC_PRODUCTS
    : currentTriggerProductsType

  // Handle trigger type change - similar to OneTick
  const handleTriggerTypeChange = (selected: ETriggerProductsType) => {
    // Clear error when changing trigger type
    onErrorClear?.()

    // Update trigger type and target products (OneTick behavior)
    onTriggerTypeChange(selected)
    onTargetProductsChange(selected === ETriggerProductsType.ALL_PRODUCTS ? [ETriggerProductsType.ALL_PRODUCTS] : [])

    // Set excludeUpsellProducts to true when changing trigger type (OneTick behavior)
    onExcludeUpsellProductsChange(true)
  }

  const handleRemoveOption = (value: string) => {
    onTargetProductsChange(targetProducts.filter(p => p !== value))
  }

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">
          {t('trigger-products')}
        </Text>

        <Text as="h2" variant="bodyMd">
          {t('add-on-products-will-appear-on')}
        </Text>

        <BlockStack gap="300">
          <Select
            name="Trigger products"
            label="Trigger products"
            labelHidden
            options={TRIGGER_TYPE_OPTIONS.filter(
              opt => !hideAllProductsOption || opt.value !== ETriggerProductsType.ALL_PRODUCTS
            ).map(opt => ({
              label: t(opt.value) || opt.label,
              value: opt.value,
            }))}
            onChange={handleTriggerTypeChange}
            value={triggerByProductsType}
          />

          <TargetProductSource
            key={currentTriggerProductsType}
            currentTriggerProductsType={currentTriggerProductsType}
            targetProducts={targetProducts}
            selectedProductsData={selectedProductsData}
            selectedVariantsData={selectedVariantsData}
            collections={collections}
            tags={tags}
            vendors={vendors}
            productTypes={productTypes}
            onTargetProductsChange={onTargetProductsChange}
            onTriggerTypeChange={onTriggerTypeChange}
            onExcludeUpsellProductsChange={onExcludeUpsellProductsChange}
            onOpenProductSelector={onOpenProductSelector}
            onOpenVariantSelector={onOpenVariantSelector}
            onErrorClear={onErrorClear}
            singleTriggerSelection={singleTriggerSelection}
          />

          {/* Only show selected items when NOT ALL_PRODUCTS - OneTick behavior */}
          {currentTriggerProductsType !== ETriggerProductsType.ALL_PRODUCTS && (
            <TargetProductsSelected
              currentTriggerProductsType={currentTriggerProductsType}
              targetProducts={targetProducts}
              selectedProductsData={selectedProductsData}
              selectedVariantsData={selectedVariantsData}
              collections={collections}
              tags={tags}
              vendors={vendors}
              productTypes={productTypes}
              onRemoveProduct={onRemoveProduct}
              onRemoveVariant={onRemoveVariant}
              onRemoveOption={handleRemoveOption}
              onEditVariants={onOpenVariantSelector}
            />
          )}

          {/* ExcludeTriggerProductOption - OneTick structure */}
          {onExcludeTriggerProductsTypeChange
            && onExcludeTriggerProductsChange
            && onOpenExcludeProductSelector
            && onOpenExcludeVariantSelector
            && onRemoveExcludeProduct
            && onRemoveExcludeVariant && (
              <ExcludeTriggerProductOption
                excludeTriggerProductsType={excludeTriggerProductsType}
                excludeTriggerProducts={excludeTriggerProducts}
                selectedExcludeProductsData={selectedExcludeProductsData}
                selectedExcludeVariantsData={selectedExcludeVariantsData}
                collections={collections}
                tags={tags}
                vendors={vendors}
                productTypes={productTypes}
                onExcludeTriggerProductsTypeChange={onExcludeTriggerProductsTypeChange}
                onExcludeTriggerProductsChange={onExcludeTriggerProductsChange}
                onOpenExcludeProductSelector={onOpenExcludeProductSelector}
                onOpenExcludeVariantSelector={onOpenExcludeVariantSelector}
                onRemoveExcludeProduct={onRemoveExcludeProduct}
                onRemoveExcludeVariant={onRemoveExcludeVariant}
              />
            )}

          {/* Error display */}
          {error && <InlineError message={error} fieldID="trigger-products" />}

          {/* Exclude add-on checkbox - only show when not SPECIFIC_PRODUCTS - OneTick structure */}
          {triggerByProductsType !== ETriggerProductsType.SPECIFIC_PRODUCTS && (
            <BlockStack gap="100">
              <Checkbox
                label={t('exclude-addon-from-triggers') || 'Exclude add-on product'}
                checked={excludeUpsellProducts}
                onChange={onExcludeUpsellProductsChange}
              />
            </BlockStack>
          )}
        </BlockStack>
      </BlockStack>
    </Card>
  )
}
