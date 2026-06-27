import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@shopify/polaris'
import GridCarousel from '~/components/GridCarousel'
import PresetCard from '../components/PresetCard'
import type { LayoutProps } from '../types'

function CarouselLayout({
  presets,
  selectedPreset,
  hoveredItem,
  itemsPerRow,
  hasMoreItems,
  showAll,
  hoverDelay,
  getThumbnailUrl,
  onItemClick,
  onMouseEnter,
  onMouseLeave,
  onToggleView,
}: LayoutProps) {
  const { t } = useTranslation()

  return (
    <GridCarousel gap="0.5rem" showDots={true} itemsPerSlide={itemsPerRow}>
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
    </GridCarousel>
  )
}

export default memo(CarouselLayout)
