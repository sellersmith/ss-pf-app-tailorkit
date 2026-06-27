import { BlockStack, Grid } from '@shopify/polaris'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ETriggerProductsType } from '~/enums/checkbox'
import ProductSelector from '~/modules/ProductSelector'
import { useRootLoaderData } from '~/root'
import { getUpsellProductLimit } from '~/utils/getUpsellProductLimit'
import CheckboxPreview from '~/routes/storefront-setup.checkboxes/components/CheckboxPreview'
import TriggerProductsCard from '~/routes/storefront-setup.checkboxes/components/TriggerProductsCard'
import UpsellProductCard from '~/routes/storefront-setup.checkboxes/components/UpsellProductCard'
import type { ProductData, UpsellProduct, VariantData } from '~/types/checkbox'
import { useCheckboxOnboarding } from '../hooks/useCheckboxOnboarding'

type SelectedVariantData = VariantData & {
  product: VariantData['product'] & {
    hasOnlyDefaultVariant?: boolean
    variants?: Array<{ id: string; title: string; price?: string }>
  }
}

type SelectedProduct = ProductData

/**
 * BasicSetupStep - Create first checkbox widget
 * Reuses TriggerProductsCard and UpsellProductCard from CheckboxForm
 */
export default function BasicSetupStep() {
  const { t } = useTranslation()
  const rootData = useRootLoaderData()
  const upsellProductLimit = getUpsellProductLimit(rootData?.shopData)
  const hideAllProductsOption = typeof upsellProductLimit === 'number'
  const {
    checkboxFormState,
    setCheckboxFormState,
    selectedVariantData,
    setSelectedVariantData,
    checkboxStyling,
    canProceedToNextStep,
    collections,
    tags,
    vendors,
    productTypes,
  } = useCheckboxOnboarding()

  // Modal states
  const [showAddonProductSelector, setShowAddonProductSelector] = useState(false)
  const [showTriggerProductSelector, setShowTriggerProductSelector] = useState(false)
  const [showTriggerVariantSelector, setShowTriggerVariantSelector] = useState(false)

  // Selected trigger products/variants data (for display)
  const [selectedProductsData, setSelectedProductsData] = useState<SelectedProduct[]>([])
  const [selectedTriggerVariantsData, setSelectedTriggerVariantsData] = useState<VariantData[]>([])

  // Handle trigger products selection from modal
  const handleTriggerProductSelect = useCallback(
    (products: ProductData[]) => {
      const productIds = products.map(p => p.id)
      setCheckboxFormState(prev => ({
        ...prev,
        targetProducts: productIds,
      }))
      setSelectedProductsData(products)
      setShowTriggerProductSelector(false)
    },
    [setCheckboxFormState]
  )

  // Handle trigger variants selection from modal
  const handleTriggerVariantSelect = useCallback(
    (_products: ProductData[], variants: VariantData[]) => {
      const variantIds = variants.map(v => v.id)
      setCheckboxFormState(prev => ({
        ...prev,
        targetProducts: variantIds,
        triggerProductsType: ETriggerProductsType.SPECIFIC_VARIANTS,
      }))
      setSelectedTriggerVariantsData(variants)
      setShowTriggerVariantSelector(false)
    },
    [setCheckboxFormState]
  )

  // Handle removing a trigger product
  const handleRemoveTriggerProduct = useCallback(
    (productId: string) => {
      setCheckboxFormState(prev => ({
        ...prev,
        targetProducts: prev.targetProducts.filter(id => id !== productId),
      }))
      setSelectedProductsData(prev => prev.filter(p => p.id !== productId))
    },
    [setCheckboxFormState]
  )

  // Handle removing a trigger variant
  const handleRemoveTriggerVariant = useCallback(
    (variantId: string) => {
      setCheckboxFormState(prev => ({
        ...prev,
        targetProducts: prev.targetProducts.filter(id => id !== variantId),
      }))
      setSelectedTriggerVariantsData(prev => prev.filter(v => v.id !== variantId))
    },
    [setCheckboxFormState]
  )

  // Handle addon product selection (single variant)
  const handleAddonProductSelect = useCallback(
    (variant: SelectedVariantData) => {
      const upsellProducts: UpsellProduct[] = [
        {
          productId: variant.product?.id || '',
          variantId: variant.id,
        },
      ]
      setCheckboxFormState(prev => ({
        ...prev,
        upsellProducts,
        checkboxContent: {
          ...prev.checkboxContent,
          heading: `<p>Add ${variant.product?.title || ''}</p>`,
          imageUrl: variant.product?.featuredImage?.url || '',
        },
      }))
      setSelectedVariantData(variant)
      setShowAddonProductSelector(false)
    },
    [setCheckboxFormState, setSelectedVariantData]
  )

  // Update form field helper
  const updateField = useCallback(
    <K extends keyof typeof checkboxFormState>(field: K, value: (typeof checkboxFormState)[K]) => {
      setCheckboxFormState(prev => ({ ...prev, [field]: value }))
    },
    [setCheckboxFormState]
  )

  return (
    <BlockStack gap="400">
      <Grid gap={{ xs: '400' }}>
        {/* Form Column */}
        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 8, xl: 8 }}>
          <BlockStack gap="400">
            {/* Trigger Products Card - reuse from CheckboxForm */}
            <TriggerProductsCard
              triggerProductsType={checkboxFormState.triggerProductsType}
              targetProducts={checkboxFormState.targetProducts}
              selectedProductsData={selectedProductsData}
              selectedVariantsData={selectedTriggerVariantsData}
              excludeUpsellProducts={checkboxFormState.excludeUpsellProducts}
              hideAllProductsOption={hideAllProductsOption}
              singleTriggerSelection={hideAllProductsOption}
              collections={collections}
              tags={tags}
              vendors={vendors}
              productTypes={productTypes}
              onTriggerTypeChange={value => {
                updateField('triggerProductsType', value)
                // Clear target products when type changes
                if (value === ETriggerProductsType.ALL_PRODUCTS) {
                  updateField('targetProducts', [])
                  setSelectedProductsData([])
                  setSelectedTriggerVariantsData([])
                }
              }}
              onTargetProductsChange={value => updateField('targetProducts', value)}
              onExcludeUpsellProductsChange={value => updateField('excludeUpsellProducts', value)}
              onOpenProductSelector={() => setShowTriggerProductSelector(true)}
              onOpenVariantSelector={() => setShowTriggerVariantSelector(true)}
              onRemoveProduct={handleRemoveTriggerProduct}
              onRemoveVariant={handleRemoveTriggerVariant}
            />

            {/* Add-on Product Card */}
            <UpsellProductCard
              upsellProducts={checkboxFormState.upsellProducts}
              selectedVariantData={selectedVariantData}
              canRemoveWhenTriggersCleared={checkboxFormState.canRemoveWhenTriggersCleared}
              error={!canProceedToNextStep ? t('add-on-product-required') : undefined}
              onCanRemoveChange={value => updateField('canRemoveWhenTriggersCleared', value)}
              onOpenProductSelector={() => setShowAddonProductSelector(true)}
            />
          </BlockStack>
        </Grid.Cell>

        {/* Preview Column */}
        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 2, lg: 4, xl: 4 }}>
          <div className="ot-sticky-preview-card">
            <CheckboxPreview
              formState={checkboxFormState}
              selectedVariantData={selectedVariantData}
              checkboxStyling={checkboxStyling}
            />
          </div>
        </Grid.Cell>
      </Grid>

      {/* Trigger Products Selector */}
      <ProductSelector
        open={showTriggerProductSelector}
        multiple={!hideAllProductsOption}
        hideVariants={true}
        showDuplicateOption={false}
        allowIntegratedProducts={true}
        defaultSource="existing"
        initialSelectedProductIds={selectedProductsData.map(p => p.id).filter(Boolean) as string[]}
        onClose={() => setShowTriggerProductSelector(false)}
        onSelect={(products, _variants) => handleTriggerProductSelect(products as ProductData[])}
      />

      {/* Trigger Variants Selector */}
      <ProductSelector
        open={showTriggerVariantSelector}
        multiple={!hideAllProductsOption}
        singleVariantSelection={false}
        showDuplicateOption={false}
        allowIntegratedProducts={true}
        embedProductInVariants={true}
        defaultSource="existing"
        initialSelectedVariantIds={selectedTriggerVariantsData.map(v => v.id)}
        onClose={() => setShowTriggerVariantSelector(false)}
        onSelect={(products, variants) =>
          handleTriggerVariantSelect(products as ProductData[], variants as VariantData[])
        }
      />

      {/* Addon Variant Selector - Single variant with radio buttons */}
      <ProductSelector
        open={showAddonProductSelector}
        multiple={false}
        singleVariantSelection={true}
        showDuplicateOption={false}
        allowIntegratedProducts={true}
        embedProductInVariants={true}
        defaultSource="existing"
        initialSelectedVariantIds={selectedVariantData ? [selectedVariantData.id] : []}
        onClose={() => setShowAddonProductSelector(false)}
        onSelect={(_, variants) => variants[0] && handleAddonProductSelect(variants[0] as SelectedVariantData)}
      />
    </BlockStack>
  )
}
