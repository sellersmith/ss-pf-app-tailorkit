import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Fragment } from 'react/jsx-runtime'
import TourGuide from '~/components/TourGuide'
import type { ITourGuideComponentProps } from '..'
import { saveProgressQuickTourData } from './fns'
import type { USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'
import { useTourStatus } from '~/utils/hooks/useTourStatus'

function TemplateEditorQuickTour(props: ITourGuideComponentProps) {
  const { flow, tourJourney } = props
  const { t } = useTranslation()

  // Active state derives from user journey progress
  const isInitiallyActive = !tourJourney || !tourJourney.isFinished
  const [tourActive, setTourActive] = useState(isInitiallyActive)

  // Only register in global tour store if this tour is actually active
  const { onSetTour, tourId } = useTourStatus(isInitiallyActive)

  const onNext = useCallback(() => {
    const tourGuideCard = document.querySelector('#tour-guide-card')

    if (!tourGuideCard) {
      return 0
    }

    const currentIndex = Number(tourGuideCard.getAttribute('data-tour-step-index') || 0)

    return currentIndex
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
        onSkip={closeTour}
        onFinish={markTourAsPermanentlyDismissed}
        onDontShowAgain={markTourAsPermanentlyDismissed}
      />
    </Fragment>
  )
}

export default TemplateEditorQuickTour
