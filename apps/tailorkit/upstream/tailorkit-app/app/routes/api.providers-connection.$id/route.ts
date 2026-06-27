import { type LoaderFunctionArgs } from '@remix-run/node'
import Provider from '~/models/Provider.server'
import ProviderIntegration from '~/models/ProviderIntegration.Server'
import { authenticate } from '~/shopify/app.server'
import { catchAsync } from '~/utils/catchAsync'
import { PROVIDER_CONNECT_ACTION } from './constants'
import { getShopsListFromPrintify } from './Printify/fns.server'
import TemporaryProductData from '~/models/TemporatyProductData'
import TemporaryFulfillmentProducts from '~/models/TemporaryFulfillmentProducts.server'
import { subscribeTailorKitFulfillmentService } from '~/shopify/fns.server'
import { EPROVIDER } from '~/constants/fulfillment-providers'
import { json } from '~/bootstrap/fns/fetch.server'
import Shop from '~/models/Shop.server'
import { checkShineOnConnection } from '~/services/shineon/connection-health.server'
import { checkPrintWayConnection } from '~/services/printway/connection-health.server'

export const loader = catchAsync(async ({ params, request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const providerId = params.id || ''
  const providerIntegrationData = await ProviderIntegration.findOne({ shopDomain, providerId })
  const providerInfo = await Provider.findOne({ _id: providerId })

  return json({ providerIntegrationData, providerInfo })
})

export const action = catchAsync(async ({ params, request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
    admin,
  } = await authenticate.admin(request)

  // Get params from url
  const providerId = params.id || ''

  const payload = (await request.json()) || {}
  const { action } = payload

  switch (action) {
    case PROVIDER_CONNECT_ACTION.SAVE_PROVIDER_INTEGRATION_DATA: {
      const { apiToken, shopId, autoFulfill, providerId } = payload

      const fulfillmentProvider = await Provider.findOne({ _id: providerId })

      if (!fulfillmentProvider) {
        throw new Error('Provider not found')
      }

      const fulfillmentProviderName = fulfillmentProvider.name

      // Subscribe Tailorkit x X (fulfillment provider name) location on Shopify
      await subscribeTailorKitFulfillmentService(admin, fulfillmentProviderName)

      // Update or create provider integration for user
      const providerIntegration = await ProviderIntegration.findOneAndUpdate(
        { shopDomain, providerId },
        { apiToken, shopId, autoFulfill },
        { upsert: true }
      )

      // Clear flag that indicates the provider has not been connected to TailorKit
      await Shop.updateOne(
        { shopDomain },
        { $unset: { [`appConfig.requiredFulfillmentServices.${fulfillmentProvider.name}`]: 1 } }
      )

      return json({ success: true, providerIntegration })
    }

    case PROVIDER_CONNECT_ACTION.DISCONNECT_PROVIDER_INTEGRATION: {
      const { providerId } = payload

      await TemporaryProductData.deleteMany({ shopDomain, providerId })
      await TemporaryFulfillmentProducts.deleteMany({ shopDomain, providerId })
      const providerIntegration = await ProviderIntegration.findOneAndDelete({ shopDomain, providerId })

      return json({ success: true, providerIntegration })
    }

    case PROVIDER_CONNECT_ACTION.CHECK_VALID_CONNECTION: {
      const { providerName, apiToken: payloadApiToken } = payload
      // Fetches the provider integration and only populates the provider's name field.
      const providerIntegration = await ProviderIntegration.findOne({ shopDomain, providerId })
      const apiToken = payloadApiToken || providerIntegration?.apiToken

      switch (providerName) {
        case EPROVIDER.PRINTIFY: {
          const shopsList = await getShopsListFromPrintify(apiToken)
          return json({ success: true, isValidConnection: !!shopsList })
        }
        case EPROVIDER.SHINEON: {
          if (!apiToken) return json({ success: true, isValidConnection: false })
          const healthResult = await checkShineOnConnection(apiToken)
          return json({ success: true, isValidConnection: healthResult.healthy })
        }
        case EPROVIDER.PRINTWAY: {
          if (!apiToken) return json({ success: true, isValidConnection: false })
          const healthResult = await checkPrintWayConnection(apiToken)
          return json({ success: true, isValidConnection: healthResult.healthy })
        }
        default:
          return json({ success: true, isValidConnection: false })
      }
    }

    case PROVIDER_CONNECT_ACTION.Printify.GET_SHOPS_LIST: {
      const { apiToken } = payload
      let shopsList = await getShopsListFromPrintify(apiToken)

      if (shopsList) {
        // Fetch all provider integrations in one query
        const providerIntegrations = await ProviderIntegration.find({
          providerId,
          shopDomain: { $ne: shopDomain },
          shopId: { $in: shopsList.map(shop => [shop.value, Number(shop.value), String(shop.value)]).flat() },
        })

        // Create a Set of connected shop IDs
        const connectedShopIds = new Set(providerIntegrations.map(integration => integration.shopId))

        // Filter out connected shops
        shopsList = shopsList.filter(shop => {
          const shopId = shop.value

          // Check if the shopId is not in the connectedShopIds Set in any form (string or number)
          const hasShopId = connectedShopIds.has(shopId)
          const hasShopIdNumber = connectedShopIds.has(Number(shopId))
          const hasShopIdString = connectedShopIds.has(String(shopId))

          return !hasShopId && !hasShopIdNumber && !hasShopIdString
        })
      }

      return json({ success: shopsList ? true : false, shopsList })
    }
  }

  return json({ success: true })
})
