import type { EventObject } from 'extensions/tailorkit-src/src/assets/libraries/event-handler'
import { useLayoutEffect, useState } from 'react'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'

export default function useRewardCoupon() {
  const [rewardedCoupon, setRewardedCoupon] = useState<any>(null)

  useLayoutEffect(() => {
    function listenRewardCoupon(eventData: EventObject) {
      setRewardedCoupon(eventData.data)
    }

    Transmitter.listen('reward-coupon', listenRewardCoupon)

    return () => {
      Transmitter.remove('reward-coupon', listenRewardCoupon)
    }
  }, [])

  return { rewardedCoupon, setRewardedCoupon }
}
