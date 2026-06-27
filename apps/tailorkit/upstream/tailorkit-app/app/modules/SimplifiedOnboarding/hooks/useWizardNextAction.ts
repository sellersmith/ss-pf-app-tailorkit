/**
 * "Next" button action handler for the wizard.
 * Encapsulates per-step logic: product advance (bulk/single), image skip,
 * template propagation in bulk mode, composite capture, and preview trigger.
 */

import { useCallback } from 'react'
import { useNavigate } from '@remix-run/react'
import { authenticatedFetch } from '~/shopify/fns.client'
import { useRootLoaderData } from '~/root'
import { isApprovedCharge } from '~/models/PricingPlan.fns'
import type { ShopDocument } from '~/models/Shop'
import type { RootLoaderData } from '~/types/loaders'
import { SIMPLIFIED_ONBOARDING_EVENTS } from '../tracking-events'
import type { WizardAction, WizardState, WizardStep } from '../types'

interface UseWizardNextActionOptions {
  state: WizardState
  dispatch: React.Dispatch<WizardAction>
  trackEvent: (event: string, data?: Record<string, unknown>) => void
  isLoadingImages: boolean
  goToStep: (step: WizardStep) => void
  handleSeeItWorks: () => void
  mockupStepRef: React.RefObject<{ getCompositeDataUrl: () => string | null }>
  compositeImageUrlRef: React.MutableRefObject<string | null>
  compositeImageUrlsRef: React.MutableRefObject<Record<string, string>>
}

export function useWizardNextAction({
  state,
  dispatch,
  trackEvent,
  isLoadingImages,
  goToStep,
  handleSeeItWorks,
  mockupStepRef,
  compositeImageUrlRef,
  compositeImageUrlsRef,
}: UseWizardNextActionOptions): () => void {
  const isBulkMode = state.selectedProducts.length > 1

  // Step 1 (product) gate — mirrors the Full Editor UX where unsubscribed
  // merchants are redirected to /pricing right after picking a product on
  // their 2nd+ build. Same condition is also enforced at publish time +
  // server-side in /api/onboarding/publish-product.
  const rootData = useRootLoaderData()
  const navigate = useNavigate()
  const shopData = (rootData as RootLoaderData | undefined)?.shopData as ShopDocument | null | undefined
  const needsSubscriptionForPublish = shopData
    ? !isApprovedCharge(shopData) && (shopData.usages?.totalPublishedIntegrations || 0) >= 1
    : false

  return useCallback(() => {
    switch (state.currentStep) {
      case 'product': {
        // Surface paywall before the merchant invests time in image / mockup steps.
        if (needsSubscriptionForPublish) {
          navigate('/pricing')
          return
        }
        const product = state.selectedProduct
        if (isBulkMode) {
          if (product && product.images.length > 0) {
            dispatch({ type: 'SET_IMAGE', imageUrl: product.images[0].url, imageIndex: 0 })
          }
          // Fire-and-forget: fetch full images for all products in parallel
          for (const p of state.selectedProducts) {
            if (p.images.length <= 1 && p.id) {
              const numId = p.id.replace('gid://shopify/Product/', '')
              authenticatedFetch(`/api/shopify?action=getProductImages&productId=${numId}`)
                .then((res: any) => {
                  const images = res?.images
                  if (Array.isArray(images) && images.length > 0) {
                    dispatch({
                      type: 'UPDATE_PRODUCT_IMAGES',
                      productId: p.id,
                      images: images.map((img: any) => ({
                        id: img.id || '',
                        url: img.url as string,
                        altText: img.altText as string | undefined,
                      })),
                    })
                  }
                })
                .catch(() => {})
            }
          }
          // Pre-select first image for all products so tabs show as complete
          for (const p of state.selectedProducts) {
            if (p.images.length > 0) {
              dispatch({
                type: 'UPDATE_PRODUCT_STATE',
                productId: p.id,
                state: { selectedImageUrl: p.images[0].url, selectedImageIndex: 0 },
              })
            }
          }
          goToStep('image')
          break
        }
        // Single product: skip image step if product has only one image
        if (!isLoadingImages && product && product.images.length === 1) {
          dispatch({ type: 'SET_IMAGE', imageUrl: product.images[0].url, imageIndex: 0 })
          trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.IMAGE_SELECTED, { imageIndex: 0, autoAdvanced: true })
          goToStep('mockup')
        } else {
          if (product && product.images.length > 0) {
            dispatch({ type: 'SET_IMAGE', imageUrl: product.images[0].url, imageIndex: 0 })
          }
          goToStep('image')
        }
        break
      }
      case 'image':
        goToStep('mockup')
        break
      case 'templates': {
        // In bulk mode, propagate the active product's template selection to all
        // products that don't have one yet.
        if (isBulkMode) {
          const activeType = state.selectedTemplateType
          const activeExisting = state.selectedExistingTemplate
          for (const p of state.selectedProducts) {
            const pps = state.perProductState[p.id]
            if (pps && !pps.selectedTemplateType && !pps.selectedExistingTemplate) {
              dispatch({
                type: 'UPDATE_PRODUCT_STATE',
                productId: p.id,
                state: activeExisting
                  ? { selectedExistingTemplate: activeExisting }
                  : { selectedTemplateType: activeType },
              })
            }
          }
        }
        // Capture composite canvas as data URL before leaving step 4.
        const dataUrl = mockupStepRef.current?.getCompositeDataUrl()
        if (dataUrl) {
          compositeImageUrlRef.current = dataUrl
          const pid = state.selectedProduct?.id
          if (pid) compositeImageUrlsRef.current[pid] = dataUrl
        }
        goToStep('preview')
        break
      }
      case 'preview':
        handleSeeItWorks()
        break
      default:
        break
    }
  }, [
    state.currentStep,
    state.selectedProduct,
    state.selectedProducts,
    state.perProductState,
    state.selectedTemplateType,
    state.selectedExistingTemplate,
    isLoadingImages,
    isBulkMode,
    goToStep,
    handleSeeItWorks,
    trackEvent,
    dispatch,
    mockupStepRef,
    compositeImageUrlRef,
    compositeImageUrlsRef,
    needsSubscriptionForPublish,
    navigate,
  ])
}
