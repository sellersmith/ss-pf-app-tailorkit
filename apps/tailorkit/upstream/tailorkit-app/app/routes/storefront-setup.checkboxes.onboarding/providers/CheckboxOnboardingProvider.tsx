import { useFetcher, useNavigate } from '@remix-run/react'
import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING, EVENTS_PARAMETERS_NAME } from '~/bootstrap/constants/eventsTracking'
import { ETriggerProductsType } from '~/enums/checkbox'
import { useRootLoaderData } from '~/root'
import type { CheckboxFormState } from '~/routes/storefront-setup.checkboxes/components/types'
import {
  DEFAULT_FORM_STATE,
  formStateToCheckboxData,
  validateFormState,
} from '~/routes/storefront-setup.checkboxes/components/types'
import type { VariantData } from '~/types/checkbox'
import type { CheckboxGlobalStyling } from '~/types/global-styling'
import { getUpsellProductLimit } from '~/utils/getUpsellProductLimit'
import { showGenericErrorToast, showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import {
  getNextStep,
  getPreviousStep,
  getStepNumber,
  isFirstStep,
  isLastStep,
  ONBOARDING_ACTIONS,
  STEP_ORDER,
  type OnboardingStepKey,
} from '../constants'
import type { CheckboxOnboardingLoaderData } from '../loader.server'

type SelectedVariantData = VariantData & {
  product: VariantData['product'] & {
    hasOnlyDefaultVariant?: boolean
    variants?: Array<{ id: string; title: string; price?: string }>
  }
}

interface OnboardingDataItem {
  step: string
  completed: boolean
  skipped?: boolean
  checkboxId?: string
}

interface ThemeConfig {
  enabledOneTickHelper: boolean
  oneTickHelperLink: string
  isOS2Theme: boolean
}

export interface CheckboxOnboardingContextType {
  // Current state
  currentStep: OnboardingStepKey
  progress: number
  isLoading: boolean
  isSaving: boolean
  isLoadingThemeConfig: boolean

  // Theme config
  themeConfig: ThemeConfig

  // Form data for checkbox creation
  checkboxFormState: CheckboxFormState
  setCheckboxFormState: (state: CheckboxFormState | ((prev: CheckboxFormState) => CheckboxFormState)) => void
  selectedVariantData: SelectedVariantData | null
  setSelectedVariantData: (data: SelectedVariantData | null) => void

  // Product selector data
  collections: Array<{ id: string; title: string }>
  tags: string[]
  vendors: string[]
  productTypes: string[]
  checkboxStyling?: CheckboxGlobalStyling

  // Navigation helpers
  stepNumber: number
  totalSteps: number
  isFirstStep: boolean
  isLastStep: boolean
  canProceedToNextStep: boolean

  // Navigation
  goToNextStep: () => Promise<void>
  goToPreviousStep: () => void
  skipStep: () => Promise<void>
  exitOnboarding: () => void
  completeOnboarding: () => Promise<void>

  // Checkbox creation
  saveCheckbox: () => Promise<{ success: boolean; checkboxId?: string }>

  // Theme helper
  refreshThemeConfig: () => Promise<boolean>
}

export const CheckboxOnboardingContext = createContext<CheckboxOnboardingContextType | undefined>(undefined)

interface CheckboxOnboardingProviderProps {
  children: ReactNode
  initialData: CheckboxOnboardingLoaderData
}

const DEFAULT_THEME_CONFIG: ThemeConfig = {
  enabledOneTickHelper: false,
  oneTickHelperLink: '',
  isOS2Theme: true,
}

export function CheckboxOnboardingProvider({ children, initialData }: CheckboxOnboardingProviderProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { trackEvent } = useEventsTracking()
  const fetcher = useFetcher<{
    success: boolean
    checkboxId?: string
    enabledOneTickHelper?: boolean
    message?: string
  }>()

  const rootData = useRootLoaderData()
  const upsellProductLimit = getUpsellProductLimit(rootData?.shopData)
  const hideAllProductsOption = typeof upsellProductLimit === 'number'

  // State
  const [currentStep, setCurrentStep] = useState<OnboardingStepKey>(initialData.currentStep)
  const [progress, setProgress] = useState(initialData.progress)
  const [onboardingData, setOnboardingData] = useState<OnboardingDataItem[]>(initialData.onboardingData)
  const [isLoading, setIsLoading] = useState(false)
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(DEFAULT_THEME_CONFIG)
  const [isLoadingThemeConfig, setIsLoadingThemeConfig] = useState(true)

  // Checkbox form state — override trigger type for limited plans (same as CheckboxForm)
  const [checkboxFormState, setCheckboxFormState] = useState<CheckboxFormState>(() => {
    const baseState = {
      ...DEFAULT_FORM_STATE,
      title: 'My first add-on',
      isActive: true,
    }
    if (hideAllProductsOption && baseState.triggerProductsType === ETriggerProductsType.ALL_PRODUCTS) {
      return { ...baseState, triggerProductsType: ETriggerProductsType.SPECIFIC_PRODUCTS, targetProducts: [] }
    }
    return baseState
  })
  const [selectedVariantData, setSelectedVariantData] = useState<SelectedVariantData | null>(null)
  const [createdCheckboxId, setCreatedCheckboxId] = useState<string | null>(null)
  const [isCreatingCheckbox, setIsCreatingCheckbox] = useState(false)

  // Derive saving state from fetcher
  const isSaving = fetcher.state === 'submitting' || fetcher.state === 'loading'

  // Fetch theme config lazily on mount
  const fetchThemeConfig = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/preferences?themeConfig=true')
      const data = await response.json()
      if (data?.appConfig) {
        setThemeConfig({
          isOS2Theme: data.appConfig.isOS2Theme ?? true,
          enabledOneTickHelper: data.appConfig.enabledOneTickHelper ?? false,
          oneTickHelperLink: data.appConfig.oneTickHelperLink ?? '',
        })
        return data.appConfig.enabledOneTickHelper ?? false
      }
      return false
    } catch (error) {
      console.error('Failed to fetch theme config:', error)
      return false
    } finally {
      setIsLoadingThemeConfig(false)
    }
  }, [])

  useEffect(() => {
    fetchThemeConfig()
  }, [fetchThemeConfig])

  // Navigation helpers
  const stepNumber = getStepNumber(currentStep)
  const totalSteps = STEP_ORDER.length

  // Determine if can proceed to next step
  const canProceedToNextStep = useMemo(() => {
    switch (currentStep) {
      case 'shareKnowledge':
        return true // Always can proceed from shareKnowledge
      case 'basicSetup':
        // Must have at least one addon product selected
        return checkboxFormState.upsellProducts.length > 0
      case 'enableThemeHelper':
        return true // Can always proceed (skip or complete)
      default:
        return false
    }
  }, [currentStep, checkboxFormState.upsellProducts.length])

  // Save progress to server
  const saveProgress = useCallback(
    async (step: OnboardingStepKey, newProgress: number, data: OnboardingDataItem[]) => {
      const formData = new FormData()
      formData.append('action', ONBOARDING_ACTIONS.SAVE_PROGRESS)
      formData.append('currentStep', step)
      formData.append('progress', newProgress.toString())
      formData.append('data', JSON.stringify(data))

      fetcher.submit(formData, { method: 'post' })
    },
    [fetcher]
  )

  // Go to next step
  const goToNextStep = useCallback(async () => {
    if (!canProceedToNextStep || isCreatingCheckbox) return

    setIsLoading(true)

    try {
      // Mark current step as completed
      const updatedData = [...onboardingData]
      const existingIndex = updatedData.findIndex(item => item.step === currentStep)
      if (existingIndex >= 0) {
        updatedData[existingIndex] = { ...updatedData[existingIndex], completed: true }
      } else {
        updatedData.push({ step: currentStep, completed: true })
      }

      // If on basicSetup step, create the checkbox first
      if (currentStep === 'basicSetup' && !createdCheckboxId) {
        const errors = validateFormState(checkboxFormState)
        if (errors.length > 0) {
          showGenericErrorToast()
          setIsLoading(false)
          return
        }

        setIsCreatingCheckbox(true)
        const checkboxData = formStateToCheckboxData(checkboxFormState)
        const formData = new FormData()
        formData.append('action', ONBOARDING_ACTIONS.CREATE_CHECKBOX)
        formData.append('data', JSON.stringify(checkboxData))

        fetcher.submit(formData, { method: 'post' })
        return // Wait for fetcher response
      }

      const nextStep = getNextStep(currentStep)
      if (nextStep) {
        setOnboardingData(updatedData)
        setCurrentStep(nextStep)
        setProgress(prev => prev + 1)
        await saveProgress(nextStep, progress + 1, updatedData)
      }
    } catch (error) {
      console.error('Error going to next step:', error)
      showGenericErrorToast()
    } finally {
      setIsLoading(false)
    }
  }, [
    canProceedToNextStep,
    isCreatingCheckbox,
    currentStep,
    onboardingData,
    createdCheckboxId,
    checkboxFormState,
    fetcher,
    progress,
    saveProgress,
  ])

  // Handle fetcher response for checkbox creation
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (fetcher.data.success && fetcher.data.checkboxId) {
        setCreatedCheckboxId(fetcher.data.checkboxId)
        setIsCreatingCheckbox(false)
        showToast(t(TOAST.COMMON.UPDATED))

        // Now proceed to next step
        const updatedData = [...onboardingData]
        const existingIndex = updatedData.findIndex(item => item.step === 'basicSetup')
        if (existingIndex >= 0) {
          updatedData[existingIndex] = {
            ...updatedData[existingIndex],
            completed: true,
            checkboxId: fetcher.data.checkboxId,
          }
        } else {
          updatedData.push({ step: 'basicSetup', completed: true, checkboxId: fetcher.data.checkboxId })
        }

        const nextStep = getNextStep('basicSetup')
        if (nextStep) {
          setOnboardingData(updatedData)
          setCurrentStep(nextStep)
          setProgress(prev => prev + 1)
          saveProgress(nextStep, progress + 1, updatedData)
        }
        setIsLoading(false)
      } else if (fetcher.data.success === false) {
        // Handle error from checkbox creation
        setIsCreatingCheckbox(false)
        setIsLoading(false)
        showGenericErrorToast()
      } else if (fetcher.data?.enabledOneTickHelper !== undefined) {
        // Theme config refresh response
        setThemeConfig(prev => ({
          ...prev,
          enabledOneTickHelper: fetcher.data?.enabledOneTickHelper || false,
        }))
      }
    }
  }, [fetcher.state, fetcher.data, onboardingData, progress, saveProgress, t])

  // Go to previous step
  const goToPreviousStep = useCallback(() => {
    const prevStep = getPreviousStep(currentStep)
    if (prevStep) {
      setCurrentStep(prevStep)
      setProgress(prev => Math.max(0, prev - 1))
    }
  }, [currentStep])

  // Skip current step
  const skipStep = useCallback(async () => {
    setIsLoading(true)

    try {
      const updatedData = [...onboardingData]
      const existingIndex = updatedData.findIndex(item => item.step === currentStep)
      if (existingIndex >= 0) {
        updatedData[existingIndex] = { ...updatedData[existingIndex], skipped: true }
      } else {
        updatedData.push({ step: currentStep, completed: false, skipped: true })
      }

      const nextStep = getNextStep(currentStep)
      if (nextStep) {
        setOnboardingData(updatedData)
        setCurrentStep(nextStep)
        setProgress(prev => prev + 1)
        await saveProgress(nextStep, progress + 1, updatedData)
      } else {
        // Last step, complete onboarding directly
        const formData = new FormData()
        formData.append('action', ONBOARDING_ACTIONS.COMPLETE_ONBOARDING)
        formData.append('data', JSON.stringify(updatedData))
        fetcher.submit(formData, { method: 'post' })
        // Redirect will happen from the action
        return
      }
    } catch (error) {
      console.error('Error skipping step:', error)
      showGenericErrorToast()
    } finally {
      setIsLoading(false)
    }
  }, [currentStep, onboardingData, progress, saveProgress, fetcher])

  // Exit onboarding
  const exitOnboarding = useCallback(() => {
    // Track onboarding exit
    trackEvent(EVENTS_TRACKING.CHECKBOX_ONBOARDING_EXITED, {
      [EVENTS_PARAMETERS_NAME.ONBOARDING_STEP]: currentStep,
    })
    navigate('/storefront-setup')
  }, [currentStep, navigate, trackEvent])

  // Complete onboarding
  const completeOnboarding = useCallback(async () => {
    setIsLoading(true)

    try {
      const updatedData = [...onboardingData]
      const existingIndex = updatedData.findIndex(item => item.step === currentStep)
      if (existingIndex >= 0) {
        updatedData[existingIndex] = { ...updatedData[existingIndex], completed: true }
      } else {
        updatedData.push({ step: currentStep, completed: true })
      }

      const formData = new FormData()
      formData.append('action', ONBOARDING_ACTIONS.COMPLETE_ONBOARDING)
      formData.append('data', JSON.stringify(updatedData))

      fetcher.submit(formData, { method: 'post' })
      // Redirect will happen from the action
    } catch (error) {
      console.error('Error completing onboarding:', error)
      showGenericErrorToast()
      setIsLoading(false)
    }
  }, [currentStep, fetcher, onboardingData])

  // Save checkbox (for manual save if needed)
  const saveCheckbox = useCallback(async () => {
    const errors = validateFormState(checkboxFormState)
    if (errors.length > 0) {
      return { success: false }
    }

    const checkboxData = formStateToCheckboxData(checkboxFormState)
    const formData = new FormData()
    formData.append('action', ONBOARDING_ACTIONS.CREATE_CHECKBOX)
    formData.append('data', JSON.stringify(checkboxData))

    fetcher.submit(formData, { method: 'post' })

    return { success: true }
  }, [checkboxFormState, fetcher])

  // Refresh theme config
  const refreshThemeConfig = useCallback(async () => {
    setIsLoadingThemeConfig(true)
    return fetchThemeConfig()
  }, [fetchThemeConfig])

  const contextValue = useMemo<CheckboxOnboardingContextType>(
    () => ({
      currentStep,
      progress,
      isLoading,
      isSaving,
      isLoadingThemeConfig,
      themeConfig,
      checkboxFormState,
      setCheckboxFormState,
      selectedVariantData,
      setSelectedVariantData,
      collections: initialData.collections,
      tags: initialData.tags,
      vendors: initialData.vendors,
      productTypes: initialData.productTypes,
      checkboxStyling: initialData.checkboxStyling,
      stepNumber,
      totalSteps,
      isFirstStep: isFirstStep(currentStep),
      isLastStep: isLastStep(currentStep),
      canProceedToNextStep,
      goToNextStep,
      goToPreviousStep,
      skipStep,
      exitOnboarding,
      completeOnboarding,
      saveCheckbox,
      refreshThemeConfig,
    }),
    [
      currentStep,
      progress,
      isLoading,
      isSaving,
      isLoadingThemeConfig,
      themeConfig,
      checkboxFormState,
      selectedVariantData,
      initialData,
      stepNumber,
      totalSteps,
      canProceedToNextStep,
      goToNextStep,
      goToPreviousStep,
      skipStep,
      exitOnboarding,
      completeOnboarding,
      saveCheckbox,
      refreshThemeConfig,
    ]
  )

  return <CheckboxOnboardingContext.Provider value={contextValue}>{children}</CheckboxOnboardingContext.Provider>
}
