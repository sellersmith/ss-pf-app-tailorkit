import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { FULFILLMENT_SERVICE_SUBMIT_FULFILLMENT_ORDER_CANCELLATION_REQUEST } from '~/constants/fulfillment-providers'
import { authenticate } from '~/shopify/app.server'
import { ShopifyApiClient } from '~/shopify/graphql/api.server'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import { pollForCancellationOrders } from './fns.server'

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { id: providerName } = params

  const {
    admin,
    payload: { kind },
  } = await authenticate.fulfillmentService(request)

  if (!admin) {
    throw new Response('Unauthorized', { status: 401 })
  }

  const api = new ShopifyApiClient(admin)

  try {
    switch (kind) {
      case 'FULFILLMENT_REQUEST': {
        // Handle fulfillment request

        break
      }
      case 'CANCELLATION_REQUEST': {
        // Handle fulfillment cancellation request
        const fulfillmentOrders = await pollForCancellationOrders(api)

        // Get latest fulfillment order
        const fulfillmentOrder = fulfillmentOrders[0]

        if (!fulfillmentOrder) break

        // Response to order request process
        const {
          node: { id, merchantRequests },
        } = fulfillmentOrder

        // Get latest merchant request
        const { message } = merchantRequests.edges[merchantRequests.edges.length - 1].node

        console.log('CANCELLATION_REQUEST message', message)

        // Only accept the cancellation request if the message equals to FULFILLMENT_SERVICE_SUBMIT_FULFILLMENT_ORDER_CANCELLATION_REQUEST
        // READ MORE: app/constants/fulfillment-providers.ts
        if (message === FULFILLMENT_SERVICE_SUBMIT_FULFILLMENT_ORDER_CANCELLATION_REQUEST) {
          const acceptedOrderMessage = `Order cancellation accepted`
          await api.acceptCancellationRequest(id, acceptedOrderMessage)
        } else {
          const rejectedOrderMessage = `Order cancellation rejected`
          await api.rejectCancellationRequest(id, rejectedOrderMessage)
        }

        break
      }
      default:
        throw new Error(`Unhandled topic: ${kind}`)
    }

    return json({ success: true })
  } catch (error) {
    console.error(`Error handling webhook for ${providerName}:`, formatErrorMessage(error))
    return json({ success: false, error: formatErrorMessage(error) }, { status: 500 })
  }
}
