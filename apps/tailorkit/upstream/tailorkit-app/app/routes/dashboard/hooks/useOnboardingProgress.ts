import { useCallback, useEffect, useMemo, useState } from 'react'
import { ONBOARDING_QUESTION_KEY } from '~/modules/Feedback/constants'
import { useOnboardingTour } from '~/modules/Onboarding/hooks/useOnboardingTour'
import { USER_JOURNEY_STEPS } from '~/routes/api.user-journey/constants'
import { useUserMilestone } from './useUserMilestone'
import { TASKS_ONBOARDING_STEPS } from '../constants'
import { useNavigate } from '@remix-run/react'
import { uuid } from '~/utils/uuid'
import { buildPrebuiltPrintAreas } from '~/modules/ProductEditor/utilities/prebuiltPrintAreas'
import { storeJSONFileToIDB, openIDBDatabase } from '~/bootstrap/db/index-db'
import { DEFAULT_TEMPLATE_DIMENSION } from '~/stores/modules/template'
import {
  startIntegrationEditorQuickTour,
  startTemplateEditorQuickTour,
} from '~/modules/TourGuides/TemplateEditorQuickTour/fns'
import { useRootLoaderData } from '~/root'
import { isInTrial } from '~/routes/api.pricing/utils/fns'
import useInitIntegration from '~/modules/ProductEditor/hooks/useInitIntegration'
import { IDB_DATABASE_NAME, IDB_STORE_NAME } from '~/constants/index-db'

interface OnboardingProgressResult {
  loading: boolean
  isWelcomeDone: boolean
  isSpecificationDone: boolean
  isAchieveFirstSaleDone: boolean
  isAllOnboardingDone: boolean
  achieveFirstSaleEvent: {
    data: AchieveFirstSaleStep[]
  }
  preparingProductsModalActive: boolean
  handleContinueUserMilestone: () => Promise<void>
  togglePreparingProductsModal: () => void
}

interface AchieveFirstSaleStep {
  step: string
  finished: boolean
}

/**
 * @author KhanhNT
 * Custom hook to track the progress of the onboarding process.
 *
 * @param modalActive - Boolean flag to indicate if the modal is active.
 * @param refresh - Boolean flag to force refresh the progress
 * @returns An object containing the status of the onboarding steps:
 *   - `isWelcomeDone`: Boolean indicating if the "Welcome" step has been completed.
 *   - `isSpecificationDone`: Boolean indicating if the "Product Specification" step has been completed.
 *
 * The hook uses the `useOnboardingTour` custom hook to get the current state of the onboarding
 * process and updates the progress of each step based on whether the user has completed specific
 * onboarding questions.
 */
export const useOnboardingProgress = (modalActive: boolean, refresh = false): OnboardingProgressResult => {
  const { shopData } = useRootLoaderData()
  const { selectedState } = useOnboardingTour(modalActive)
  const { achieveFirstSaleEvent } = useUserMilestone()
  const navigate = useNavigate()
  const { prepareVariantsSelected } = useInitIntegration()
  const [preparingProductsModalActive, setPreparingProductsModalActive] = useState(false)
  const [onboardingProgress, setOnboardingProgress] = useState({
    loading: true,
    [TASKS_ONBOARDING_STEPS.WELCOME.id]: false,
    [TASKS_ONBOARDING_STEPS.SPECIFICATIONS.id]: false,
    [TASKS_ONBOARDING_STEPS.ACHIEVE_FIRST_SALE.id]: false,
  })

  const isInTrialPeriod = useMemo(() => isInTrial(shopData.subscription), [shopData.subscription])

  const stepsNotOnboarding = useMemo(
    () => [
      USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.ACHIEVE_FIRST_SALE,
      USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.ACHIEVE_200_DOLLAR,
    ],
    []
  )

  const archiveFirstSaleSteps = useMemo(() => {
    const excludedSteps = isInTrialPeriod
      ? [USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.ACHIEVE_200_DOLLAR]
      : [
          USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.ACHIEVE_FIRST_SALE,
          USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.ACHIEVE_200_DOLLAR,
        ]

    return Object.values(USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE).filter(step => !excludedSteps.includes(step))
  }, [isInTrialPeriod])

  const stepsMap = useMemo(() => {
    if (!achieveFirstSaleEvent?.data) return new Map<string, boolean>()

    return new Map<string, boolean>(
      (achieveFirstSaleEvent.data as AchieveFirstSaleStep[]).map(({ step, finished }) => [step, finished])
    )
  }, [achieveFirstSaleEvent?.data])

  const togglePreparingProductsModal = useCallback(() => {
    setPreparingProductsModalActive(prev => !prev)
  }, [])

  const handleCreateTemplate = useCallback(async () => {
    const id = uuid()

    // Save the time users start creating a template
    if (!localStorage?.getItem('TLK_CREATING_TEMPLATE_START_AT')) {
      localStorage?.setItem('TLK_CREATING_TEMPLATE_START_AT', Date.now().toString())
    }

    const storeName = IDB_STORE_NAME.TEMPLATE_DIMENSION
    const formData = {
      title: 'Untitled',
      ...DEFAULT_TEMPLATE_DIMENSION,
    }

    const db = await openIDBDatabase(IDB_DATABASE_NAME.TEMPLATE_DIMENSION, storeName)
    await storeJSONFileToIDB(db, storeName, formData, id)
    const response = await startTemplateEditorQuickTour(id)

    if (response.success) {
      setTimeout(() => navigate(response.returnUrl), 100)
    }
  }, [navigate])

  /**
   * Step 1: Welcome done when user finish topic focus question
   */
  const getWelcomeProgress = useCallback(
    () => Boolean(selectedState?.has(ONBOARDING_QUESTION_KEY.TOPIC_FOCUS)),
    [selectedState]
  )

  /**
   * Step 2: Product Specification done when user finish let started question
   */
  const getSpecificationProgress = useCallback(
    () => Boolean(selectedState?.has(ONBOARDING_QUESTION_KEY.LET_STARTED)),
    [selectedState]
  )

  /**
   * Step 3: Achieve First Sale done when user finish all steps in achieve first sale journey
   */
  const getAchieveFirstSaleProgress = useCallback(() => {
    if (!achieveFirstSaleEvent?.data) return false
    return archiveFirstSaleSteps.every(step => stepsMap.get(step))
  }, [achieveFirstSaleEvent?.data, archiveFirstSaleSteps, stepsMap])

  const calculatedProgress = useMemo(
    () => ({
      loading: false,
      [TASKS_ONBOARDING_STEPS.WELCOME.id]: getWelcomeProgress(),
      [TASKS_ONBOARDING_STEPS.SPECIFICATIONS.id]: getSpecificationProgress(),
      [TASKS_ONBOARDING_STEPS.ACHIEVE_FIRST_SALE.id]: getAchieveFirstSaleProgress(),
    }),
    [getWelcomeProgress, getSpecificationProgress, getAchieveFirstSaleProgress]
  )

  /**
   * All onboarding done when user finish all steps in onboarding,
   * include welcome, specification, create template, prepare products, integrate products and publish products
   */
  const isAllOnboardingDone = useMemo(() => {
    if (!achieveFirstSaleEvent?.data) return false

    const onboardingSteps = archiveFirstSaleSteps.filter(step => !stepsNotOnboarding.includes(step))
    return (
      calculatedProgress[TASKS_ONBOARDING_STEPS.WELCOME.id]
      && calculatedProgress[TASKS_ONBOARDING_STEPS.SPECIFICATIONS.id]
      && onboardingSteps.every(step => stepsMap.get(step))
    )
  }, [achieveFirstSaleEvent?.data, archiveFirstSaleSteps, stepsNotOnboarding, calculatedProgress, stepsMap])

  /**
   * Navigate to tour when user click on continue onboarding button
   */
  const navigateToTour = useCallback(
    async (startTourFn: () => Promise<any>) => {
      try {
        const response = await startTourFn()

        if (response.success) {
          const { productVariants, integrationId, returnUrl } = response || {}

          // Build prebuilt print areas map and include printAreaId in URL
          const { prebuiltPrintAreasByVariantId, selectedPrintAreaId } = buildPrebuiltPrintAreas(productVariants as any)

          const urlWithPA = selectedPrintAreaId
            ? `${returnUrl}${returnUrl?.includes('?') ? '&' : '?'}printAreaId=${selectedPrintAreaId}`
            : returnUrl

          await prepareVariantsSelected({
            variants: productVariants || [],
            integrationId,
            returnUrl: urlWithPA,
            prebuiltPrintAreasByVariantId,
            selectedPrintAreaId,
          })
          navigate(urlWithPA)
        }
      } catch (err) {
        console.error('Failed to navigate to tour:', err)
      }
    },
    [navigate, prepareVariantsSelected]
  )

  /**
   * Open integration screen when user click on continue onboarding button and user has not finished publish products step
   */
  const handleIntegrateWithProducts = useCallback(
    () => navigateToTour(startIntegrationEditorQuickTour),
    [navigateToTour]
  )

  const handlePreparingProducts = useCallback(() => {
    togglePreparingProductsModal()
  }, [togglePreparingProductsModal])

  /**
   * Handle continue user milestone when user click on continue onboarding button
   */
  const handleContinueUserMilestone = useCallback(async () => {
    const stepActions = {
      [USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.CREATE_TEMPLATE]: handleCreateTemplate,
      [USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.PREPARE_PRODUCTS]: handlePreparingProducts,
      [USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.INTEGRATE_WITH_PRODUCTS]: handleIntegrateWithProducts,
      [USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.PUBLISH_ON_ONLINE_STORE]: handleIntegrateWithProducts,
    }

    try {
      for (const step in stepActions) {
        if (!stepsMap.get(step)) {
          const action = stepActions[step as keyof typeof stepActions]
          await action()
          return
        }
      }
    } catch (error) {
      console.error('Error in continuing user milestone:', error)
    }
  }, [stepsMap, handleCreateTemplate, handlePreparingProducts, handleIntegrateWithProducts])

  /**
   * Update onboarding progress when dependencies change
   */
  useEffect(() => {
    setOnboardingProgress(calculatedProgress)
  }, [calculatedProgress, refresh])

  return {
    loading: onboardingProgress.loading,
    isWelcomeDone: onboardingProgress[TASKS_ONBOARDING_STEPS.WELCOME.id],
    isSpecificationDone: onboardingProgress[TASKS_ONBOARDING_STEPS.SPECIFICATIONS.id],
    isAchieveFirstSaleDone: onboardingProgress[TASKS_ONBOARDING_STEPS.ACHIEVE_FIRST_SALE.id],
    isAllOnboardingDone,
    achieveFirstSaleEvent,
    preparingProductsModalActive,
    handleContinueUserMilestone,
    togglePreparingProductsModal,
  }
}
