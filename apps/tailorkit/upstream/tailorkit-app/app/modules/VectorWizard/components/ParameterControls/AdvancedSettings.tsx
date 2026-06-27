import React from 'react'
import { BlockStack, RangeSlider, Checkbox, Select } from '@shopify/polaris'
import type { VectorConversionParameters } from '../../types'

interface AdvancedSettingsProps {
  params: VectorConversionParameters
  updateParameter: (key: keyof VectorConversionParameters, value: any) => void
  t: (key: string) => string
}

export default function AdvancedSettings({ params, updateParameter, t }: AdvancedSettingsProps) {
  const turnPolicyOptions = [
    { label: t('minority'), value: 'minority' },
    { label: t('majority'), value: 'majority' },
    { label: t('black'), value: 'black' },
    { label: t('white'), value: 'white' },
    { label: t('left'), value: 'left' },
    { label: t('right'), value: 'right' },
  ]

  return (
    <BlockStack gap="400">
      <RangeSlider
        output={true}
        label={t('suppress-speckles')}
        value={params.turdSize}
        min={0}
        max={100}
        step={1}
        onChange={value => updateParameter('turdSize', value)}
        helpText={t('suppress-speckles-of-this-size-or-smaller')}
      />

      <Select
        label={t('turn-policy')}
        options={turnPolicyOptions}
        value={params.turnPolicy}
        onChange={value => updateParameter('turnPolicy', value)}
        helpText={t('how-to-resolve-ambiguities-in-path-decomposition')}
      />

      <RangeSlider
        output={true}
        label={t('corner-threshold')}
        value={params.alphaMax}
        min={0}
        max={2}
        step={0.1}
        onChange={value => updateParameter('alphaMax', value)}
        helpText={t('corner-threshold-parameter-controls-sharpness')}
      />

      <Checkbox
        label={t('optimize-curves')}
        checked={params.optCurve}
        onChange={checked => updateParameter('optCurve', checked)}
        helpText={t('apply-bezier-curve-optimization')}
      />

      {params.optCurve && (
        <RangeSlider
          output={true}
          label={t('curve-tolerance')}
          value={params.optTolerance}
          min={0}
          max={1}
          step={0.05}
          onChange={value => updateParameter('optTolerance', value)}
          helpText={t('curve-optimization-tolerance-lower-is-more-precise')}
        />
      )}
    </BlockStack>
  )
}
