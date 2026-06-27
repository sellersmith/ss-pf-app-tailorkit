import type { LoaderFunctionArgs } from '@remix-run/node'
import { catchAsync } from '~/utils/catchAsync'
import { json } from '~/bootstrap/fns/fetch.server'
import Shop from '~/models/Shop.server'
import Integration, { getDetailIntegration } from '~/models/Integration.server'
import VariantIntegration from '~/models/VariantIntegration.server'
import { prepareMetafieldDataBeforePublishingIntegrationV2 } from '~/routes/api.integration/preparation-fns.server'
import { rateLimitMiddleware } from '~/services/mcp/rate-limit.server'
import { validatePartnerApiKey } from '~/utils/partner-auth.server'
import { normalizeShopDomain } from '~/utils/shop-domain.server'
import { PAGEFLY_DEMO_CONFIG, PAGEFLY_INSTALL_URL, PAGEFLY_ADMIN_URL } from '~/constants/pagefly-demo-config'
import { PREFIX_PRODUCT_ID } from '~/constants/shopify'

const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

/**
 * Public partner endpoint used by PageFly editor to render TailorKit
 * customizer live preview before merchant installs TK.
 *
 * GET /api/public/preview-config?shop={domain}&product_id={optional}
 * Header: X-Api-Key: {PAGEFLY_PARTNER_API_KEY}
 *
 * Response: { status, config, installUrl, adminUrl }
 *   status = 'demo'       — shop not installed / uninstalled
 *   status = 'installed'  — shop installed but no customizer for product
 *   status = 'configured' — customizer found; config is the storefront-shape mockup
 */
export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const authError = validatePartnerApiKey(request)
  if (authError) return authError

  const url = new URL(request.url)
  const shopDomain = normalizeShopDomain(url.searchParams.get('shop'))
  const rawProductId = url.searchParams.get('product_id')

  if (!shopDomain) {
    return json({ error: 'Invalid or missing shop param' }, { status: 400, headers: corsHeaders })
  }

  const rateLimited = rateLimitMiddleware(request, shopDomain)
  if (rateLimited) return rateLimited

  const shop = (await Shop.findOne({ shopDomain }).lean()) as { uninstalledAt?: Date | null } | null
  const isInstalled = !!shop && !shop.uninstalledAt

  if (!isInstalled) {
    return demoResponse('demo')
  }

  if (rawProductId) {
    const config = await tryLoadConfiguredCustomizer(shopDomain, rawProductId)
    if (config) {
      return json(
        {
          status: 'configured',
          config,
          installUrl: PAGEFLY_INSTALL_URL,
          adminUrl: PAGEFLY_ADMIN_URL,
        },
        { headers: corsHeaders }
      )
    }
  }

  return demoResponse('installed')
})

function demoResponse(status: 'demo' | 'installed') {
  return json(
    {
      status,
      config: PAGEFLY_DEMO_CONFIG,
      installUrl: PAGEFLY_INSTALL_URL,
      adminUrl: PAGEFLY_ADMIN_URL,
    },
    { headers: corsHeaders }
  )
}

/**
 * Looks up a configured + published customizer for a given product. Tries
 * both numeric and GID formats since storefront/admin code is inconsistent.
 * Returns the storefront-shape mockup config or null.
 */
async function tryLoadConfiguredCustomizer(shopDomain: string, rawProductId: string) {
  const candidates = normalizeProductIdCandidates(rawProductId)

  // Find any variant integration matching the product
  const variant = (await VariantIntegration.findOne({
    shopDomain,
    productId: { $in: candidates },
  })
    .select('id _id')
    .lean()) as { id: string; _id: string } | null
  if (!variant) return null

  // Find the integration that owns this variant + is currently published.
  // Mirrors install-status query so both endpoints agree on "configured" state.
  const integration = (await Integration.findOne({
    shopDomain,
    variants: { $in: [variant.id] },
    publishedAt: { $exists: true, $ne: null },
    $or: [{ unpublishedAt: null }, { unpublishedAt: { $exists: false } }],
  })
    .select('_id')
    .sort({ updatedAt: -1 })
    .lean()) as { _id: string } | null
  if (!integration) return null

  // Hydrate full integration with populated mockup/printAreas/template chain
  // matching the same shape publishIntegrationProcess() uses.
  const detail = await getDetailIntegration({
    _id: integration._id,
    shopDomain,
    populateTemplate: true,
  })
  if (!detail || !detail.variants?.length) return null

  // Run the same preparation that produces the storefront metafield value.
  // Output shape: { [variantKey]: { [variantKey]: { mockup: {...} } } }
  const variantsData = prepareMetafieldDataBeforePublishingIntegrationV2(detail.variants as any[])

  const firstKey = Object.keys(variantsData)[0]
  if (!firstKey) return null
  const variantBucket = variantsData[firstKey]
  const innerBucket = variantBucket?.[firstKey]
  const mockup = innerBucket?.mockup
  if (!mockup) return null

  // Wrap into the same envelope shape as PAGEFLY_DEMO_CONFIG so PF code
  // doesn't need to branch on status.
  return {
    settings: PAGEFLY_DEMO_CONFIG.settings,
    productImage: (mockup as any).pi || PAGEFLY_DEMO_CONFIG.productImage,
    mockup,
  }
}

/**
 * Returns possible storage formats for a Shopify product ID. Accepts:
 *   - numeric string ("12345")
 *   - GID ("gid://shopify/Product/12345")
 * Returns both forms so query matches whatever DB format is stored.
 */
function normalizeProductIdCandidates(input: string): string[] {
  const trimmed = input.trim()
  const gidMatch = trimmed.match(/Product\/(\d+)/)
  const numeric = gidMatch ? gidMatch[1] : /^\d+$/.test(trimmed) ? trimmed : null

  if (!numeric) return [trimmed] // unknown shape, query as-is

  return [numeric, `${PREFIX_PRODUCT_ID}${numeric}`]
}
