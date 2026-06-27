import { BlockStack, Divider } from '@shopify/polaris'
import type { ShopDocument } from '~/models/Shop'
import CurrentBilling from './CurrentBilling'
import PaymentHistory from './PaymentHistory'
import type { TFunction } from 'i18next'
import type { SubscriptionDocument } from '~/models/Subscription'
import { Fragment, useCallback, useLayoutEffect, useState } from 'react'
import type { CouponDocument } from '~/models/Coupon'
import { authenticatedFetch } from '~/shopify/fns.client'
import { PRICING_ACTION } from '~/routes/api.pricing/constants'
import SettingLayout from '~/routes/settings/components/SettingLayout'
import PricingTable from '~/routes/pricing-ver-1/components/PricingTable'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import CouponList from './CouponList'
import ConfirmApplyCouponModal from './ConfirmApplyCouponModal'
import { showToast } from '~/utils/toastEvents'
import { useRevalidator } from '@remix-run/react'
import { TOAST } from '~/constants/toasts'

interface IBillingCardProps {
  t: TFunction
  shopData: ShopDocument
}

function BillingCard(props: IBillingCardProps) {
  const { t, shopData } = props

  const { revalidate } = useRevalidator()

  // Check if shop approved charge
  const appGeneratedRevenue = shopData.usages?.appGeneratedRevenue || 0

  const subscription = shopData.subscription as SubscriptionDocument

  const [coupons, setCoupons] = useState<CouponDocument[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedCoupon, setSelectedCoupon] = useState<CouponDocument | null>(null)
  const [applyingCoupon, setApplyingCoupon] = useState(false)

  const couponCode = subscription?.couponCode

  // Get the applied coupon for display in pricing table
  const appliedCoupon = coupons.find(c => c.code === couponCode) || null

  // Check if the applied coupon is still valid
  const hasValidAppliedCoupon = Boolean(appliedCoupon)

  useLayoutEffect(() => {
    ;(async () => {
      try {
        // Fetch all available coupons for the shop
        const availableCouponsResponse = await authenticatedFetch(`/api/pricing`, {
          method: 'POST',
          body: JSON.stringify({
            action: PRICING_ACTION.GET_CURRENT_COUPON_BY_SHOP_DOMAIN,
          }),
        })

        if (!availableCouponsResponse.success) {
          console.error('Error fetching available coupons', availableCouponsResponse.message)
          return
        }

        const availableCoupons = availableCouponsResponse.coupons || []

        // If there's an applied coupon, validate it and ensure it's in the list
        if (couponCode) {
          const response = await authenticatedFetch('/api/pricing', {
            method: 'POST',
            body: JSON.stringify({
              action: PRICING_ACTION.VALIDATE_COUPON,
              coupon: couponCode,
            }),
          })

          if (response.success && response.validatedCoupon) {
            const { validatedCoupon } = response

            // Check if the validated coupon is already in the available coupons list
            const existsInList = availableCoupons.some((c: CouponDocument) => c.code === validatedCoupon.code)

            if (!existsInList) {
              // Add the validated coupon to the list if it's not there
              setCoupons([validatedCoupon, ...availableCoupons])
            } else {
              setCoupons(availableCoupons)
            }
          } else {
            setCoupons(availableCoupons)
          }
        } else {
          setCoupons(availableCoupons)
        }
      } catch (error) {
        console.error('Error fetching coupons', error)
      }
    })()
  }, [couponCode])

  const handleApplyCoupon = useCallback((coupon: CouponDocument) => {
    setSelectedCoupon(coupon)
    setModalOpen(true)
  }, [])

  const handleConfirmApply = useCallback(async () => {
    if (!selectedCoupon) return

    setApplyingCoupon(true)
    try {
      const response = await authenticatedFetch('/api/pricing', {
        method: 'POST',
        body: JSON.stringify({
          coupon: selectedCoupon.code,
          action: PRICING_ACTION.REDEEM_COUPON,
        }),
      })

      if (response.success) {
        showToast(t(TOAST.BILLING.COUPON_APPLIED))

        revalidate()
      } else {
        showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
      }
    } catch (e) {
      showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
    } finally {
      setApplyingCoupon(false)
      setModalOpen(false)
    }
  }, [revalidate, selectedCoupon, t])

  const handleCloseModal = useCallback(() => {
    if (!applyingCoupon) {
      setModalOpen(false)
      setSelectedCoupon(null)
    }
  }, [applyingCoupon])

  return (
    <BlockStack gap="400">
      <CurrentBilling shopData={shopData} coupons={coupons} appGeneratedRevenue={appGeneratedRevenue} />

      {coupons.length > 0 && (
        <>
          <Divider borderColor="border" />
          <SettingLayout title={t('available-coupons')}>
            <CouponList
              coupons={coupons}
              appliedCouponCode={couponCode}
              onApplyCoupon={handleApplyCoupon}
              hasValidAppliedCoupon={hasValidAppliedCoupon}
              t={t}
            />
          </SettingLayout>
        </>
      )}

      {subscription && (
        <Fragment>
          <Divider borderColor="border" />
          <SettingLayout title={t('pay-as-you-grow-pricing')}>
            <PricingTable t={t} coupon={appliedCoupon} plan={subscription.plan as PricingPlanDocument} />
          </SettingLayout>
        </Fragment>
      )}

      <Divider borderColor="border" />
      <SettingLayout title={t('payment-history')}>
        <PaymentHistory />
      </SettingLayout>

      <ConfirmApplyCouponModal
        open={modalOpen}
        onClose={handleCloseModal}
        onConfirm={handleConfirmApply}
        coupon={selectedCoupon}
        loading={applyingCoupon}
        t={t}
      />
    </BlockStack>
  )
}

export default BillingCard
