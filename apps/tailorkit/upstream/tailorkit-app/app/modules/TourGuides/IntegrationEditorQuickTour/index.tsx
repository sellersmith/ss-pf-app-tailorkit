import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Fragment } from 'react/jsx-runtime'
import TourGuide from '~/components/TourGuide'
import { useModal } from '~/utils/hooks/useModal'
import type { ITourGuideComponentProps } from '..'
import { COMMON_ERROR } from '~/constants/status'
import { CONFETTI_INTEGRATION_QUICK_TOUR_KEY } from './constants'
import { saveProgressQuickTourData } from '../TemplateEditorQuickTour/fns'
import { type USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { ONE_MINUTE_IN_MILLISECONDS } from '~/constants'
// import { useValidateIntegrationSteps } from './hooks/useValidateIntegrationSteps'
import { useTourStatus } from '~/utils/hooks/useTourStatus'

function IntegrationEditorQuickTour(props: ITourGuideComponentProps) {
  const { flow, tourJourney } = props
  const { t } = useTranslation()
  const { trackEvent } = useEventsTracking()
  // const { appBlock, validateInstallAppBlockStep } = useValidateIntegrationSteps()
  const isInitiallyActive = !tourJourney || !tourJourney.isFinished
  const [tourActive, setTourActive] = useState(isInitiallyActive)

  // Only register in global tour store if this tour is actually active
  const { onSetTour, tourId } = useTourStatus(isInitiallyActive)

  // Don't show the previous step if there is not step `Save`
  // const [prevAttribute, setPrevAttribute] = useState<{ content: string; action: () => void } | undefined>(undefined)
  const { state } = useModal()

  const isConfettiQuickTourActive = state[CONFETTI_INTEGRATION_QUICK_TOUR_KEY]

  const onNext = useCallback(() => {
    const tourGuideCard = document.querySelector('#tour-guide-card')

    if (!tourGuideCard) {
      console.error(COMMON_ERROR)

      return
    }

    const currentIndex = Number(tourGuideCard.getAttribute('data-tour-step-index') || 0)
    // const nextIndex = currentIndex + 1
    // const nextStepId = flow.steps[nextIndex]?.id
    // const nextStepElement = flow.steps[nextIndex]?.element

    // if (nextStepId) {
    // const validCallbackForInstallAppBlock = () => {
    //   setPrevAttribute(undefined)
    //   const btnSaveIntegration = document.querySelector('#btn-save-integration')
    //   btnSaveIntegration?.removeAttribute('aria-disabled')
    //   btnSaveIntegration?.classList.remove('Polaris-Button--disabled')
    // }

    // const invalidCallbackForInstallAppBlock = () => {
    //   setPrevAttribute({
    //     content: t('install-app-block'),
    //     action: () => {
    //       trackEvent(EVENTS_TRACKING.INSTALL_APP_BLOCK)
    //       window.open(appBlock.customizerLink, '_blank')
    //     },
    //   })

    //   const btnSaveIntegration = document.querySelector('#btn-save-integration')
    //   btnSaveIntegration?.setAttribute('aria-disabled', 'true')
    //   btnSaveIntegration?.classList.add('Polaris-Button--disabled')
    // }

    // switch (nextStepElement) {
    //   case '#btn-save-integration':
    //     validateInstallAppBlockStep(validCallbackForInstallAppBlock, invalidCallbackForInstallAppBlock)
    //     break
    // }

    return currentIndex
    // }
  }, [])

  const closeTour = useCallback(() => {
    setTourActive(false)
    if (tourId) onSetTour(tourId, false)
  }, [tourId, onSetTour])

  const markTourAsPermanentlyDismissed = useCallback(async () => {
    try {
      await saveProgressQuickTourData(flow.id as USER_JOURNEY_TYPE, null, 100, true)
    } catch (e) {
      console.error('Failed to save tour dismissal:', e)
    }
    closeTour()
  }, [flow.id, closeTour])

  useEffect(() => {
    if (isConfettiQuickTourActive && !tourJourney) {
      // Send time users need to complete the onboarding
      const startTime = localStorage?.getItem('TLK_ONBOARDING_START_AT')

      if (startTime) {
        trackEvent(EVENTS_TRACKING.COMPLETE_ONBOARDING, {
          // eslint-disable-next-line max-len
          [EVENTS_PARAMETERS_NAME.COMPLETION_MINUTES]: (
            (Date.now() - Number(startTime))
            / ONE_MINUTE_IN_MILLISECONDS
          ).toFixed(2),
        })

        localStorage?.removeItem('TLK_ONBOARDING_START_AT')
      }
    }
  }, [isConfettiQuickTourActive, tourJourney, trackEvent])

  return (
    <Fragment>
      <TourGuide
        flow={flow}
        active={tourActive}
        showProgress
        showSkip={false}
        onNext={{
          content: t('next'),
          action: onNext,
        }}
        // onPrev={prevAttribute}
        onSkip={closeTour}
        onFinish={markTourAsPermanentlyDismissed}
        onDontShowAgain={markTourAsPermanentlyDismissed}
      />
    </Fragment>
  )
}

export default IntegrationEditorQuickTour
