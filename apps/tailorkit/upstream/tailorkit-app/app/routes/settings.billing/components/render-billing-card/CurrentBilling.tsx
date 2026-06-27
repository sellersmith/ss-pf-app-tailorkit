/* eslint-disable max-len */
import { Banner, BlockStack, Box, Button, Card, Divider, Icon, InlineStack, Text, TextField } from '@shopify/polaris'
import { format } from 'date-fns'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getStartDate } from '~/bootstrap/fns/date'
import { APP_CHARGE_CURRENCY } from '~/constants/pricing'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import type { ShopDocument } from '~/models/Shop'
import type { SubscriptionDocument } from '~/models/Subscription'
import { PRICING_ACTION } from '~/routes/api.pricing/constants'
import { authenticatedFetch } from '~/shopify/fns.client'
import { getBillingCycleDate } from '~/utils/getBillingCycleDate'
import { showGenericErrorToast } from '~/utils/toastEvents'
import numeral from 'numeral'
import { CheckIcon } from '@shopify/polaris-icons'
import type { CouponDocument } from '~/models/Coupon'
import { navigateToShopifyAdmin } from '~/utils/shopify'
import type { TFunction } from 'i18next'
import SettingLayout from '~/routes/settings/components/SettingLayout'
import { isApprovedCharge } from '~/models/PricingPlan.fns'
import { getCouponAppliedOn } from '~/bootstrap/fns/coupon'

interface ICurrentBillingProps {
  shopData: ShopDocument
  coupons: CouponDocument[]
  appGeneratedRevenue: number
}

function CurrentBilling(props: ICurrentBillingProps) {
  const { shopData, coupons, appGeneratedRevenue } = props
  const { t } = useTranslation()

  const [billingCycle, setBillingCycle] = useState<any>(null)

  const subscription = shopData.subscription as SubscriptionDocument | null
  const isChargeApproved = isApprovedCharge(shopData)

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS (React Rules of Hooks)
  useEffect(() => {
    // Skip if no subscription or charge not approved
    if (!subscription || !isChargeApproved) {
      return
    }

    ;(async () => {
      try {
        const response = await authenticatedFetch('/api/pricing', {
          method: 'POST',
          body: JSON.stringify({
            action: PRICING_ACTION.GET_CURRENT_SUBSCRIPTION_CYCLE,
          }),
        })

        if (!response.success) {
          throw new Error(response.message)
        }

        const billingCycle = response.billingCycle

        setBillingCycle(billingCycle)
      } catch (e) {
        showGenericErrorToast()
      }
    })()
  }, [isChargeApproved, subscription])

  const onNavigateToBillingSection = useCallback(() => {
    /**
     * @example https://admin.shopify.com/store/longpc-tailorkit/settings/billing
     */

    navigateToShopifyAdmin('/settings/billing')
  }, [])

  // Guard against null subscription - render fallback UI instead of crashing
  // This must come AFTER all hooks
  if (!subscription) {
    return (
      <SettingLayout title={t('overall')}>
        <Card>
          <BlockStack gap="400">
            <Banner tone="warning">
              <Text as="p" variant="bodyMd">
                {t('subscription-information-unavailable')}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {t('please-contact-support')}
              </Text>
            </Banner>
          </BlockStack>
        </Card>
      </SettingLayout>
    )
  }

  const { shopifyCharge } = subscription

  const { activated_on, trial_ends_on } = shopifyCharge || {}

  const plan = subscription.plan as PricingPlanDocument

  // Determine which coupon is currently applied
  const appliedCouponCode = subscription?.couponCode
  const appliedCoupon = coupons.find(c => c.code === appliedCouponCode)

  const usageFee = shopData.usages?.usageFee || 0
  const discountedUsageFee = shopData.usages?.discountedUsageFee || 0

  // Get end of cycle date
  const endOfCycle
    = activated_on && trial_ends_on && new Date(billingCycle?.to || getBillingCycleDate(trial_ends_on || activated_on).to)

  // Get trial ends on
  const trialEndsOn = new Date(trial_ends_on || activated_on)

  const isOnTrial = trialEndsOn.getTime() > Date.now()

  // Calculate the usage fee after discount
  const discountAmount = usageFee - discountedUsageFee

  // Get the date the coupon was applied
  const couponAppliedOn = appliedCoupon ? getCouponAppliedOn(shopData, appliedCoupon, subscription) : new Date()

  return (
    <SettingLayout title={t('overall')}>
      <Card>
        <BlockStack gap="400">
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <Text as="h3" variant="bodyMd">
                {t('this-month-s-app-generated-revenue')}
              </Text>
              <Text as="h3" variant="headingSm">
                {numeral(appGeneratedRevenue).format('$0,0.00')}
              </Text>
            </InlineStack>
          </BlockStack>
          <Divider borderColor="border" />
          <Box>
            {isOnTrial ? (
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h3" variant="bodyMd">
                    {t('your-trial-ends-on')}
                  </Text>
                  <Text as="h3" variant="headingSm">
                    {format(trialEndsOn, 'MMM dd, yyyy')}
                  </Text>
                </InlineStack>

                {appliedCoupon && (
                  <>
                    <Divider borderColor="border" />
                    <InlineStack align="space-between" blockAlign="center">
                      <CouponDiscount t={t} coupon={appliedCoupon} />
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span">{t('coupon-applied-on')}</Text>
                      <Text as="span" fontWeight="bold">
                        {format(couponAppliedOn, 'MMM dd, yyyy')}
                      </Text>
                    </InlineStack>
                  </>
                )}
              </BlockStack>
            ) : (
              <BlockStack gap={'400'}>
                <InlineStack align="space-between">
                  <Text as="h3" variant="bodyMd">
                    {t('current-charge')}
                  </Text>
                  <Text as="h3" variant="headingSm">
                    {APP_CHARGE_CURRENCY}
                    {numeral(usageFee).format('0,0.00')}
                  </Text>
                </InlineStack>

                {appliedCoupon && (
                  <>
                    <InlineStack align="space-between" blockAlign="center">
                      <CouponDiscount t={t} coupon={appliedCoupon} />

                      <Text as="span" fontWeight="bold">
                        -{APP_CHARGE_CURRENCY}
                        {numeral(discountAmount).format('0,0.00')}
                      </Text>
                    </InlineStack>{' '}
                    <InlineStack align="space-between">
                      <Text as="span">{t('coupon-applied-on')}</Text>
                      <Text as="span" fontWeight="bold">
                        {format(couponAppliedOn, 'MMM dd, yyyy')}
                      </Text>
                    </InlineStack>
                  </>
                )}

                <InlineStack align="space-between">
                  <Text as="h3" variant="bodyMd">
                    {t('capped-amount')}
                  </Text>
                  <Text as="h3" variant="headingSm">
                    {APP_CHARGE_CURRENCY}
                    {numeral(usageFee < plan.cappedAmount ? usageFee : plan.cappedAmount).format('0,0.00')}
                  </Text>
                </InlineStack>

                <InlineStack align="space-between">
                  <Text as="h3" variant="headingSm">
                    {t('total-charge')}
                  </Text>
                  <Text as="h3" variant="headingSm">
                    {APP_CHARGE_CURRENCY}
                    {numeral(discountedUsageFee).format('0,0.00')}
                  </Text>
                </InlineStack>

                <Divider borderColor="border" />

                {isChargeApproved ? (
                  <>
                    <InlineStack align="space-between">
                      <Text as="p" variant="bodyMd">
                        {t('the-final-charge-amount-will-be-generated-on', {
                          date: format(getStartDate(endOfCycle), 'MMM dd, yyyy'),
                        })}
                      </Text>
                      <InlineStack gap={'300'}>
                        <Button variant="plain" onClick={onNavigateToBillingSection}>
                          {t('update-payment-method')}
                        </Button>
                      </InlineStack>
                    </InlineStack>
                  </>
                ) : null}
              </BlockStack>
            )}
          </Box>
        </BlockStack>
      </Card>
    </SettingLayout>
  )
}

function CouponDiscount(props: { t: TFunction; coupon: CouponDocument }) {
  const { t, coupon } = props

  const { limit } = coupon || {}
  const { type, amount = 0 } = coupon?.discount || {}

  return (
    <InlineStack gap={'100'}>
      <Text as="span">
        {t('amount-off-coupon-for-lifetime', {
          amount: type === 'percent' ? `${amount}%` : `${APP_CHARGE_CURRENCY}${amount}`,
          lifetime: limit?.discountEndsAfter
            ? limit.discountEndsAfter > 1
              ? t('num-months', {
                  num: limit.discountEndsAfter,
                })
              : t('the-first-month')
            : t('lifetime'),
        })}
      </Text>

      <TextField
        prefix={<Icon source={CheckIcon} tone="subdued" />}
        autoComplete="off"
        label={t('coupon')}
        labelHidden
        disabled
        autoSize
        value={coupon.code}
      />
    </InlineStack>
  )
}

export default CurrentBilling
