import { type LoaderFunctionArgs } from '@remix-run/node'
import { fetchList, json } from '~/bootstrap/fns/fetch.server'
import { EPROVIDER } from '~/constants/fulfillment-providers'
import Provider from '~/models/Provider.server'
import ProviderIntegration from '~/models/ProviderIntegration.Server'
import { Printify } from '~/modules/Fulfillments'
import { ShineOn } from '@sellersmith/shineon-sdk'
import Order from '~/models/Order.server'
import { submitShineOnOrder } from '~/services/shineon/submit-shineon-order.server'
import { checkAndUpdateShineOnHealth } from '~/services/shineon/connection-health.server'
import { createPrintWaySdkWithRefresh } from '~/services/printway/token-manager.server'
import { checkAndUpdatePrintWayHealth } from '~/services/printway/connection-health.server'
import { mapPrintWayProduct } from '~/services/fulfillment/adapters/printway-mappers.server'
import { formatShopifyObjectIdToNumberId } from '~/utils/shopify'
import { SHOPIFY_ORDER_PREFIX } from '~/constants/shopify'
import { appUrl, authenticate } from '~/shopify/app.server'
import { catchAsync } from '~/utils/catchAsync'
import { PROVIDER_CONNECT_ACTION } from '../api.providers-connection.$id/constants'
import {
  getAdvanceBlueprintsProvider,
  getBlueprintsFromPrintify,
} from '../api.providers-connection.$id/Printify/fns.server'
import { sendOrderToProduction } from './orders'
import capitalize from 'lodash/capitalize'
import { sleep } from '~/utils/sleep'
import { getSecond } from '~/constants/time'

export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const {
    session: { shop },
  } = await authenticate.admin(request)

  const res = await fetchList(
    request,
    Provider,
    [
      {
        $addFields: {
          providerIdStr: { $toString: '$_id' },
        },
      },
      {
        $lookup: {
          from: ProviderIntegration.collection.collectionName,
          localField: 'providerIdStr',
          foreignField: 'providerId',
          as: 'ProviderIntegrations',
        },
      },
      {
        $addFields: {
          connectStatus: {
            $cond: {
              if: {
                $and: [
                  { $gt: [{ $size: '$ProviderIntegrations' }, 0] }, // Check if integrations exist
                  {
                    $anyElementTrue: {
                      $map: {
                        input: '$ProviderIntegrations',
                        as: 'integration',
                        in: {
                          $and: [
                            { $eq: ['$$integration.shopDomain', shop] },
                            { $ifNull: ['$$integration.apiToken', false] },
                          ],
                        },
                      },
                    },
                  },
                ],
              },
              then: 'connected',
              else: 'disconnect',
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          detailsUrl: 1,
          logoUrl: 1,
          status: 1,
          recommended: 1,
          createdAt: 1,
          updatedAt: 1,
          providerIdStr: 1,
          connectStatus: 1,
        },
      },
    ],
    [],
    true
  )

  return json(res)
})

export const action = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const {
    session: { shop },
  } = await authenticate.admin(request)

  const payload = (await request.json()) || {}
  const { action, vendor, data } = payload

  // TODO: This code needs to update to handle provider action dynamically
  switch (action) {
    case PROVIDER_CONNECT_ACTION.Printify.GET_BLUEPRINTS_LIST: {
      const { providerId } = payload
      const providerIntegration = await ProviderIntegration.findOne({ providerId, shopDomain: shop })
      const apiToken = providerIntegration.apiToken
      const blueprintsList = await getBlueprintsFromPrintify(apiToken)

      return json({ success: !!blueprintsList, blueprintsList })
    }
    case PROVIDER_CONNECT_ACTION.Printify.GET_ADVANCE_BLUEPRINTS_LIST: {
      const { blueprintId } = payload
      const providerData = await getAdvanceBlueprintsProvider(blueprintId)

      return json({ success: !!providerData, providerData: providerData ? { ...providerData, id: blueprintId } : null })
    }

    case PROVIDER_CONNECT_ACTION.ShineOn.GET_PRODUCT_TEMPLATES: {
      const { providerId } = payload
      const providerIntegration = await ProviderIntegration.findOne({ providerId, shopDomain: shop })
      const apiToken = providerIntegration?.apiToken

      if (!apiToken) {
        return json({ success: false, error: 'API token not found' })
      }

      const shineOn = new ShineOn({ token: apiToken })
      const response = await shineOn.productTemplates.list()

      return json({ success: true, productTemplates: response.product_templates })
    }
  }

  switch (vendor) {
    case EPROVIDER.PRINTIFY: {
      const providerIntegrationByShop = await ProviderIntegration.findOne({ shopDomain: shop })

      if (!providerIntegrationByShop) break

      const { apiToken, shopId } = providerIntegrationByShop

      const printify = new Printify({
        accessToken: apiToken,
        shopId,
      })

      // Dynamically defined action
      const [module, method] = action.split('.')
      if (printify[module] && printify[module][method]) {
        const fnc = printify[module][method]

        switch (action) {
          // TODO: Remove webhook after uninstalling TailorKit app
          case 'webhooks.create': {
            const webhookUrl = `${appUrl}/api/public/${vendor.toLocaleLowerCase()}/webhooks`

            const topic = data.topic
            const webhooks = await printify.webhooks.getList()

            // Check this webhook if existing
            const isExisted = webhooks.find(webhook => webhook.topic === topic && webhook.url === webhookUrl)
            if (isExisted) {
              break
            }

            await fnc({
              topic: data.topic,
              url: webhookUrl,
            })

            break
          }

          case 'webhooks.deleteOne': {
            const topic = data.topic
            const webhooks = await printify.webhooks.getList()

            const webhooksByTopic = webhooks.filter(webhook => webhook.topic === topic)

            // Delete list webhooks by specific topic
            await Promise.all(webhooksByTopic.map(webhook => fnc(webhook.id)))

            break
          }

          // case 'orders.submit': {
          //   const response = await submitOrder({
          //     payloadData: { orderId: data.orderId, fulfillmentOrderId: data.fulfillmentOrderId },
          //     shopDomain: shop,
          //     vendor,
          //     shop_id: shopId,
          //     callback: fnc,
          //   })

          //   return json({
          //     success: true,
          //     fulfillmentOrderId: response.id,
          //   })
          // }

          case 'orders.sendToProduction': {
            const response = await sendOrderToProduction({
              payloadData: data,
              shopDomain: shop,
              vendor,
              shop_id: shopId,
              callback: fnc,
            })

            // TODO: Optimize to remove duplicated code
            // Sleep 5 seconds for Printify checking order is valid or not
            await sleep(getSecond(5))

            // Get order status
            const fulfillmentOrder = await printify.orders.getOne(response.id)

            if (!fulfillmentOrder) {
              throw new Error('Fulfillment order is not found')
            }

            const { status } = fulfillmentOrder

            if (status === 'payment-not-received' || status === 'has-issues') {
              throw new Error(capitalize(status.split('-').join(' ')))
            }

            return json({
              success: true,
              response,
            })
          }
        }
      }
      break
    }

    case EPROVIDER.SHINEON: {
      const providerIntegrationByShop = await ProviderIntegration.findOne({
        shopDomain: shop,
        providerId: (await Provider.findOne({ name: EPROVIDER.SHINEON }))?._id,
      })

      if (!providerIntegrationByShop) break

      const { apiToken } = providerIntegrationByShop
      const shineOn = new ShineOn({ token: apiToken })

      switch (action) {
        case 'orders.sendToProduction': {
          const response = await sendOrderToProduction({
            payloadData: data,
            shopDomain: shop,
            vendor: EPROVIDER.SHINEON,
            shop_id: 'shineon',
            callback: (fulfillmentOrderId: string) => shineOn.orders.ready(fulfillmentOrderId),
          })

          return json({
            success: true,
            response,
          })
        }

        case 'orders.retryFulfillment': {
          if (!data?.orderId) throw new Error('Order ID is required')
          const orderId = +formatShopifyObjectIdToNumberId(data.orderId, SHOPIFY_ORDER_PREFIX)

          // Idempotency: check if ShineOn already has this order
          const order = await Order.findOne({ shopDomain: shop, id: orderId })
          if (!order) throw new Error('Order not found')

          const lineItems = order.line_items as Array<{
            vendor?: string
            fulfillment_order_submitted?: { orderId?: string }
          }>
          const shineOnItem = lineItems.find(li => li.vendor === EPROVIDER.SHINEON)
          const existingShineOnOrderId = shineOnItem?.fulfillment_order_submitted?.orderId

          if (existingShineOnOrderId) {
            // Check if the order still exists and is active on ShineOn
            try {
              const existingResponse = await shineOn.orders.get(existingShineOnOrderId)
              const existingOrder = existingResponse.order
              if (existingOrder && existingOrder.status !== 'cancelled') {
                return json({ success: true, alreadySubmitted: true, status: existingOrder.status })
              }
            } catch {
              // Order not found on ShineOn, safe to resubmit
            }
          }

          // Single attempt for user-initiated retry (no exponential backoff to avoid HTTP timeout)
          const response = await submitShineOnOrder({
            orderId,
            shopDomain: shop,
            callback: submitData => shineOn.orders.create(submitData),
          })

          return json({ success: true, response })
        }

        case 'checkConnectionHealth': {
          const result = await checkAndUpdateShineOnHealth(shop)
          return json({ success: true, ...result })
        }
      }
      break
    }

    case EPROVIDER.PRINTWAY: {
      const providerIntegrationByShop = await ProviderIntegration.findOne({
        shopDomain: shop,
        providerId: (await Provider.findOne({ name: EPROVIDER.PRINTWAY }))?._id,
      })

      if (!providerIntegrationByShop) break

      const { apiToken } = providerIntegrationByShop
      const providerId = String(providerIntegrationByShop.providerId)
      const printway = createPrintWaySdkWithRefresh(apiToken, shop, providerId)

      switch (action) {
        case 'webhooks.create': {
          const secret = process.env.PRINTWAY_WEBHOOK_SECRET
          if (!secret) {
            console.warn('[PrintWay] PRINTWAY_WEBHOOK_SECRET not set — skipping webhook registration')
            break
          }
          const baseWebhookUrl = `${appUrl}/api/public/printway/webhooks`

          // Register both tracking and order status webhooks
          await printway.webhooks.create('tracking', {
            endpoint: `${baseWebhookUrl}?type=tracking`,
            access_key: secret,
          })
          await printway.webhooks.create('order', {
            endpoint: `${baseWebhookUrl}?type=order`,
            access_key: secret,
          })
          break
        }

        case 'checkConnectionHealth': {
          const result = await checkAndUpdatePrintWayHealth(shop)
          return json({ success: true, ...result })
        }

        case 'get-printway-products': {
          const response = await printway.products.list({ limit: data?.limit || 50, page: data?.page || 1 })
          const products = (response.data || []).map(mapPrintWayProduct)
          return json({ success: true, products })
        }
      }
      break
    }
  }

  return json({ success: true })
})
