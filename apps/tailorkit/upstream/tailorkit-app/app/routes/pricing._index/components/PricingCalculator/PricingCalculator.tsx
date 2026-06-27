/**
 * PricingCalculator Component
 *
 * A comparison table layout showing all plans side-by-side with the
 * "Best price" badge highlighting the most cost-effective option.
 */

import { useState, useCallback, useRef } from 'react'
import { Card, BlockStack, Text } from '@shopify/polaris'
import type { PricingCalculatorProps } from './types'
import { ROICalculator } from './roi-calculator'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING, EVENTS_PARAMETERS_NAME } from '~/bootstrap/constants/eventsTracking'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'

export function PricingCalculator({
  t,
  plans,
  initialOrderCount = 150,
  subscriberMode = false,
}: PricingCalculatorProps) {
  const { trackEvent } = useEventsTracking()
  const { trackStarted: trackROIStarted } = useFeatureTracking('pricing_roi_calculator')

  // Form state
  const [orderCount, setOrderCount] = useState<number>(initialOrderCount)

  // Debounce ref for calculator tracking
  const calculatorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Handle order count change
  const handleOrderCountChange = useCallback(
    (value: number) => {
      setOrderCount(value)

      // Debounced tracking - only fire after user stops adjusting for 1500ms
      if (calculatorDebounceRef.current) {
        clearTimeout(calculatorDebounceRef.current)
      }
      calculatorDebounceRef.current = setTimeout(() => {
        trackEvent(EVENTS_TRACKING.PRICING_CALCULATOR_USED, {
          [EVENTS_PARAMETERS_NAME.ORDER_COUNT]: value,
          [EVENTS_PARAMETERS_NAME.SOURCE_COMPONENT]: 'calculator',
        })
        trackROIStarted({ order_count: value })
      }, 1500)
    },
    [trackEvent, trackROIStarted]
  )

  return (
    <Card>
      <BlockStack gap="400" id="pricing-calculator">
        {/* ROI Calculator — computes estimated revenue, plan fee, and net profit */}
        <BlockStack gap="100">
          <Text as="h2" variant="headingMd" fontWeight="bold">
            {subscriberMode ? t('project-your-next-month') : t('calculate-your-potential-roi')}
          </Text>
          <Text as="p" tone="subdued" variant="bodyMd">
            {subscriberMode
              ? t('estimate-next-month-revenue-from-current-usage')
              : t('estimate-how-much-extra-revenue-personalization-can-generate')}
          </Text>
        </BlockStack>

        <ROICalculator t={t} plans={plans} orderCount={orderCount} onOrderCountChange={handleOrderCountChange} />
      </BlockStack>
    </Card>
  )
}

export default PricingCalculator
