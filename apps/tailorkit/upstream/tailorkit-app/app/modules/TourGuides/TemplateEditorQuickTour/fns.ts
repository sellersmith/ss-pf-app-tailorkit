import { isTutorialGuide } from '~/bootstrap/hoc/withTourGuide'
import type { USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'
import { USER_JOURNEY_ACTIONS } from '~/routes/api.user-journey/constants'
import { authenticatedFetch } from '~/shopify/fns.client'

/**
 * Save progress of quick tour
 *
 * @param type USER_JOURNEY_TYPE
 * @param currentStepKey string | null
 * @param isFinished false
 */
export const saveProgressQuickTourData = async (
  type: USER_JOURNEY_TYPE,
  currentStepKey: string | null,
  progress = 0,
  isFinished = false
) => {
  try {
    // Check if the current flow is a tutorial
    const isTutorial = isTutorialGuide(type)

    // Don't save the progress of the tutorial, but allow permanent dismissal
    if (isTutorial && !isFinished) return

    await authenticatedFetch(`/api/user-journey?action=${USER_JOURNEY_ACTIONS.SAVE_ONBOARDING_PROGRESS_STATE}`, {
      method: 'POST',
      body: JSON.stringify({
        type,
        currentStep: currentStepKey,
        progress,
        isFinished,
      }),
    })
  } catch (err) {
    console.error('Failed to save progress onboarding ', err)
  }
}

/**
 * Start the integration editor quick tour
 *
 * @param isTutorial
 * @returns
 */
export const startIntegrationEditorQuickTour = async (isTutorial = false) => {
  const response = await authenticatedFetch(`/api/user-journey?action=${USER_JOURNEY_ACTIONS.START_INTEGRATION_TOUR}`, {
    method: 'POST',
    body: JSON.stringify({
      isTutorial,
    }),
  })

  return response
}

/**
 * Start the template editor quick tour
 *
 * @param isTutorial
 * @returns
 */
export const startTemplateEditorQuickTour = async (templateId: string, isTutorial = false) => {
  const response = await authenticatedFetch(`/api/user-journey?action=${USER_JOURNEY_ACTIONS.START_TEMPLATE_TOUR}`, {
    method: 'POST',
    body: JSON.stringify({
      isTutorial,
      templateId,
    }),
  })

  return response
}
