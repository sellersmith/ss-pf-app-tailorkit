import { USER_JOURNEY_ACTIONS } from '~/routes/api.user-journey/constants'
import { authenticatedFetch } from '~/shopify/fns.client'
import { formatErrorMessage } from '~/utils/formatErrorMessage'

/**
 * @description Get user milestones data
 * @returns
 */
export async function getUserMilestonsData() {
  try {
    const response = await authenticatedFetch(
      `/api/user-journey?action=${USER_JOURNEY_ACTIONS.CHECK_AND_UPDATE_USER_MILESTONE}`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    )

    if (!response.success) {
      throw new Error(response.message)
    }

    return response.userJourney
  } catch (e) {
    throw new Error(formatErrorMessage(e))
  }
}
