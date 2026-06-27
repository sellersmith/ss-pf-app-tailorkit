import { ShineOnProductsSelector } from '~/modules/modals/ShineOnProductsSelector'
import { convertShineOnProductToCommonType } from './utilities/convert-shineon-to-common-type'
import { sendTemporaryDataToImport } from './utilities/sendTemporaryDataToImportProduct'
import { useNavigate } from '@remix-run/react'
import { showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import { useTranslation } from 'react-i18next'

export const ShineOnProductSelectorModal = (props: {
  active: boolean
  providerId: string
  selectedProductIds?: string[]
  handleSelect?: (items: any[]) => Promise<void>
  onClose: () => void
}) => {
  const { active, providerId, onClose, selectedProductIds, handleSelect: handleSelectProp } = props
  const { t } = useTranslation()
  const navigate = useNavigate()

  const handleSelect = async (items: any[]) => {
    try {
      if (handleSelectProp && typeof handleSelectProp === 'function') {
        await handleSelectProp(items)
      } else {
        const temporaryData = convertShineOnProductToCommonType(items)
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
    <ShineOnProductsSelector
      active={active}
      onSelect={handleSelect}
      providerId={providerId}
      selectedProductIds={selectedProductIds}
      onClose={onClose}
    />
  )
}
