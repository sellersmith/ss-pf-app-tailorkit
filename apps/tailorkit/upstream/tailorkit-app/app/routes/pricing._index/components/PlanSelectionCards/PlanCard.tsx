import { BlockStack, Text, Icon, InlineStack, Card, Divider, Button, Box, Badge } from '@shopify/polaris'
import type { TFunction } from 'i18next'
import { CheckIcon } from '@shopify/polaris-icons'
import type { PlanDisplayData } from '../../utils/planDisplayMapper'
import { PaymentJourneyTimeline } from './PaymentJourneyTimeline'
import { FIRST_MONTH_DEAL_DEADLINE } from '~/constants/first-month-deal'
import styles from '../../styles.module.css'

export type PlanAction = 'select' | 'current' | 'upgrade' | 'downgrade'

interface PlanCardProps {
  plan: PlanDisplayData
  onSelectPlan: (planAlias: string) => void
  planAction: PlanAction
  isLoading?: boolean
  t: TFunction
  remainingTrialDays?: number | null
  /** Whether the $1 deal promotion window is open */
  isDealActive?: boolean
  /** Whether this shop has never paid and is eligible for the $1 deal */
  isDealEligible?: boolean
}

function getButtonLabel(planAction: PlanAction, showDeal: boolean, t: TFunction): string {
  if (showDeal && (planAction === 'select' || planAction === 'upgrade')) {
    return t('upgrade-for-1-usd')
  }
  switch (planAction) {
    case 'current':
      return t('current-plan')
    case 'upgrade':
      return t('upgrade-plan')
    case 'downgrade':
      return t('downgrade-plan')
    default:
      return t('select-plan')
  }
}

/** Detect plan tier from alias/name for visual styling */
function getPlanTier(plan: PlanDisplayData): 'starter' | 'growth' | 'enterprise' {
  const key = (plan.alias || plan.tier).toLowerCase()
  if (key.includes('growth')) return 'growth'
  if (key.includes('enterprise')) return 'enterprise'
  return 'starter'
}

export default function PlanCard(props: PlanCardProps) {
  const {
    plan,
    onSelectPlan,
    planAction,
    isLoading = false,
    t,
    remainingTrialDays,
    isDealActive,
    isDealEligible,
  } = props

  const { projectedTotal, projectedExtraOrders, includedOrders, trialDays } = plan
  const overageOrderNumber = includedOrders + 1
  const isProjectedTotalValid = projectedTotal !== undefined && projectedTotal > 0
  const isProjectedExtraOrdersValid = projectedExtraOrders !== undefined && projectedExtraOrders > 0
  const hasProjectedCharges = isProjectedTotalValid && isProjectedExtraOrdersValid
  const displayTrialDays = remainingTrialDays ?? trialDays
  const isCurrentPlan = planAction === 'current'

  // Show $1 deal UI when: deal is active, shop is eligible, plan is paid, not the current plan
  const showDeal = !!isDealActive && !!isDealEligible && plan.price > 0 && !isCurrentPlan

  // Visual ranking — Growth gets premium treatment, Starter stays flat
  const tier = getPlanTier(plan)
  const isGrowth = tier === 'growth'

  // CTA button: Growth = solid success green, Starter = outlined secondary
  const ctaVariant = isGrowth || showDeal ? 'primary' : ('secondary' as const)
  const ctaTone = isGrowth || showDeal ? ('success' as const) : undefined

  // Growth uses a plain div (outer wrapper provides border/shadow);
  // Starter/other use Polaris Card for its native border.
  const Wrapper = isGrowth ? 'div' : Card
  const wrapperProps = isGrowth ? { className: styles.growthCardInner } : {}

  const cardContent = (
    <Wrapper {...wrapperProps}>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Text as="p" variant="headingMd" fontWeight="semibold">
              {t(plan.tier)}
            </Text>
            {plan.badge && <Badge tone="info">{plan.badge}</Badge>}
            {isCurrentPlan && <Badge tone="success">{t('your-plan')}</Badge>}
          </InlineStack>
          {/* Hide trial badge when deal timeline is shown (it covers trial info) */}
          {displayTrialDays && displayTrialDays > 0 && !showDeal ? (
            <Text as="p" variant="bodySm" tone="subdued">
              {t('count-day-free-trial', { count: displayTrialDays })}
            </Text>
          ) : null}
        </InlineStack>

        {/* $1 first month promotional badge — wrap in InlineStack so Badge sizes to content (BlockStack would stretch it full-width). */}
        {showDeal && (
          <InlineStack>
            <Badge tone="attention">
              {t('1-first-month-ends-date', {
                date: FIRST_MONTH_DEAL_DEADLINE.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              })}
            </Badge>
          </InlineStack>
        )}

        {/* Price section */}
        <BlockStack gap="100">
          {showDeal ? (
            // Deal pricing: strikethrough full price + $1/month
            <InlineStack gap="100" blockAlign="center">
              <Text as="span" variant="bodyMd" tone="subdued">
                <s>${plan.price.toFixed(2)}</s>
              </Text>
              <Text as="span" variant="heading2xl">
                $1
              </Text>
              <Text as="span" variant="bodyMd">
                /{t('month')}
              </Text>
            </InlineStack>
          ) : (
            // Normal pricing
            <InlineStack gap="100" blockAlign="center">
              <Text as="span" variant="heading2xl">
                ${plan.price.toFixed(2)}
              </Text>
              <Text as="span" variant="bodyMd">
                /{t('month')}
              </Text>
            </InlineStack>
          )}

          {hasProjectedCharges ? (
            <Text as="p" variant="bodySm" tone="subdued">
              {t('includes-number-extra-orders-at-dollar-amount-per-order', {
                number: plan.projectedExtraOrders,
                amount: plan.overageFeePerOrder.toFixed(2),
              })}
            </Text>
          ) : (
            <Text as="p" variant="bodySm" tone="subdued">
              ${plan.overageFeePerOrder.toFixed(2)}{' '}
              {t('per-extra-order-from-number-st-order', { number: overageOrderNumber })}
            </Text>
          )}
        </BlockStack>

        {/* Payment journey timeline — only shown when deal is active */}
        {showDeal && (
          <PaymentJourneyTimeline planPrice={plan.price} trialDays={displayTrialDays || trialDays || 14} t={t} />
        )}

        <Button
          variant={ctaVariant}
          tone={ctaTone}
          fullWidth
          onClick={() => onSelectPlan(plan.alias)}
          disabled={isCurrentPlan}
          loading={isLoading}
        >
          {getButtonLabel(planAction, showDeal, t)}
        </Button>

        <Divider />

        <BlockStack gap="200">
          {plan.features.map((feature, index) => (
            <InlineStack key={index} gap="200" blockAlign="start" wrap={false}>
              <Box>
                <Icon source={CheckIcon} />
              </Box>
              {feature.highlight ? (
                <Text as="span" variant="bodyMd" fontWeight="semibold">
                  {t('lightning-emoji')} {t(feature.text)}
                </Text>
              ) : (
                <Text as="span" variant="bodyMd">
                  {t(feature.text)}
                </Text>
              )}
            </InlineStack>
          ))}
        </BlockStack>
      </BlockStack>
    </Wrapper>
  )

  // Growth plan: wrap in premium container with shadow + accent border
  if (isGrowth) {
    return <div className={styles.growthPlanCard}>{cardContent}</div>
  }

  // Starter/other: Polaris Card handles border natively
  return cardContent
}
