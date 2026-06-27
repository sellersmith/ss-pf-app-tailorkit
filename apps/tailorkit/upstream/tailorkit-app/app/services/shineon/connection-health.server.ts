import ProviderIntegration from '~/models/ProviderIntegration.Server'
import { notifyShineOnConnectionLost } from './notifications.server'
import { EPROVIDER } from '~/constants/fulfillment-providers'
import Provider from '~/models/Provider.server'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import { ShineOn } from '@sellersmith/shineon-sdk'

export interface ConnectionHealthResult {
  healthy: boolean
  error?: string
  checkedAt: Date
}

export async function checkShineOnConnection(apiToken: string): Promise<ConnectionHealthResult> {
  try {
    const sdk = new ShineOn({ token: apiToken })
    await sdk.whoami()

    return { healthy: true, checkedAt: new Date() }
  } catch (error) {
    return { healthy: false, error: formatErrorMessage(error), checkedAt: new Date() }
  }
}

export async function checkAndUpdateShineOnHealth(shopDomain: string): Promise<ConnectionHealthResult> {
  const provider = await Provider.findOne({ name: EPROVIDER.SHINEON })
  if (!provider) {
    return { healthy: false, error: 'ShineOn provider not found', checkedAt: new Date() }
  }

  const integration = await ProviderIntegration.findOne({ shopDomain, providerId: provider._id.toString() })
  if (!integration) {
    return { healthy: false, error: 'No integration found', checkedAt: new Date() }
  }

  const result = await checkShineOnConnection(integration.apiToken)

  if (!result.healthy) {
    await ProviderIntegration.updateOne({ _id: integration._id }, { connectionStatus: 'disconnected' })
    await notifyShineOnConnectionLost({ shopDomain, error: result.error || 'Unknown error' })
  } else {
    await ProviderIntegration.updateOne({ _id: integration._id }, { connectionStatus: 'connected' })
  }

  return result
}
