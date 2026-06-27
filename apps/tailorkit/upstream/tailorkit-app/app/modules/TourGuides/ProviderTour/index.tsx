import { Fragment, useCallback, useMemo, useState } from 'react'
import TourGuide from '~/components/TourGuide'
import type { USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'
import type { ITourGuideComponentProps } from '..'
import { saveProgressQuickTourData } from '../TemplateEditorQuickTour/fns'
import { ModalProviderTourNavigateToDiscovery } from './ModalNavigateToDiscovery'

function ProviderTour(props: ITourGuideComponentProps) {
  const { flow, tourJourney } = props

  // Disable if tour has already existed and user explicitly dismissed it
  const canOpenTour = tourJourney === null || !tourJourney?.isFinished
  const [tourActive, setTourActive] = useState(canOpenTour)

  const closeTour = useCallback(() => {
    setTourActive(false)
  }, [])

  const markTourAsPermanentlyDismissed = useCallback(async () => {
    try {
      await saveProgressQuickTourData(flow.id as USER_JOURNEY_TYPE, null, 100, true)
    } catch (e) {
      console.error('Failed to save tour dismissal:', e)
    }
    closeTour()
  }, [flow.id, closeTour])

  const onNextHandler = useMemo(
    () => ({
      content: 'Next',
      action: () => {},
    }),
    []
  )

  return (
    <Fragment>
      <TourGuide
        flow={flow}
        startStepId={tourJourney?.currentStep}
        active={tourActive}
        onNext={onNextHandler}
        onSkip={closeTour}
        onFinish={markTourAsPermanentlyDismissed}
        onDontShowAgain={markTourAsPermanentlyDismissed}
      />

      {/* Do not show the congratulation modal if this is a tutorial guide */}
      {/* {isProviderTourCongratulationsModalActive && <ModalProviderTourNavigateToDiscovery />} */}
      <ModalProviderTourNavigateToDiscovery />
    </Fragment>
  )
}

export default ProviderTour
