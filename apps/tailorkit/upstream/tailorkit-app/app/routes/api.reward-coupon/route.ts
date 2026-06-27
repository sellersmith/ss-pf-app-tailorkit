import type { LoaderFunctionArgs } from '@remix-run/node'
import { getShopData } from '~/models/Shop.server'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import Coupon, { applyCouponToShop, generateCouponCode } from '~/models/Coupon.server'
import { INVALID_SHOP_ERROR } from '~/constants/errors'

export async function action({ request }: LoaderFunctionArgs) {
  try {
    const {
      session: { shop: shopDomain },
    } = await authenticate.admin(request)

    const shop = await getShopData(shopDomain)
    const { actionCompleted, promotionId, coupon, couponLifetimeMonths } = await request.json()

    if (!shop) {
      throw new Error(INVALID_SHOP_ERROR)
    }

    if (
      !actionCompleted
      || !promotionId
      || !coupon
      || (typeof coupon !== 'number' && (typeof coupon !== 'string' || !coupon.match(/^\d+\%$/)))
    ) {
      throw new Error('Invalid payload')
    }

    // Check if coupon is issued before
    let couponIssued = await Coupon.findOne({ applyTo: shopDomain, promotionId }, null, { sort: { createdAt: -1 } })

    if (!couponIssued) {
      const couponCode = generateCouponCode()

      couponIssued = await Coupon.create({
        promotionId,
        code: couponCode,
        status: 'active',
        applyTo: [shopDomain],
        name: `Reward for ${promotionId}`,
        discount: {
          type: 'percent',
          amount: typeof coupon === 'number' ? coupon * 100 : parseInt(coupon),
        },
        limit: {
          ...(couponLifetimeMonths ? { discountEndsAfter: couponLifetimeMonths } : {}),
        },
      })
    }

    // Automatically apply the coupon to the shop
    await applyCouponToShop(couponIssued, shopDomain)

    return json({ success: true, data: couponIssued })
  } catch (e: any) {
    return json({ success: false, message: e?.message || e })
  }
}
