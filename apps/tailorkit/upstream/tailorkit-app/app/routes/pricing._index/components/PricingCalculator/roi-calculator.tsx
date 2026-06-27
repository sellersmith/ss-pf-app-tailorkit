/**
 * ROI Calculator — "Profit Machine" variant.
 *
 * Shows merchants the revenue potential of personalization with animated
 * counting numbers for a dopamine-hit UX. Uses "Estimated" and "Potential"
 * language to comply with Shopify's policy against guaranteed income claims.
 */

import { useState, useMemo, useRef, useCallback } from 'react'
import { BlockStack, Button, ButtonGroup, InlineGrid, Text, TextField, Divider } from '@shopify/polaris'
import type { TFunction } from 'i18next'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import { calculateTotalCost } from '../../utils/planRecommendation'
import { isOrderBasedPlan } from '~/models/helpers/pricing-utils'
import { useAnimatedNumber } from '../../hooks/use-animated-number'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING, EVENTS_PARAMETERS_NAME } from '~/bootstrap/constants/eventsTracking'
import styles from '../../styles.module.css'

interface ROICalculatorProps {
  t: TFunction
  plans: PricingPlanDocument[]
  orderCount: number
  onOrderCountChange: (value: number) => void
}

const MAX_ORDER_COUNT = 100000
const DEFAULT_PERSONALIZATION_FEE = 15

function formatUSD(amount: number): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function ROICalculator({ t, plans, orderCount, onOrderCountChange }: ROICalculatorProps) {
  const { trackEvent } = useEventsTracking()
  const roiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [personalizationFee, setPersonalizationFee] = useState(DEFAULT_PERSONALIZATION_FEE)

  // Order-based plans sorted by price (Starter first, then Growth)
  const orderBasedPlans = useMemo(() => plans.filter(isOrderBasedPlan).sort((a, b) => a.price - b.price), [plans])

  // User-selectable plan for fee calculation (defaults to Growth for higher perceived ROI)
  const [selectedPlanId, setSelectedPlanId] = useState<string>(() => {
    const growth = orderBasedPlans.find(p => (p.alias || p.name).toLowerCase().includes('growth'))
    return growth?._id || orderBasedPlans[0]?._id || ''
  })

  const selectedPlan = useMemo(
    () => orderBasedPlans.find(p => p._id === selectedPlanId) ?? orderBasedPlans[0],
    [orderBasedPlans, selectedPlanId]
  )

  // Debounced tracking for ROI calculator interactions
  const trackROIChange = useCallback(
    (volume: number, fee: number) => {
      if (roiDebounceRef.current) clearTimeout(roiDebounceRef.current)
      roiDebounceRef.current = setTimeout(() => {
        trackEvent(EVENTS_TRACKING.PRICING_ROI_CALCULATOR_USED, {
          [EVENTS_PARAMETERS_NAME.ORDER_COUNT]: volume,
          personalization_fee: fee,
          estimated_revenue: volume * fee,
          selected_plan: selectedPlan?.name || '',
          potential_profit: volume * fee - (selectedPlan ? calculateTotalCost(selectedPlan, volume) : 0),
        })
      }, 1500)
    },
    [trackEvent, selectedPlan]
  )

  // ROI calculations based on user-selected plan
  const estimatedRevenue = orderCount * personalizationFee
  const totalAppFee = selectedPlan ? calculateTotalCost(selectedPlan, orderCount) : 0
  const potentialProfit = estimatedRevenue - totalAppFee

  // Animated numbers for the dopamine counting effect
  const animRevenue = useAnimatedNumber(estimatedRevenue)
  const animFee = useAnimatedNumber(totalAppFee)
  const animProfit = useAnimatedNumber(potentialProfit)

  const handleOrderChange = (value: string) => {
    const num = parseInt(value.replace(/[^0-9]/g, ''), 10)
    const clamped = isNaN(num) ? 0 : Math.min(num, MAX_ORDER_COUNT)
    onOrderCountChange(clamped)
    trackROIChange(clamped, personalizationFee)
  }

  const handleFeeChange = (value: string) => {
    const num = parseFloat(value.replace(/[^0-9.]/g, ''))
    const clamped = isNaN(num) ? 0 : Math.min(num, 999)
    setPersonalizationFee(clamped)
    trackROIChange(orderCount, clamped)
  }

  const handlePlanChange = useCallback(
    (value: string) => {
      setSelectedPlanId(value)
      const plan = orderBasedPlans.find(p => p._id === value)
      trackEvent(EVENTS_TRACKING.PRICING_ROI_CALCULATOR_USED, {
        [EVENTS_PARAMETERS_NAME.ORDER_COUNT]: orderCount,
        personalization_fee: personalizationFee,
        selected_plan: plan?.name || '',
        action: 'plan_switch',
      })
    },
    [orderBasedPlans, trackEvent, orderCount, personalizationFee]
  )

  return (
    <BlockStack gap="400">
      {/* Inputs row */}
      <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
        <TextField
          label={t('monthly-order-volume')}
          type="number"
          value={orderCount.toString()}
          onChange={handleOrderChange}
          autoComplete="off"
          min={0}
          max={MAX_ORDER_COUNT}
        />
        <TextField
          label={t('average-personalization-fee-usd')}
          type="number"
          value={personalizationFee.toString()}
          onChange={handleFeeChange}
          prefix="$"
          autoComplete="off"
          min={0}
        />
      </InlineGrid>

      <Divider />

      {/* Results with counting animation */}
      <BlockStack gap="300">
        {/* Estimated Revenue */}
        <div className={styles.revenueRow}>
          <InlineGrid columns={{ xs: '1fr auto' }}>
            <Text as="p" variant="bodyMd">
              {t('estimated-extra-revenue')}
            </Text>
            <Text as="p" variant="headingMd" fontWeight="bold" tone="success">
              <span className={`${styles.roiAmount} ${animRevenue.isAnimating ? styles.roiAmountAnimating : ''}`}>
                +${formatUSD(animRevenue.value)}
              </span>
            </Text>
          </InlineGrid>
        </div>

        {/* App Fee — with plan selector */}
        <div className={styles.feeRow}>
          <BlockStack gap="200">
            <InlineGrid columns={{ xs: '1fr auto' }}>
              <Text as="p" variant="bodyMd" tone="subdued">
                {t('tailorkit-plan-fee')}
              </Text>
              <Text as="p" variant="bodyMd" tone="critical">
                -${formatUSD(animFee.value)}
              </Text>
            </InlineGrid>
            {orderBasedPlans.length > 1 && (
              <ButtonGroup variant="segmented">
                {orderBasedPlans.map(p => (
                  <Button
                    key={p._id}
                    pressed={p._id === selectedPlanId}
                    onClick={() => handlePlanChange(p._id)}
                    size="slim"
                  >
                    {p.name}
                  </Button>
                ))}
              </ButtonGroup>
            )}
          </BlockStack>
        </div>

        {/* Net Profit — dominant, oversized */}
        <div className={styles.profitRow}>
          <InlineGrid columns={{ xs: '1fr auto' }} alignItems="center">
            <Text as="p" variant="headingMd">
              {t('your-potential-net-profit')}
            </Text>
            <span
              className={`${styles.netProfitAmount} ${styles.roiAmount} ${animProfit.isAnimating ? styles.roiAmountAnimating : ''}`}
              style={{ color: potentialProfit >= 0 ? 'var(--p-color-text-success)' : 'var(--p-color-text-critical)' }}
            >
              {potentialProfit >= 0 ? '+' : ''}${formatUSD(animProfit.value)}
              {potentialProfit > 0 ? ` ${t('rocket-emoji')}` : ''}
            </span>
          </InlineGrid>
        </div>
      </BlockStack>
    </BlockStack>
  )
}
