import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import { getFirstTemplateWithIntegration } from '../api.preferences/fns.server'

/**
 * API endpoint to get first unpublished template with integration
 * Used by dashboard to avoid unnecessary queries on other routes
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  const shopDomain = session.shop

  try {
    const firstTemplateWithIntegration = await getFirstTemplateWithIntegration(shopDomain)

    return json(
      {
        success: true,
        data: firstTemplateWithIntegration,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[api.first-template-integration] Error:', error)
    return json(
      {
        success: false,
        error: 'Failed to fetch first template integration',
        data: null,
      },
      { status: 500 }
    )
  }
}
