import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { BlockStack, Select, Text } from '@shopify/polaris'
import type { ShineOnFontMapping, TextLayerOption } from './types'

interface FontMapperProps {
  fontMapping: ShineOnFontMapping
  textLayers: TextLayerOption[]
  defaultFonts: string[]
  onChange: (fontMapping: ShineOnFontMapping) => void
}

export function FontMapper({ fontMapping, textLayers, defaultFonts, onChange }: FontMapperProps) {
  const { t } = useTranslation()

  const handleFontChange = useCallback(
    (value: string) => {
      onChange({
        ...fontMapping,
        defaultFont: value,
      })
    },
    [fontMapping, onChange]
  )

  const handleLayerChange = useCallback(
    (value: string) => {
      onChange({
        ...fontMapping,
        layerId: value === '' ? null : value,
      })
    },
    [fontMapping, onChange]
  )

  const fontOptions = defaultFonts.map(font => ({
    label: font,
    value: font,
  }))

  const layerOptions = [
    { label: t('use-default-font'), value: '' },
    ...textLayers.map(layer => ({
      label: `${layer.label} (${layer.printAreaName})`,
      value: layer.layerId,
    })),
  ]

  return (
    <BlockStack gap="400">
      <div>
        <Text as="h3" variant="headingSm" fontWeight="semibold">
          {t('font-mapping')}
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          {t('select-the-default-engraving-font-or-map-to-a-layer')}
        </Text>
      </div>
      <Select
        label={t('default-font')}
        options={fontOptions}
        value={fontMapping.defaultFont}
        onChange={handleFontChange}
      />
      <Select
        label={t('font-source-layer')}
        helpText={t('optionally-map-font-selection-to-a-text-layer')}
        options={layerOptions}
        value={fontMapping.layerId || ''}
        onChange={handleLayerChange}
      />
    </BlockStack>
  )
}
