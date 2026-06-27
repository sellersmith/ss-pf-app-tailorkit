import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { BlockStack, Select, Text } from '@shopify/polaris'
import type { ShineOnSizeMapping, TextLayerOption } from './types'

interface SizeMapperProps {
  sizeMapping: ShineOnSizeMapping
  textLayers: TextLayerOption[]
  onChange: (sizeMapping: ShineOnSizeMapping) => void
}

export function SizeMapper({ sizeMapping, textLayers, onChange }: SizeMapperProps) {
  const { t } = useTranslation()

  const handleLayerChange = useCallback(
    (value: string) => {
      onChange({
        ...sizeMapping,
        layerId: value === '' ? null : value,
      })
    },
    [sizeMapping, onChange]
  )

  const layerOptions = [
    { label: t('none'), value: '' },
    ...textLayers.map(layer => ({
      label: `${layer.label} (${layer.printAreaName})`,
      value: layer.layerId,
    })),
  ]

  return (
    <BlockStack gap="400">
      <div>
        <Text as="h3" variant="headingSm" fontWeight="semibold">
          {t('size-mapping')}
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          {t('map-ring-size-to-a-text-layer-or-option-set')}
        </Text>
      </div>
      <Select
        label={t('size-source-layer')}
        helpText={t('select-which-layer-contains-the-ring-size-value')}
        options={layerOptions}
        value={sizeMapping.layerId || ''}
        onChange={handleLayerChange}
      />
    </BlockStack>
  )
}
