import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import Shop from '~/models/Shop.server'
import { ensureOptionPricingProduct } from '~/routes/api.option-pricing/OptionPricingProduct.server'
import { authenticate } from '~/shopify/app.server'
import { catchAsync } from '~/utils/catchAsync'

enum OPTION_PRICING_ACTIONS {
  ENSURE_PRICING_PRODUCT = 'ENSURE_PRICING_PRODUCT',
}

// Defense-in-depth: server-side bound for averagePrice. Frontend already validates,
// but rejecting non-finite / negative / wildly large values here protects against
// rogue clients producing invalid Shopify variant prices.
const MAX_AVERAGE_PRICE = 1_000_000

function isValidAveragePrice(value: unknown): value is number {
  return typeof value === 'number' && isFinite(value) && value > 0 && value <= MAX_AVERAGE_PRICE
}

export const action = catchAsync(async ({ request }: ActionFunctionArgs) => {
  const {
    admin,
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const payload = (await request.json()) || {}
  const { action, averagePrice } = payload

  switch (action) {
    case OPTION_PRICING_ACTIONS.ENSURE_PRICING_PRODUCT: {
      // averagePrice is optional. When present it must be a valid positive finite number;
      // otherwise reject the request rather than silently coerce to a default that would
      // surprise the merchant.
      if (averagePrice !== undefined && !isValidAveragePrice(averagePrice)) {
        return json({ success: false, message: 'Invalid average price' }, { status: 400 })
      }

      const productId = await ensureOptionPricingProduct(admin, averagePrice)

      if (!productId) {
        throw new Error('Failed to create or find option pricing product')
      }

      // Persist averagePrice so the Edit-price modal can preload it on next mount
      // and we can avoid pushing a "default" value that would clobber merchant edits.
      // Fail-fast: if we can't persist, the modal would default again on next open,
      // which is the bug we're fixing. Surface 500 so the client can react.
      if (isValidAveragePrice(averagePrice)) {
        try {
          await Shop.updateOne({ shopDomain }, { $set: { 'appConfig.optionPricing.averagePrice': averagePrice } })
        } catch (err) {
          console.error('Failed to persist averagePrice', err)
          return json(
            { success: false, productId, message: 'Pricing product saved but failed to persist average price' },
            { status: 500 }
          )
        }
      }

      return json({
        success: true,
        productId,
        message: 'Option pricing product ready',
      })
    }

    default:
      throw new Error('Invalid action')
  }
})
