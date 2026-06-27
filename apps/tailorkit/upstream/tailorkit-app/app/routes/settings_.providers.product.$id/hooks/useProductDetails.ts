import { useState, useCallback } from 'react'
import uniq from 'lodash/uniq'
import { useProductProviderState } from './useProductProviderState'
import { ProductProviderStore } from '../stores/productProviderStore'
import { showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import type { TemporaryProduct } from '~/models/TemporaryFulfillmentProducts'
import { useNavigate, useSearchParams } from '@remix-run/react'
import { useProductProvider } from './useProductProvider'
import { ERROR_TYPES } from '../constants'
import { useTranslation } from 'react-i18next'
import { useGatherUserFeedbackForm } from '~/modules/Feedback/hooks/useGatherUserFeedbackForm'
import { FEEDBACK_TYPE } from '~/modules/Feedback/constants'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import type { ProviderCapabilities } from '~/services/fulfillment/types'

interface UseProductDetailsProps {
  providerId: string
  providerName?: string
  capabilities?: ProviderCapabilities
  initialState: TemporaryProduct
  handleSetCachedProductDetailsData: (data: TemporaryProduct) => void
}

export const useProductDetails = ({
  providerId,
  providerName,
  capabilities,
  initialState,
  handleSetCachedProductDetailsData,
}: UseProductDetailsProps) => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation()
  const { handleSaveProductToDataBase, handleSaveShineOnMapping } = useProductProvider()
  const { handleAfterSaveProviderProduct } = useGatherUserFeedbackForm({
    feedbackType: FEEDBACK_TYPE.PRODUCT_CATALOG_SUPPLIER_SELECTION,
  })

  // Only providers with print provider selection require productProviderId
  const requireProviderId = capabilities?.hasPrintProviderSelection ?? !providerName

  // Use 2-state pattern hook for accurate comparison
  const { currentProductData, isChanged, disabledSave } = useProductProviderState(initialState, { requireProviderId })

  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [bannerDismissed, setBannerDismissed] = useState(true)

  const scrollToTop = useCallback(() => {
    window.scroll({ top: 0, behavior: 'smooth' })
  }, [])

  // Re-validate the page while keeping query params (providerId)
  const onRevalidate = useCallback(() => {
    navigate(`.?${searchParams.toString()}`, { replace: true })
  }, [navigate, searchParams])

  const handleError = useCallback(
    (error: string | string[], scroll = true) => {
      setBannerDismissed(false)
      scroll && scrollToTop()
      setErrors(prev => (error instanceof Array ? uniq(error) : uniq([...prev, error])))
    },
    [scrollToTop]
  )

  const { trackEvent } = useEventsTracking()

  const handleSave = useCallback(async () => {
    trackEvent(EVENTS_TRACKING.EDITED_PROVIDER_PRODUCT_DETAIL, {
      [EVENTS_PARAMETERS_NAME.NUM_VARIANTS]: currentProductData.variants.length,
    })

    if (currentProductData.variants.length > 100) {
      handleError(ERROR_TYPES.EXCEED_VARIANTS)
      return
    }

    handleError([], false)
    setSaving(true)
    showToast(t(TOAST.PROVIDER.SAVING_PRODUCTS))

    try {
      // Merge current working data with full initial state
      const updatedData = {
        ...initialState,
        ...currentProductData,
        providerId,
      }

      const res = await handleSaveProductToDataBase(updatedData)

      // Save ShineOn mapping if present in store state
      const storeState = ProductProviderStore.getState()
      if ('shineOnMapping' in storeState && storeState.shineOnMapping) {
        await handleSaveShineOnMapping({
          productId: updatedData.productId,
          providerId,
          shineOnMapping: storeState.shineOnMapping as Record<string, unknown>,
        })
      }

      if (res?.success) {
        // Update cached data (this becomes new baseline)
        handleSetCachedProductDetailsData(updatedData)
        showToast(t(TOAST.PROVIDER.PRODUCTS_SAVED))
        scrollToTop()
        onRevalidate()
        handleAfterSaveProviderProduct()
      } else {
        showToast(t(TOAST.PROVIDER.SAVE_PRODUCTS_FAILED))
      }
    } finally {
      setSaving(false)
    }
  }, [
    trackEvent,
    currentProductData,
    handleError,
    t,
    initialState,
    providerId,
    handleSaveProductToDataBase,
    handleSaveShineOnMapping,
    handleSetCachedProductDetailsData,
    scrollToTop,
    onRevalidate,
    handleAfterSaveProviderProduct,
  ])

  const handleDiscard = useCallback(() => {
    // Reset store to saved baseline
    ProductProviderStore.dispatch({
      type: 'INIT_DATA',
      payload: { state: initialState },
    })
    onRevalidate()
  }, [initialState, onRevalidate])

  return {
    saving,
    errors,
    bannerDismissed,
    disabledSave,
    isChanged,
    setBannerDismissed,
    handleSave,
    handleDiscard,
  }
}
