import { PROVIDER_CONNECT_ACTION } from '~/routes/api.providers-connection.$id/constants'
import { authenticatedFetch } from '~/shopify/fns.client'

export const checkValidConnection = async (providerId: string, providerName: string) => {
  try {
    const res = await authenticatedFetch(`/api/providers-connection/${providerId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: PROVIDER_CONNECT_ACTION.CHECK_VALID_CONNECTION,
        providerName,
      }),
    })

    if (res && res.success) {
      return res.isValidConnection
    }

    return false
  } catch (err) {
    console.error('Failed to check valid connection: ', err)
    return false
  }
}

/**
 * Check if the provider is connected
 * @param connectStatus
 * @returns
 */
export const checkIsConnectedProvider = (connectStatus: string | undefined) => {
  return connectStatus && connectStatus !== 'disconnect'
}
