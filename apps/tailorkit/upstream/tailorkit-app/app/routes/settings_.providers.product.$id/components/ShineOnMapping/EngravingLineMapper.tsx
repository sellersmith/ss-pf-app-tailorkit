import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { InlineStack, Select, TextField, Text } from '@shopify/polaris'
import type { TextLayerOption } from './types'

interface EngravingLineMapperProps {
  lineNumber: number
  layerId: string | null
  maxChars: number
  textLayers: TextLayerOption[]
  onChange: (layerId: string | null, maxChars: number) => void
}

export function EngravingLineMapper({ lineNumber, layerId, maxChars, textLayers, onChange }: EngravingLineMapperProps) {
  const { t } = useTranslation()

  const handleLayerChange = useCallback(
    (value: string) => {
      onChange(value === '' ? null : value, maxChars)
    },
    [onChange, maxChars]
  )

  const handleMaxCharsChange = useCallback(
    (value: string) => {
      const numValue = parseInt(value, 10)
      if (!isNaN(numValue) && numValue >= 0) {
        onChange(layerId, numValue)
      }
    },
    [onChange, layerId]
  )

  const layerOptions = [
    { label: t('none'), value: '' },
    ...textLayers.map(layer => ({
      label: `${layer.label} (${layer.printAreaName})`,
      value: layer.layerId,
    })),
  ]

  return (
    <InlineStack gap="400" align="start" blockAlign="center">
      <div style={{ minWidth: '120px' }}>
        <Text as="span" variant="bodyMd" fontWeight="medium">
          {t('line')} {lineNumber}
        </Text>
      </div>
      <div style={{ flex: 1, minWidth: '300px' }}>
        <Select label="" labelHidden options={layerOptions} value={layerId || ''} onChange={handleLayerChange} />
      </div>
      <div style={{ width: '120px' }}>
        <TextField
          label={t('max-characters')}
          labelHidden
          type="number"
          value={maxChars.toString()}
          onChange={handleMaxCharsChange}
          min={0}
          autoComplete="off"
          placeholder={t('max-chars')}
        />
      </div>
    </InlineStack>
  )
}
