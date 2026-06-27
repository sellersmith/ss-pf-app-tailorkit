import { FEEDBACK_TYPE } from '~/modules/Feedback/constants'
import { authenticatedFetch } from '~/shopify/fns.client'
import type { OnboardingForm } from '../types'

/**
 * @author KhanhNT
 * Fetches the active onboarding form data for the user.
 *
 * This function makes an authenticated request to fetch onboarding form details
 * based on the `ONBOARDING_FEEDBACK` form type. It utilizes an `AbortController`
 * to cancel any previous ongoing fetch requests before initiating a new one, ensuring
 * that only the latest request is processed.
 *
 * If the API response indicates success, it extracts and returns the form data
 * including its completion status (`isFinished`), the current step and current step data (`currentStep`, `currentStepData`),
 * the form ID (`formId`), and the associated questions (`questions`).
 *
 * In case of errors (e.g., network issues or an aborted request), an error is logged
 * and the function returns `undefined`.
 *
 * @returns {Promise<OnboardingForm | undefined>} - A promise that resolves to the
 * onboarding form data or `undefined` if fetching fails.
 */

export const fetchActiveOnboardingForm = async (): Promise<OnboardingForm | undefined> => {
  try {
    const res = await authenticatedFetch(`/api/feedback?formType=${FEEDBACK_TYPE.ONBOARDING_FEEDBACK}`)

    if (res && res.success) {
      const {
        isFinished = false,
        currentStep = '',
        formId = '',
        questions = [],
        currentStepData = [],
        isShowFirstTime,
      } = res

      return {
        isFinished,
        currentStep,
        formId,
        questions,
        currentStepData,
        isShowFirstTime,
      }
    }
  } catch (error) {
    console.error('Cannot fetch onboarding form: ', error)
  }
}
