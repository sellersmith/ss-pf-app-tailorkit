import type { ActionFunctionArgs } from '@remix-run/node'
import { catchAsync } from '~/utils/catchAsync'
import { json } from '~/bootstrap/fns/fetch.server'
import PendingInstallSource from '~/models/pending-install-source.server'
import { rateLimitMiddleware } from '~/services/mcp/rate-limit.server'
import { validatePartnerApiKey } from '~/utils/partner-auth.server'
import { normalizeShopDomain } from '~/utils/shop-domain.server'

// Allow `pagefly`, `pagefly_editor`, `pagefly_some_segment`, etc.
// Strict allowlist prevents arbitrary attribution spoofing.
const ALLOWED_SOURCE_PATTERN = /^pagefly(_[a-z0-9]+)*$/

const TTL_MS = 30 * 60 * 1000 // 30 minutes
const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

/**
 * Public partner endpoint to mark a pending install source for a shop.
 * Called by PageFly editor backend BEFORE redirecting merchant to the
 * Shopify App Store. The OAuth `afterAuthHandler` consumes the doc on
 * install completion. Idempotent (upsert by shopDomain).
 *
 * POST /api/public/mark-source
 * Header: X-Api-Key: {PAGEFLY_PARTNER_API_KEY}
 * Body: { shop: string, source: string, metadata?: object }
 *
 * Response: { success: true, expiresIn: number }
 */
export const action = catchAsync(async ({ request }: ActionFunctionArgs) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders })
  }

  const authError = validatePartnerApiKey(request)
  if (authError) return authError

  const body = (await request.json().catch(() => null)) as {
    shop?: string
    source?: string
    metadata?: Record<string, unknown>
  } | null
  if (!body || typeof body !== 'object') {
    return json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders })
  }

  const { shop, source, metadata } = body
  const shopDomain = normalizeShopDomain(shop ?? null)

  if (!shopDomain || !source) {
    return json({ error: 'Invalid or missing shop / source' }, { status: 400, headers: corsHeaders })
  }

  if (!ALLOWED_SOURCE_PATTERN.test(source)) {
    return json({ error: 'Invalid source' }, { status: 400, headers: corsHeaders })
  }

  const rateLimited = rateLimitMiddleware(request, shopDomain)
  if (rateLimited) return rateLimited

  await PendingInstallSource.findOneAndUpdate(
    { shopDomain },
    {
      $set: {
        source,
        metadata: metadata ?? {},
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    },
    { upsert: true, new: true }
  )

  return json({ success: true, expiresIn: Math.floor(TTL_MS / 1000) }, { headers: corsHeaders })
})
