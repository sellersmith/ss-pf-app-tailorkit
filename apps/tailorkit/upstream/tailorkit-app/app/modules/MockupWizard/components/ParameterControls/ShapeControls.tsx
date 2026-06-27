import React from 'react'
import { BlockStack, RangeSlider, Checkbox } from '@shopify/polaris'
import type { ProcessingParameters } from '../../types'

interface ShapeControlsProps {
  params: ProcessingParameters
  updateParameter: (key: keyof ProcessingParameters, value: any) => void
  t: (key: string) => string
}

export default function ShapeControls({ params, updateParameter, t }: ShapeControlsProps) {
  return (
    <BlockStack gap="400">
      <RangeSlider
        output={true}
        label={t('interior-matching')}
        value={params.centerSimilarityThreshold}
        min={40}
        max={100}
        step={5}
        onChange={value => updateParameter('centerSimilarityThreshold', value)}
        helpText={t('how-similar-pixels-must-be-to-the-center-to-be-included')}
      />

      <RangeSlider
        output={true}
        label={t('background-detection')}
        value={params.centerBackgroundThreshold}
        min={20}
        max={80}
        step={5}
        onChange={value => updateParameter('centerBackgroundThreshold', value)}
        helpText={t('how-different-the-background-must-be-from-the-center')}
      />

      <Checkbox
        label={t('keep-only-largest-area')}
        checked={params.keepOnlyLargestArea}
        onChange={checked => updateParameter('keepOnlyLargestArea', checked)}
        helpText={t('filters-out-small-fragments-and-keeps-only-the-main-transparent-area')}
      />

      {!params.keepOnlyLargestArea && (
        <RangeSlider
          output={true}
          label={t('minimum-area-size')}
          value={params.minAreaSize}
          min={50}
          max={1000}
          step={50}
          suffix="px"
          onChange={value => updateParameter('minAreaSize', value)}
          helpText={t('minimum-size-in-pixels-for-a-transparent-area-to-be-included')}
        />
      )}
    </BlockStack>
  )
}
