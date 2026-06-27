import { useCallback, useLayoutEffect, useState } from 'react'
import { BlockStack, RangeSlider, Select, Checkbox } from '@shopify/polaris'
import type { VectorConversionParameters } from '../../types'

interface BasicSettingsProps {
  params: VectorConversionParameters
  updateParameter: (key: keyof VectorConversionParameters, value: any) => void
  onQualityPresetChange?: (preset: 'low' | 'medium' | 'high') => void
  t: (key: string) => string
}

export default function BasicSettings({ params, updateParameter, onQualityPresetChange, t }: BasicSettingsProps) {
  const [qualityPreset, setQualityPreset] = useState<string>()

  const colorModeOptions = [
    { label: t('monochrome'), value: 'monochrome' },
    { label: t('color'), value: 'color' },
  ]

  const qualityPresetOptions = [
    { label: t('low-quality'), value: 'low' },
    { label: t('medium-quality'), value: 'medium' },
    { label: t('high-quality'), value: 'high' },
  ]

  // Determine current preset based on parameters
  const getCurrentPreset = useCallback((): string => {
    if (params.threshold === 80 && params.turdSize === 1 && params.optTolerance === 0.1) {
      return 'low'
    }
    if (params.threshold === 180 && params.turdSize === 10 && params.optTolerance === 0.5) {
      return 'high'
    }
    return 'medium'
  }, [params.optTolerance, params.threshold, params.turdSize])

  useLayoutEffect(() => {
    if (qualityPreset === undefined) {
      setQualityPreset(getCurrentPreset())
    }
  }, [getCurrentPreset, qualityPreset])

  const handleQualityPresetChange = useCallback(
    (value: 'low' | 'medium' | 'high') => {
      setQualityPreset(value)
      onQualityPresetChange?.(value)
    },
    [onQualityPresetChange]
  )

  return (
    <BlockStack gap="400">
      <Select
        label={t('color-mode')}
        options={colorModeOptions}
        value={params.colorMode}
        onChange={value => updateParameter('colorMode', value as 'monochrome' | 'color')}
        helpText={t('choose-monochrome-for-simple-graphics-or-color-to-preserve-original-colors')}
      />

      {params.colorMode === 'color' && (
        <>
          <RangeSlider
            output={true}
            label={t('color-count')}
            value={params.colorCount}
            min={2}
            max={256}
            step={1}
            onChange={value => updateParameter('colorCount', value)}
            helpText={t('number-of-colors-to-use-in-the-vector-output-2-256')}
          />

          {/* Background Removal Settings - Color Mode Only */}
          <Checkbox
            label={t('remove-solid-color-background')}
            checked={params.removeSolidBackground ?? false}
            onChange={checked => updateParameter('removeSolidBackground', checked)}
            helpText={t('remove-solid-color-background-before-vectorization')}
          />

          {params.removeSolidBackground && (
            <>
              <Checkbox
                label={t('remove-only-white-color-globally')}
                checked={params.removeWhiteBackground ?? false}
                onChange={checked => updateParameter('removeWhiteBackground', checked)}
                helpText={t('only-remove-plain-white-background-across-the-frame')}
              />

              <RangeSlider
                output={true}
                label={t('background-removal-tolerance')}
                value={params.bgRemovalTolerance ?? 30}
                min={5}
                max={100}
                step={5}
                onChange={value => updateParameter('bgRemovalTolerance', value)}
                helpText={t('higher-tolerance-removes-more-similar-colors')}
              />
            </>
          )}
        </>
      )}

      {params.colorMode === 'monochrome' && onQualityPresetChange && (
        <Select
          label={t('quality-preset')}
          options={qualityPresetOptions}
          value={getCurrentPreset()}
          onChange={value => handleQualityPresetChange(value as 'low' | 'medium' | 'high')}
          helpText={t('preset-adjusts-multiple-parameters-for-quality')}
        />
      )}

      {params.colorMode === 'monochrome' && (
        <RangeSlider
          output={true}
          label={t('threshold')}
          value={params.threshold}
          min={0}
          max={255}
          step={5}
          onChange={value => updateParameter('threshold', value)}
          helpText={t('controls-black-white-cutoff-lower-captures-more-detail')}
        />
      )}
    </BlockStack>
  )
}
