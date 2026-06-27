/**
 * Computes wizard button labels, primaryAction, secondaryActions, title, completedSteps.
 * Pure derived-state — no side effects, no dispatch calls.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { STEP_LABELS, STEP_NUMBERS, WIZARD_STEPS } from '../constants'
import { SIMPLIFIED_ONBOARDING_EVENTS } from '../tracking-events'
import { useWizardNextAction } from './useWizardNextAction'
import type { WizardAction, WizardState, WizardStep } from '../types'

interface UseWizardButtonActionsOptions {
  state: WizardState
  dispatch: React.Dispatch<WizardAction>
  trackEvent: (event: string, data?: Record<string, unknown>) => void
  isLoadingImages: boolean
  shapeCount: number
  isProcessingMockup: boolean
  publishAction: string | null
  handleSeeItWorks: () => void
  handleViewInEditor: () => void
  handleMakeItRealistic: () => void
  goToStep: (step: WizardStep) => void
  goBack: () => void
  allProductsComplete: (step: 'image' | 'mockup' | 'templates') => boolean
  isMobileView: boolean
  mockupStepRef: React.RefObject<{ getCompositeDataUrl: () => string | null }>
  compositeImageUrlRef: React.MutableRefObject<string | null>
  compositeImageUrlsRef: React.MutableRefObject<Record<string, string>>
}

export interface WizardButtonActionsReturn {
  completedSteps: WizardStep[]
  primaryAction: { content: string; onAction: () => void; disabled?: boolean; loading?: boolean } | undefined
  secondaryActions: { content: string; onAction: () => void; loading?: boolean; disabled?: boolean }[]
  title: string
}

export function useWizardButtonActions({
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
}: UseWizardButtonActionsOptions): WizardButtonActionsReturn {
  const { t } = useTranslation()
  const isBulkMode = state.selectedProducts.length > 1

  const completedSteps = useMemo(() => {
    const currentIndex = WIZARD_STEPS.indexOf(state.currentStep)
    const steps: WizardStep[] = []
    if (state.selectedProduct && WIZARD_STEPS.indexOf('product') < currentIndex) steps.push('product')
    if (state.selectedImageUrl && WIZARD_STEPS.indexOf('image') < currentIndex) steps.push('image')
    if (state.mockupResult && WIZARD_STEPS.indexOf('mockup') < currentIndex) steps.push('mockup')
    if (
      (state.selectedTemplateType || state.selectedExistingTemplate)
      && WIZARD_STEPS.indexOf('templates') < currentIndex
    ) {
      steps.push('templates')
    }
    return steps
  }, [
    state.currentStep,
    state.selectedProduct,
    state.selectedImageUrl,
    state.mockupResult,
    state.selectedTemplateType,
    state.selectedExistingTemplate,
  ])

  const canGoNext = useMemo(() => {
    if (state.isNavigating) return false
    switch (state.currentStep) {
      case 'product':
        return !!state.selectedProduct && !isLoadingImages
      case 'image':
        return !!state.selectedImageUrl && allProductsComplete('image')
      case 'mockup':
        return true
      case 'templates':
        return !!state.selectedTemplateType || !!state.selectedExistingTemplate
      case 'preview':
        if (state.publishPhase === 'publishing') return false
        // Publish can proceed without storefront setup; the runtime fallback handles missing embed/block setup.
        return true
      default:
        return false
    }
  }, [state, isLoadingImages, allProductsComplete])

  const handleNext = useWizardNextAction({
    state,
    dispatch,
    trackEvent,
    isLoadingImages,
    goToStep,
    handleSeeItWorks,
    mockupStepRef,
    compositeImageUrlRef,
    compositeImageUrlsRef,
  })

  const nextButtonLabel = useMemo(() => {
    switch (state.currentStep) {
      case 'product':
        return state.selectedProducts.length > 1
          ? t('set-up-count-products', { count: state.selectedProducts.length })
          : t('make-it-personalizable')
      case 'image':
        return t('define-personalized-area')
      case 'mockup':
        return t('make-it-realistic')
      case 'templates':
        return t('make-it-live')
      case 'preview':
        return t('view-it-on-storefront')
      default:
        return t('next')
    }
  }, [state.currentStep, state.selectedProducts.length, t])

  const showBack = state.currentStep !== 'product'

  const secondaryActions = useMemo(() => {
    if (state.currentStep === 'preview') {
      if (state.publishPhase === 'completed' && state.publishResult) {
        return [
          { content: t('view-it-in-editor'), onAction: handleViewInEditor },
          {
            content: t('view-it-on-storefront'),
            onAction: () => {
              trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.STOREFRONT_OPENED, { trigger: 'fallback_button' })
              window.open(state.publishResult!.storefrontUrl, '_blank')
            },
          },
        ]
      }
      return [
        {
          content: t('view-it-in-editor'),
          onAction: handleViewInEditor,
          loading: state.publishPhase === 'publishing' && publishAction === 'editor',
          disabled: state.publishPhase === 'publishing' && publishAction === 'storefront',
        },
      ]
    }
    if (showBack) return [{ content: t('back'), onAction: goBack }]
    return []
  }, [
    showBack,
    t,
    goBack,
    state.currentStep,
    state.publishPhase,
    state.publishResult,
    handleViewInEditor,
    publishAction,
    trackEvent,
  ])

  const primaryAction = useMemo(() => {
    if (state.currentStep === 'mockup') {
      return {
        content: nextButtonLabel,
        onAction: handleMakeItRealistic,
        disabled: !canGoNext,
        loading: isProcessingMockup || state.isNavigating,
      }
    }
    if (state.currentStep === 'preview') {
      if (state.publishPhase === 'completed') return undefined
      return {
        content: nextButtonLabel,
        onAction: handleNext,
        disabled: !canGoNext || (state.publishPhase === 'publishing' && publishAction === 'editor'),
        loading: state.publishPhase === 'publishing' && publishAction === 'storefront',
      }
    }
    return { content: nextButtonLabel, onAction: handleNext, disabled: !canGoNext, loading: state.isNavigating }
  }, [
    state.currentStep,
    state.isNavigating,
    state.publishPhase,
    publishAction,
    isProcessingMockup,
    nextButtonLabel,
    handleNext,
    handleMakeItRealistic,
    canGoNext,
  ])

  const title = isMobileView
    ? `${t('step')} ${STEP_NUMBERS[state.currentStep]}: ${t(STEP_LABELS[state.currentStep])}`
    : isBulkMode
      ? `${t('bulk-product-setup')} (${STEP_NUMBERS[state.currentStep]}/5)`
      : `${t('set-up-a-personalized-product')} (${STEP_NUMBERS[state.currentStep]}/5)`

  return { completedSteps, primaryAction, secondaryActions, title }
}
