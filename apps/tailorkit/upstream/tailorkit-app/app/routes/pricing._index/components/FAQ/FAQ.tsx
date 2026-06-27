import { useState, useCallback, useMemo } from 'react'
import { BlockStack, Box, Card, Collapsible, Divider, Icon, InlineStack, Link, List, Text } from '@shopify/polaris'
import { MinusIcon, PlusIcon } from '@shopify/polaris-icons'
import type { TFunction } from 'i18next'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import { getFreeOrdersCount, getOverageFeePerOrder, isOrderBasedPlan } from '~/models/helpers/pricing-utils'
import useDevices from '~/utils/hooks/useDevice'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING, EVENTS_PARAMETERS_NAME } from '~/bootstrap/constants/eventsTracking'

interface FAQItem {
  id: string
  question: string
  answer: React.ReactNode
}

interface PlanSummary {
  name: string
  freeOrders: number
  extraFee: number
  highlighted?: boolean
}

interface FAQProps {
  t: TFunction
  plans: PricingPlanDocument[]
  /**
   * Subscriber-mode rewrites the FAQ for active customers:
   *  - drops the "which plan is best fit" shopping question,
   *  - adds invoice / payment / AI credits questions,
   *  - swaps the section heading to "Billing FAQ".
   */
  isSubscriber?: boolean
}

export function FAQ({ t, plans, isSubscriber = false }: FAQProps) {
  const [openFaqId, setOpenFaqId] = useState<string | null>(null)
  const { isSmallDesktopView } = useDevices()
  const { trackEvent } = useEventsTracking()

  const toggleFaq = useCallback(
    (id: string) => {
      setOpenFaqId(currentId => {
        const willOpen = currentId !== id
        if (willOpen) {
          trackEvent(EVENTS_TRACKING.PRICING_FAQ_TOGGLED, {
            [EVENTS_PARAMETERS_NAME.ID]: id,
          })
        }
        return willOpen ? id : null
      })
    },
    [trackEvent]
  )

  const planSummaries: PlanSummary[] = useMemo(
    () =>
      plans
        .filter(p => p.userSelectable !== false && isOrderBasedPlan(p))
        .map(p => ({
          name: p.name,
          freeOrders: getFreeOrdersCount(p),
          extraFee: getOverageFeePerOrder(p),
          highlighted: p.highlighted,
        })),
    [plans]
  )

  const highlightedPlan = useMemo(() => planSummaries.find(p => p.highlighted), [planSummaries])

  const subscriberQuestions: FAQItem[] = useMemo(
    () => [
      {
        id: 'invoices',
        question: t('faq-subscriber-invoices-q'),
        answer: (
          <BlockStack gap="200">
            <Text as="span" variant="bodySm" tone="subdued">
              {t('faq-subscriber-invoices-a')}
            </Text>
            <Text as="span" variant="bodySm" tone="subdued">
              <Link
                url="https://help.shopify.com/en/manual/your-account/manage-billing/managing-your-bills"
                target="_blank"
              >
                {t('view-manage-your-shopify-bills')}
              </Link>
            </Text>
          </BlockStack>
        ),
      },
      {
        id: 'payment-method',
        question: t('faq-subscriber-payment-method-q'),
        answer: (
          <Text as="span" variant="bodySm" tone="subdued">
            {t('faq-subscriber-payment-method-a')}
          </Text>
        ),
      },
      {
        id: 'ai-credits',
        question: t('faq-subscriber-ai-credits-q'),
        answer: (
          <Text as="span" variant="bodySm" tone="subdued">
            {t('faq-subscriber-ai-credits-a')}
          </Text>
        ),
      },
    ],
    [t]
  )

  const faqItemsAll: FAQItem[] = useMemo(
    () => [
      {
        id: 'best-fit',
        question: t('which-plan-is-the-best-fit-for-my-store'),
        answer: (
          <BlockStack gap="200">
            <Text as="span" variant="bodySm" tone="subdued">
              {t(
                // eslint-disable-next-line max-len
                'Each plan includes a different number of free personalized orders per month, which determines how cost-efficient it is for your store as sales grow:'
              )}
            </Text>
            <List type="bullet">
              {planSummaries.map(plan => (
                <List.Item key={plan.name}>
                  <Text as="span" variant="bodySm" tone="subdued">
                    {t('free-orders-per-month-summary', {
                      name: plan.name,
                      count: plan.freeOrders,
                    })}
                  </Text>
                </List.Item>
              ))}
            </List>
            <Text as="span" variant="bodySm" tone="subdued">
              {t(
                // eslint-disable-next-line max-len
                'Higher plans include more free orders and lower extra order fees — making them more cost-efficient as your store grows.'
              )}
            </Text>
            {highlightedPlan && (
              <Text as="span" variant="bodySm" tone="subdued">
                {'💡 '}
                <Text as="span" fontWeight="semibold">
                  {highlightedPlan.name}
                </Text>
                {t(
                  // eslint-disable-next-line max-len
                  ' is our most popular plan because it offers the best balance of price, order capacity, and scalability for growing stores.'
                )}
              </Text>
            )}
          </BlockStack>
        ),
      },
      {
        id: 'billing-cycle',
        question: t('how-does-tailorkit-billing-cycle-work'),
        answer: (
          <BlockStack gap="200">
            <Text as="span" variant="bodySm" tone="subdued">
              {t('tailorkit-follows-shopify-s-app-billing-cycle')}
            </Text>
            <List type="bullet">
              <List.Item>
                <Text as="span" variant="bodySm" tone="subdued">
                  {t('you-are-billed-every-30-days')}
                </Text>
              </List.Item>
              <List.Item>
                <Text as="span" variant="bodySm" tone="subdued">
                  {t('charges-are-handled-directly-through-shopify')}
                </Text>
              </List.Item>
              <List.Item>
                <Text as="span" variant="bodySm" tone="subdued">
                  {t('your-billing-cycle-starts-the-day-you-subscribe-to-a-paid-plan')}
                </Text>
              </List.Item>
            </List>
            <Text as="span" variant="bodySm" tone="subdued">
              {t(
                // eslint-disable-next-line max-len
                'For detailed Shopify billing policy, Shopify manages all charges and invoices directly in your Shopify admin. '
              )}
              <Link
                url="https://help.shopify.com/en/manual/your-account/manage-billing/managing-your-bills"
                target="_blank"
              >
                {t('view-manage-your-shopify-bills')}
              </Link>
            </Text>
          </BlockStack>
        ),
      },
      {
        id: 'upgrade',
        question: t('what-happens-if-i-upgrade-my-plan'),
        answer: (
          <BlockStack gap="200">
            <Text as="span" variant="bodySm" tone="subdued">
              {t('if-you-upgrade-e-g-starter-growth')}
            </Text>
            <List type="bullet">
              <List.Item>
                <Text as="span" variant="bodySm" tone="subdued">
                  {t('the-upgrade-takes-effect-immediately')}
                </Text>
              </List.Item>
              <List.Item>
                <Text as="span" variant="bodySm" tone="subdued">
                  {t('you-gain-access-to-the-new-plan-s-features-right-away')}
                </Text>
              </List.Item>
              <List.Item>
                <Text as="span" variant="bodySm" tone="subdued">
                  {t('shopify-will-charge-the-prorated-difference-for-the-remaining-billing-period')}
                </Text>
              </List.Item>
            </List>
            <Box paddingInlineStart="400">
              <BlockStack gap="100">
                <Text as="span" variant="bodySm" tone="subdued">
                  {t(
                    // eslint-disable-next-line max-len
                    'Eg: You use the Starter plan for 10 days. Then you upgrade to the Growth plan for the remaining 20 days of the billing cycle.'
                  )}
                </Text>
                <Text as="span" variant="bodySm" tone="subdued">
                  {t(
                    // eslint-disable-next-line max-len
                    '→ Shopify will charge you for 10 days of Starter + 20 days of Growth (prorated). You will not be charged the full monthly fee for both plans.'
                  )}
                </Text>
              </BlockStack>
            </Box>
            <List type="bullet">
              <List.Item>
                <Text as="span" variant="bodySm" tone="subdued">
                  {t('a-new-billing-cycle-may-start-depending-on-shopify-s-proration-rules')}
                </Text>
              </List.Item>
            </List>
            <Text as="span" variant="bodySm" tone="subdued">
              {t('this-follows-shopify-s-official-app-billing-proration-system')}{' '}
              <Link
                url="https://help.shopify.com/en/manual/your-account/manage-billing/managing-your-bills/billing-plan-changes"
                target="_blank"
              >
                {t('view-managing-your-shopify-billing-plan-changes')}
              </Link>
            </Text>
            <Text as="span" variant="bodySm" tone="subdued">
              {t('usage-reset-note')}
            </Text>
          </BlockStack>
        ),
      },
      {
        id: 'downgrade',
        question: t('what-happens-if-i-downgrade-my-plan'),
        answer: (
          <BlockStack gap="200">
            <Text as="span" variant="bodySm" tone="subdued">
              {t('if-you-downgrade-e-g-growth-starter')}
            </Text>
            <List type="bullet">
              <List.Item>
                <Text as="span" variant="bodySm" tone="subdued">
                  {t('the-downgrade-usually-takes-effect-at-the-next-billing-cycle')}
                </Text>
              </List.Item>
              <List.Item>
                <Text as="span" variant="bodySm" tone="subdued">
                  {t('you-retain-access-to-your-current-plan-features-until-the-end-of-the-paid-period')}
                </Text>
              </List.Item>
              <List.Item>
                <Text as="span" variant="bodySm" tone="subdued">
                  {t('no-partial-refund-is-issued-for-unused-time-in-the-current-cycle')}
                </Text>
              </List.Item>
            </List>
            <Text as="span" variant="bodySm" tone="subdued">
              {t('downgrade-behavior-follows-shopify-s-billing-policies')}{' '}
              <Link
                url="https://help.shopify.com/en/manual/your-account/manage-billing/managing-your-bills/billing-plan-changes"
                target="_blank"
              >
                {t('view-managing-your-shopify-billing-plan-changes')}
              </Link>
            </Text>
            <Text as="span" variant="bodySm" tone="subdued">
              {t('usage-reset-note')}
            </Text>
          </BlockStack>
        ),
      },
      {
        id: 'refund',
        question: t('can-i-get-a-refund-if-i-upgrade-or-change-plans'),
        answer: (
          <BlockStack gap="200">
            <Text as="span" variant="bodySm" tone="subdued">
              {t('refunds-are-handled-according-to-shopify-s-app-charge-policies')}
            </Text>
            <Text as="span" variant="bodySm" tone="subdued">
              {t('general-principles')}
            </Text>
            <List type="bullet">
              <List.Item>
                <Text as="span" variant="bodySm" tone="subdued">
                  {t('if-you-upgrade-shopify-may-prorate-the-remaining-time-and-apply-adjustments')}{' '}
                  <Link
                    url="https://help.shopify.com/en/manual/your-account/manage-billing/credit-notes-and-billing-credits#plan-upgrade-credits"
                    target="_blank"
                  >
                    {t('view-prorated-credits-during-shopify-plan-upgrades')}
                  </Link>
                </Text>
              </List.Item>
              <List.Item>
                <Text as="span" variant="bodySm" tone="subdued">
                  {t('if-you-downgrade-refunds-are-typically-not-issued-for-the-remaining-unused-time')}{' '}
                  <Link
                    url="https://help.shopify.com/en/manual/your-account/manage-billing/refund-policy-subscriptions"
                    target="_blank"
                  >
                    {t('view-understanding-shopify-s-refund-policy-for-plans')}
                  </Link>
                </Text>
              </List.Item>
              <List.Item>
                <Text as="span" variant="bodySm" tone="subdued">
                  {t('refund-requests-are-reviewed-case-by-case-according-to-shopify-s-billing-system')}
                </Text>
              </List.Item>
            </List>
            <Text as="span" variant="bodySm" tone="subdued">
              {t(
                // eslint-disable-next-line max-len
                "TailorKit does not manually override Shopify billing rules, but we're happy to assist if you believe a charge was made in error."
              )}
            </Text>
          </BlockStack>
        ),
      },
      {
        id: 'order-counting',
        question: t('how-are-orders-counted-in-my-plan'),
        answer: (
          <BlockStack gap="200">
            <Text as="span" variant="bodySm" tone="subdued">
              {t('an-order-is-counted-if-it-contains-one-or-more-personalized-products-powered-by-tailorkit')}
            </Text>
            <Text as="span" variant="bodySm" tone="subdued">
              {t(
                // eslint-disable-next-line max-len
                '* Note: Order status (fulfilled, unfulfilled, paid, pending, or refunded) does not affect how it is counted.'
              )}
            </Text>
          </BlockStack>
        ),
      },
      {
        id: 'exceed-limit',
        question: t('what-happens-if-i-exceed-my-included-order-limit'),
        answer: (
          <BlockStack gap="200">
            <Text as="span" variant="bodySm" tone="subdued">
              {t('each-plan-includes-a-number-of-free-orders-per-month')}
            </Text>
            <List type="bullet">
              {planSummaries.map(plan => (
                <List.Item key={plan.name}>
                  <Text as="span" variant="bodySm" tone="subdued">
                    {t('free-orders-per-month-summary', {
                      name: plan.name,
                      count: plan.freeOrders,
                    })}
                  </Text>
                </List.Item>
              ))}
            </List>
            <Text as="span" variant="bodySm" tone="subdued">
              {t('if-you-exceed-your-limit-extra-order-fees-apply')}
            </Text>
            <List type="bullet">
              {planSummaries.map(plan => (
                <List.Item key={plan.name}>
                  <Text as="span" variant="bodySm" tone="subdued">
                    {t('name-fee-per-extra-order', {
                      name: plan.name,
                      fee: `$${plan.extraFee}`,
                    })}
                  </Text>
                </List.Item>
              ))}
            </List>
            <Text as="span" variant="bodySm" tone="subdued">
              {t('you-are-only-charged-for-the-number-of-orders-beyond-your-included-quota')}
            </Text>
          </BlockStack>
        ),
      },
      {
        id: 'uninstall',
        question: t('what-happens-if-i-uninstall-the-app'),
        answer: (
          <BlockStack gap="200">
            <Text as="span" variant="bodySm" tone="subdued">
              {t('if-you-uninstall-tailorkit-your-subscription-will-be-automatically-canceled-by-shopify')}
            </Text>
            <List type="bullet">
              <List.Item>
                <Text as="span" variant="bodySm" tone="subdued">
                  {t('you-will-not-be-charged-for-future-billing-cycles')}
                </Text>
              </List.Item>
              <List.Item>
                <Text as="span" variant="bodySm" tone="subdued">
                  {t(
                    // eslint-disable-next-line max-len
                    "Any unused portion of your current billing period is typically non-refundable, following Shopify's app billing policy."
                  )}
                </Text>
              </List.Item>
              <List.Item>
                <Text as="span" variant="bodySm" tone="subdued">
                  {t('reinstalling-the-app-will-start-a-new-subscription-and-a-new-billing-cycle')}
                </Text>
              </List.Item>
            </List>
            <Text as="span" variant="bodySm" tone="subdued">
              {t('to-avoid-unwanted-charges-make-sure-to-uninstall-the-app-before-your-next-billing-date')}
            </Text>
          </BlockStack>
        ),
      },
    ],
    [t, planSummaries, highlightedPlan]
  )

  // Subscriber FAQ: drop the "which plan is best fit" shopping question,
  // prepend account-management questions (invoices, payment, AI credits).
  const faqItems: FAQItem[] = useMemo(
    () =>
      isSubscriber ? [...subscriberQuestions, ...faqItemsAll.filter(item => item.id !== 'best-fit')] : faqItemsAll,
    [isSubscriber, subscriberQuestions, faqItemsAll]
  )

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd" fontWeight="bold">
          {isSubscriber ? t('billing-faq') : t('frequently-asked-questions')}
        </Text>

        <InlineStack align="center">
          <Box width={isSmallDesktopView ? '100%' : '66%'}>
            <BlockStack gap="300">
              {faqItems.map((item, index) => (
                <BlockStack gap="300" key={item.id}>
                  <div style={{ cursor: 'pointer' }} onClick={() => toggleFaq(item.id)}>
                    <InlineStack align="space-between" gap="300">
                      <Text as="span" variant="bodySm" fontWeight="semibold">
                        {item.question}
                      </Text>
                      <Box>
                        <Icon source={openFaqId === item.id ? MinusIcon : PlusIcon} />
                      </Box>
                    </InlineStack>
                  </div>
                  <Collapsible open={openFaqId === item.id} id={`${item.id}-content`}>
                    <Box paddingBlockEnd="200">{item.answer}</Box>
                  </Collapsible>
                  {index < faqItems.length - 1 && <Divider />}
                </BlockStack>
              ))}
            </BlockStack>
          </Box>
        </InlineStack>
      </BlockStack>
    </Card>
  )
}
