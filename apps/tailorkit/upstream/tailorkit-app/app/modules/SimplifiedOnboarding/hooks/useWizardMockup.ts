/**
 * Mockup step handlers for the wizard.
 * Manages shape selections, per-product shape persistence, bulk processing chain,
 * and the "Make It Realistic" trigger logic.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { SIMPLIFIED_ONBOARDING_EVENTS } from '../tracking-events'
import { useWizardMockupEffects } from './useWizardMockupEffects'
import type { MockupWizardStepRef } from '../steps/MockupWizardStep'
import type { ShapeSelection, TemplatePosition } from '~/modules/MockupWizard/types'
import type { WizardAction, WizardMockupResult, WizardState } from '../types'

interface UseWizardMockupOptions {
  state: WizardState
  dispatch: React.Dispatch<WizardAction>
  trackEvent: (event: string, data?: Record<string, unknown>) => void
  goToStep: (step: WizardState['currentStep']) => void
  mockupStepRef: React.RefObject<MockupWizardStepRef>
  positionGenRef: React.MutableRefObject<number>
  skipNextInvalidationRef: React.MutableRefObject<boolean>
  bulkChainRef: React.MutableRefObject<boolean>
}

export interface WizardMockupReturn {
  shapeCount: number
  isProcessingMockup: boolean
  currentProductShapes: ShapeSelection[] | undefined
  hasAdvancedToTemplatesRef: React.MutableRefObject<boolean>
  handleShapeCountChange: (count: number) => void
  handleShapeSelectionsChange: (shapes: ShapeSelection[]) => void
  handleTemplatePositionsChange: (positions: TemplatePosition[]) => void
  handleMockupApply: (result: WizardMockupResult) => void
  handleMockupError: () => void
  handleMakeItRealistic: () => void
  allProductsComplete: (step: 'image' | 'mockup' | 'templates') => boolean
}

export function useWizardMockup({
  state,
  dispatch,
  trackEvent,
  goToStep,
  mockupStepRef,
  positionGenRef,
  skipNextInvalidationRef,
  bulkChainRef,
}: UseWizardMockupOptions): WizardMockupReturn {
  const isBulkMode = state.selectedProducts.length > 1

  // Per-product shapes (ref, not state — doesn't drive parent rendering)
  const perProductShapesRef = useRef<Record<string, ShapeSelection[]>>({})

  const [shapeCount, setShapeCount] = useState(0)
  const [isProcessingMockup, setIsProcessingMockup] = useState(false)

  // Guard: prevent double-advance from stale closures
  const hasAdvancedToTemplatesRef = useRef(false)

  // Shape count drives "Make It Realistic" enabled state; count change invalidates mockupResult
  const handleShapeCountChange = useCallback(
    (count: number) => {
      setShapeCount(prev => {
        if (skipNextInvalidationRef.current) {
          skipNextInvalidationRef.current = false
          return count
        }
        if (prev !== count && state.currentStep === 'mockup' && state.mockupResult) {
          dispatch({ type: 'SET_MOCKUP_RESULT', result: null })
        }
        return count
      })
    },
    [state.currentStep, state.mockupResult, dispatch, skipNextInvalidationRef]
  )

  const handleShapeSelectionsChange = useCallback(
    (shapes: ShapeSelection[]) => {
      const productId = state.selectedProduct?.id
      if (productId) {
        perProductShapesRef.current[productId] = shapes
      }
    },
    [state.selectedProduct?.id]
  )

  const currentProductShapes = useMemo(() => {
    const productId = state.selectedProduct?.id
    if (!productId) return undefined
    const stored = perProductShapesRef.current[productId]
    return stored && stored.length > 0 ? stored : undefined
  }, [state.selectedProduct?.id])

  // Product-scoped: positions target the captured productId, safe against tab-switch races
  const activeProductId = state.selectedProduct?.id
  const handleTemplatePositionsChange = useCallback(
    (positions: TemplatePosition[]) => {
      if (state.mockupResult && positions.length > 0 && activeProductId) {
        const scale = state.mockupResult.processedDimensions.scale ?? 1
        const productPositions: TemplatePosition[] = positions.map(p => ({
          x: p.x / scale,
          y: p.y / scale,
          width: p.width / scale,
          height: p.height / scale,
          rotation: p.rotation,
        }))
        dispatch({
          type: 'SET_TEMPLATE_POSITIONS',
          productId: activeProductId,
          positions,
          productPositions,
        })
      }
    },
    [state.mockupResult, dispatch, activeProductId]
  )

  const handleMockupApply = useCallback(
    (result: WizardMockupResult) => {
      dispatch({ type: 'SET_MOCKUP_RESULT', result })
      trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.MOCKUP_APPLIED, {
        positionCount: result.templatePositions.length,
      })
    },
    [dispatch, trackEvent]
  )

  const handleMockupError = useCallback(() => setIsProcessingMockup(false), [])

  const allProductsComplete = useCallback(
    (step: 'image' | 'mockup' | 'templates') => {
      if (!isBulkMode) return true
      return state.selectedProducts.every(p => {
        const pps = state.perProductState[p.id]
        if (!pps) return false
        switch (step) {
          case 'image':
            return !!pps.selectedImageUrl
          case 'mockup':
            return !!pps.mockupResult
          case 'templates':
            return !!(pps.selectedTemplateType || pps.selectedExistingTemplate)
          default:
            return false
        }
      })
    },
    [isBulkMode, state.selectedProducts, state.perProductState]
  )

  const findNextUnprocessedProduct = useCallback(() => {
    if (!isBulkMode) return -1
    for (let i = 0; i < state.selectedProducts.length; i++) {
      if (i === state.activeProductIndex) continue
      const pps = state.perProductState[state.selectedProducts[i].id]
      if (!pps?.mockupResult) return i
    }
    return -1
  }, [isBulkMode, state.selectedProducts, state.activeProductIndex, state.perProductState])

  const handleMakeItRealistic = useCallback(() => {
    if (hasAdvancedToTemplatesRef.current) return
    if (state.mockupResult) {
      if (isBulkMode) {
        const nextIdx = findNextUnprocessedProduct()
        if (nextIdx >= 0) {
          positionGenRef.current += 1
          dispatch({ type: 'SET_ACTIVE_PRODUCT_INDEX', index: nextIdx })
          return
        }
      }
      hasAdvancedToTemplatesRef.current = true
      goToStep('templates')
      return
    }
    if (isProcessingMockup) return

    // Zero-shape path: skip pixel-erasure pipeline — synthesize result from product image dimensions
    if (shapeCount === 0) {
      const imageUrl = state.selectedImageUrl
      if (!imageUrl) return
      setIsProcessingMockup(true)
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const w = img.naturalWidth
        const h = img.naturalHeight
        const fullBounds: TemplatePosition = { x: 0, y: 0, width: w, height: h }
        dispatch({
          type: 'SET_MOCKUP_RESULT',
          result: {
            processedImageUrl: null,
            noMask: true,
            templatePositions: [fullBounds],
            processedDimensions: { width: w, height: h, scale: 1 },
            positionsAreComputed: false,
            transparentAreas: [],
            productPositions: [fullBounds],
          },
        })
      }
      img.onerror = () => {
        setIsProcessingMockup(false)
        console.error('[SimplifiedOnboarding] Failed to load product image for synthetic mockup result')
      }
      img.src = imageUrl
      return
    }

    // Normal path: pixel erasure pipeline
    setIsProcessingMockup(true)
    const triggered = mockupStepRef.current?.triggerProcess()
    if (!triggered) setIsProcessingMockup(false)
  }, [
    state.mockupResult,
    state.selectedImageUrl,
    isProcessingMockup,
    shapeCount,
    isBulkMode,
    goToStep,
    findNextUnprocessedProduct,
    dispatch,
    positionGenRef,
    mockupStepRef,
  ])

  useWizardMockupEffects({
    state,
    dispatch,
    shapeCount,
    isProcessingMockup,
    setIsProcessingMockup,
    isBulkMode,
    goToStep,
    findNextUnprocessedProduct,
    hasAdvancedToTemplatesRef,
    skipNextInvalidationRef,
    bulkChainRef,
    positionGenRef,
    mockupStepRef,
    perProductShapesRef,
  })

  return {
    shapeCount,
    isProcessingMockup,
    currentProductShapes,
    hasAdvancedToTemplatesRef,
    handleShapeCountChange,
    handleShapeSelectionsChange,
    handleTemplatePositionsChange,
    handleMockupApply,
    handleMockupError,
    handleMakeItRealistic,
    allProductsComplete,
  }
}
