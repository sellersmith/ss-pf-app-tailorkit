/**
 * useWizardCore: composes all wizard sub-hooks into a single reusable hook.
 * WizardModal/WizardInPage become thin wrappers that delegate everything here.
 *
 * Sub-hooks:
 *   useWizardTracking      — analytics, A/B test, timing
 *   useWizardProduct       — product/image selection + tab switching
 *   useWizardMockup        — shape state, mockup handlers, bulk processing chain
 *     useWizardMockupEffects — auto-advance effects
 *   useWizardNavigation    — back/close/skip + delegates to:
 *     useWizardNextAction    — per-step "Next" logic
 *     useWizardButtonActions — canGoNext, primaryAction, secondaryActions, title
 *   useTemplateGeneration  (existing)
 *   useWizardPublish       (existing)
 */

import { useCallback, useReducer, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import useScreenBreakpoints from '~/utils/hooks/use-screen-breakpoints'
import { useTemplateGeneration } from './useTemplateGeneration'
import { useWizardPublish } from './useWizardPublish'
import { useWizardTracking } from './useWizardTracking'
import { useWizardProduct } from './useWizardProduct'
import { useWizardMockup } from './useWizardMockup'
import { useWizardNavigation } from './useWizardNavigation'
import { createInitialWizardState, wizardReducer } from '../wizard-reducer'
import type { SimplifiedOnboardingWizardProps, WizardCoreReturn, WizardStep } from '../types'
import type { MockupWizardStepRef } from '../steps/MockupWizardStep'

export type { WizardCoreReturn }

export function useWizardCore({
  active,
  appConfig: _appConfig,
  onComplete,
  onSkip,
  entryPoint,
}: SimplifiedOnboardingWizardProps): WizardCoreReturn {
  const { t } = useTranslation()
  const { isMobileView } = useScreenBreakpoints()
  const [state, dispatch] = useReducer(wizardReducer, undefined, createInitialWizardState)

  // Refs shared across sub-hooks
  const mockupStepRef = useRef<MockupWizardStepRef>(null)
  const compositeImageUrlsRef = useRef<Record<string, string>>({})
  const compositeImageUrlRef = useRef<string | null>(null)
  const positionGenRef = useRef(0)
  const skipNextInvalidationRef = useRef(false)
  const bulkChainRef = useRef(false)

  // Tracking
  const { trackEvent, wizardStartTimeRef, stepStartTimeRef, fireWizardCompleted } = useWizardTracking({
    active,
    currentStep: state.currentStep,
    selectedTemplateType: state.selectedTemplateType,
    publishResult: state.publishResult,
    onComplete,
    entryPoint,
  })

  // Product & image selection
  const { isLoadingImages, handleProductSelect, handleProductsSelect, handleImageSelect, handleProductTabChange }
    = useWizardProduct({
      state,
      dispatch,
      trackEvent,
      skipNextInvalidationRef,
      positionGenRef,
      mockupStepRef,
      compositeImageUrlsRef,
    })

  // Publish flow
  const activeCompositeUrl
    = (state.selectedProduct?.id && compositeImageUrlsRef.current[state.selectedProduct.id])
    || compositeImageUrlRef.current
  const { publishStepMessage, publishAction, handleSeeItWorks, handleViewInEditor } = useWizardPublish({
    selectedProduct: state.selectedProduct,
    selectedImageUrl: state.selectedImageUrl,
    mockupResult: state.mockupResult,
    compositeImageUrl: activeCompositeUrl,
    selectedTemplateType: state.selectedTemplateType,
    selectedExistingTemplate: state.selectedExistingTemplate,
    templateStates: state.templateStates,
    publishResult: state.publishResult,
    wizardStartTime: wizardStartTimeRef.current,
    publishMode: state.publishMode,
    replaceFeaturedMedia: state.replaceFeaturedMedia,
    dispatch,
    fireWizardCompleted,
  })

  // Template generation
  const isBulkMode = state.selectedProducts.length > 1
  const { currentTemplateImageUrls, templateListContent } = useTemplateGeneration({
    currentStep: state.currentStep,
    selectedImageUrl: state.selectedImageUrl,
    mockupResult: state.mockupResult,
    selectedTemplateType: state.selectedTemplateType,
    selectedExistingTemplate: state.selectedExistingTemplate,
    templateStates: state.templateStates,
    dispatch,
    isBulkMode,
    selectedProducts: state.selectedProducts,
    perProductState: state.perProductState,
  })

  // Lightweight dispatch wrapper passed to mockup hook (no tracking).
  const goToStepDispatch = useCallback(
    (step: WizardStep) => {
      if (state.selectedProducts.length > 1 && state.activeProductIndex !== 0) {
        positionGenRef.current += 1
        dispatch({ type: 'SET_ACTIVE_PRODUCT_INDEX', index: 0 })
      }
      dispatch({ type: 'SET_STEP', step })
    },
    [state.selectedProducts.length, state.activeProductIndex]
  )

  // Mockup step
  const {
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
  } = useWizardMockup({
    state,
    dispatch,
    trackEvent,
    goToStep: goToStepDispatch,
    mockupStepRef,
    positionGenRef,
    skipNextInvalidationRef,
    bulkChainRef,
  })

  // Navigation (buttons, titles, canGoNext)
  const { goToStep, handleClose, completedSteps, primaryAction, secondaryActions, title } = useWizardNavigation({
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
  })

  return {
    state,
    dispatch,
    isMobileView,
    t,
    primaryAction,
    secondaryActions,
    title,
    completedSteps,
    handleClose,
    handleProductSelect,
    handleProductsSelect,
    handleProductTabChange,
    handleImageSelect,
    handleMockupApply,
    handleMockupError,
    handleShapeCountChange,
    handleShapeSelectionsChange,
    handleTemplatePositionsChange,
    goToStep,
    currentProductShapes,
    mockupStepRef,
    compositeImageUrlRef,
    compositeImageUrlsRef,
    currentTemplateImageUrls,
    templateListContent,
    publishStepMessage,
    wizardStartTime: wizardStartTimeRef.current,
    trackEvent,
  }
}
