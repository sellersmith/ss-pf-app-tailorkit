import { BlockStack, Checkbox } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { ETriggerProductsType } from '~/enums/checkbox'
import ExcludeProductsSource from './ExcludeProductsSource'

interface ExcludeTriggerProductOptionProps {
  excludeTriggerProductsType: ETriggerProductsType | null
  excludeTriggerProducts: string[]
  selectedExcludeProductsData: Array<{ id: string; title: string; featuredImage?: { url: string } }>
  selectedExcludeVariantsData: Array<{
    id: string
    title: string
    price?: string
    product: { id: string; title: string; featuredImage?: { url: string } }
  }>
  collections?: Array<{ id: string; title: string; image?: { url: string; altText?: string | null } }>
  tags?: string[]
  vendors?: string[]
  productTypes?: string[]
  onExcludeTriggerProductsTypeChange: (type: ETriggerProductsType | null) => void
  onExcludeTriggerProductsChange: (products: string[]) => void
  onOpenExcludeProductSelector: () => void
  onOpenExcludeVariantSelector: () => void
  onRemoveExcludeProduct: (productId: string) => void
  onRemoveExcludeVariant: (variantId: string) => void
}

/**
 * Component for excluding specific products from triggers
 * Similar to OneTick's ExcludeTriggerProductOption
 */
export default function ExcludeTriggerProductOption({
  excludeTriggerProductsType,
  excludeTriggerProducts,
  selectedExcludeProductsData,
  selectedExcludeVariantsData,
  collections = [],
  tags = [],
  vendors = [],
  productTypes = [],
  onExcludeTriggerProductsTypeChange,
  onExcludeTriggerProductsChange,
  onOpenExcludeProductSelector,
  onOpenExcludeVariantSelector,
  onRemoveExcludeProduct,
  onRemoveExcludeVariant,
}: ExcludeTriggerProductOptionProps) {
  const { t } = useTranslation()

  const handleChange = (newChecked: boolean) => {
    if (newChecked) {
      // When checked, set default to PRODUCT_COLLECTIONS and clear exclude products
      onExcludeTriggerProductsTypeChange(ETriggerProductsType.PRODUCT_COLLECTIONS)
      onExcludeTriggerProductsChange([])
    } else {
      // When unchecked, set to null and clear exclude products
      onExcludeTriggerProductsTypeChange(null)
      onExcludeTriggerProductsChange([])
    }
  }

  return (
    <BlockStack gap="300">
      <Checkbox
        label={t('exclude-specific-products-from-triggers')}
        checked={!!excludeTriggerProductsType}
        onChange={handleChange}
      />

      {excludeTriggerProductsType && (
        <ExcludeProductsSource
          excludeTriggerProductsType={excludeTriggerProductsType}
          excludeTriggerProducts={excludeTriggerProducts}
          selectedExcludeProductsData={selectedExcludeProductsData}
          selectedExcludeVariantsData={selectedExcludeVariantsData}
          collections={collections}
          tags={tags}
          vendors={vendors}
          productTypes={productTypes}
          onExcludeTypeChange={onExcludeTriggerProductsTypeChange}
          onExcludeProductsChange={onExcludeTriggerProductsChange}
          onOpenExcludeProductSelector={onOpenExcludeProductSelector}
          onOpenExcludeVariantSelector={onOpenExcludeVariantSelector}
          onRemoveExcludeProduct={onRemoveExcludeProduct}
          onRemoveExcludeVariant={onRemoveExcludeVariant}
        />
      )}
    </BlockStack>
  )
}
