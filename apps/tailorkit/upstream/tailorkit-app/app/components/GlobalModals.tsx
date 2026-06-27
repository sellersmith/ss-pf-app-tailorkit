import { memo, useEffect } from 'react'
import ModalAskWhyOnlySaveNotPublish from '~/modules/ProductEditor/components/UnifiedHeader/ModalAskWhyOnlySaveNotPublish'
import { BuyAiCreditsModal } from '~/modules/modals/BuyAiCreditsModal'

/**
 * GlobalModals - Renders global modals that need to be available across the entire app
 * This component ensures modals are only rendered once at the root level
 */
function GlobalModals() {
  useEffect(() => {
    console.log('[GlobalModals] Component mounted - modal is now available globally')
  }, [])

  return (
    <>
      <ModalAskWhyOnlySaveNotPublish />
      <BuyAiCreditsModal />
    </>
  )
}

export default memo(GlobalModals)
