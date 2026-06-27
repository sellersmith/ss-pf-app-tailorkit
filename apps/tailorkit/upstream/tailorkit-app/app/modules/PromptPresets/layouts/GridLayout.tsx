import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, InlineGrid } from '@shopify/polaris'
import PresetCard from '../components/PresetCard'
import type { LayoutProps } from '../types'

function GridLayout({
  presets,
  selectedPreset,
  hoveredItem,
  hasMoreItems,
  showAll,
  hoverDelay,
  itemsPerRow,
  getThumbnailUrl,
  onItemClick,
  onMouseEnter,
  onMouseLeave,
  onToggleView,
}: LayoutProps) {
  const { t } = useTranslation()

  return (
    <InlineGrid columns={itemsPerRow} gap="200">
      {presets.map((preset, index) => (
        <PresetCard
          key={preset.name}
          preset={preset}
          index={index}
          isSelected={selectedPreset.includes(preset.name)}
          isHovered={hoveredItem === preset.name}
          thumbnailUrl={getThumbnailUrl(preset)}
          hoverDelay={hoverDelay}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onClick={onItemClick}
        />
      ))}

      {hasMoreItems && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Button variant="plain" onClick={onToggleView} disclosure={showAll ? 'up' : 'down'}>
            {showAll ? t('view-less') : t('view-more')}
          </Button>
        </div>
      )}
    </InlineGrid>
  )
}

export default memo(GridLayout)
