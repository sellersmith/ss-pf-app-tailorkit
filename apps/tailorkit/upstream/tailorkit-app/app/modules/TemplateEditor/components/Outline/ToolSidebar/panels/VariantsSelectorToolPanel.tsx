import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'
import ProductNVariantSelector from '~/modules/modals/ProductNVariantSelector'
import { EMPTY_ARRAY } from '~/constants'
import { useVariantSelectionModal } from '~/modules/ProductEditor/hooks'
import { useModal } from '~/utils/hooks/useModal'
import { MODAL_ID } from '~/constants/modal'

interface IVariantsSelectorToolPanelProps {}

/**
 * Text Tool Panel - Add text elements to the template
 */
export default function VariantsSelectorToolPanel(props: IVariantsSelectorToolPanelProps) {
  const { state } = useModal()
  const { closeVariantSelector, handleVariantSelection, groupProductBase, groupAllProductVariants }
    = useVariantSelectionModal()
  const { t } = useTranslation()

  const modalData = state?.[MODAL_ID.PRODUCT_VARIANT_SELECTOR_MODAL]?.data

  const handleClose = (variants?: any[]) => {
    closeVariantSelector()
    if (variants) {
      handleVariantSelection(variants)
    }
  }

  const currentVariants = useMemo(
    () => (modalData?.mockup?._id ? groupProductBase[modalData.mockup._id] || EMPTY_ARRAY : EMPTY_ARRAY),
    [modalData?.mockup?._id, groupProductBase]
  )

  if (!modalData) return null

  return (
    <ProductNVariantSelector
      active={true}
      title={t('select-products')}
      onClose={handleClose}
      onSelect={handleVariantSelection}
      showVariants={true}
      groupProductBase={groupProductBase}
      groupAllProductVariants={groupAllProductVariants}
      conditionToShow={{
        mockupId: modalData.mockup?._id,
        productId: modalData.productId,
      }}
      displayAs="panel"
      allowMultiple={true}
      currentVariants={currentVariants}
      queryString=""
    />
  )
}
