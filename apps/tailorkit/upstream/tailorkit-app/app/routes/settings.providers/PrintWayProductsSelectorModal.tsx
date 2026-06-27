import { useNavigate } from '@remix-run/react'
import { useTranslation } from 'react-i18next'
import { PrintWayProductsSelector } from '~/modules/modals/PrintWayProductsSelector'
import { TOAST } from '~/constants/toasts'
import { showToast } from '~/utils/toastEvents'
import type { NormalizedProduct } from '~/services/fulfillment/types'
import { convertPrintWayProductToCommonType } from './utilities/convert-printway-to-common-type'
import { sendTemporaryDataToImport } from './utilities/sendTemporaryDataToImportProduct'

export const PrintWayProductSelectorModal = (props: {
  active: boolean
  providerId: string
  selectedProductIds?: string[]
  handleSelect?: (items: NormalizedProduct[]) => Promise<void>
  onClose: () => void
}) => {
  const { active, providerId, onClose, selectedProductIds, handleSelect: handleSelectProp } = props
  const { t } = useTranslation()
  const navigate = useNavigate()

  const handleSelect = async (items: NormalizedProduct[]) => {
    try {
      const temporaryData = convertPrintWayProductToCommonType(items)
      if (handleSelectProp && typeof handleSelectProp === 'function') {
        // Convert NormalizedProduct (externalId) to TProductToImport (productId) before passing upstream
        await handleSelectProp(temporaryData.products as any)
      } else {
        const res = await sendTemporaryDataToImport({ providerId, temporaryData })
        if (res?.success) {
          const { showUnderstandAboutProviderModal } = res || {}
          navigate(
            `/settings/providers/integration/${providerId}?showUnderstandAboutProviderModal=${showUnderstandAboutProviderModal}&autoSelect=true`
          )
          return
        }
        showToast(t(TOAST.PROVIDER.PRODUCT_IMPORT_FAILED), { isError: true })
      }
    } catch (error) {
      console.error(error)
      showToast(t(TOAST.PROVIDER.PRODUCT_IMPORT_FAILED), { isError: true })
    }
  }

  return (
    <PrintWayProductsSelector
      active={active}
      onSelect={handleSelect}
      providerId={providerId}
      selectedProductIds={selectedProductIds}
      onClose={onClose}
    />
  )
}
