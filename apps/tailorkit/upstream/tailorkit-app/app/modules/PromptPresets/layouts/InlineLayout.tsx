import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, InlineStack, Tag } from '@shopify/polaris'
import type { LayoutProps } from '../types'

function InlineLayout({ presets, hasMoreItems, showAll, onItemClick, onToggleView }: LayoutProps) {
  const { t } = useTranslation()

  return (
    <InlineStack gap="200" wrap={true}>
      {presets.map((preset, index) => (
        <Tag disabled={false} key={preset.name} onClick={() => onItemClick(preset.name, index)}>
          {preset.name}
        </Tag>
      ))}

      {hasMoreItems && (
        <Button variant="plain" onClick={onToggleView} disclosure={showAll ? 'up' : 'down'}>
          {showAll ? t('view-less') : t('view-more')}
        </Button>
      )}
    </InlineStack>
  )
}

export default memo(InlineLayout)
