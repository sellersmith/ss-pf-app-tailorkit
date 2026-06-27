import type { LoaderFunctionArgs } from '@remix-run/node'
import { catchAsync } from '~/utils/catchAsync'
import { json } from '~/bootstrap/fns/fetch.server'
import Integration from '~/models/Integration.server'
import { getShopData } from '~/models/Shop.server'
import { rateLimitMiddleware } from '~/services/mcp/rate-limit.server'
import { validatePartnerApiKey } from '~/utils/partner-auth.server'
import { normalizeShopDomain } from '~/utils/shop-domain.server'
import { PAGEFLY_INSTALL_URL, PAGEFLY_ADMIN_URL } from '~/constants/pagefly-demo-config'

const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

/**
 * Public partner endpoint used by PageFly editor to know whether TailorKit
 * is installed/configured in the merchant's shop. Used to:
 *   - poll for install completion after redirecting to App Store
 *   - gate "Install" CTA in editor
 *   - branch UI between demo / installed / configured states
 *
 * GET /api/public/install-status?shop={domain}
 * Header: X-Api-Key: {PAGEFLY_PARTNER_API_KEY}
 *
 * Response: { installed, configured, productCount, plan }
 */
export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const authError = validatePartnerApiKey(request)
  if (authError) return authError

  const url = new URL(request.url)
  const shopDomain = normalizeShopDomain(url.searchParams.get('shop'))

  if (!shopDomain) {
    return json({ error: 'Invalid or missing shop param' }, { status: 400, headers: corsHeaders })
  }

  const rateLimited = rateLimitMiddleware(request, shopDomain)
  if (rateLimited) return rateLimited

  const shop = await getShopData(shopDomain)
  const installed = !!shop && !shop.uninstalledAt

  // Skip integration count for uninstalled shops — historical integrations
  // would otherwise produce confusing { installed: false, productCount: > 0 }
  const productCount = installed
    ? await Integration.countDocuments({
        shopDomain,
        publishedAt: { $exists: true, $ne: null },
        $or: [{ unpublishedAt: null }, { unpublishedAt: { $exists: false } }],
      })
    : 0

  const configured = installed && productCount > 0
  const plan: string | null = installed
    ? ((shop?.subscription as { plan?: { alias?: string } } | null | undefined)?.plan?.alias ?? null)
    : null

  return json(
    {
      installed,
      configured,
      productCount,
      plan,
      installUrl: PAGEFLY_INSTALL_URL,
      adminUrl: PAGEFLY_ADMIN_URL,
    },
    { headers: corsHeaders }
  )
})
