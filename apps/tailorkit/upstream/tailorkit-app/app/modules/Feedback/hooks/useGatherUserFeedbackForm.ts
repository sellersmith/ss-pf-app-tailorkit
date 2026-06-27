import { useCallback, useMemo } from 'react'
import { useSearchParams } from '@remix-run/react'
import { getUserJourneyOfTourGuide } from '~/bootstrap/hoc/withTourGuide'
import { CONFETTI_INTEGRATION_QUICK_TOUR_KEY } from '~/modules/TourGuides/IntegrationEditorQuickTour/constants'
import {
  CONFETTI_QUICK_TOUR_KEY,
  NAVIGATE_TO_DISCOVERY_MODAL_KEY,
  NAVIGATE_TO_INTEGRATION_MODAL_KEY,
  NAVIGATE_TO_PUBLISH_PRODUCT_MODAL_KEY,
} from '~/modules/TourGuides/TemplateEditorQuickTour/constants'
import { saveProgressQuickTourData } from '~/modules/TourGuides/TemplateEditorQuickTour/fns'
import { type USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'
import { useModal } from '~/utils/hooks/useModal'
import { type FEEDBACK_TYPE } from '~/modules/Feedback/constants'
import { feedbackStore } from '~/stores/feedback'
import { useStore } from '~/libs/external-store'
import { isInTrial } from '~/routes/api.pricing/utils/fns'
import { useRootLoaderData } from '~/root'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { GLOBAL_EVENTS_TRANSMITTER } from '~/constants/events-transmitter'
import { BFS_COMPLIANCE } from '~/constants/bfs-compliance'

interface UseGatherUserFeedbackFormProps {
  feedbackType: FEEDBACK_TYPE
}

const DELAY_TIME_TO_SHOW_CONFETTI = 3500
const DELAY_TIME_TO_SHOW_MODAL = 3500

// BFS Compliance: Flag to disable auto-opening modals (requirement 4.3.3)
const isDisableAutoOpeningModals = BFS_COMPLIANCE.DISABLE_AUTO_OPENING_MODALS

export function useGatherUserFeedbackForm({ feedbackType }: UseGatherUserFeedbackFormProps) {
  const [searchParams] = useSearchParams()
  const tourId = searchParams.get('tour')

  const { shopData } = useRootLoaderData()
  const isInTrialPeriod = useMemo(() => isInTrial(shopData?.subscription), [shopData?.subscription])

  const { openModal, closeModal } = useModal()
  const feedbackState = useStore(feedbackStore, state => state[feedbackType]) || {}
  const showFeedback = feedbackState.showFeedback
  const feedbackCallback = feedbackState.callback

  const showFeedbackForm = useCallback(
    async (args?: { feedbackCallback?: () => void | Promise<void> }) => {
      const callback = args?.feedbackCallback || feedbackCallback

      feedbackStore.dispatch({
        type: 'SHOW_FEEDBACK',
        payload: {
          feedbackType,
          callback,
        },
      })
    },
    [feedbackCallback, feedbackType]
  )

  const checkTourActive = useCallback(async () => {
    if (tourId) {
      const userJourney = await getUserJourneyOfTourGuide(tourId)
      return !userJourney
    }
    return false
  }, [tourId])

  const handleShowConfetti = useCallback(
    async (keyConfetti: string, tourActive: boolean) => {
      openModal(keyConfetti)

      setTimeout(() => {
        closeModal(keyConfetti)
      }, DELAY_TIME_TO_SHOW_CONFETTI)

      if (tourActive) {
        await saveProgressQuickTourData(tourId as USER_JOURNEY_TYPE, null, 100, true)
      }
    },
    [closeModal, openModal, tourId]
  )

  const handleAfterSaveTemplate = useCallback(
    async (showConfetti = false) => {
      const tourActive = await checkTourActive()

      if (showConfetti) {
        await handleShowConfetti(CONFETTI_QUICK_TOUR_KEY, tourActive)
      }

      if (tourActive) {
        setTimeout(() => {
          openModal(NAVIGATE_TO_INTEGRATION_MODAL_KEY)
        }, DELAY_TIME_TO_SHOW_MODAL)
        return
      }

      showFeedbackForm()
    },
    [checkTourActive, handleShowConfetti, openModal, showFeedbackForm]
  )

  const handleAfterPublishIntegration = useCallback(
    async (args: { shouldShowConfetti?: boolean; shouldShowFeedbackForm?: boolean }) => {
      const { shouldShowConfetti, shouldShowFeedbackForm } = args
      const tourActive = await checkTourActive()

      if (!tourActive && shouldShowConfetti) {
        // Show confetti and trigger Transmitter event to show PTE card in editor
        await handleShowConfetti(CONFETTI_INTEGRATION_QUICK_TOUR_KEY, tourActive)

        // setTimeout(() => {
        //   openModal(isInTrialPeriod ? NAVIGATE_TO_PUBLISH_PRODUCT_MODAL_KEY : NAVIGATE_TO_DISCOVERY_MODAL_KEY)
        // }, DELAY_TIME_TO_SHOW_MODAL)

        /**
         * NOTE: When BFS_COMPLIANCE.DISABLE_AUTO_OPENING_MODALS is true, we will not
         * register any event listeners or show any modals (Shopify requirement 4.3.3).
         */
        if (!isDisableAutoOpeningModals) {
          Transmitter.trigger(GLOBAL_EVENTS_TRANSMITTER.SHOW_PTE_CARD_IN_EDITOR)
        }
        return
      }

      if (!tourActive && shouldShowFeedbackForm) {
        showFeedbackForm()
      }
    },
    [checkTourActive, handleShowConfetti, showFeedbackForm]
  )

  const handleAfterViewLive = useCallback(
    async (args: { modalKeyShow?: string }) => {
      const { modalKeyShow } = args
      const tourActive = await checkTourActive()

      if (tourActive) {
        handleShowConfetti(CONFETTI_INTEGRATION_QUICK_TOUR_KEY, tourActive)

        setTimeout(() => {
          const modalKeyOnTrial = modalKeyShow || NAVIGATE_TO_PUBLISH_PRODUCT_MODAL_KEY
          openModal(isInTrialPeriod ? modalKeyOnTrial : NAVIGATE_TO_DISCOVERY_MODAL_KEY)
        }, DELAY_TIME_TO_SHOW_MODAL)
      }
    },
    [checkTourActive, handleShowConfetti, isInTrialPeriod, openModal]
  )

  const handleAfterSaveOnboarding = useCallback(
    async (saveOnboardingCallback?: () => void) => {
      await showFeedbackForm({
        feedbackCallback: saveOnboardingCallback,
      })
    },
    [showFeedbackForm]
  )

  const handleAfterSaveProviderProduct = useCallback(() => {
    showFeedbackForm()
  }, [showFeedbackForm])

  return {
    showFeedback,
    feedbackCallback,
    showFeedbackForm,
    handleAfterSaveTemplate,
    handleAfterPublishIntegration,
    handleAfterViewLive,
    handleAfterSaveOnboarding,
    handleAfterSaveProviderProduct,
  }
}
