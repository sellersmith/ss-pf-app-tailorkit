import { FEEDBACK_TYPE } from '~/modules/Feedback/constants'
import { authenticatedFetch } from '~/shopify/fns.client'

/**
 * @author KhanhNT
 * Sends onboarding feedback to the server.
 *
 * This function takes a form ID and the corresponding answers data, adds the local timestamp
 * to the answers, and submits the data to a specific API endpoint for onboarding feedback.
 * If the submission fails, an error is logged to the console.
 *
 * @param {string} formId - The ID of the form being submitted.
 * @param {any} answersData - The answers data associated with the form.
 */
export const sendOnboardingFeedback = async (formId: string, answersData: any) => {
  try {
    const now = new Date()
    answersData['localTime'] = now.toString()

    await authenticatedFetch(`/api/feedback?formType=${FEEDBACK_TYPE.ONBOARDING_FEEDBACK}`, {
      method: 'POST',
      body: JSON.stringify({ [formId]: answersData }),
    })
  } catch (err) {
    console.error('Failed to send onboarding feedback ', err)
  }
}
