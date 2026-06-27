import type { AdminApiContext } from 'node_modules/@shopify/shopify-app-remix/dist/ts/server/clients'
import crypto from 'crypto'
import fetch from 'node-fetch'
import { INVALID_REQUEST } from '~/constants/errors'
import Shop, { getShopData } from '~/models/Shop.server'
import { getAppHandle } from '~/shopify/fns.server'
import type { SubscriptionDocument } from '~/models/Subscription'
import { getEndDate } from '~/bootstrap/fns/date'

const customerioSiteId = process.env.CUSTOMERIO_SITE_ID
const customerioApiKey = process.env.CUSTOMERIO_API_KEY
const customerioBetaApiKey = process.env.CUSTOMERIO_APP_API_KEY

const customerioApiUrl = 'https://track.customer.io/api/v1'
const customerioBetaApiUrl = 'https://beta-api.customer.io/v1/api'

const headers = {
  'Content-Type': 'application/json',
}

/**
 * Method that sends a request to customer.io API.
 *
 * @param endPoint The API end-point to send request to.
 * @param method   Method to send the request.
 * @param postData The payload to post.
 *
 * @returns {Promise<any>}
 */
export async function requestCustomerIoApi(endPoint: string, method = 'GET', postData: any = undefined): Promise<any> {
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
    throw new Error(INVALID_REQUEST)
  }

  return fetch(`${customerioApiUrl}/${endPoint}`, {
    method,
    headers: {
      ...headers,
      Authorization: `Basic ${Buffer.from(`${customerioSiteId}:${customerioApiKey}`).toString('base64')}`,
    },
    ...(postData ? { body: JSON.stringify(postData) } : {}),
  })
    .then(res => res.json())
    .catch(console.error)
}

/**
 * Method that sends a request to the Beta API of customer.io
 *
 * @param endPoint    The API end-point to send request to.
 * @param queryString The query string to append to the end-point.
 * @param method      Method to send the request.
 * @param postData    The payload to post.
 *
 * @returns {Promise<any>}
 */
export function requestCustomerIoBetaApi(
  endPoint: string,
  queryString = '',
  method = 'get',
  postData = undefined
): Promise<any> {
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
    throw new Error(INVALID_REQUEST)
  }

  return fetch(`${customerioBetaApiUrl}/${endPoint}${queryString ? `${queryString}` : ''}`, {
    method,
    headers: {
      ...headers,
      Authorization: `Bearer ${customerioBetaApiKey}`,
    },
    ...(postData ? { body: JSON.stringify(postData) } : {}),
  })
    .then(res => res.json())
    .catch(console.error)
}

/**
 * Method that posts an event to customer.io
 *
 * @param shopDomain  The shop domain where event occurs.
 * @param eventName   Name of event to post.
 * @param eventData   Data to send along with event.
 * @param noDuplicate Whether to post event if posted before.
 *
 * @returns {Promise<any>}
 */
export async function postEventToCustomerIo(params: {
  admin?: AdminApiContext<any, any>
  shopDomain: string
  eventName: string
  eventData: any
  noDuplicate?: boolean
}): Promise<any> {
  const { admin, shopDomain, eventName, eventData = {}, noDuplicate = false } = params

  // Get shop data
  const shopData = await getShopData(shopDomain)
  const occurredEvents = shopData?.appConfig?.occurredEvents || {}

  if (!shopData?.shopConfig || (noDuplicate && occurredEvents[eventName])) {
    return null
  }

  const shopName = shopData.shopConfig.name
  const ownerName = shopData.shopConfig.shop_owner || shopName
  const email = shopData.shopConfig.customer_email || shopData.shopConfig.email

  // Get trial end date
  const { shopifyCharge } = (shopData.subscription as SubscriptionDocument) || {}

  let trialEndsOn = shopifyCharge?.trial_ends_on || shopifyCharge?.activated_on || shopData.createdAt
  trialEndsOn = typeof trialEndsOn === 'string' ? getEndDate(trialEndsOn) : trialEndsOn

  // Sync user data to people profile at customer.io first.
  const [firstName, lastName] = ownerName.split(' ', 2)

  const peopleId = await syncUserDataToCustomerIo(email, {
    lastName,
    firstName,
    ownerName,
    unsubscribed: false,
  })

  let appHandle = null

  // Prepare post data.
  appHandle = await getAppHandle(shopDomain, admin).catch(console.error)

  const data = {
    data: {
      email,
      shopName,
      ownerName,
      appHandle,
      shopDomain,
      trialEndsOn,
      ...eventData,
    },
    name: eventName,
  }

  // Save last event to shop atomically to avoid overwriting other occurredEvents keys
  const eventCounterPath = `appConfig.occurredEvents.${eventName}`

  // Fix: Ensure appConfig exists before using $inc (MongoDB can't create nested fields in null parent)
  // First, initialize appConfig if it's null (this is idempotent - won't affect existing data)
  await Shop.updateOne({ shopDomain, appConfig: null }, { $set: { appConfig: {} } })

  // Now increment the event counter safely
  await Shop.updateOne({ shopDomain }, { $inc: { [eventCounterPath]: 1 } })

  // Post event to customer.io
  return requestCustomerIoApi(`customers/${peopleId}/events`, 'post', data)
}

/**
 * Sends an anonymous event to customer.io
 *
 * @param eventName Name of event to post.
 * @param eventData Data to send along with event.
 * @param recipient Recipient name.
 *
 * @returns {Promise<any>}
 */
export async function postAnonymousEventToCustomerIo(
  eventName: string,
  eventData = {},
  recipient: string
): Promise<any> {
  const data = {
    data: {
      recipient,
      ...eventData,
    },
    name: eventName,
  }

  // Post event to Customer.io
  return requestCustomerIoApi(`events`, 'post', data)
}

/**
 * Method that synchronizes user data to email profile at customer.io
 *
 * @param email       Email to create/update people profile.
 * @param customAttrs Custom attributes to send along with the request.
 *
 * @returns {Promise<any>}
 */
export async function syncUserDataToCustomerIo(email: string, customAttrs = {}): Promise<any> {
  // Verify email.
  if (!email) {
    throw new Error(INVALID_REQUEST)
  }

  // Get people profile from customer.io
  const { results: profiles }
    = (await requestCustomerIoBetaApi('customers', `?email=${encodeURIComponent(email)}`)) || {}

  // Init user data.
  const data = {
    email,
    ...customAttrs,
  }

  // Either add a new or update an existing people profile at customer.io
  const id = profiles?.[0] ? profiles[0].id : hashEmail(email)

  await requestCustomerIoApi(`customers/${id}`, 'put', data)

  return id
}

function hashEmail(email: string) {
  const hash = crypto.createHash('md5')

  hash.update(email)

  return hash.digest('hex')
}
