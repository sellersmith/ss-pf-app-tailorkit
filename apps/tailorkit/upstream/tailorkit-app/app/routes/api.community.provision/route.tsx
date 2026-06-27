import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import { getCommunityProvisionRedirectUrl } from '~/services/community/get-community-provision-url.server'
import { trackFeatureEvent } from '~/bootstrap/fns/feature-tracking.server'
import Shop from '~/models/Shop.server'

/**
 * GET /api/community/provision
 *
 * Returns a redirect URL for community provisioning.
 * If already linked, returns community URL directly.
 * Used by the "Explore Now" dashboard banner button.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request)
  const shopDomain = session.shop

  try {
    const { redirectUrl, isAlreadyLinked } = await getCommunityProvisionRedirectUrl(shopDomain)

    // Track feature usage
    const shopData = await Shop.findOne({ shopDomain })
    if (shopData) {
      await trackFeatureEvent(shopData, 'community_provision', isAlreadyLinked ? 'already_linked' : 'provision_start')
    }

    return json({ redirectUrl })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Community Provision]', errorMessage)

    // Track provision failures
    try {
      const shopData = await Shop.findOne({ shopDomain })
      if (shopData) {
        await trackFeatureEvent(shopData, 'community_provision', 'provision_error', {
          error: errorMessage,
        })
      }
    } catch {
      // Don't fail the response if tracking fails
    }

    return json({ error: 'Unable to process community provision request' }, { status: 500 })
  }
}
