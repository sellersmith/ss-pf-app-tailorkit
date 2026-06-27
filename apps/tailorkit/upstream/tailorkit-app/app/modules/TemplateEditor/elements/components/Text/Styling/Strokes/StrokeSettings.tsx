/**
 * StrokeSettings - Settings panel for individual stroke configuration
 *
 * Allows configuration of:
 * - Paint (solid color, image, gradient)
 * - Thickness (0-100% of fontSize)
 *
 * @module TemplateEditor/elements/components/Text/Styling/Strokes
 */

import { BlockStack, InlineStack, Text } from '@shopify/polaris'
import type { Paint, StrokeConfig } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import { NumericStepperField } from '~/components/common/NumericStepperField'
import { FillPicker } from '../Fill/FillPicker'

interface StrokeSettingsProps {
  /** Stroke configuration */
  stroke: StrokeConfig
  /** Index in the strokes array */
  index: number
  /** Callback for paint changes */
  onPaintChange: (index: number, paint: Paint) => void
  /** Callback for weight changes */
  onWeightChange: (index: number, weight: number) => void
  /** Translation function */
  t: (key: string) => string
  /** Shop domain for asset uploads */
  shopDomain?: string
}

export function StrokeSettings({ stroke, index, onPaintChange, onWeightChange, t, shopDomain }: StrokeSettingsProps) {
  return (
    <BlockStack gap="300">
      {/* Header row: Fill label + Thickness input */}
      <InlineStack align="space-between" blockAlign="center">
        <Text as="span" variant="bodyMd" fontWeight="medium">
          {t('fill')}
        </Text>
        <div style={{ width: '80px' }}>
          <NumericStepperField
            label={t('thickness')}
            value={stroke.weight}
            onChange={value => onWeightChange(index, value)}
            min={0}
            max={100}
            step={0.5}
            hideNumericStepper
          />
        </div>
      </InlineStack>

      {/* Paint Picker - Color/Image/Gradient */}
      <FillPicker value={stroke.paint} onChange={paint => onPaintChange(index, paint)} shopDomain={shopDomain} />
    </BlockStack>
  )
}
