/**
 * FeatureComparisonTable Component
 *
 * Displays a grouped comparison table of features across pricing plans.
 * Group headers span full width. Feature rows have hover highlight.
 * Uses Polaris DataTable with fixedFirstColumns for mobile responsiveness.
 */

import { isValidElement, useEffect, useMemo, useRef } from 'react'
import { BlockStack, DataTable, Icon, InlineStack, Text, useBreakpoints } from '@shopify/polaris'
import { CheckCircleIcon, XSmallIcon } from '@shopify/polaris-icons'
import type { FeatureComparisonTableProps, FeatureValue } from './types'
import { formatCurrency } from '../../utils/planRecommendation'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'
import styles from '../../styles.module.css'

function renderFeatureValue(value: FeatureValue) {
  if (typeof value === 'boolean') {
    return value ? <Icon source={CheckCircleIcon} tone="success" /> : <Icon source={XSmallIcon} tone="subdued" />
  }
  if (typeof value === 'string' && value === '') {
    // Empty string = group header cell, render nothing
    return null
  }
  if (isValidElement(value)) {
    return value
  }
  return (
    <Text as="p" variant="bodyMd" alignment="center">
      {String(value)}
    </Text>
  )
}

export function FeatureComparisonTable({ t, headerLabel, plans, features }: FeatureComparisonTableProps) {
  const { mdDown } = useBreakpoints()
  const { trackDiscovered } = useFeatureTracking('pricing_feature_comparison')

  // Track when the table scrolls into view (once)
  const tableRef = useRef<HTMLDivElement>(null)
  const trackedRef = useRef(false)
  useEffect(() => {
    const el = tableRef.current
    if (!el || trackedRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !trackedRef.current) {
          trackedRef.current = true
          trackDiscovered('pricing_page')
          observer.disconnect()
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [trackDiscovered])

  const headings = useMemo(
    () => [
      headerLabel,
      ...plans.map(plan => (
        <BlockStack key={plan.alias} gap="100">
          <Text as="span" variant="bodyMd" tone="subdued">
            {plan.name}
          </Text>
          <Text as="span" variant="headingLg" fontWeight="bold">
            {formatCurrency(plan.price)}/{plan.period || t('month')}
          </Text>
        </BlockStack>
      )),
    ],
    [headerLabel, plans, t]
  )

  const columnContentTypes = useMemo(() => ['text' as const, ...plans.map(() => 'text' as const)], [plans])

  const rows = useMemo(
    () =>
      features.map(feature => {
        // Group header — bold label spanning the first column, empty cells for plan columns
        if (feature.isGroupHeader) {
          const headerLabel = (
            <div className={styles.featureGroupHeader}>
              <Text as="span" variant="headingSm" fontWeight="bold">
                {feature.label}
              </Text>
            </div>
          )
          return [headerLabel, ...plans.map(() => null)]
        }

        // Regular feature row with optional tooltip subtitle
        const label = feature.subtitle ? (
          <div className={styles.featureRow}>
            <InlineStack gap="100" blockAlign="center" wrap={false}>
              <Text as="span" variant="headingSm" fontWeight="semibold">
                {feature.label}
              </Text>
              {feature.subtitle}
            </InlineStack>
          </div>
        ) : (
          <div className={styles.featureRow}>
            <Text as="span" variant="headingSm" fontWeight="semibold">
              {feature.label}
            </Text>
          </div>
        )

        const values = plans.map(plan => {
          const value = feature.values[plan.alias]
          return feature.renderValue ? feature.renderValue(value, plan.alias) : renderFeatureValue(value)
        })

        return [label, ...values]
      }),
    [features, plans]
  )

  return (
    <div ref={tableRef}>
      <DataTable
        columnContentTypes={columnContentTypes}
        headings={headings}
        rows={rows}
        fixedFirstColumns={mdDown ? 1 : 0}
        stickyHeader
      />
    </div>
  )
}

export default FeatureComparisonTable
