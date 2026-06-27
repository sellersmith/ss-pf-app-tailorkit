/**
 * Product and image selection handlers for the wizard.
 * Handles single/bulk product selection, image fetching, image selection,
 * and bulk product tab switching.
 */

import { useCallback, useState } from 'react'
import { authenticatedFetch } from '~/shopify/fns.client'
import { SIMPLIFIED_ONBOARDING_EVENTS } from '../tracking-events'
import type { MockupWizardStepRefLike, WizardAction, WizardProduct, WizardState } from '../types'

interface UseWizardProductOptions {
  state: WizardState
  dispatch: React.Dispatch<WizardAction>
  trackEvent: (event: string, data?: Record<string, unknown>) => void
  skipNextInvalidationRef: React.MutableRefObject<boolean>
  positionGenRef: React.MutableRefObject<number>
  mockupStepRef: React.RefObject<MockupWizardStepRefLike>
  compositeImageUrlsRef: React.MutableRefObject<Record<string, string>>
}

export interface WizardProductReturn {
  isLoadingImages: boolean
  handleProductSelect: (product: WizardProduct) => void
  handleProductsSelect: (products: WizardProduct[]) => void
  handleImageSelect: (index: number) => void
  handleProductTabChange: (index: number) => void
}

export function useWizardProduct({
  state,
  dispatch,
  trackEvent,
  skipNextInvalidationRef,
  positionGenRef,
  mockupStepRef,
  compositeImageUrlsRef,
}: UseWizardProductOptions): WizardProductReturn {
  const { selectedProduct } = state
  const [isLoadingImages, setIsLoadingImages] = useState(false)

  const handleProductSelect = useCallback(
    (product: WizardProduct) => {
      dispatch({ type: 'SET_PRODUCT', product })
      trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.PRODUCT_SELECTED, {
        productId: product.id,
        hasImages: product.images.length > 0,
        imageCount: product.images.length,
      })

      // The product list API only returns featuredImage (1 image).
      // Fetch the full media from Shopify so multi-image products show all images in step 2.
      if (product.id) {
        setIsLoadingImages(true)
        const numericId = product.id.replace('gid://shopify/Product/', '')
        authenticatedFetch(`/api/shopify?action=getProductImages&productId=${numericId}`)
          .then((res: any) => {
            const images = res?.images
            if (Array.isArray(images) && images.length > 0) {
              dispatch({
                type: 'SET_PRODUCT',
                product: {
                  ...product,
                  images: images.map((img: any) => ({
                    id: img.id || '',
                    url: img.url as string,
                    altText: img.altText as string | undefined,
                  })),
                },
              })
            }
          })
          .catch(() => {
            /* Non-fatal — proceed with featuredImage */
          })
          .finally(() => setIsLoadingImages(false))
      }
    },
    [dispatch, trackEvent]
  )

  // Bulk mode: select multiple products.
  // Also fetch full product images for each (the product list API only returns featuredImage).
  const handleProductsSelect = useCallback(
    (products: WizardProduct[]) => {
      dispatch({ type: 'SET_PRODUCTS', products })
      trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.PRODUCT_SELECTED, {
        bulkMode: true,
        productCount: products.length,
      })
      for (const p of products) {
        if (p.id && p.images.length <= 1) {
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
    },
    [dispatch, trackEvent]
  )

  const handleImageSelect = useCallback(
    (index: number) => {
      if (!selectedProduct || !selectedProduct.images[index]) return
      dispatch({
        type: 'SET_IMAGE',
        imageUrl: selectedProduct.images[index].url,
        imageIndex: index,
      })
      trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.IMAGE_SELECTED, {
        imageIndex: index,
        autoAdvanced: selectedProduct.images.length === 1,
      })
    },
    [selectedProduct, dispatch, trackEvent]
  )

  // Bulk mode: switch active product tab (saves current state, loads target).
  // Guards the next onShapeCountChange from triggering invalidation (it's from mount).
  const handleProductTabChange = useCallback(
    (index: number) => {
      if (index === state.activeProductIndex) return
      // Capture composite of the current product before switching (step 4 only).
      // The canvas unmounts on tab switch, so this is the last chance to capture.
      if (state.currentStep === 'templates') {
        const dataUrl = mockupStepRef.current?.getCompositeDataUrl()
        const pid = state.selectedProduct?.id
        if (dataUrl && pid) compositeImageUrlsRef.current[pid] = dataUrl
      }
      skipNextInvalidationRef.current = true
      positionGenRef.current += 1
      dispatch({ type: 'SET_ACTIVE_PRODUCT_INDEX', index })
      // Auto-select default template if the target product has no selection on templates step.
      if (state.currentStep === 'templates') {
        const targetProduct = state.selectedProducts[index]
        if (targetProduct) {
          const pps = state.perProductState[targetProduct.id]
          if (pps && !pps.selectedTemplateType && !pps.selectedExistingTemplate) {
            dispatch({ type: 'SELECT_TEMPLATE', templateType: 'plain-custom-text' })
          }
        }
      }
      trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.BULK_TAB_SWITCH, {
        step: state.currentStep,
        fromIndex: state.activeProductIndex,
        toIndex: index,
      })
    },
    [
      state.activeProductIndex,
      state.currentStep,
      state.selectedProducts,
      state.perProductState,
      dispatch,
      trackEvent,
      skipNextInvalidationRef,
      positionGenRef,
      mockupStepRef,
      compositeImageUrlsRef,
      state.selectedProduct?.id,
    ]
  )

  return {
    isLoadingImages,
    handleProductSelect,
    handleProductsSelect,
    handleImageSelect,
    handleProductTabChange,
  }
}
