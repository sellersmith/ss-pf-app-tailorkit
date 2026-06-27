import type { ProcessingParameters } from '../../types'
import { BlockStack, Text, RadioButton, Checkbox } from '@shopify/polaris'

interface CompositeControlsProps {
  templatePositioningMode: 'fit' | 'fill'
  onTemplatePositioningModeChange: (mode: 'fit' | 'fill') => void
  hasShapeSelections: boolean
  shouldShowFallbackParameter: boolean
  processingParameters: ProcessingParameters
  updateParameter: (key: keyof ProcessingParameters, value: any) => void
  t: (key: string) => string
}

export default function CompositeControls({
  templatePositioningMode,
  onTemplatePositioningModeChange,
  hasShapeSelections,
  shouldShowFallbackParameter,
  processingParameters,
  updateParameter,
  t,
}: CompositeControlsProps) {
  return (
    <BlockStack gap="400">
      <BlockStack gap="300">
        <Text variant="bodyMd" as="p" tone="subdued">
          {t('choose-how-templates-fill-transparent-areas')}
        </Text>
        <BlockStack gap="200">
          <RadioButton
            label={t('fit-inside-area-show-entire-template')}
            helpText={t('templates-will-be-scaled-to-fit-completely-within-transparent-areas')}
            checked={templatePositioningMode === 'fit'}
            id="positioning-fit"
            name="positioning"
            onChange={() => onTemplatePositioningModeChange('fit')}
          />
          <RadioButton
            label={t('fill-entire-area-may-crop-template')}
            helpText={t('templates-will-be-scaled-to-completely-fill-transparent-areas-may-crop-edges')}
            checked={templatePositioningMode === 'fill'}
            id="positioning-fill"
            name="positioning"
            onChange={() => onTemplatePositioningModeChange('fill')}
          />
        </BlockStack>
      </BlockStack>

      {/* Moved parameters from Rectangle tab - only visible when shape selections exist without seed points */}
      {shouldShowFallbackParameter && (
        <Checkbox
          label={t('fallback-to-full-transparency')}
          checked={processingParameters.fallbackToFullTransparency}
          onChange={checked => updateParameter('fallbackToFullTransparency', checked)}
          helpText={t('skip-interior-detection-make-entire-shape-selection-transparent')}
        />
      )}
    </BlockStack>
  )
}
