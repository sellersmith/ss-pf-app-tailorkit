import isDate from 'lodash/isDate'
import type { CouponDocument } from '~/models/Coupon'
import type { SubscriptionDocument } from '~/models/Subscription'
/**
 * Calculate coupon discount
 *
 * @param coupon CouponDocument
 * @param totalFee number
 * @returns number
 */
export function calculateCouponDiscount(coupon: CouponDocument, totalFee: number) {
  if (!coupon) return totalFee

  const {
    discount: { type, amount },
  } = coupon

  if (type === 'percent') {
    return totalFee - (totalFee * amount) / 100
  }

  return totalFee - amount
}

/**
 * Check if the subscription is in trial
 *
 * A subscription is considered "in trial" when:
 * 1. It has a trial_ends_on date that hasn't passed yet, AND
 * 2. It's either a FREE plan OR hasn't been activated yet (status !== 'active')
 *
 * Once a user approves a PAID plan (price > 0 and status = 'active'),
 * they are no longer in trial, even if trial_ends_on hasn't passed.
 *
 * @param subscription SubscriptionDocument | null
 * @returns boolean
 */
export function isInTrial(subscription?: SubscriptionDocument | null) {
  // If subscription is active with a paid plan, not in trial anymore
  // (User has approved and is now paying)
  if (subscription?.status === 'active' && subscription?.finalPrice && subscription.finalPrice > 0) {
    return false
  }

  const trial_ends_on = subscription?.shopifyCharge?.trial_ends_on

  if (!trial_ends_on) return false

  // Validate trial_ends_on is a valid date
  const trialEndsDate = new Date(trial_ends_on)
  const isValidDate = isDate(trialEndsDate)

  if (!isValidDate) return false

  // Convert to UTC timestamp for consistent comparison
  const trialEndsTimestamp = trialEndsDate.getTime()
  const currentTimestamp = Date.now()

  return currentTimestamp < trialEndsTimestamp
}
