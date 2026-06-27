import type { CouponDocument } from '~/models/Coupon'
import type { ShopDocument } from '~/models/Shop'
import type { SubscriptionDocument } from '~/models/Subscription'

/**
 * Get the applied on date for a coupon.
 * @param coupon - The coupon to get the applied on date for.
 * @param subscription - The subscription to get the applied on date for.
 * @param options - The options for the function.
 * @param options.ignoreSubscription - Whether to ignore the subscription when getting the applied on date.
 * @returns The applied on date for the coupon.
 */
export function getCouponAppliedOn(
  shop: ShopDocument,
  coupon: CouponDocument,
  subscription: SubscriptionDocument,
  options: { ignoreSubscription?: boolean } = {}
) {
  const { ignoreSubscription = false } = options

  const { createdAt, couponAppliedOn: subscriptionCouponAppliedOn, shopifyCharge } = subscription

  const { activated_on, trial_ends_on } = shopifyCharge || {}

  const couponAppliedOn = new Date(
    Math.max(
      !ignoreSubscription && createdAt ? new Date(createdAt).getTime() : 0,
      shop.createdAt ? new Date(shop.createdAt).getTime() : 0,
      coupon.createdAt ? new Date(coupon.createdAt).getTime() : 0,
      (activated_on && new Date(`${activated_on}T23:59:59.999Z`).getTime()) || 0,
      (trial_ends_on && new Date(`${trial_ends_on}T23:59:59.999Z`).getTime()) || 0,
      (subscriptionCouponAppliedOn && new Date(`${subscriptionCouponAppliedOn}T23:59:59.999Z`).getTime()) || 0
    )
  )

  return couponAppliedOn
}
