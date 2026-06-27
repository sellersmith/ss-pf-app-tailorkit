/**
 * Utility to build feature comparison data from PricingPlan documents.
 *
 * Features are organized into strategic groups to reduce cognitive load:
 *   - Design & Preview — visual creation capabilities
 *   - Sales & Conversion — AI-powered revenue tools
 *   - Automation & Workflow — operational efficiency features
 */

import { Tooltip, Icon } from '@shopify/polaris'
import { InfoIcon } from '@shopify/polaris-icons'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import type { FeatureDefinition, PlanColumnDefinition } from '../components/FeatureComparisonTable/types'
import type { TFunction } from 'i18next'

/** Tooltip descriptions for complex features */
const FEATURE_TOOLTIPS: Record<string, string> = {
  'charm-builder': 'Allow buyers to build multi-charm accessories visually.',
  'lossless-svg-export': 'Export infinitely scalable print-ready files without quality loss.',
}

/**
 * Build plan column definitions from PricingPlan documents
 */
export function buildPlanColumns(plans: PricingPlanDocument[]): PlanColumnDefinition[] {
  return plans.map(plan => ({
    alias: plan.alias || plan.name.toLowerCase(),
    name: plan.name,
    price: plan.price,
    period: 'month',
  }))
}

/**
 * Build feature definitions organized into strategic groups.
 *
 * Groups use emoji prefixes as visual anchors to help merchants
 * quickly scan and find the features they care about.
 */
export function buildFeatureDefinitions(
  plans: PricingPlanDocument[],
  t: TFunction,
  _openModal: Function
): FeatureDefinition[] {
  // Helper to create feature values object
  const buildValues = (valueFn: (plan: PricingPlanDocument) => boolean | string | number) => {
    const values: Record<string, boolean | string | number> = {}
    plans.forEach(plan => {
      values[plan.alias || plan.name.toLowerCase()] = valueFn(plan)
    })
    return values
  }

  // Helper to create a group header row (empty values, just a label)
  const groupHeader = (label: string): FeatureDefinition => ({
    id: `group-${label}`,
    label,
    values: buildValues(() => ''),
    isGroupHeader: true,
  })

  // Helper to create a feature row with optional tooltip
  const feature = (
    id: string,
    valueFn: (plan: PricingPlanDocument) => boolean | string | number = () => true
  ): FeatureDefinition => {
    const tooltip = FEATURE_TOOLTIPS[id]
    return {
      id,
      label: t(id),
      subtitle: tooltip ? (
        <Tooltip content={tooltip}>
          <Icon source={InfoIcon} tone="subdued" />
        </Tooltip>
      ) : undefined,
      values: buildValues(valueFn),
    }
  }

  const featureRows: FeatureDefinition[] = [
    // ─── Design & Preview ───
    groupHeader(`${t('art-emoji')} ${t('design-and-preview')}`),
    feature('text-effects'),
    feature('image-upload'),
    feature('svg-image-editor'),
    feature('multi-view-mockups'),
    feature('realistic-preview'),
    feature('free-cliparts'),

    // ─── Sales & Conversion ───
    groupHeader(`${t('rocket-emoji')} ${t('sales-and-conversion')}`),
    {
      id: 'upsell-products',
      label: t('upsell-products'),
      values: buildValues(plan => {
        if (plan.features?.upsellProductLimit === null) return t('unlimited-upsell-products')
        if (typeof plan.features?.upsellProductLimit === 'number') {
          return t('count-upsell-products', { count: plan.features.upsellProductLimit })
        }
        return true
      }),
    },
    feature('upsell-price'),
    feature('actionable-analytics'),
    feature('ai-generated-images'),
    feature('ai-mockups'),
    feature('ai-generated-text'),
    feature('elva-ai-assistant'),
    {
      id: 'ai-credits',
      label: t('ai-credits'),
      values: buildValues(plan => {
        const credits = plan.aiCreditsPerMonth || 0
        return `${credits.toLocaleString()} ${t('free-credits-per-month')}`
      }),
    },

    // ─── Automation & Workflow ───
    groupHeader(`${t('gear-emoji')} ${t('automation-and-workflow')}`),
    feature('24-7-support'),
    feature('charm-builder', plan => plan.features?.charmBuilder === true),
    feature('lossless-svg-export', plan => plan.features?.losslessSvgExport === true),
    feature('priority-feature-requests', plan => plan.features?.priorityFeatureRequests === true),
    feature('dedicated-success-manager', plan => plan.features?.dedicatedSuccessManager === true),
  ]

  // Apply alternating row backgrounds (skip group headers)
  let rowIndex = 0
  return featureRows.map(f => {
    if (f.isGroupHeader) return f
    const result = { ...f, alternateBackground: rowIndex % 2 === 1 }
    rowIndex++
    return result
  })
}
