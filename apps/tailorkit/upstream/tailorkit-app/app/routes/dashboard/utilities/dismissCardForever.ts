import { PREFERENCES_ACTIONS } from '~/routes/api.preferences/constants'
import { authenticatedFetch } from '~/shopify/fns.client'

export async function dismissCardForever(cardName: string, isDeleting: boolean = false) {
  try {
    const response = await authenticatedFetch('/api/preferences', {
      method: 'POST',
      body: JSON.stringify({
        action: PREFERENCES_ACTIONS.UPDATE_OCCURRED_EVENT,
        eventName: cardName,
        value: !isDeleting,
      }),
    })

    if (!response.success) {
      throw new Error(`Failed to dismiss card ${cardName} forever`)
    }

    return true
  } catch (error) {
    console.error(error)
    return false
  }
}
