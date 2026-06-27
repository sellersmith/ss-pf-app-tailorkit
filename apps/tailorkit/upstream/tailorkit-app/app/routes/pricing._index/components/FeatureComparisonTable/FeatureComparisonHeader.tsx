/**
 * FeatureComparisonHeader Component
 *
 * Renders the header row with plan names and prices.
 * Label column is sticky for horizontal scrolling on mobile.
 */

import { InlineStack, Text, BlockStack, Box } from '@shopify/polaris'
import type { FeatureComparisonHeaderProps } from './types'
import { formatCurrency } from '../../utils/planRecommendation'

export function FeatureComparisonHeader({ t, headerLabel, plans }: FeatureComparisonHeaderProps) {
  return (
    <Box
      background="bg-surface"
      padding="400"
      borderColor="border"
      borderWidth="025"
      borderRadius="300"
      borderEndStartRadius="0"
      borderEndEndRadius="0"
    >
      <div style={{ display: 'flex', gap: 'var(--p-space-300)', alignItems: 'center' }}>
        {/* Features Column Header - Sticky */}
        <div
          style={{
            position: 'sticky',
            left: 0,
            zIndex: 1,
            minWidth: '243px',
            backgroundColor: 'var(--p-color-bg-surface)',
            paddingRight: 'var(--p-space-300)',
          }}
        >
          <Text as="h3" variant="headingMd" fontWeight="bold">
            {headerLabel}
          </Text>
        </div>

        {/* Plan Columns */}
        {plans.map(plan => (
          <div key={plan.alias} style={{ flex: 1, minWidth: 0 }}>
            <BlockStack gap="300">
              <Text as="p" variant="bodyMd" tone="subdued">
                {plan.name}
              </Text>
              <InlineStack gap="100" blockAlign="center">
                <Text as="span" variant="heading2xl" fontWeight="bold">
                  {formatCurrency(plan.price)}
                </Text>
                <Text as="span" variant="bodyMd">
                  /{plan.period || t('month')}
                </Text>
              </InlineStack>
            </BlockStack>
          </div>
        ))}
      </div>
    </Box>
  )
}

export default FeatureComparisonHeader
