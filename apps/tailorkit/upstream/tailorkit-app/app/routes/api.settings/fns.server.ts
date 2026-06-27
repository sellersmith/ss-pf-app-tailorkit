import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { trackEvent } from '~/bootstrap/fns/mixpanel.server'
import { postToSlackChannelWhenUninstall } from '~/bootstrap/fns/slack.server'
import { ONE_DAY_IN_MILLISECONDS } from '~/constants'
import { clearShopConfigs, getShopData } from '~/models/Shop.server'
import type { SubscriptionDocument } from '~/models/Subscription'
import UserJourney from '~/models/UserJourney.server'
import { postEventToCustomerIo, syncUserDataToCustomerIo } from '~/modules/customer.io/api.server'
import { CUSTOMERIO_EVENTS } from '~/modules/customer.io/constants'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import ShopLifecycleEvent, { LifecycleEventType } from '~/models/ShopLifecycleEvent.server'

/**
 * Uninstall app by revoking permission
 *
 * @see https://shopify.dev/docs/apps/build/authentication-authorization/app-installation/uninstall-app-api-request
 * @param shop
 * @param accessToken
 * @returns Response
 */
export async function uninstallApp(shop: string, accessToken: string) {
  const url = `https://${shop}/admin/api_permissions/current.json`

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    })

    if (response.status === 200) {
      return response
    }
  } catch (error) {
    throw new Error(`Error uninstalling app: ${formatErrorMessage(error)}`)
  }
}

/**
 * Clean up shop data after uninstalling with TailorKit privacy
 *
 * @param shopDomain
 */
export async function cleanupShopDataAfterUninstalling(shopDomain: string) {
  // Get shop data
  const shopData = await getShopData(shopDomain)

  if (!shopData) {
    return
  }

  // Prepare event data
  const uninstalledAt = new Date()
  const eventData = { uninstalledAt }
  const eventName = CUSTOMERIO_EVENTS.UNINSTALLED_APP

  // Send event to MixPanel
  trackEvent(shopData, eventName, eventData).catch(console.error)

  if (
    (shopData.subscription as SubscriptionDocument)?.shopifyCharge?.trial_ends_on
    && uninstalledAt.getTime()
      < new Date(`${(shopData.subscription as SubscriptionDocument).shopifyCharge.trial_ends_on}T23:59:59.999Z`).getTime()
  ) {
    trackEvent(shopData, EVENTS_TRACKING.ABANDON_TRIAL, {
      // eslint-disable-next-line max-len
      [EVENTS_PARAMETERS_NAME.TRIAL_DAYS]: (
        (uninstalledAt.getTime() - (shopData.createdAt as Date).getTime())
        / ONE_DAY_IN_MILLISECONDS
      ).toFixed(2),
    }).catch(console.error)
  }

  // Send uninstalled_app event to customer.io
  postEventToCustomerIo({ eventData, eventName, shopDomain }).catch(console.error)

  // Get user email
  const { shopConfig: { email } = {} } = shopData || {}

  if (email) {
    // Notify message that user uninstall our app
    postToSlackChannelWhenUninstall(shopDomain, email).catch(console.error)

    // Unsubscribe the user from the mailing list
    await syncUserDataToCustomerIo(email, { unsubscribed: true })
  }

  // Log uninstall lifecycle event (fire-and-forget — must not block uninstall flow)
  ShopLifecycleEvent.create({
    shopDomain,
    event: LifecycleEventType.UNINSTALL,
    timestamp: uninstalledAt,
    metadata: {},
  }).catch((err: unknown) => console.error('[ShopLifecycleEvent] Failed to log uninstall event:', err))

  // Reset user journey records so onboarding runs again on reinstall
  await UserJourney.deleteMany({ shopDomain })

  // Mark shop as uninstalled and clear shop config in the `shops` collection
  await clearShopConfigs(shopDomain, { uninstalledAt })

  // TODO: Remove templates, products mockups, order data after 30 days
}
