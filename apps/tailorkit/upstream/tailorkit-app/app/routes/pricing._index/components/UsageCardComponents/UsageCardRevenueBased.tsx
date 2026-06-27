import { Badge, BlockStack, Box, Card, InlineGrid, InlineStack, Link, Text } from '@shopify/polaris'
import type { TFunction } from 'i18next'
import type { ShopDocument } from '~/models/Shop'
import type { SubscriptionDocument } from '~/models/Subscription'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import { AiCreditsSection } from './AiCreditsSection'
import { AiCreditBannerSection } from './AiCreditBannerSection'
import { Trans } from 'react-i18next'

interface UsageCardRevenueBasedProps {
  shopData: ShopDocument | null
  subscription: SubscriptionDocument | null
  plan: PricingPlanDocument
  aiCredits: {
    used: number
    total: number
    purchased: number
    purchasedTotal: number
    purchasedUsed: number
  }
  t: TFunction
  purchasedCreditsLoading?: boolean
}

function formatDate(date: Date | null): string {
  if (!date) return ''
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function UsageCardRevenueBased(props: UsageCardRevenueBasedProps) {
  const { shopData, subscription, plan, aiCredits, t, purchasedCreditsLoading = false } = props

  const appGeneratedRevenue = shopData?.usages?.appGeneratedRevenue || 0
  const currentCharge = shopData?.usages?.usageFee || 0
  const cappedAmount = plan?.cappedAmount || 0
  const extraAiFee = 0 // Currently $0, no separate charge for purchased AI credits

  const total = currentCharge + extraAiFee

  // Get tier name from plan (e.g., "Tier 1", "Tier 2")
  const tierName = plan.name || 'Plan'
  const usagePeriodStart = subscription?.from ? formatDate(new Date(subscription.from)) : formatDate(new Date())
  const usagePeriodEnd = t('present')

  return (
    <Card>
      <BlockStack gap="300">
        {/* Header */}
        <InlineStack align="start" blockAlign="center" gap="100">
          <Text as="h2" variant="headingMd">
            {t('current-plan')}
          </Text>
          <Badge>{t('planname-old-pricing', { planName: tierName })}</Badge>
        </InlineStack>

        {/* Description */}
        <Box>
          <Trans
            t={t}
            components={{
              a: (
                <Link removeUnderline url="#pricing-calculator">
                  {t('view-comparison')}
                </Link>
              ),
              b: <strong />,
            }}
          >
            {t(
              // eslint-disable-next-line max-len
              'You\u2019re currently using the old TailorKit pay-as-you-grow pricing plan. Keep your current pricing or <b>switch a new plan with 50% off for the first month</b>. <a>View comparison</a>'
            )}
          </Trans>
        </Box>

        {/* Usage period */}
        <Text as="p" variant="bodyMd" tone="subdued">
          {t('usage-and-charge-from-start-end', { start: usagePeriodStart, end: usagePeriodEnd })}
        </Text>

        {/* 2-column layout: Revenue breakdown | AI Credits */}
        <InlineGrid columns={2} gap="2000">
          {/* Left column: Revenue breakdown */}
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text as="p" variant="bodyMd">
                {t('this-month-s-app-generated-revenue')}
              </Text>
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                ${appGeneratedRevenue.toFixed(2)}
              </Text>
            </InlineStack>

            <div style={{ borderTop: '1px solid var(--p-color-border-secondary)', margin: '0' }} />

            <InlineStack align="space-between">
              <Text as="p" variant="bodyMd">
                {t('current-charge')}
              </Text>
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                ${currentCharge.toFixed(2)}
              </Text>
            </InlineStack>

            <InlineStack align="space-between">
              <Text as="p" variant="bodyMd">
                {t('capped-amount')}
              </Text>
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                ${cappedAmount.toFixed(2)}
              </Text>
            </InlineStack>

            <InlineStack align="space-between">
              <Text as="p" variant="bodyMd">
                {t('extra-ai-fees')}
              </Text>
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                ${extraAiFee.toFixed(2)}
              </Text>
            </InlineStack>

            <div style={{ borderTop: '1px solid var(--p-color-border-secondary)', margin: '0' }} />

            <InlineStack align="space-between">
              <Text as="p" variant="headingLg">
                {t('total')}
              </Text>
              <Text as="p" variant="headingLg">
                ${total.toFixed(2)}
              </Text>
            </InlineStack>

            <Text as="p" variant="bodyMd" tone="subdued">
              {t('billed-on-the-first-day-of-shopify-billing-cycle')}
            </Text>
          </BlockStack>

          {/* Right column: AI Credits */}
          <AiCreditsSection aiCredits={aiCredits} t={t} purchasedCreditsLoading={purchasedCreditsLoading} />
        </InlineGrid>

        <AiCreditBannerSection aiCredit={shopData?.usages?.aiCredit} allocation={plan?.aiCreditsPerMonth} />
      </BlockStack>
    </Card>
  )
}
