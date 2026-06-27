import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import { catchAsync } from '~/utils/catchAsync'
import AiCreditPackage from '~/models/AiCreditPackage.server'
import { createAiCreditPurchase, getAiCreditPurchaseHistory } from '~/models/helpers/ai-credits-purchase.server'
import { AI_CREDITS_ACTIONS } from './constants'

/**
 * AI Credits API Routes
 *
 * Handles AI credit package listing, purchasing, and history
 */

/**
 * GET: List active AI credit packages
 */
export const loader = catchAsync(async () => {
  const packages = await AiCreditPackage.find({ status: 'active' }).sort({ displayOrder: 1 }).lean()

  return json({ success: true, packages })
})

/**
 * POST: Handle AI credit actions
 *
 * Actions:
 * - purchase: Create AI credit purchase
 * - history: Get purchase history
 */
export const action = catchAsync(async ({ request }: ActionFunctionArgs) => {
  const {
    admin,
    session: { shop },
  } = await authenticate.admin(request)

  const payload = (await request.json()) || {}
  const { action, ...rest } = payload

  switch (action) {
    case AI_CREDITS_ACTIONS.PURCHASE: {
      const { packageId, couponCode } = rest

      if (!packageId) {
        return json({ success: false, message: 'Package ID is required' })
      }

      const result = await createAiCreditPurchase(admin, shop, packageId, couponCode)

      return json(result)
    }

    case AI_CREDITS_ACTIONS.HISTORY: {
      const { limit, status } = rest
      const history = await getAiCreditPurchaseHistory(shop, { limit, status })

      return json({ success: true, history })
    }

    default: {
      return json({ success: false, message: 'Invalid action' })
    }
  }
})
