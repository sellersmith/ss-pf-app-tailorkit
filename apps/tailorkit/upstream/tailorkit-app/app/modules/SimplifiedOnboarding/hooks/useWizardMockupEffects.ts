/**
 * Auto-advance effects for the mockup step.
 * Separated from useWizardMockup to keep both files under 200 lines.
 *
 * Effect 1: auto-advance to templates (or bulk-switch tab) when processing completes.
 * Effect 2: bulk chain — auto-trigger processing after tab switch if product has shapes.
 */

import { useEffect } from 'react'
import type { MockupWizardStepRef } from '../steps/MockupWizardStep'
import type { WizardAction, WizardState } from '../types'

interface UseWizardMockupEffectsOptions {
  state: WizardState
  dispatch: React.Dispatch<WizardAction>
  shapeCount: number
  isProcessingMockup: boolean
  setIsProcessingMockup: (v: boolean) => void
  isBulkMode: boolean
  goToStep: (step: WizardState['currentStep']) => void
  findNextUnprocessedProduct: () => number
  hasAdvancedToTemplatesRef: React.MutableRefObject<boolean>
  skipNextInvalidationRef: React.MutableRefObject<boolean>
  bulkChainRef: React.MutableRefObject<boolean>
  positionGenRef: React.MutableRefObject<number>
  mockupStepRef: React.RefObject<MockupWizardStepRef>
  /** Per-product stored shapes (ref) — used to verify the target product actually has shapes
   *  before triggering bulk chain processing (avoids stale shapeCount from previous product). */
  perProductShapesRef: React.MutableRefObject<Record<string, unknown[]>>
}

export function useWizardMockupEffects({
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
}: UseWizardMockupEffectsOptions): void {
  // Auto-advance after processing; isProcessingMockup guard prevents re-trigger on Back nav
  useEffect(() => {
    if (state.currentStep === 'mockup' && state.mockupResult && isProcessingMockup) {
      setIsProcessingMockup(false)
      if (isBulkMode) {
        const nextIdx = findNextUnprocessedProduct()
        if (nextIdx >= 0) {
          skipNextInvalidationRef.current = true
          bulkChainRef.current = true
          positionGenRef.current += 1
          dispatch({ type: 'SET_ACTIVE_PRODUCT_INDEX', index: nextIdx })
          return
        }
      }
      hasAdvancedToTemplatesRef.current = true
      goToStep('templates')
    }
  }, [
    state.currentStep,
    state.mockupResult,
    isProcessingMockup,
    isBulkMode,
    goToStep,
    findNextUnprocessedProduct,
    dispatch,
    setIsProcessingMockup,
    skipNextInvalidationRef,
    bulkChainRef,
    positionGenRef,
    hasAdvancedToTemplatesRef,
  ])

  // Bulk chain: auto-trigger processing after tab switch if new product has shapes.
  // IMPORTANT: Use perProductShapesRef (not shapeCount) to verify the TARGET product
  // actually has shapes. shapeCount may still reflect the PREVIOUS product's value
  // because the new MockupWizardStep hasn't mounted and reported its count yet.
  useEffect(() => {
    if (!bulkChainRef.current) return
    if (state.currentStep !== 'mockup' || state.mockupResult || isProcessingMockup) return

    // Check stored shapes for the active product (ref, not stale state)
    const activeProductId = state.selectedProduct?.id
    const storedShapes = activeProductId ? perProductShapesRef.current[activeProductId] : undefined
    const hasStoredShapes = storedShapes && storedShapes.length > 0

    if (!hasStoredShapes) {
      // No shapes for this product — stop chain, user needs to draw manually
      bulkChainRef.current = false
      return
    }
    bulkChainRef.current = false
    setIsProcessingMockup(true)
    requestAnimationFrame(() => {
      const triggered = mockupStepRef.current?.triggerProcess()
      if (!triggered) setIsProcessingMockup(false)
    })
  }, [
    state.currentStep,
    state.selectedProduct?.id,
    state.mockupResult,
    isProcessingMockup,
    bulkChainRef,
    mockupStepRef,
    setIsProcessingMockup,
    perProductShapesRef,
  ])
}
