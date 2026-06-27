/* eslint-disable max-len */
import { useLocation, useNavigate, useSearchParams } from '@remix-run/react'
import {
  BlockStack,
  Box,
  Button,
  Card,
  Collapsible,
  Divider,
  Icon,
  InlineGrid,
  InlineStack,
  List,
  Page,
  Text,
} from '@shopify/polaris'
import { MinusIcon, PlusIcon, StatusActiveIcon, XCircleIcon } from '@shopify/polaris-icons'
import numeral from 'numeral'
import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { Trans } from 'react-i18next'
import type { WithTranslationProps } from '~/bootstrap/hoc/withTranslation'
import { PricingErrors } from '~/constants/errors'
import type { CouponDocument } from '~/models/Coupon'
import type { GroupedPricingPlanDocument, PricingPlanDocument } from '~/models/PricingPlan'
import { authenticatedFetch } from '~/shopify/fns.client'
import { escapeRegExp } from '~/utils/escapeRegex'
import { showGenericErrorToast } from '~/utils/toastEvents'
import PricingTable from '../../pricing-ver-1/components/PricingTable'
import { UsageFeeComponent } from '../../pricing-ver-1/components/UsageFee'
import type { ShopDocument } from '~/models/Shop'
import { PRICING_ACTION } from '~/routes/api.pricing/constants'
import { OldVsNewComparison } from './OldVsNewComparison'

interface PricingV1Props extends WithTranslationProps {
  shopData: ShopDocument
  pricingPlans: GroupedPricingPlanDocument[]
  coupon: CouponDocument | null
  v2Plans?: PricingPlanDocument[]
}

export function PricingV1({ shopData, pricingPlans, coupon: _coupon, t, v2Plans }: PricingV1Props) {
  const location = useLocation()
  const navigate = useNavigate()

  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [, setProcessing] = useState(false)

  const [coupon, setCoupon] = useState<CouponDocument | null>(_coupon)
  const preferentialPricingPlan = useMemo(() => pricingPlans[0], [pricingPlans])

  // Handle coupon validation from URL params
  useLayoutEffect(() => {
    if (location.search.includes('redeemCouponCode') || location.search.includes('couponCode')) {
      const regexRedeemCouponCode = new RegExp(/[?&]redeemCouponCode=([^&]+)/)
      const regexCouponCode = new RegExp(/[?&]couponCode=([^&]+)/)
      const testRedeemCouponCode = location.search.match(regexRedeemCouponCode)
      const testCouponCode = location.search.match(regexCouponCode)
      const test = testRedeemCouponCode || testCouponCode

      if (test?.[1]) {
        authenticatedFetch('/api/pricing', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: PRICING_ACTION.VALIDATE_COUPON, coupon: test[1] }),
        })
          .then(res => {
            if (res.success && res.validatedCoupon) {
              setCoupon(res.validatedCoupon)
            }
          })
          .catch(console.error)
          .finally(() => setLoading(false))

        return
      }
    }

    setLoading(false)
  }, [location.search])

  // Redirect to confirmation page
  const openConfirmationUrl = useCallback(
    (confirmationUrl?: string) => {
      if (confirmationUrl) {
        window.parent.location.href = confirmationUrl
      } else {
        navigate('/dashboard')
      }
    },
    [navigate]
  )

  // Subscribe to pricing plan
  const subscribeToPricingPlan = useCallback(
    async (e?: PointerEvent, planId?: string) => {
      try {
        // Get plan ID
        planId = planId || preferentialPricingPlan?.variants[0]?._id

        if (!planId) {
          throw new Error(PricingErrors.INVALID_PLAN)
        }

        setProcessing(true)

        // Get coupon code from query params
        const couponCode = searchParams.get('redeemCouponCode') || searchParams.get('couponCode') || coupon?.code

        // Subscribe to pricing plan
        const res = await authenticatedFetch(`/api/pricing`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            planId,
            action: PRICING_ACTION.SUBSCRIBE,
            ...(couponCode ? { couponCode: escapeRegExp(couponCode) } : {}),
          }),
        })

        if (!res?.success) {
          throw new Error(res.message)
        }

        setProcessing(false)

        // Redirect to confirmation page
        openConfirmationUrl(res?.confirmationUrl)
      } catch (e) {
        setProcessing(false)

        // Show error message
        showGenericErrorToast()
      }
    },
    [coupon?.code, openConfirmationUrl, preferentialPricingPlan?.variants, searchParams]
  )

  // FAQ section
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  const faqs = useMemo(
    () => [
      {
        question: t('is-there-a-free-trial-available'),
        answer: t(
          'yes-every-month-begins-on-our-free-plan-until-you-earn-50-from-products-created-with-tailorkit-after-that-we-automatically-move-you-into-the-paid-tier-that-matches-your-tailorkit-generated-revenue-you-ll-always-retain-full-access-to-premium-features-with-no-time-limit'
        ),
      },
      {
        question: t('how-is-my-monthly-revenue-calculated'),
        answer: t(
          'monthly-revenue-is-measured-as-the-total-sales-in-the-past-30-days-of-products-you-created-with-tailorkit-whether-orders-were-processed-by-tailorkit-or-fulfilled-manually-your-pricing-tier-is-then-automatically-updated-each-month-to-match-that-actual-tailorkit-generated-revenue'
        ),
      },
      {
        question: t('what-if-i-upgrade-mid-cycle'),
        answer: t(
          'we-only-bill-the-difference-so-you-ll-pay-exactly-the-full-amount-for-your-highest-tier-for-example-if-you-ve-paid-14-99-for-the-app-generated-revenue-from-over-50-to-2-000-and-then-hit-the-app-generated-revenue-from-over-2-000-to-5-000-you-ll-be-charged-just-20-34-99-14-99-additional-usage-fee'
        ),
      },
    ],
    [t]
  )

  const currentCharge = useMemo(() => shopData?.usages?.usageFee || 0, [shopData?.usages?.usageFee])

  return (
    !loading && (
      <Page narrowWidth>
        {/* Header Section */}
        <Box paddingBlockStart="600" paddingBlockEnd="600">
          <BlockStack gap="300" align="center">
            <Text as="h1" variant="headingXl" alignment="center">
              {t('congratulations-on-your-first-sale')}
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
              {t('continue-using-tailorkit-with-fair-transparent-pay-as-you-grow-pricing')}
            </Text>
          </BlockStack>
        </Box>

        <BlockStack gap="400">
          {/* Old vs New Pricing Comparison */}
          {v2Plans && v2Plans.length > 0 && <OldVsNewComparison t={t} v2Plans={v2Plans} />}

          <Card>
            <BlockStack gap="400">
              <Text as="p" variant="bodyMd">
                {t('tailorkit-charges-based-on-monthly-revenue-only-charge-when-you-earn-50')}
              </Text>
              <List>
                <List.Item>
                  <Text as="p" variant="bodyMd">
                    <Trans t={t} components={{ b: <strong /> }}>
                      {t('this-month-s-app-generated-renevue-b-amount-b', {
                        amount: numeral(shopData?.usages?.appGeneratedRevenue || 0).format('$0,0.00'),
                      })}
                    </Trans>
                  </Text>
                </List.Item>
                <List.Item>
                  <InlineStack gap="100" align="start">
                    <Text as="p" variant="bodyMd">
                      {t('current-charge')}
                      {': '}
                    </Text>
                    {currentCharge ? (
                      <UsageFeeComponent
                        t={t}
                        coupon={coupon}
                        fontWeight="bold"
                        discountTone="base"
                        inlineAlign="start"
                        fee={shopData?.usages?.usageFee}
                        tier={preferentialPricingPlan?.variants?.[0]?.usages?.revenue?.find(
                          (item: any) =>
                            item.from <= (shopData?.usages?.usageFee || 0)
                            && (!item.to || item.to > (shopData?.usages?.usageFee || 0))
                        )}
                      />
                    ) : (
                      <Text as="p" variant="bodyMd" fontWeight="bold">
                        {numeral(currentCharge).format('$0,0.00')}
                      </Text>
                    )}
                  </InlineStack>
                </List.Item>
              </List>
              <Text as="p" variant="bodyMd">
                {t('you-need-to-set-up-billing-to-continue-tracking-sales-and-keep-selling-more')}
              </Text>

              <InlineGrid gap="400" columns={{ xs: 1, md: 2 }}>
                <Card background="bg-surface-info">
                  <BlockStack gap="400">
                    <InlineGrid gap="100" columns="20px 1fr">
                      <Box>
                        <Icon source={StatusActiveIcon} tone="success" />
                      </Box>
                      <Text as="p" variant="headingMd">
                        {t('why-set-it-up-now')}
                      </Text>
                    </InlineGrid>
                    <List>
                      <List.Item>
                        <Text as="p" variant="bodyMd">
                          {t('unlock-all-tailorkit-features')}
                        </Text>
                      </List.Item>
                      <List.Item>
                        <Text as="p" variant="bodyMd">
                          {t('personalize-products-with-ai')}
                        </Text>
                      </List.Item>
                      <List.Item>
                        <Text as="p" variant="bodyMd">
                          {t('ensure-buyers-smooth-experience')}
                        </Text>
                      </List.Item>
                      <List.Item>
                        <Text as="p" variant="bodyMd">
                          {t('track-revenue-gain-insights')}
                        </Text>
                      </List.Item>
                    </List>
                  </BlockStack>
                </Card>
                <Card background="bg-surface-disabled">
                  <BlockStack gap="400">
                    <InlineGrid gap="100" columns="20px 1fr">
                      <Box>
                        <Icon source={XCircleIcon} />
                      </Box>
                      <Text as="p" variant="headingMd">
                        {t('if-you-don-t-set-up')}
                      </Text>
                    </InlineGrid>
                    <List>
                      <List.Item>
                        <Text as="p" variant="bodyMd">
                          {t('limited-features-only')}
                        </Text>
                      </List.Item>
                      <List.Item>
                        <Text as="p" variant="bodyMd">
                          {t('no-ai-personalization')}
                        </Text>
                      </List.Item>
                      <List.Item>
                        <Text as="p" variant="bodyMd">
                          {t('lower-buyers-experience')}
                        </Text>
                      </List.Item>
                      <List.Item>
                        <Text as="p" variant="bodyMd">
                          {t('no-revenue-insights')}
                        </Text>
                      </List.Item>
                    </List>
                  </BlockStack>
                </Card>
              </InlineGrid>
              <InlineStack align="center">
                <Button variant="primary" size="large" onClick={subscribeToPricingPlan}>
                  {t('set-up-billing')}
                </Button>
              </InlineStack>
              {!currentCharge && (
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" fontWeight="bold" alignment="center">
                    {t('you-won-t-be-charged-anything-today')}
                  </Text>
                  <Text as="p" variant="bodyMd" alignment="center">
                    {t(
                      'this-just-enables-billing-for-when-you-reach-50-revenue-you-ll-see-a-shopify-approval-screen-next'
                    )}
                  </Text>
                </BlockStack>
              )}
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <Text as="p" variant="bodyMd">
                {t(
                  'the-monthly-charge-will-be-based-on-your-app-generated-revenue-at-the-time-of-finishing-billing-setup'
                )}
              </Text>

              <PricingTable t={t} coupon={coupon} plan={preferentialPricingPlan?.variants[0]} />
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                {t('frequently-asked-questions')}
              </Text>
              <BlockStack>
                {faqs.map((faq, index) => (
                  <Box key={index} paddingBlockStart="400">
                    <Box paddingBlockEnd="400">
                      <div onClick={() => toggleFaq(index)}>
                        <InlineGrid columns="1fr 20px">
                          <Text as="span" variant="bodyMd" fontWeight="semibold">
                            {faq.question}
                          </Text>
                          <Box>
                            <Icon source={openFaq === index ? MinusIcon : PlusIcon} />
                          </Box>
                        </InlineGrid>
                      </div>
                      <Collapsible
                        open={openFaq === index}
                        id={`faq-${index}`}
                        transition={{
                          duration: '200ms',
                          timingFunction: 'ease-in-out',
                        }}
                      >
                        <Box paddingBlockStart="400">
                          <Text as="p" variant="bodyMd" tone="subdued">
                            {faq.answer}
                          </Text>
                        </Box>
                      </Collapsible>
                    </Box>
                    {index < faqs.length - 1 && <Divider />}
                  </Box>
                ))}
              </BlockStack>
            </BlockStack>
          </Card>
        </BlockStack>
      </Page>
    )
  )
}
