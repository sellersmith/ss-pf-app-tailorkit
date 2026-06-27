import type { LoaderFunctionArgs } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import { processAiCreditPurchaseCallback } from '~/models/helpers/ai-credits-purchase.server'

/**
 * AI Credits Purchase Callback Route
 *
 * Handles Shopify one-time charge approval callback
 * Called after user approves the charge in Shopify admin
 *
 * Query params:
 * - purchase_id: Purchase record ID
 * - charge_id: Shopify charge ID
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { redirect } = await authenticate.admin(request)

  const url = new URL(request.url)
  const purchaseId = url.searchParams.get('purchase_id')
  const chargeId = url.searchParams.get('charge_id')

  // Validate required params
  if (!purchaseId || !chargeId) {
    console.error('[AICreditCallback] Missing required params:', { purchaseId, chargeId })
    return redirect('/pricing?error=invalid_callback')
  }

  try {
    // Process the purchase and credit the shop
    const result = await processAiCreditPurchaseCallback(purchaseId, chargeId)

    if (!result.success) {
      console.error('[AICreditCallback] Processing failed:', result.message)
      return redirect(`/pricing?error=${encodeURIComponent(result.message || 'unknown')}`)
    }

    // Success - redirect to pricing page with success message
    return redirect('/pricing?ai_credits_purchased=true')
  } catch (error) {
    console.error('[AICreditCallback] Unexpected error:', error)
    return redirect('/pricing?error=processing_failed')
  }
}
