import ProviderIntegration from '~/models/ProviderIntegration.Server'
import Provider from '~/models/Provider.server'
import { EPROVIDER } from '~/constants/fulfillment-providers'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import { notifyPrintWayConnectionLost } from './notifications.server'
import { createPrintWaySdkWithRefresh } from './token-manager.server'

export interface ConnectionHealthResult {
  healthy: boolean
  error?: string
  checkedAt: Date
}

/**
 * Validates a PrintWay API token by listing products with limit=1.
 * PrintWay has no whoami endpoint; a successful product list confirms auth.
 */
export async function checkPrintWayConnection(
  apiToken: string,
  shopDomain = '',
  providerId = ''
): Promise<ConnectionHealthResult> {
  try {
    const sdk = createPrintWaySdkWithRefresh(apiToken, shopDomain, providerId)
    await sdk.products.list({ limit: 1 })
    return { healthy: true, checkedAt: new Date() }
  } catch (error) {
    return { healthy: false, error: formatErrorMessage(error), checkedAt: new Date() }
  }
}

/**
 * Finds the shop's PrintWay integration, checks the connection, and updates connectionStatus.
 * Sends a Slack alert if the token is invalid.
 */
export async function checkAndUpdatePrintWayHealth(shopDomain: string): Promise<ConnectionHealthResult> {
  const provider = await Provider.findOne({ name: EPROVIDER.PRINTWAY })
  if (!provider) {
    return { healthy: false, error: 'PrintWay provider not found', checkedAt: new Date() }
  }

  const integration = await ProviderIntegration.findOne({ shopDomain, providerId: provider._id.toString() })
  if (!integration) {
    return { healthy: false, error: 'No integration found', checkedAt: new Date() }
  }

  const result = await checkPrintWayConnection(integration.apiToken, shopDomain, provider._id.toString())

  if (!result.healthy) {
    await ProviderIntegration.updateOne({ _id: integration._id }, { connectionStatus: 'disconnected' })
    await notifyPrintWayConnectionLost({ shopDomain, error: result.error || 'Unknown error' })
  } else {
    await ProviderIntegration.updateOne({ _id: integration._id }, { connectionStatus: 'connected' })
  }

  return result
}
