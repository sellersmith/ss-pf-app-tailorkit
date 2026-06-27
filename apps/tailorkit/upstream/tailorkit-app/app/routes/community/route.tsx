import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import { getCommunityProvisionRedirectUrl } from '~/services/community/get-community-provision-url.server'

/**
 * GET /community
 *
 * Redirects to the community site.
 * If not linked, generates a provision token and redirects to community with token.
 * If already linked, redirects directly to community.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request)
  const shopDomain = session.shop

  try {
    const { redirectUrl } = await getCommunityProvisionRedirectUrl(shopDomain)
    return redirect(redirectUrl)
  } catch (error) {
    console.error('[Community]', error)
    throw new Response((error as Error).message, { status: 500 })
  }
}
