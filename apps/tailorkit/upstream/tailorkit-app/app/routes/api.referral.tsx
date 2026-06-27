import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import { recordReferralClick } from '~/services/ss-referral/index.server'
import type { SSTargetApp } from '~/services/ss-referral/types.server'

/**
 * POST /api/referral
 *
 * Called client-side via useFetcher when a merchant clicks a cross-sell CTA.
 * Accepts any targetApp and crossSellPosition — no allowlists so new placements
 * don't need server-side changes. Extracts fingerprint from the request, fires a
 * non-blocking PUT to the SS Admin Console referral API. Always returns 200.
 *
 * Form fields:
 *   targetApp         — the promoted app key (e.g. 'vibe')
 *   crossSellPosition — placement identifier (e.g. 'apps-promo-card')
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== 'POST') {
    return json({ ok: false, reason: 'method-not-allowed' }, { status: 405 })
  }

  const { session } = await authenticate.admin(request)

  const formData = await request.formData()
  const targetApp = formData.get('targetApp')?.toString() ?? ''

  if (!targetApp) {
    return json({ ok: false, reason: 'missing-target-app' })
  }

  const crossSellPosition = formData.get('crossSellPosition')?.toString() || undefined
  const landingPage = request.headers.get('referer') ?? undefined

  recordReferralClick({
    request,
    targetApp: targetApp as SSTargetApp,
    shopDomain: session.shop,
    landingPage,
    crossSellPosition,
  })

  return json({ ok: true })
}
