import { Box, BlockStack, Text, InlineStack, RangeSlider, TextField, Select, Tooltip, Icon } from '@shopify/polaris'
import { InfoIcon } from '@shopify/polaris-icons'
import { useState, useEffect } from 'react'
import EditorColorPicker from '~/components/common/ColorPicker'
import Switch from '~/components/common/Switch'
import { DEBOUNCE_REQUEST_MINOR } from '~/constants/debounce'
import { DEFAULT_TEXT_COLOR } from '~/constants/inspector/text'
import useDebouncedCallback from '~/utils/hooks/useDebouncedCallback'
import type { EffectStyleType } from './EffectPresets'
import type { EdgeStyleType } from '~/modules/TemplateEditor/elements/effects/preset-utils'
import type { Paint } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import { FillPicker } from '../Fill/FillPicker'

interface PresetSettingsProps {
  effectStyle: EffectStyleType
  // Neon
  neonIntensity: number
  onNeonIntensityChange: (value: number) => void
  neonColor: string
  onNeonColorChange: (value: string) => void
  // Emboss/Deboss
  direction: number
  depth: number
  onDirectionChange: (value: number) => void
  onDepthChange: (value: number) => void
  applyColorOverlay: boolean
  onApplyColorOverlayChange: () => void
  onOverlayColorChange: (value: string) => void
  edgeStyle: EdgeStyleType
  onEdgeStyleChange: (value: EdgeStyleType) => void
  // Outline (TextStroke)
  strokeWeight: number
  strokeColor: string
  onStrokeWeightChange: (value: number) => void
  onStrokeColorChange: (value: string) => void
  // Embroidery
  embroiderySheen: number
  onEmbroiderySheenChange: (value: number) => void
  fill: Paint | string | undefined
  onFillChange: (fill: Paint) => void
  shopDomain?: string
  t: (key: string) => string
}

/**
 * Context-aware settings panel that shows controls based on selected effect style
 */
export function PresetSettings({
  effectStyle,
  neonIntensity,
  onNeonIntensityChange,
  neonColor,
  onNeonColorChange,
  direction,
  depth,
  onDirectionChange,
  onDepthChange,
  applyColorOverlay,
  onApplyColorOverlayChange,
  onOverlayColorChange,
  edgeStyle,
  onEdgeStyleChange,
  strokeWeight,
  strokeColor,
  onStrokeWeightChange,
  onStrokeColorChange,
  embroiderySheen,
  onEmbroiderySheenChange,
  fill,
  onFillChange,
  shopDomain,
  t,
}: PresetSettingsProps) {
  // No settings for "none" or null
  if (!effectStyle || effectStyle === 'none') {
    return null
  }

  return (
    <Box>
      <BlockStack gap="300">
        {effectStyle === 'neon' && (
          <>
            <Box>
              <BlockStack gap="150">
                <Text as="p" variant="bodyMd">
                  {t('color')}
                </Text>
                <EditorColorPicker
                  id="neon-color"
                  placeholder={DEFAULT_TEXT_COLOR}
                  value={neonColor}
                  preferredPosition="below"
                  debounceMs={DEBOUNCE_REQUEST_MINOR}
                  onChange={onNeonColorChange}
                />
              </BlockStack>
            </Box>
            <SliderWithInput
              label={t('intensity')}
              value={neonIntensity}
              min={0}
              max={100}
              suffix="%"
              step={5}
              onChange={onNeonIntensityChange}
            />
          </>
        )}

        {(effectStyle === 'emboss' || effectStyle === 'deboss') && (
          <>
            <SliderWithInput
              label={t('direction')}
              value={direction}
              min={0}
              max={360}
              suffix="°"
              step={10}
              onChange={onDirectionChange}
            />
            <SliderWithInput
              label={t('depth')}
              value={depth}
              min={0}
              max={100}
              suffix="%"
              step={5}
              onChange={onDepthChange}
            />
            <Box>
              <BlockStack gap="150">
                <Text as="p" variant="bodyMd">
                  {t('edge-style')}
                </Text>
                <Select
                  label={t('edge-style')}
                  labelHidden
                  options={[
                    { label: t('soft-for-paper-leather'), value: 'soft' },
                    { label: t('standard'), value: 'standard' },
                    { label: t('crisp-for-metal-wood'), value: 'crisp' },
                  ]}
                  value={edgeStyle}
                  onChange={val => onEdgeStyleChange(val as EdgeStyleType)}
                />
              </BlockStack>
            </Box>

            <InlineStack gap="100" blockAlign="center">
              <Switch
                accessibilityLabel={t('apply-color-overlay')}
                label={t('apply-color-overlay')}
                checked={applyColorOverlay}
                onInput={onApplyColorOverlayChange}
              />
              <Tooltip content={t('apply-color-overlay-description')} width="wide">
                <Icon source={InfoIcon} tone="subdued" />
              </Tooltip>
            </InlineStack>

            {applyColorOverlay && (
              <Box>
                <BlockStack gap="150">
                  <Text as="p" variant="bodyMd">
                    {t('overlay-color')}
                  </Text>
                  <EditorColorPicker
                    id="overlay-color"
                    placeholder={DEFAULT_TEXT_COLOR}
                    value={neonColor}
                    preferredPosition="below"
                    debounceMs={DEBOUNCE_REQUEST_MINOR}
                    onChange={onOverlayColorChange}
                  />
                </BlockStack>
              </Box>
            )}
          </>
        )}

        {effectStyle === 'outline' && (
          <>
            <SliderWithInput
              label={t('thickness')}
              value={strokeWeight}
              min={0}
              max={20}
              suffix="px"
              onChange={onStrokeWeightChange}
            />
            <Box>
              <BlockStack gap="150">
                <Text as="p" variant="bodyMd">
                  {t('color')}
                </Text>
                <EditorColorPicker
                  id="outline-color"
                  placeholder={DEFAULT_TEXT_COLOR}
                  value={strokeColor}
                  preferredPosition="below"
                  debounceMs={DEBOUNCE_REQUEST_MINOR}
                  onChange={onStrokeColorChange}
                />
              </BlockStack>
            </Box>
          </>
        )}

        {effectStyle === 'embroidery' && (
          <>
            {/* Image fill picker for embroidery texture */}
            <Box>
              <BlockStack gap="150">
                <Text as="p" variant="bodyMd">
                  {t('thread-texture')}
                </Text>
                <FillPicker value={fill} onChange={onFillChange} shopDomain={shopDomain} disableGradient />
              </BlockStack>
            </Box>
            <SliderWithInput
              label={t('depth')}
              value={depth}
              min={0}
              max={100}
              suffix="%"
              step={5}
              onChange={onDepthChange}
            />
            <SliderWithInput
              label={t('sheen')}
              value={embroiderySheen}
              min={0}
              max={100}
              suffix="%"
              step={5}
              onChange={onEmbroiderySheenChange}
            />
            <SliderWithInput
              label={t('direction')}
              value={direction}
              min={0}
              max={360}
              suffix="°"
              step={10}
              onChange={onDirectionChange}
            />
          </>
        )}
      </BlockStack>
    </Box>
  )
}

interface SliderWithInputProps {
  label: string
  value: number
  min: number
  max: number
  suffix: string
  step?: number
  onChange: (value: number) => void
}

/**
 * Combined RangeSlider + TextField component for precise control
 * Uses local state for immediate visual feedback while debouncing parent updates
 */
function SliderWithInput({ label, value, min, max, suffix, step = 1, onChange }: SliderWithInputProps) {
  // Local state for immediate visual feedback
  const [localValue, setLocalValue] = useState(value)

  // Sync local state when props change externally (undo/redo, preset switch)
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Debounce the actual update to parent for smooth canvas rendering
  const debouncedOnChange = useDebouncedCallback((val: number) => {
    onChange(val)
  }, 16)

  const handleSliderChange = (val: number | [number, number]) => {
    const numValue = typeof val === 'number' ? val : val[0]
    setLocalValue(numValue) // Update local state immediately
    debouncedOnChange(numValue) // Debounce parent update
  }

  const handleTextFieldChange = (val: string) => {
    const numValue = Number(val)
    if (!isNaN(numValue)) {
      const clampedValue = Math.max(min, Math.min(max, numValue))
      setLocalValue(clampedValue)
      debouncedOnChange(clampedValue)
    }
  }

  const handleBlur = () => {
    if (localValue > max) {
      setLocalValue(max)
      onChange(max)
    } else if (localValue < min) {
      setLocalValue(min)
      onChange(min)
    }
  }

  return (
    <Box>
      <Text as="p" variant="bodyMd">
        {label}
      </Text>
      <InlineStack gap="200" wrap={false} blockAlign="center" align="space-between">
        <Box width="70%">
          <RangeSlider
            output
            label={label}
            labelHidden
            min={min}
            max={max}
            step={step}
            value={localValue}
            onChange={handleSliderChange}
          />
        </Box>
        <Box width="30%">
          <div className="tailorkit-input_field">
            <TextField
              autoComplete="off"
              label={label}
              labelHidden
              type="number"
              min={min}
              max={max}
              value={localValue.toString()}
              onChange={handleTextFieldChange}
              onBlur={handleBlur}
              suffix={suffix}
            />
          </div>
        </Box>
      </InlineStack>
    </Box>
  )
}
