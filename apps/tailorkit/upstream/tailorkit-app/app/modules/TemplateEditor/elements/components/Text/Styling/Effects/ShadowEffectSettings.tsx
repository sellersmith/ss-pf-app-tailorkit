import { BlockStack, Box, InlineStack, RangeSlider, Select, Text } from '@shopify/polaris'
import { useState } from 'react'
import EditorColorPicker from '~/components/common/ColorPicker'
import { NumericStepperField } from '~/components/common/NumericStepperField'
import type { DropShadowConfig, EffectConfig, InnerShadowConfig } from '~/modules/TemplateEditor/elements/effects/types'
import { initializeRelativeFromAbsolute } from '~/modules/TemplateEditor/elements/effects/relative-shadow-utils'
import { useDebouncedCallback } from '~/utils/hooks/useDebouncedCallback'

interface ShadowEffectSettingsProps {
  effect: EffectConfig
  index: number
  fontSize: number
  onUpdate: (index: number, patch: Partial<EffectConfig>) => void
  t: (key: string) => string
}

/**
 * Settings panel for drop shadow and inner shadow effects
 * Supports both absolute (offsetX/offsetY) and relative (direction/distance) modes
 */
export function ShadowEffectSettings({ effect, index, fontSize, onUpdate, t }: ShadowEffectSettingsProps) {
  const shadowEffect = effect as DropShadowConfig | InnerShadowConfig

  // Get relative values from props with defaults
  const propsDirection = shadowEffect.relative?.direction ?? 0
  const propsDistancePercent = shadowEffect.relative?.distancePercent ?? 0
  const propsRadiusPercent = shadowEffect.relative?.radiusPercent ?? 0

  // Local state for immediate visual feedback while dragging
  const [localDirection, setLocalDirection] = useState(propsDirection)
  const [localDistancePercent, setLocalDistancePercent] = useState(propsDistancePercent)
  const [localRadiusPercent, setLocalRadiusPercent] = useState(propsRadiusPercent)

  // Track previous props to detect external changes (undo/redo)
  const [prevProps, setPrevProps] = useState({ propsDirection, propsDistancePercent, propsRadiusPercent })

  const {
    propsDirection: prevPropsDirection,
    propsDistancePercent: prevPropsDistancePercent,
    propsRadiusPercent: prevPropsRadiusPercent,
  } = prevProps
  // Sync local state when props change (update during render pattern)
  const propsChanged
    = propsDirection !== prevPropsDirection
    || propsDistancePercent !== prevPropsDistancePercent
    || propsRadiusPercent !== prevPropsRadiusPercent

  if (propsChanged) {
    setLocalDirection(propsDirection)
    setLocalDistancePercent(propsDistancePercent)
    setLocalRadiusPercent(propsRadiusPercent)
    setPrevProps({ propsDirection, propsDistancePercent, propsRadiusPercent })
  }

  // Debounced update to parent - only affects canvas rendering, not UI feedback
  const debouncedOnUpdate = useDebouncedCallback((patch: Partial<EffectConfig>) => {
    onUpdate(index, patch)
  }, 16)

  const handleRelativeUpdate = (field: 'direction' | 'distancePercent' | 'radiusPercent', value: number) => {
    // Update local state immediately for responsive UI
    if (field === 'direction') setLocalDirection(value)
    else if (field === 'distancePercent') setLocalDistancePercent(value)
    else if (field === 'radiusPercent') setLocalRadiusPercent(value)

    // Debounce the actual update to parent
    debouncedOnUpdate({
      relative: {
        ...shadowEffect.relative,
        direction: field === 'direction' ? value : localDirection,
        distancePercent: field === 'distancePercent' ? value : localDistancePercent,
        radiusPercent: field === 'radiusPercent' ? value : localRadiusPercent,
      },
    } as Partial<EffectConfig>)
  }

  if (effect.type !== 'DROP_SHADOW' && effect.type !== 'INNER_SHADOW') {
    return null
  }

  const isInnerShadow = effect.type === 'INNER_SHADOW'
  const isRelativeMode = !!shadowEffect.relative

  return (
    <BlockStack gap="200">
      {/* Mode toggle: Absolute vs Relative */}
      <InlineStack gap="300" align="space-between" wrap={false} blockAlign="center">
        <Text as="p" variant="bodyMd">
          {t('mode')}
        </Text>
        <Box width="150px">
          <Select
            labelHidden
            label="mode"
            options={[
              { label: t('absolute'), value: 'absolute' },
              { label: t('relative'), value: 'relative' },
            ]}
            value={isRelativeMode ? 'relative' : 'absolute'}
            onChange={val => {
              if (val === 'relative' && !isRelativeMode) {
                // Initialize relative values from current absolute
                const relativeConfig = initializeRelativeFromAbsolute(shadowEffect, fontSize)
                onUpdate(index, { relative: relativeConfig.relative } as Partial<EffectConfig>)
              } else if (val === 'absolute' && isRelativeMode) {
                // Remove relative to switch to absolute mode
                onUpdate(index, { relative: undefined } as Partial<EffectConfig>)
              }
            }}
          />
        </Box>
      </InlineStack>

      {isRelativeMode ? (
        /* Relative mode controls with simple sliders */
        /* Inner shadows use smaller max (25%) with step 1 for finer control */
        <>
          <BlockStack gap="100">
            <InlineStack align="space-between">
              <Text as="p" variant="bodyMd">
                {t('direction')}
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                {localDirection.toFixed(2)}°
              </Text>
            </InlineStack>
            <RangeSlider
              label={t('direction')}
              labelHidden
              value={localDirection}
              min={0}
              max={360}
              step={10}
              output
              onChange={val => handleRelativeUpdate('direction', val as number)}
            />
          </BlockStack>

          <BlockStack gap="100">
            <InlineStack align="space-between">
              <Text as="p" variant="bodyMd">
                {t('distance')}
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                {localDistancePercent.toFixed(2)}%
              </Text>
            </InlineStack>
            <RangeSlider
              label={t('distance')}
              labelHidden
              value={localDistancePercent}
              min={0}
              max={isInnerShadow ? 25 : 100}
              step={isInnerShadow ? 1 : 5}
              output
              onChange={val => handleRelativeUpdate('distancePercent', val as number)}
            />
          </BlockStack>

          <BlockStack gap="100">
            <InlineStack align="space-between">
              <Text as="p" variant="bodyMd">
                {t('blur')}
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                {localRadiusPercent.toFixed(2)}%
              </Text>
            </InlineStack>
            <RangeSlider
              label={t('blur')}
              labelHidden
              value={localRadiusPercent}
              min={0}
              max={isInnerShadow ? 25 : 100}
              step={isInnerShadow ? 1 : 5}
              output
              onChange={val => handleRelativeUpdate('radiusPercent', val as number)}
            />
          </BlockStack>
        </>
      ) : (
        /* Absolute mode controls (original) */
        <>
          <InlineStack gap="300" align="space-between" wrap={false}>
            <Text as="p" variant="bodyMd">
              {t('position')}
            </Text>
            <BlockStack gap="100">
              <Box width="120px">
                <NumericStepperField
                  label={t('x')}
                  labelHidden
                  hideNumericStepper
                  value={shadowEffect.offsetX ?? 0}
                  min={-500}
                  max={500}
                  step={1}
                  prefix={t('x')}
                  onChange={val => onUpdate(index, { offsetX: val } as Partial<EffectConfig>)}
                />
              </Box>
              <Box width="120px">
                <NumericStepperField
                  label={t('y')}
                  labelHidden
                  hideNumericStepper
                  value={shadowEffect.offsetY ?? 0}
                  min={-500}
                  max={500}
                  step={1}
                  prefix={t('y')}
                  onChange={val => onUpdate(index, { offsetY: val } as Partial<EffectConfig>)}
                />
              </Box>
            </BlockStack>
          </InlineStack>

          <InlineStack gap="300" align="space-between" wrap={false} blockAlign="center">
            <Text as="p" variant="bodyMd">
              {t('blur')}
            </Text>
            <Box width="120px">
              <NumericStepperField
                label={t('blur')}
                labelHidden
                hideNumericStepper
                value={shadowEffect.radius ?? 4}
                min={0}
                max={300}
                step={1}
                onChange={val => onUpdate(index, { radius: val } as Partial<EffectConfig>)}
              />
            </Box>
          </InlineStack>
        </>
      )}

      <InlineStack gap="300" align="space-between" wrap={false} blockAlign="center">
        <Text as="p" variant="bodyMd">
          {t('color')}
        </Text>
        <Box width="120px">
          <EditorColorPicker
            id={`effect-${index}-color`}
            value={shadowEffect.color === 'currentColor' ? '' : shadowEffect.color || ''}
            onChange={val => onUpdate(index, { color: val || 'currentColor' } as Partial<EffectConfig>)}
            debounceMs={100}
            showInPopover={true}
            onClear={() => onUpdate(index, { color: 'currentColor' } as Partial<EffectConfig>)}
            placeholder={t('textcolor')}
          />
        </Box>
      </InlineStack>
    </BlockStack>
  )
}
