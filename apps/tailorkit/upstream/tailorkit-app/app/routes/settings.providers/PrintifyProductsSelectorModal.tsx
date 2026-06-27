import { PrintifyProductsSelector } from '~/modules/modals/PrintifyProductsSelector'
import { convertPrintifyProductToCommonType } from './utilities/covertToCommonType'
import { sendTemporaryDataToImport } from './utilities/sendTemporaryDataToImportProduct'
import { useNavigate } from '@remix-run/react'
import { showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import { useTranslation } from 'react-i18next'

export const PrintifyProductSelectorModal = (props: {
  active: boolean
  providerId: string
  selectedProductIds?: string[]
  handleSelect?: (items: any[]) => Promise<void>
  onClose: () => void
}) => {
  const { active, providerId, onClose, selectedProductIds, handleSelect: handleSelectProp } = props
  const { t } = useTranslation()
  const navigate = useNavigate()

  const handelSelect = async (items: any[]) => {
    try {
      if (handleSelectProp && typeof handleSelectProp === 'function') {
        await handleSelectProp(
          items.map(item => ({
            ...item,
            description: item.description.replaceAll('.:', ''),
            productId: item.id.toString(),
          }))
        )
      } else {
        const temporaryData = convertPrintifyProductToCommonType(items)
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
    <PrintifyProductsSelector
      active={active}
      onSelect={handelSelect}
      providerId={providerId}
      selectedProductIds={selectedProductIds}
      onClose={onClose}
    />
  )
}
