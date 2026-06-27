import { BlockStack, Box, Button, InlineStack, Text, useBreakpoints } from '@shopify/polaris'
import type { PricingViewProps } from '../types'
import { OldVsNewComparison, UsageCard } from './index'
import { hasActivePlan } from '~/models/PricingPlan.fns'
import PlanSelectionCards from './PlanSelectionCards'
import { PricingCalculator } from './PricingCalculator'
import { FeatureComparisonTable } from './FeatureComparisonTable'
import { FAQ } from './FAQ'
import { SocialProofSection } from './social-proof-section'
import { buildPlanColumns, buildFeatureDefinitions } from '../utils/buildFeatureComparison'
import { useModal } from '~/utils/hooks/useModal'
import type { PricingPlanDocument } from '~/models/PricingPlan'

/**
 * Prospect view (no active plan, trial-expired, or migration-mode).
 * Behavior matches the historical /pricing page exactly — used as the
 * default fallback when the subscriber gate returns false.
 */
export default function ProspectView(props: PricingViewProps) {
  const {
    t,
    shopData,
    v2Plans,
    plan,
    hasActiveV1Plan,
    isOldPricingMigration,
    remainingTrialDays,
    billingCycleBaseline,
    billingCycles,
    showPricingCalculator,
    togglePricingCalculator,
    showFeatureComparisonTable,
    toggleFeatureComparisonTable,
    showFAQ,
    toggleFAQ,
    onSelectPlanByAlias,
  } = props
  const { mdDown } = useBreakpoints()
  const { openModal } = useModal()

  return (
    <BlockStack gap="300">
      {/* Page Header */}
      {hasActivePlan(shopData) ? (
        <Text as="h1" variant="headingXl">
          {t('pricing')}
        </Text>
      ) : (
        <BlockStack gap="200">
          <Text as="h1" variant="headingXl" alignment="center">
            {t('select-a-plan-to-continue')}
          </Text>
          {(remainingTrialDays === null || remainingTrialDays > 0) && (
            <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
              {t('enjoy-trial-days-free-to-explore-all-features-before-any-payment-is-required', {
                trialDaysFree: remainingTrialDays,
              })}
            </Text>
          )}
        </BlockStack>
      )}

      {/* Usage Card */}
      {hasActivePlan(shopData) && (
        <UsageCard
          shopData={shopData}
          t={t}
          billingCycleBaseline={billingCycleBaseline}
          billingCycles={billingCycles}
        />
      )}

      {/* Plan Selection Cards */}
      {v2Plans.length > 0 && (
        <PlanSelectionCards
          t={t}
          plans={v2Plans}
          onSelectPlan={onSelectPlanByAlias}
          remainingTrialDays={remainingTrialDays}
          billingCycleBaseline={billingCycleBaseline}
        />
      )}

      <BlockStack gap="200">
        {hasActivePlan(shopData) && (
          <Button variant="plain" removeUnderline onClick={togglePricingCalculator}>
            {showPricingCalculator ? t('hide-pricing-plan-calculator') : t('pricing-plan-calculator')}
          </Button>
        )}

        {/* V1 era users: Old vs New comparison | V2/new users: ROI Calculator */}
        {v2Plans.length > 0
          && showPricingCalculator
          && (isOldPricingMigration ? (
            <OldVsNewComparison
              t={t}
              v2Plans={v2Plans}
              currentPlan={hasActiveV1Plan ? (plan as PricingPlanDocument) : undefined}
            />
          ) : (
            <PricingCalculator t={t} plans={v2Plans} />
          ))}
      </BlockStack>

      <SocialProofSection t={t} />

      {/* Bottom CTA */}
      {v2Plans.length > 0 && (
        <Box paddingBlock="400" paddingInline={mdDown ? '400' : '0'}>
          <BlockStack gap="300" align="center">
            <Text as="h3" variant="headingMd" alignment="center">
              {t('ready-to-scale-your-personalization')}
            </Text>
            {(() => {
              const sorted = [...v2Plans].sort((a, b) => a.price - b.price)
              const ordered = mdDown ? [...sorted].reverse() : sorted
              const buttons = ordered.map(planItem => {
                const isGrowth = (planItem.alias || planItem.name).toLowerCase().includes('growth')
                return (
                  <Button
                    key={planItem.alias}
                    variant={isGrowth ? 'primary' : 'secondary'}
                    tone={isGrowth ? 'success' : undefined}
                    fullWidth={mdDown}
                    onClick={() => onSelectPlanByAlias(planItem.alias || planItem.name)}
                  >
                    {isGrowth
                      ? t('scale-with-plan-price-mo', { plan: planItem.name, price: planItem.price?.toFixed(2) })
                      : t('start-with-plan-price-mo', { plan: planItem.name, price: planItem.price?.toFixed(2) })}
                  </Button>
                )
              })
              return mdDown ? (
                <BlockStack gap="200">{buttons}</BlockStack>
              ) : (
                <InlineStack gap="300" align="center" blockAlign="center">
                  {buttons}
                </InlineStack>
              )
            })()}
          </BlockStack>
        </Box>
      )}

      {/* Feature Comparison Table */}
      <BlockStack gap="200">
        <InlineStack align="center">
          <Button variant="plain" removeUnderline onClick={toggleFeatureComparisonTable}>
            {showFeatureComparisonTable ? t('hide-key-features') : t('key-features')}
          </Button>
        </InlineStack>
        {v2Plans.length > 0 && showFeatureComparisonTable && (
          <FeatureComparisonTable
            t={t}
            headerLabel={
              <Text as="h3" variant="headingMd" fontWeight="bold">
                {t('key-features')}
              </Text>
            }
            plans={buildPlanColumns(v2Plans)}
            features={buildFeatureDefinitions(v2Plans, t, openModal)}
          />
        )}
      </BlockStack>

      {/* FAQ */}
      <BlockStack gap="200">
        <InlineStack align="center">
          <Button variant="plain" onClick={toggleFAQ}>
            {showFAQ ? t('hide-frequently-asked-questions') : t('frequently-asked-questions')}
          </Button>
        </InlineStack>
        {showFAQ && <FAQ t={t} plans={v2Plans} />}
      </BlockStack>
    </BlockStack>
  )
}
