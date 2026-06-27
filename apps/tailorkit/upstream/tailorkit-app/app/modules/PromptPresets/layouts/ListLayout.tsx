import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { BlockStack, Button, Card, Checkbox, Text } from '@shopify/polaris'
import type { LayoutProps } from '../types'

function ListLayout({ presets, selectedPreset, hasMoreItems, showAll, onItemClick, onToggleView }: LayoutProps) {
  const { t } = useTranslation()

  return (
    <BlockStack gap="200">
      {presets.map((preset, index) => {
        const isSelected = selectedPreset.includes(preset.name)

        return (
          <Card key={preset.name}>
            <Checkbox
              checked={isSelected}
              onChange={() => onItemClick(preset.name, index)}
              label={
                <Text as="span" variant="bodyMd" fontWeight="semibold">
                  {preset.name}
                </Text>
              }
              helpText={
                <Text truncate as="span" variant="bodyMd" tone="subdued">
                  {preset.instruction}
                </Text>
              }
            />
          </Card>
        )
      })}

      {hasMoreItems && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Button variant="plain" onClick={onToggleView} disclosure={showAll ? 'up' : 'down'}>
            {showAll ? t('view-less') : t('view-more')}
          </Button>
        </div>
      )}
    </BlockStack>
  )
}

export default memo(ListLayout)
