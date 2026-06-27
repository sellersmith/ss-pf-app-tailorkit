import type { FeedbackData, OnboardingData } from '~/models/UserJourney'
import { type FEEDBACK_TYPE } from '~/modules/Feedback/constants'
import { USER_JOURNEY_ACTIONS, USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'
import { authenticatedFetch } from '~/shopify/fns.client'
import { CHAT_BOX_SESSION_FLAG_KEY } from '~/components/AIChat/constants'

/**
 * @author KhanhNT
 * Saves the user's journey progress to the server.
 *
 * @param {USER_JOURNEY_TYPE} [type] - The type of the user's journey.
 * @param {OnboardingData[]} data - The onboarding data to be saved.
 * @param {string} currentStep - The current step the user is on.
 * @param {boolean} [isFinished] - Indicates if the onboarding process is completed.
 *
 * The function performs the following tasks:
 * 1. If a previous fetch request is still active, it aborts the request using `fetchController`.
 * 2. Creates a new `AbortController` instance for the current fetch request.
 * 3. Sends a POST request to the `/api/user-journey` endpoint to save the onboarding progress.
 *    - Includes the onboarding data, the current step, and whether the process is finished in the request body.
 * 4. Handles any errors during the request and logs them to the console.
 */

let fetchController: AbortController | null = null

export const saveUserJourneyProgress = async (args: {
  type?: USER_JOURNEY_TYPE | FEEDBACK_TYPE
  data: OnboardingData[] | FeedbackData[]
  currentStep?: string
  isFinished?: boolean
}) => {
  const { type = USER_JOURNEY_TYPE.ONBOARDING, data, currentStep, isFinished } = args

  try {
    if (fetchController) {
      fetchController.abort()
    }

    fetchController = new AbortController()
    const { signal } = fetchController

    const res = await authenticatedFetch(
      `/api/user-journey?action=${USER_JOURNEY_ACTIONS.SAVE_ONBOARDING_PROGRESS_STATE}`,
      {
        method: 'POST',
        body: JSON.stringify({
          type,
          data,
          currentStep,
          isFinished,
          openTemplateEditor: type === USER_JOURNEY_TYPE.ONBOARDING,
        }),
        signal,
      }
    )

    if (res && res.success) {
      return {
        returnUrl: res.returnUrl,
      }
    }
  } catch (err) {
    console.error('Failed to save progress onboarding ', err)
  }
}

/**
 * @author KhanhNT
 * Marks the AI onboarding as completed.
 *
 * This function sends a POST request to the `/api/preferences` endpoint to update the `ai_onboarding_completed_ver_1`
 * occurred event in the app config. It handles any errors during the request and logs them to the console.
 */
export const markAiOnboardingCompleted = async () => {
  await authenticatedFetch('/api/preferences', {
    method: 'POST',
    body: JSON.stringify({
      action: 'UPDATE_OCCURRED_EVENT',
      eventName: 'ai_onboarding_completed_ver_1',
      value: true,
    }),
  }).catch(() => {})

  // Set the flag to prevent auto-open of AI chat on first app load
  sessionStorage.setItem(CHAT_BOX_SESSION_FLAG_KEY, '1')

  // TODO: Temporary disable to debug mixpanel events issues.
  // Clear onboarding tracking flags so they can be used again in future onboarding sessions
  // localStorage.removeItem('TLK_STARTED_ONBOARDING')
  // localStorage.removeItem('TLK_ONBOARDING_START_AT')
}
