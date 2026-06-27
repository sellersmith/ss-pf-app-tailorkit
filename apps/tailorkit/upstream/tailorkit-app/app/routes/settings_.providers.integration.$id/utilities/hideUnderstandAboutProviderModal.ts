import { PROVIDER_INTEGRATION_ACTION } from '~/routes/api.providers-integration.$id/constants'
import { authenticatedFetch } from '~/shopify/fns.client'

export const hideUnderstandAboutProviderModal = async (params: { providerId: string; dontShowAgain: boolean }) => {
  try {
    const { providerId, dontShowAgain } = params
    const res = await authenticatedFetch(`/api/providers-integration/${providerId}`, {
      method: 'POST',
      body: JSON.stringify({ action: PROVIDER_INTEGRATION_ACTION.HIDE_UNDERSTAND_ABOUT_PROVIDER_MODAL, dontShowAgain }),
    })

    if (res?.success) {
      return res
    }

    throw new Error('Failed to hide understand about provider modal')
  } catch (e) {
    console.error(e)
    return null
  }
}
