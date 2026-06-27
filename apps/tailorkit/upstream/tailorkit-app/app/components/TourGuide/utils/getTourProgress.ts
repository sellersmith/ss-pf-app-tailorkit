import { TOUR_ERRORS } from '../constants'

type TourProgress = {
  tourId: string
  stepId: string
  stepIndex: number
  progress: number
}

/**
 * Get tour progress information
 *
 * @returns TourProgress | null
 */
export function getTourProgress(): TourProgress | null {
  const tourGuideCard = document.querySelector('#tour-guide-card')

  if (!tourGuideCard) {
    console.error(TOUR_ERRORS.INVALID_TOUR)

    return null
  }

  const tourId = tourGuideCard.getAttribute('data-tour-id') || ''
  const stepId = tourGuideCard.getAttribute('data-tour-step-id') || ''
  const stepIndex = +(tourGuideCard.getAttribute('data-tour-step-index') || 0)
  const progress = +(tourGuideCard.getAttribute('data-tour-progress') || 0)

  return {
    tourId,
    stepId,
    stepIndex,
    progress,
  }
}
