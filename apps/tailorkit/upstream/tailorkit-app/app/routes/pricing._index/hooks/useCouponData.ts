import { useState, useEffect } from 'react'
import type { SubscriptionDocument } from '~/models/Subscription'
import type { CouponDocument } from '~/models/Coupon'
import { fetchCouponByCode } from '../fns'

/**
 * Custom hook to fetch coupon data based on subscription's couponCode
 *
 * Returns coupon details including discount type and amount
 * with loading state for optimal UX
 *
 * @param subscription - Current subscription with optional couponCode
 * @returns Object containing coupon data and loading state
 */
export function useCouponData(subscription: SubscriptionDocument | null) {
  const [coupon, setCoupon] = useState<CouponDocument | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const couponCode = subscription?.couponCode

    if (!couponCode) {
      setCoupon(null)
      setLoading(false)
      return
    }

    // Fetch coupon data
    const fetchCoupon = async () => {
      setLoading(true)
      try {
        const couponData = await fetchCouponByCode(couponCode)
        setCoupon(couponData)
      } catch (error) {
        console.error('Failed to fetch coupon:', error)
        setCoupon(null)
      } finally {
        setLoading(false)
      }
    }

    fetchCoupon()
  }, [subscription?.couponCode])

  return { coupon, loading }
}
