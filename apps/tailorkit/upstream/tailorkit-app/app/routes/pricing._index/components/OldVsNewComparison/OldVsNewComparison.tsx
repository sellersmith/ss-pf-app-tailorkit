/**
 * OldVsNewComparison Component
 *
 * Displays a side-by-side pricing comparison for V1 (revenue-based) users
 * considering migration to V2 (order-based) plans. Shows a DataTable
 * with AI credits, subscription fees, extra order fees, migration discount,
 * and total cost for both old and new pricing.
 */

import type { BadgeProps } from '@shopify/polaris'
import { Badge, BlockStack, Box, Card, DataTable, InlineGrid, InlineStack, Text, TextField } from '@shopify/polaris'
import type { TFunction } from 'i18next'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import { getOverageFeePerOrder } from '~/models/helpers/pricing-utils'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING, EVENTS_PARAMETERS_NAME } from '~/bootstrap/constants/eventsTracking'
import {
  calculateV1Breakdown,
  calculateV2MigrationBreakdown,
  recommendMigrationPlan,
} from '../../utils/oldPricingCalculation'
import { formatCurrency } from '../../utils/planRecommendation'

interface OldVsNewComparisonProps {
  t: TFunction
  v2Plans: PricingPlanDocument[]
  currentPlan?: PricingPlanDocument
}

const MAX_ORDER_COUNT = 100000
const MAX_REVENUE = 10000000
/** Average order count for a typical small Shopify store (just above Starter plan's 50 free orders) */
const DEFAULT_ORDER_COUNT = 51
/** Approximate monthly revenue for a store with ~51 orders at ~$41 AOV */
const DEFAULT_REVENUE = 2100

const CELL_CENTER_STYLE: React.CSSProperties = { textAlign: 'center' }

type PlanTier = 'starter' | 'growth' | 'enterprise'

function getPlanTier(plan: PricingPlanDocument): PlanTier {
  const price = plan.price || 0
  if (price >= 99) return 'enterprise'
  if (price >= 49) return 'growth'
  return 'starter'
}

function getTierBadgeTone(tier: PlanTier): BadgeProps['tone'] {
  switch (tier) {
    case 'starter':
      return 'success-strong'
    case 'growth':
      return 'warning-strong'
    case 'enterprise':
      return 'info-strong'
  }
}

export function OldVsNewComparison({ t, v2Plans, currentPlan }: OldVsNewComparisonProps) {
  const [orderCount, setOrderCount] = useState(DEFAULT_ORDER_COUNT)
  const [monthlyRevenue, setMonthlyRevenue] = useState(DEFAULT_REVENUE)
  const { trackEvent } = useEventsTracking()
  const calculatorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleOrderCountChange = useCallback(
    (value: string) => {
      const numericValue = value.replace(/[^0-9]/g, '')
      const numValue = parseInt(numericValue, 10)

      if (isNaN(numValue)) {
        setOrderCount(0)
      } else if (numValue > MAX_ORDER_COUNT) {
        setOrderCount(MAX_ORDER_COUNT)
      } else {
        setOrderCount(numValue)
      }

      // Debounced tracking - only fire after user stops adjusting for 1500ms
      if (calculatorDebounceRef.current) {
        clearTimeout(calculatorDebounceRef.current)
      }
      const finalValue = isNaN(numValue) ? 0 : Math.min(numValue, MAX_ORDER_COUNT)
      calculatorDebounceRef.current = setTimeout(() => {
        trackEvent(EVENTS_TRACKING.PRICING_CALCULATOR_USED, {
          [EVENTS_PARAMETERS_NAME.ORDER_COUNT]: finalValue,
          [EVENTS_PARAMETERS_NAME.SOURCE_COMPONENT]: 'old_vs_new',
        })
      }, 1500)
    },
    [trackEvent]
  )

  const handleRevenueChange = useCallback((value: string) => {
    const numericValue = value.replace(/[^0-9.]/g, '')
    const numValue = parseFloat(numericValue)

    if (isNaN(numValue)) {
      setMonthlyRevenue(0)
    } else if (numValue > MAX_REVENUE) {
      setMonthlyRevenue(MAX_REVENUE)
    } else {
      setMonthlyRevenue(numValue)
    }
  }, [])

  const recommendedPlan = useMemo(() => {
    return recommendMigrationPlan(orderCount, v2Plans)
  }, [orderCount, v2Plans])

  const v1Breakdown = useMemo(() => calculateV1Breakdown(monthlyRevenue, currentPlan), [monthlyRevenue, currentPlan])

  const v2Breakdown = useMemo(() => {
    if (!recommendedPlan) return null
    return calculateV2MigrationBreakdown(recommendedPlan, orderCount)
  }, [recommendedPlan, orderCount])

  if (!recommendedPlan || !v2Breakdown) return null

  const planName = recommendedPlan.name || recommendedPlan.alias || ''
  const planTier = getPlanTier(recommendedPlan)
  const overageFee = getOverageFeePerOrder(recommendedPlan)
  const savings = v1Breakdown.total - v2Breakdown.total

  // Build table rows
  const rows = [
    // AI Credits
    [
      <Text key="ai-label" as="span" variant="bodySm" fontWeight="semibold">
        {t('ai-credits')}
      </Text>,
      <div key="ai-new" style={CELL_CENTER_STYLE}>
        <Text as="span" variant="bodySm">
          {v2Breakdown.aiCredits.toLocaleString()} {t('free-credits-per-month')}
        </Text>
      </div>,
      <div key="ai-old" style={CELL_CENTER_STYLE}>
        <Text as="span" variant="bodySm">
          {v1Breakdown.aiCredits.toLocaleString()} {t('free-credits-per-month')}
        </Text>
      </div>,
    ],

    // Subscription fee
    [
      <Text key="sub-label" as="span" variant="bodySm" fontWeight="semibold">
        {t('subscription-fee')}
      </Text>,
      <div key="sub-new" style={CELL_CENTER_STYLE}>
        <Text as="span" variant="bodySm">
          {formatCurrency(v2Breakdown.subscriptionFee)}
        </Text>
      </div>,
      <div key="sub-old" style={CELL_CENTER_STYLE}>
        <Text as="span" variant="bodySm">
          {formatCurrency(v1Breakdown.subscriptionFee)}
        </Text>
      </div>,
    ],

    // Extra order fees
    [
      <Text key="extra-label" as="span" variant="bodySm" fontWeight="semibold">
        {t('extra-order-fees')}
      </Text>,
      <div key="extra-new" style={CELL_CENTER_STYLE}>
        <Text as="span" variant="bodySm">
          {formatCurrency(overageFee)}
        </Text>
      </div>,
      <div key="extra-old" style={CELL_CENTER_STYLE}>
        <Text as="span" variant="bodySm">
          {formatCurrency(0)}
        </Text>
      </div>,
    ],

    // 50% migration discount
    [
      <Text key="disc-label" as="span" variant="bodySm" fontWeight="semibold">
        {t('50-discount-for-1st-month')}
      </Text>,
      <div key="disc-new" style={CELL_CENTER_STYLE}>
        <Text as="span" variant="bodySm" tone="success">
          {v2Breakdown.discount > 0 ? `\u2014 ${formatCurrency(v2Breakdown.discount)}` : formatCurrency(0)}
        </Text>
      </div>,
      <div key="disc-old" style={CELL_CENTER_STYLE}>
        <Text as="span" variant="bodySm">
          {formatCurrency(0)}
        </Text>
      </div>,
    ],

    // Total
    [
      <Text key="total-label" as="span" variant="headingMd" fontWeight="bold">
        {t('total')}
      </Text>,
      <div key="total-new" style={CELL_CENTER_STYLE}>
        <Text as="span" variant="headingMd" fontWeight="bold" tone={savings > 0 ? 'success' : undefined}>
          {formatCurrency(v2Breakdown.total)}
        </Text>
      </div>,
      <div key="total-old" style={CELL_CENTER_STYLE}>
        <Text as="span" variant="headingMd" fontWeight="bold">
          {formatCurrency(v1Breakdown.total)}
        </Text>
      </div>,
    ],
  ]

  const valueHeading = (
    <Text as="span" variant="headingSm" fontWeight="bold">
      {t('value')}
    </Text>
  )

  const newPricingHeading = (
    <div style={{ textAlign: 'center' }}>
      <InlineStack gap="100" blockAlign="center" align="center">
        <Text as="span" variant="headingSm" fontWeight="bold">
          {t('new-pricing')}
        </Text>
        <Badge tone={getTierBadgeTone(planTier)}>{planName}</Badge>
      </InlineStack>
    </div>
  )

  const oldPricingHeading = (
    <div style={{ textAlign: 'center' }}>
      <Text as="span" variant="headingSm" fontWeight="bold">
        {t('old-pricing')}
      </Text>
    </div>
  )

  return (
    <Card>
      <Box id="pricing-calculator">
        <BlockStack gap="400">
          <Text as="h2" variant="headingMd">
            {t('pricing-comparison-old-vs-new')}
          </Text>

          <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
            <TextField
              label={t('average-number-of-orders-per-month')}
              type="number"
              value={String(orderCount)}
              onChange={handleOrderCountChange}
              autoComplete="off"
              min={0}
              max={MAX_ORDER_COUNT}
            />
            <TextField
              label={t('average-revenue-per-month')}
              type="number"
              value={String(monthlyRevenue)}
              onChange={handleRevenueChange}
              autoComplete="off"
              prefix="$"
              min={0}
              max={MAX_REVENUE}
            />
          </InlineGrid>

          <DataTable
            columnContentTypes={['text', 'text', 'text']}
            headings={[valueHeading, newPricingHeading, oldPricingHeading]}
            rows={rows}
            fixedFirstColumns={1}
          />

          <Text as="p" variant="bodySm" tone="subdued">
            * {t('note-billed-monthly-no-extra-ai-fees-included')}
          </Text>
        </BlockStack>
      </Box>
    </Card>
  )
}
