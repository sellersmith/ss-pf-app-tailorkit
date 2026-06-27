import { BlockStack, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import PromptPresets from '~/modules/PromptPresets'
import type { PromptPresetItem } from '~/api/services/prompt-presets'

interface VisualStyleSectionProps {
  visualStyle: string
  itemsPerRow: number
  filterItems: (items: PromptPresetItem[]) => PromptPresetItem[]
  onSelect: (name: string[], instruction?: string[]) => void
}

export function VisualStyleSection({ visualStyle, itemsPerRow, filterItems, onSelect }: VisualStyleSectionProps) {
  const { t } = useTranslation()

  return (
    <BlockStack gap="100">
      <Text variant="bodyMd" as="p" fontWeight="semibold">
        {t('visual-style')}
      </Text>
      <PromptPresets
        viewAll={true}
        layout="carousel"
        showLabel={false}
        type="visual_style"
        selected={visualStyle}
        onSelect={onSelect}
        filterItems={filterItems}
        itemsPerRow={itemsPerRow}
      />
    </BlockStack>
  )
}
