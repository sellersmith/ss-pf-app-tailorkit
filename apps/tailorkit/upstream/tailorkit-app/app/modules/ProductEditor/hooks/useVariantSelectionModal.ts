import { useCallback } from 'react'
import { useStore } from '~/libs/external-store'
import { IntegrationStore, useGroupProductBase } from '~/stores/modules/integration/integration'
import { useModal } from '~/utils/hooks/useModal'
import { MODAL_ID } from '~/constants/modal'
import type { IVariant } from '~/types/shopify-product'
import { useEditorParams } from './useEditorParams'
import { EMPTY_ARRAY } from '~/constants'
import { showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import { useTranslation } from 'react-i18next'

interface IProductVariantSelectModalArgs {
  mockup: any
  printAreas: any[]
  variantsChanging: any[]
  productId: string
}

/**
 * Hook for managing product variant selection modal in unified editor
 */
export function useVariantSelectionModal() {
  const { openModal, closeModal } = useModal()
  const { t } = useTranslation()
  const variants = useStore(IntegrationStore, state => state.variants)
  const allVariantsIntegrated = useStore(IntegrationStore, state => state.allVariantsIntegrated)
  const groupAllProductVariants = useGroupProductBase(allVariantsIntegrated)
  const groupProductBase = useGroupProductBase()
  const { mockupId } = useEditorParams()

  // Find current variant based on mockupId
  const currentVariant = variants.find(v => v.mockup._id === mockupId)

  const openVariantSelector = useCallback(() => {
    if (!currentVariant) return

    const modalData: IProductVariantSelectModalArgs = {
      mockup: currentVariant.mockup,
      printAreas: currentVariant.printAreas || EMPTY_ARRAY,
      variantsChanging: groupAllProductVariants[currentVariant.mockup._id] || EMPTY_ARRAY,
      productId: currentVariant.product?.id || '',
    }

    openModal(MODAL_ID.PRODUCT_VARIANT_SELECTOR_MODAL, modalData)
  }, [currentVariant, groupAllProductVariants, openModal])

  const closeVariantSelector = useCallback(() => {
    closeModal(MODAL_ID.PRODUCT_VARIANT_SELECTOR_MODAL)
  }, [closeModal])

  const handleVariantSelection = useCallback(
    async (selectedVariants: IVariant[], closeAfterUpdate: boolean = true) => {
      if (!currentVariant) return

      try {
        const { mockup, printAreas } = currentVariant
        const currentVariants = groupProductBase[mockup._id] || []

        // Check if variants are actually changed
        const isSelectedVariantsEveryBeIncludedInCurrentVariants = selectedVariants.every(variant =>
          currentVariants.map(_variant => _variant.id).includes(variant.id)
        )
        const isSameLength = selectedVariants.length === currentVariants.length

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
            newProductVariants: selectedVariants,
          },
        })

        if (closeAfterUpdate) {
          closeVariantSelector()
        }
        showToast(t(TOAST.INTEGRATED_EDITOR.VARIANTS_UPDATED))
      } catch (error) {
        console.error('Error updating product variants:', error)
      }
    },
    [currentVariant, groupProductBase, closeVariantSelector, t]
  )

  return {
    openVariantSelector,
    closeVariantSelector,
    handleVariantSelection,
    groupProductBase,
    groupAllProductVariants,
    currentVariant,
  }
}
