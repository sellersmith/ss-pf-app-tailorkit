import React from 'react'
import { BlockStack, RangeSlider, Checkbox } from '@shopify/polaris'
import type { ProcessingParameters } from '../../types'

interface DetectionControlsProps {
  params: ProcessingParameters
  updateParameter: (key: keyof ProcessingParameters, value: any) => void
  t: (key: string) => string
}

export default function DetectionControls({ params, updateParameter, t }: DetectionControlsProps) {
  return (
    <BlockStack gap="400">
      <RangeSlider
        output={true}
        label={t('detection-precision')}
        value={params.colorSimilarityThreshold}
        min={30}
        max={100}
        step={5}
        onChange={value => updateParameter('colorSimilarityThreshold', value)}
        helpText={t('higher-values-are-more-precise-but-may-miss-similar-areas')}
      />

      <Checkbox
        label={t('fill-interior-gaps')}
        checked={params.interiorGapFilling}
        onChange={checked => updateParameter('interiorGapFilling', checked)}
        helpText={t('automatically-fill-gaps-within-detected-areas')}
      />

      <Checkbox
        label={t('preserve-shadows-highlights')}
        checked={params.keepShadowHighlight}
        onChange={checked => updateParameter('keepShadowHighlight', checked)}
        helpText={t('maintains-depth-and-dimension-in-transparent-areas')}
      />
    </BlockStack>
  )
}
