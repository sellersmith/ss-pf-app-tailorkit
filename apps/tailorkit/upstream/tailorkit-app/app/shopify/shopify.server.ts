import { registerWebhooks } from './app.server'
import Shop, { createOrUpdateShop } from '~/models/Shop.server'
import UserJourney from '~/models/UserJourney.server'
import PendingInstallSource from '~/models/pending-install-source.server'
import type { AdminApiContext, Session } from '@shopify/shopify-app-remix/server'
import { createTailorKitDeliveryProfile } from './fns.server'
import type { ShopDocument } from '~/models/Shop'

/**
 * @description Handle afterAuth hook.
 * This function is called after the app is installed, re-installed, updating app scopes, etc.
 * @param admin
 * @param session
 */
export async function afterAuthHandler(opts: { admin: AdminApiContext; session: Session }) {
  const { admin, session } = opts

  try {
    // Read shop state BEFORE createOrUpdateShop (which may clear fields for V1 users).
    // `uninstalledAt` is the single source of truth for reinstall — set by the
    // APP_UNINSTALLED webhook (or the manual uninstall path in api.settings).
    // We previously also inferred reinstall from "subscription not active", but
    // that misclassified returning subscribed merchants whose subscription was
    // legitimately in a transient non-active state (cancel→resubscribe gap,
    // plan-change `pending`, billing failure `cancelled`/`inactive`) and wiped
    // their onboardingIntent on every login, dumping them onto the install
    // intent page they had never seen before.
    const existingShop = (await Shop.findOne({ shopDomain: session.shop })
      .select('uninstalledAt')
      .lean()) as ShopDocument | null
    const isReinstall = !!existingShop?.uninstalledAt

    // Create shop configs
    await createOrUpdateShop(admin, session)

    // Reset onboarding state on reinstall so onboarding runs again.
    // $unset 'appConfig.onboardingIntent' so the install intent page re-shows on
    // reinstall — clearShopConfigs (APP_UNINSTALLED webhook) wipes the whole
    // appConfig, but defending here keeps the reset deterministic if a future
    // refactor changes that path.
    if (isReinstall) {
      await Promise.all([
        Shop.updateOne(
          { shopDomain: session.shop },
          {
            $set: {
              lastReinstalledAt: new Date(),
              uninstalledAt: null,
              'appConfig.occurredEvents': {},
            },
            $unset: {
              'appConfig.onboardingIntent': '',
            },
          }
        ),
        UserJourney.deleteMany({ shopDomain: session.shop }),
      ])
    }

    // Consume pending install source attribution (e.g. from PageFly editor).
    // Partner apps mark the source via /api/public/mark-source BEFORE
    // redirecting to App Store. We pick it up here, persist onto Shop.metadata,
    // and delete the pending doc. Failure here is non-fatal — install proceeds.
    await consumePendingInstallSource(session.shop)

    // Register webhooks and create delivery profile
    runAsyncRegisterWebhooksAndCreateDeliveryProfile({ admin, session }).catch(console.error)
  } catch (error) {
    console.error(`Fatal error during afterAuth for shop ${session.shop}:`, error)
  }
}

/**
 * Reads a pending install source for the given shop, persists the source
 * onto Shop.metadata so downstream tracking (Mixpanel, Customer.io) can
 * attribute the install, then deletes the pending doc. Bypasses if no
 * pending doc or it has expired. Errors are logged and swallowed — never
 * fatal to OAuth completion.
 *
 * Read → update → delete order ensures attribution survives a transient
 * Mongo write error: if the Shop update fails the pending doc is preserved
 * and the next afterAuth (e.g. on retry / re-auth) can try again.
 */
async function consumePendingInstallSource(shopDomain: string): Promise<void> {
  try {
    const pending = await PendingInstallSource.findOne({
      shopDomain,
      expiresAt: { $gt: new Date() },
    }).lean()
    if (!pending) return

    await Shop.updateOne(
      { shopDomain },
      {
        $set: {
          'metadata.installSource': pending.source,
          'metadata.installSourceMarkedAt': pending.createdAt,
          'metadata.installSourceMetadata': pending.metadata || {},
        },
      }
    )

    await PendingInstallSource.deleteOne({ _id: pending._id })
  } catch (error) {
    console.error(`[afterAuth] Failed to consume pending install source for ${shopDomain}:`, error)
  }
}

/**
 * Register webhooks and create delivery profile
 *
 * @param {AdminApiContext} admin
 * @param {Session} session
 *
 * @returns {Promise<void>}
 */
async function runAsyncRegisterWebhooksAndCreateDeliveryProfile(opts: {
  admin: AdminApiContext
  session: Session
}): Promise<void> {
  const { admin, session } = opts

  const results = await Promise.allSettled([
    // Register essentials webhooks
    registerWebhooks(admin, session.shop).catch(error => {
      console.error(`Failed to register webhooks for shop ${session.shop}:`, error)
      throw error
    }),

    // Create delivery profile
    createTailorKitDeliveryProfile(admin, session.shop).catch(error => {
      console.error(`Failed to create delivery profile for shop ${session.shop}:`, error)
      throw error
    }),
  ])

  // Check for any failures in the parallel operations
  const failures = results.filter(result => result.status === 'rejected')
  if (failures.length > 0) {
    console.error(`${failures.length} operations failed during afterAuth for shop ${session.shop}`)
    // Log the specific errors
    failures.forEach((failure, index) => {
      if (failure.status === 'rejected') {
        console.error(`Failure ${index + 1}:`, failure.reason)
      }
    })
  }
}
