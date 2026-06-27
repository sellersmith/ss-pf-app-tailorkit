/**
 * PlanComparisonTable Component
 *
 * Displays a comparison table of all pricing plans side-by-side
 * with an order count input, discount code, and "Best price" highlighting.
 * On mobile, plans are displayed in a horizontally scrollable carousel.
 */

import { useMemo } from 'react'
import { BlockStack, Text, TextField, Box, InlineGrid, Button, Icon } from '@shopify/polaris'
import type { PlanComparisonTableProps, PlanColumnData } from './types'
import { PlanColumn } from './PlanColumn'
import { calculatePlanPrice, findBestPricePlan } from '../../utils/planRecommendation'
import { CheckIcon } from '@shopify/polaris-icons'
import { CarouselWithPagination } from '~/components/Carousel'
import useDevices from '~/utils/hooks/useDevice'
import { isOrderBasedPlan } from '~/models/helpers/pricing-utils'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import type { SubscriptionDocument } from '~/models/Subscription'
import { useRootLoaderData } from '~/root'
import type { PlanAction } from '../PlanSelectionCards/PlanCard'

const MAX_ORDER_COUNT = 100000

function getPlanAction(
  planId: string,
  planPrice: number,
  currentPlanId?: string,
  currentPlanPrice?: number
): PlanAction {
  if (!currentPlanId) return 'select'
  if (currentPlanId === planId) return 'current'
  return planPrice > currentPlanPrice! ? 'upgrade' : 'downgrade'
}

export function PlanComparisonTable({
  t,
  plans,
  orderCount,
  onOrderCountChange,
  onSelectPlan,
  discountCode,
  onDiscountCodeChange,
  onCheckDiscount,
  discountStatus,
  validatedCoupon,
  discountError,
  isLoading = false,
}: PlanComparisonTableProps) {
  const { isMobileView, isSmallMobileView } = useDevices()

  // Get current plan info from root loader
  const { shopData } = useRootLoaderData()
  const subscription = shopData?.subscription as SubscriptionDocument | null
  const currentPlan = subscription?.plan as PricingPlanDocument | null
  const currentPlanId = currentPlan?._id?.toString()
  const currentPlanPrice = currentPlan?.price

  // Filter to order-based plans only
  const v2Plans = useMemo(() => {
    return plans.filter(plan => isOrderBasedPlan(plan))
  }, [plans])

  // Find the best price plan
  const bestPricePlanId = useMemo(() => {
    return findBestPricePlan(plans, orderCount)
  }, [plans, orderCount])

  // Build column data for each plan (with coupon applied)
  const columnData: PlanColumnData[] = useMemo(() => {
    return v2Plans.map(plan => ({
      plan,
      calculatedPrice: calculatePlanPrice(plan, orderCount, validatedCoupon),
      isBestPrice: plan._id === bestPricePlanId,
      planAction: getPlanAction(plan._id.toString(), plan.price, currentPlanId, currentPlanPrice),
    }))
  }, [v2Plans, orderCount, bestPricePlanId, validatedCoupon, currentPlanId, currentPlanPrice])

  // Sort by price (lowest first) for consistent display
  const sortedColumnData = useMemo(() => {
    return [...columnData].sort((a, b) => a.plan.price - b.plan.price)
  }, [columnData])

  // Index of the best price plan for auto-scrolling on mobile
  const bestPriceIndex = useMemo(() => {
    const index = sortedColumnData.findIndex(data => data.isBestPrice)
    return Math.max(index, 0)
  }, [sortedColumnData])

  const itemsPerSlide = isSmallMobileView ? 1 : 2

  // Handle order count input change
  const handleOrderCountChange = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '')
    const numValue = parseInt(numericValue, 10)

    if (isNaN(numValue)) {
      onOrderCountChange(0)
    } else if (numValue > MAX_ORDER_COUNT) {
      onOrderCountChange(MAX_ORDER_COUNT)
    } else {
      onOrderCountChange(numValue)
    }
  }

  if (v2Plans.length === 0) {
    return (
      <Box padding="400">
        <Text as="p" tone="subdued" alignment="center">
          {t('no-plans-available')}
        </Text>
      </Box>
    )
  }

  const planColumns = sortedColumnData.map(data => (
    <PlanColumn key={data.plan._id} t={t} data={data} onSelectPlan={onSelectPlan} isCalculating={isLoading} />
  ))

  return (
    <BlockStack gap="400">
      {/* Order Count & Discount Code - Side by side */}
      <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
        <TextField
          label={t('average-number-of-orders-per-month')}
          type="number"
          value={orderCount.toString()}
          onChange={handleOrderCountChange}
          placeholder="0"
          autoComplete="off"
          min={0}
          max={MAX_ORDER_COUNT}
          disabled={isLoading}
        />

        <TextField
          label={t('discount-code')}
          value={discountCode}
          onChange={onDiscountCodeChange}
          placeholder={t('enter-code')}
          autoComplete="off"
          disabled={discountStatus === 'checking' || isLoading}
          error={discountStatus === 'invalid' ? discountError : undefined}
          connectedRight={
            <Button
              onClick={onCheckDiscount}
              disabled={!discountCode.trim() || isLoading}
              loading={discountStatus === 'checking'}
              icon={discountStatus === 'valid' && validatedCoupon ? <Icon source={CheckIcon} /> : undefined}
            >
              {t('check')}
            </Button>
          }
        />
      </InlineGrid>

      {/* Plan Columns - Carousel on mobile, Grid on desktop */}
      {isMobileView ? (
        <CarouselWithPagination
          id="plan-comparison-carousel"
          itemsPerSlide={itemsPerSlide}
          numItems={sortedColumnData.length}
          paginationStyle="dots"
          defaultActiveIndex={bestPriceIndex}
        >
          {planColumns}
        </CarouselWithPagination>
      ) : (
        <InlineGrid columns={sortedColumnData.length} gap="300">
          {planColumns}
        </InlineGrid>
      )}
    </BlockStack>
  )
}

export default PlanComparisonTable
