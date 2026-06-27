import type { ScrollableRef } from '@shopify/polaris'
import { Scrollable } from '@shopify/polaris'
import type { LegacyRef, RefObject } from 'react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TRIGGER_ELEMENT } from '~/components/TourGuide/constants'
import { useStore } from '~/libs/external-store'
import ProductNVariantSelector from '~/modules/modals/ProductNVariantSelector'
import { IntegrationStore, useGroupProductBase } from '~/stores/modules/integration/integration'
import { type IVariant } from '~/types/shopify-product'
import { getVariantsSelectedWithNewMockup } from '../../utilities/evaluateMetafieldLayersAndPrintAreas'
import { createTemplateForPrintAreaFactory } from '../../utilities/newIntegrationHelpers'
import type { IProductVariantSelectModalArgs } from './ProductBase'
import ProductBaseContainer from './ProductBase'
import { useEditorParams } from '../../hooks/useEditorParams'

/** Component for managing product base settings. */
const ProductBaseSetting = () => {
  const { t } = useTranslation()
  const { previewMode } = useEditorParams()
  const allVariantsIntegrated = useStore(IntegrationStore, state => state.allVariantsIntegrated)

  const [productSelectorActive, setProductSelectorActive] = useState<{
    isActive: boolean
    selectMode?: 'add' | 'change'
    data?: IProductVariantSelectModalArgs | null
  }>({ isActive: false, selectMode: 'add', data: null })

  const groupAllProductVariants = useGroupProductBase(allVariantsIntegrated)
  const groupProductBase = useGroupProductBase()

  // Memoized condition to show based on selected variants
  const conditionToShow = useMemo(() => {
    const { mockup, product } = productSelectorActive.data?.variantsChanging?.[0] || {}
    return {
      mockupId: mockup?._id,
      productId: product?.id,
    }
  }, [productSelectorActive.data?.variantsChanging])

  // Memoized current variants based on condition to show
  const currentVariants = useMemo(() => {
    const mockupId = conditionToShow.mockupId

    return mockupId ? groupProductBase[mockupId] : []
  }, [conditionToShow.mockupId, groupProductBase])

  // Function to close product selector modal
  const closeProductSelectorModal = useCallback(async () => {
    setProductSelectorActive({ isActive: false, data: null })
  }, [])

  const outlineRef: RefObject<HTMLDivElement> = useRef(null)
  const scrollableRef: LegacyRef<ScrollableRef> = useRef(null)

  /**
   * Builds a template factory with empty defaults for the first mockup selection.
   */
  const buildCreateTemplateForPrintArea = useCallback(() => {
    const templateSelected = null
    const templateData = null
    const printAreaIdFromSearchParams = ''
    const prebuiltPrintAreasByVariantId = undefined
    const mockupIdFromSearchParams = undefined
    const selectedPrintAreaId = undefined
    const shopDomain = ''

    return createTemplateForPrintAreaFactory({
      templateSelected,
      templateData,
      printAreaIdFromSearchParams,
      prebuiltPrintAreasByVariantId,
      mockupIdFromSearchParams,
      selectedPrintAreaId,
      shopDomain,
    })
  }, [])

  // Function to handle variant selection
  const onSelect = useCallback(
    async (variants: IVariant[]) => {
      try {
        if (productSelectorActive.selectMode === 'add') {
          const variantsSelectedWithMockup = await getVariantsSelectedWithNewMockup({
            variantsSelected: variants,
            mockupIdFromSearchParams: undefined,
            seedTemplateDimensionPx: undefined,
            prebuiltPrintAreasByVariantId: undefined,
            createTemplateForPrintArea: buildCreateTemplateForPrintArea(),
          })
          IntegrationStore.dispatch({ type: 'PRODUCTS_VARIANTS_ADDED', payload: { variantsSelectedWithMockup } })

          // Automatically open the first recently added variant to create mockup
          setTimeout(() => {
            const element = document.getElementById(variantsSelectedWithMockup[0]._id)

            if (element) {
              element.role = TRIGGER_ELEMENT
              element.click()
            }
          }, 100)
        } else if (productSelectorActive.selectMode === 'change' && productSelectorActive.data) {
          const { mockup, printAreas } = productSelectorActive.data

          const currentVariants = groupAllProductVariants[mockup._id]

          // Check if variants are actually changed
          const isSelectedVariantsEveryBeIncludedInCurrentVariants = variants.every(variant =>
            currentVariants.map(_variant => _variant.id).includes(variant.id)
          )
          const isSameLength = variants.length === currentVariants.length

          const isChanged = !(isSelectedVariantsEveryBeIncludedInCurrentVariants && isSameLength)

          IntegrationStore.dispatch({
            type: 'UPDATED_PRODUCT_VARIANTS_SELECTED',
            payload: {
              mockup: isChanged
                ? {
                    ...mockup,
                    // Clear variant label
                    variantLabel: '',
                  }
                : mockup,
              printAreas,
              newProductVariants: variants,
            },
          })
        }
      } catch (error) {
        console.error('Error selecting variants:', error)
      }
    },
    [
      buildCreateTemplateForPrintArea,
      groupAllProductVariants,
      productSelectorActive.data,
      productSelectorActive.selectMode,
    ]
  )

  return (
    <div ref={outlineRef}>
      <s-box>
        <Scrollable
          ref={scrollableRef}
          style={{
            height: '100%',
            overflowY: 'auto',
          }}
        >
          {/* Render list product variants selected */}
          <ProductBaseContainer scrollableRef={scrollableRef} previewMode={previewMode} />
        </Scrollable>

        {productSelectorActive.isActive && (
          <ProductNVariantSelector
            active={productSelectorActive.isActive}
            title={t('select-products')}
            onClose={closeProductSelectorModal}
            onSelect={onSelect}
            groupProductBase={groupProductBase}
            groupAllProductVariants={groupAllProductVariants}
            conditionToShow={conditionToShow}
            currentVariants={currentVariants}
          />
        )}
      </s-box>
    </div>
  )
}

export default ProductBaseSetting
