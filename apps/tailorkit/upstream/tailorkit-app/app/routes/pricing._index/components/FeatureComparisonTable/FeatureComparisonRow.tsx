/**
 * FeatureComparisonRow Component
 *
 * Renders a single feature row with values for each plan.
 * Label column is sticky for horizontal scrolling on mobile.
 */

import { InlineStack, Text, Box, Icon, BlockStack } from '@shopify/polaris'
import { CheckCircleIcon, XSmallIcon } from '@shopify/polaris-icons'
import type { FeatureComparisonRowProps, FeatureValue } from './types'
import { isValidElement } from 'react'

/**
 * Default renderer for feature values
 * Converts boolean/string/number to appropriate display
 */
function renderFeatureValue(value: FeatureValue) {
  // Boolean values: show icon
  if (typeof value === 'boolean') {
    if (value) {
      return (
        <Box paddingInline="300">
          <Icon source={CheckCircleIcon} tone="success" />
        </Box>
      )
    }
    return (
      <Box paddingInline="300">
        <Icon source={XSmallIcon} tone="subdued" />
      </Box>
    )
  }

  // ReactNode: render as-is
  if (isValidElement(value)) {
    return value
  }

  // String/Number: render as text
  return (
    <Text as="p" variant="bodyMd" alignment="center">
      {String(value)}
    </Text>
  )
}

export function FeatureComparisonRow({ feature, planAliases }: FeatureComparisonRowProps) {
  const isAlternate = feature.alternateBackground
  const background = isAlternate ? 'bg-surface-active' : 'bg-surface'
  const stickyBg = isAlternate ? 'var(--p-color-bg-surface-active)' : 'var(--p-color-bg-surface)'

  return (
    <Box
      background={background}
      padding="300"
      borderInlineStartWidth={'025'}
      borderInlineEndWidth={'025'}
      borderColor="border"
      borderBlockEndWidth={'025'}
    >
      <div style={{ display: 'flex', gap: 'var(--p-space-300)', alignItems: 'center' }}>
        {/* Feature Label Column - Sticky */}
        <div
          style={{
            position: 'sticky',
            left: 0,
            zIndex: 1,
            minWidth: '243px',
            backgroundColor: stickyBg,
            paddingRight: 'var(--p-space-300)',
          }}
        >
          {feature.subtitle ? (
            <BlockStack gap="100">
              <Text as="span" variant="headingSm" fontWeight="semibold">
                {feature.label}
              </Text>
              {typeof feature.subtitle === 'string' ? (
                <Text as="span" variant="bodyMd" tone="subdued">
                  {feature.subtitle}
                </Text>
              ) : (
                feature.subtitle
              )}
            </BlockStack>
          ) : (
            <Text as="span" variant="headingSm" fontWeight="semibold">
              {feature.label}
            </Text>
          )}
        </div>

        {/* Feature Value Columns */}
        {planAliases.map(alias => {
          const value = feature.values[alias]
          const content = feature.renderValue ? feature.renderValue(value, alias) : renderFeatureValue(value)

          return (
            <div key={alias} style={{ flex: 1, minWidth: 0 }}>
              <InlineStack align="center" blockAlign="center">
                {content}
              </InlineStack>
            </div>
          )
        })}
      </div>
    </Box>
  )
}

export default FeatureComparisonRow
