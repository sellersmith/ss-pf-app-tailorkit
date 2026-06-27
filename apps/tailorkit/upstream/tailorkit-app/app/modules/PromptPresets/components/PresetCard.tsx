import { memo } from 'react'
import { Badge, Box, Card, Checkbox, Image, Tooltip } from '@shopify/polaris'
import type { PresetCardProps } from '../types'
import { useTranslation } from 'react-i18next'

const DEFAULT_HOVER_DELAY = 800

function PresetCard({
  preset,
  index,
  isSelected,
  isHovered,
  thumbnailUrl,
  hoverDelay = DEFAULT_HOVER_DELAY,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: PresetCardProps) {
  const { t } = useTranslation()

  return (
    <Tooltip zIndexOverride={999} content={preset.name} hoverDelay={hoverDelay}>
      <div
        role="button"
        aria-pressed={isSelected}
        onMouseLeave={onMouseLeave}
        onClick={() => onClick(preset.name, index)}
        onMouseEnter={() => onMouseEnter(preset.name)}
        style={{ cursor: 'pointer', position: 'relative', height: '100%' }}
      >
        <Card padding="0" background={isHovered ? 'bg-surface-hover' : isSelected ? 'bg-surface-active' : undefined}>
          {thumbnailUrl ? (
            <Image
              source={thumbnailUrl}
              alt={preset.name}
              style={{ width: '100%', height: '100%', maxHeight: '108px', display: 'block' }}
            />
          ) : (
            <Box background="bg-surface-secondary" borderRadius="200" minHeight="108px" />
          )}
        </Card>

        <div style={{ position: 'absolute', top: '0.5rem', left: '0.5rem' }}>
          <Checkbox labelHidden label={preset.name} checked={isSelected} />
        </div>

        {preset.hot && (
          <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }}>
            <Badge tone="success">{t('hot')}</Badge>
          </div>
        )}
      </div>
    </Tooltip>
  )
}

export default memo(PresetCard)
