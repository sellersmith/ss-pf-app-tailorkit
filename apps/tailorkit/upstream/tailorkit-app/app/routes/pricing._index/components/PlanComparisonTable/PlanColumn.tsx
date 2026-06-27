/**
 * PlanColumn Component
 *
 * Displays a single plan column in the comparison table with
 * plan name, pricing breakdown, and action button.
 */

import { BlockStack, Box, Button, Text, Badge, SkeletonDisplayText, Divider, InlineStack, Card } from '@shopify/polaris'
import type { BadgeProps } from '@shopify/polaris'
import type { PlanColumnProps } from './types'
import { formatCurrency, getPlanDisplayName } from '../../utils/planRecommendation'
import type { PlanAction } from '../PlanSelectionCards/PlanCard'
import type { TFunction } from 'i18next'

type PlanTier = 'starter' | 'growth' | 'enterprise'

/**
 * Get the tier of a plan based on its name
 */
function getPlanTier(planName: string): PlanTier {
  const lowerName = planName.toLowerCase()
  if (lowerName.includes('enterprise')) return 'enterprise'
  if (lowerName.includes('growth')) return 'growth'
  return 'starter'
}

/**
 * Get the background color for a plan tier header
 */
function getTierBackground(tier: PlanTier): 'bg-surface-success' | 'bg-surface-warning' | 'bg-surface-info' {
  switch (tier) {
    case 'starter':
      return 'bg-surface-success'
    case 'growth':
      return 'bg-surface-warning'
    case 'enterprise':
      return 'bg-surface-info'
  }
}

/**
 * Get the badge tone for a plan tier
 */
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

function getColumnButtonLabel(planAction: PlanAction, t: TFunction): string {
  switch (planAction) {
    case 'current':
      return t('current-plan')
    case 'upgrade':
      return t('upgrade')
    case 'downgrade':
      return t('downgrade')
    default:
      return t('select-plan')
  }
}

export function PlanColumn({ t, data, onSelectPlan, isCalculating = false }: PlanColumnProps) {
  const { plan, calculatedPrice, isBestPrice, planAction } = data
  const planName = getPlanDisplayName(plan)
  const planTier = getPlanTier(planName)
  const isCurrentPlan = planAction === 'current'

  const handleSelectPlan = () => {
    onSelectPlan(plan, calculatedPrice)
  }

  return (
    <Card padding={'0'}>
      <BlockStack gap="300">
        <Box padding="300" background={isBestPrice ? getTierBackground(planTier) : 'bg-fill-disabled'}>
          {/* Plan Name with Best Price Badge */}
          <InlineStack gap="100" blockAlign="center" align="center">
            <Text as="p" variant="headingMd" alignment="center" fontWeight="bold">
              {planName}
            </Text>
            {isBestPrice && <Badge tone={getTierBadgeTone(planTier)}>{t('best-price')}</Badge>}
          </InlineStack>
        </Box>

        {/* Price Breakdown */}
        <Box padding="300">
          <BlockStack gap="300">
            {/* Subscription Fee */}
            <InlineStack gap="100" blockAlign="start" align="space-between">
              <BlockStack gap="0">
                <Text as="span" variant="bodyMd">
                  {t('subscription-fee')}
                </Text>
                <Text as="span" variant="bodySm" tone="subdued">
                  {t('numfreeorderspermonth', { count: calculatedPrice.includedOrders })}
                </Text>
              </BlockStack>
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                {formatCurrency(calculatedPrice.subscriptionFee)}
              </Text>
            </InlineStack>

            {/* Extra Order Fee */}
            <InlineStack gap="100" blockAlign="start" align="space-between">
              <BlockStack gap="0">
                <Text as="span" variant="bodyMd">
                  {t('extra-order-fee')}
                </Text>
                <Text as="span" variant="bodySm" tone="subdued">
                  {formatCurrency(calculatedPrice.overageFeePerOrder)} {t('per-order')}
                </Text>
              </BlockStack>
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                {formatCurrency(calculatedPrice.extraOrderFee)}
              </Text>
            </InlineStack>

            <Divider />

            {/* Subtotal */}
            <InlineStack gap="100" blockAlign="center" align="space-between">
              <Text as="span" variant="bodyMd">
                {t('subtotal')}
              </Text>
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                {formatCurrency(calculatedPrice.subtotal)}
              </Text>
            </InlineStack>

            {/* Discount */}
            <InlineStack gap="100" blockAlign="center" align="space-between">
              <Text as="span" variant="bodyMd">
                {t('discount')}
              </Text>
              <Text
                as="span"
                variant="bodyMd"
                fontWeight="semibold"
                tone={calculatedPrice.discount > 0 ? 'success' : undefined}
              >
                {calculatedPrice.discount > 0
                  ? `-${formatCurrency(calculatedPrice.discount)}`
                  : `- ${formatCurrency(0)}`}
              </Text>
            </InlineStack>

            <Divider />

            {/* Total */}
            <InlineStack gap="100" blockAlign="center" align="space-between">
              <Text as="span" variant="headingMd" fontWeight="bold">
                {t('total')}
              </Text>
              {isCalculating ? (
                <Box minWidth="80px">
                  <SkeletonDisplayText size="small" />
                </Box>
              ) : (
                <Text as="span" variant="headingMd" fontWeight="bold" tone={isBestPrice ? 'success' : undefined}>
                  {formatCurrency(calculatedPrice.total)}
                </Text>
              )}
            </InlineStack>

            {/* Note */}
            <Text as="p" variant="bodySm" tone="subdued">
              * {t('note-billed-monthly-no-extra-ai-fees-included')}
            </Text>
          </BlockStack>
        </Box>

        {/* Choose Plan Button */}
        <Box padding="300" paddingBlockStart="0">
          <Button
            variant={isCurrentPlan ? 'secondary' : isBestPrice ? 'primary' : 'secondary'}
            fullWidth
            onClick={handleSelectPlan}
            disabled={isCurrentPlan || isCalculating}
          >
            {getColumnButtonLabel(planAction, t)}
          </Button>
        </Box>
      </BlockStack>
    </Card>
  )
}

export default PlanColumn
