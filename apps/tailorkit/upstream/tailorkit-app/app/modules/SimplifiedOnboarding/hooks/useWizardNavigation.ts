/** Navigation: step transitions, back/close/skip + button/title computation.
 *  Per-step "Next" logic → useWizardNextAction
 *  Button labels/actions/title → useWizardButtonActions */

import { useCallback, useRef } from 'react'
import { STEP_NUMBERS, WIZARD_STEPS } from '../constants'
import { SIMPLIFIED_ONBOARDING_EVENTS } from '../tracking-events'
import { useWizardButtonActions } from './useWizardButtonActions'
import type { WizardAction, WizardState, WizardStep } from '../types'

interface UseWizardNavigationOptions {
  state: WizardState
  dispatch: React.Dispatch<WizardAction>
  trackEvent: (event: string, data?: Record<string, unknown>) => void
  stepStartTimeRef: React.MutableRefObject<number>
  wizardStartTimeRef: React.MutableRefObject<number>
  isLoadingImages: boolean
  shapeCount: number
  isProcessingMockup: boolean
  publishAction: string | null
  handleSeeItWorks: () => void
  handleViewInEditor: () => void
  handleMakeItRealistic: () => void
  hasAdvancedToTemplatesRef: React.MutableRefObject<boolean>
  fireWizardCompleted: (action: string) => void
  onSkip: () => void
  positionGenRef: React.MutableRefObject<number>
  mockupStepRef: React.RefObject<{ getCompositeDataUrl: () => string | null }>
  compositeImageUrlRef: React.MutableRefObject<string | null>
  compositeImageUrlsRef: React.MutableRefObject<Record<string, string>>
  isMobileView: boolean
  allProductsComplete: (step: 'image' | 'mockup' | 'templates') => boolean
}

export interface WizardNavigationReturn {
  goToStep: (step: WizardStep) => void
  goBack: () => void
  handleClose: () => void
  completedSteps: WizardStep[]
  primaryAction: { content: string; onAction: () => void; disabled?: boolean; loading?: boolean } | undefined
  secondaryActions: { content: string; onAction: () => void; loading?: boolean; disabled?: boolean }[]
  title: string
}

export function useWizardNavigation({
  state,
  dispatch,
  trackEvent,
  stepStartTimeRef,
  wizardStartTimeRef,
  isLoadingImages,
  shapeCount,
  isProcessingMockup,
  publishAction,
  handleSeeItWorks,
  handleViewInEditor,
  handleMakeItRealistic,
  hasAdvancedToTemplatesRef,
  fireWizardCompleted,
  onSkip,
  positionGenRef,
  mockupStepRef,
  compositeImageUrlRef,
  compositeImageUrlsRef,
  isMobileView,
  allProductsComplete,
}: UseWizardNavigationOptions): WizardNavigationReturn {
  const goToStep = useCallback(
    (step: WizardStep) => {
      const durationMs = Date.now() - stepStartTimeRef.current
      trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.STEP_COMPLETED, {
        step: STEP_NUMBERS[state.currentStep],
        stepName: state.currentStep,
        durationMs,
      })
      if (state.selectedProducts.length > 1 && state.activeProductIndex !== 0) {
        positionGenRef.current += 1
        dispatch({ type: 'SET_ACTIVE_PRODUCT_INDEX', index: 0 })
      }
      dispatch({ type: 'SET_STEP', step })
    },
    [
      state.currentStep,
      state.activeProductIndex,
      state.selectedProducts.length,
      trackEvent,
      stepStartTimeRef,
      positionGenRef,
      dispatch,
    ]
  )

  const goBack = useCallback(() => {
    const currentIndex = WIZARD_STEPS.indexOf(state.currentStep)
    if (currentIndex <= 0) return
    let prevStep = WIZARD_STEPS[currentIndex - 1]
    if (prevStep === 'image' && state.selectedProduct && state.selectedProduct.images.length <= 1) {
      prevStep = 'product'
    }
    trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.STEP_BACK, {
      fromStep: STEP_NUMBERS[state.currentStep],
      toStep: STEP_NUMBERS[prevStep],
    })
    if (prevStep === 'mockup') hasAdvancedToTemplatesRef.current = false
    if (state.selectedProducts.length > 1 && state.activeProductIndex !== 0) {
      positionGenRef.current += 1
      dispatch({ type: 'SET_ACTIVE_PRODUCT_INDEX', index: 0 })
    }
    dispatch({ type: 'SET_STEP', step: prevStep })
  }, [
    state.currentStep,
    state.selectedProduct,
    state.activeProductIndex,
    state.selectedProducts.length,
    trackEvent,
    hasAdvancedToTemplatesRef,
    positionGenRef,
    dispatch,
  ])

  const handleSkip = useCallback(() => {
    trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.ABANDONED, {
      lastStep: STEP_NUMBERS[state.currentStep],
      lastStepName: state.currentStep,
      totalDurationMs: Date.now() - wizardStartTimeRef.current,
    })
    onSkip()
  }, [state.currentStep, trackEvent, wizardStartTimeRef, onSkip])

  // Ref pattern avoids stale closure over fireWizardCompleted / handleSkip
  const handleCloseRef = useRef<() => void>(() => {})
  const handleClose = useCallback(() => handleCloseRef.current(), [])
  handleCloseRef.current = () => {
    if (state.publishPhase === 'completed' && state.publishResult) {
      fireWizardCompleted('close_after_publish')
    } else {
      handleSkip()
    }
  }

  const { completedSteps, primaryAction, secondaryActions, title } = useWizardButtonActions({
    state,
    dispatch,
    trackEvent,
    isLoadingImages,
    shapeCount,
    isProcessingMockup,
    publishAction,
    handleSeeItWorks,
    handleViewInEditor,
    handleMakeItRealistic,
    goToStep,
    goBack,
    allProductsComplete,
    isMobileView,
    mockupStepRef,
    compositeImageUrlRef,
    compositeImageUrlsRef,
  })

  return { goToStep, goBack, handleClose, completedSteps, primaryAction, secondaryActions, title }
}
