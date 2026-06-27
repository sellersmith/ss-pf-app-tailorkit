import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import TourGuide from '~/components/TourGuide'
import type { GuidedTourFlow } from '~/components/TourGuide/types'
import type { USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'
import { saveProgressQuickTourData } from '~/modules/TourGuides/TemplateEditorQuickTour/fns'
import { tourStore } from '~/stores/tour'

interface VectorEditorTourProps {
  flow: GuidedTourFlow
  active: boolean
  onClose: () => void
}

/**
 * Reusable tour component for VectorEditor tours (edit mode + draw mode).
 * Follows the "always show until Don't Show Again" pattern.
 */
export default function VectorEditorTour({ flow, active, onClose }: VectorEditorTourProps) {
  const { t } = useTranslation()
  const [tourActive, setTourActive] = useState(active)

  const closeTour = useCallback(() => {
    setTourActive(false)
    tourStore.dispatch({ type: 'SET_TOUR', payload: { key: flow.id, active: false } })
    onClose()
  }, [flow.id, onClose])

  const markTourAsPermanentlyDismissed = useCallback(async () => {
    try {
      await saveProgressQuickTourData(flow.id as USER_JOURNEY_TYPE, null, 100, true)
    } catch (e) {
      console.error('Failed to save tour dismissal:', e)
    }
    closeTour()
  }, [flow.id, closeTour])

  const onNext = useCallback(() => {
    const tourGuideCard = document.querySelector('#tour-guide-card')
    if (!tourGuideCard) return 0
    return Number(tourGuideCard.getAttribute('data-tour-step-index') || 0)
  }, [])

  if (!tourActive) return null

  return (
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
  )
}
