import { Box, Text, Tooltip } from '@shopify/polaris'
import { useMemo } from 'react'

export type EffectStyleType = 'none' | 'emboss' | 'deboss' | 'neon' | 'outline' | 'embroidery' | null

/** Thumbnail URLs for effect presets */
const PRESET_THUMBNAILS = {
  none: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/None.png?v=1766715945',
  emboss:
    'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Emboss_4141cb4c-3119-49b0-b90e-6949382e0cce.webp?v=1766715109',
  deboss:
    'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Deboss_75744237-1c83-486e-ab3a-bc591035fa18.webp?v=1766715109',
  neon: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Neon_71eab421-bec0-446a-a421-86a912ff1826.webp?v=1766715109',
  outline: 'https://cdn.shopify.com/s/files/1/0704/8429/5925/files/Outline.webp?v=1766715109',
} as const

interface PresetItem {
  label: string
  value: EffectStyleType
  thumbnail: string
}

interface EffectPresetsProps {
  appliedPreset: EffectStyleType
  onApplyPreset: (preset: EffectStyleType) => void
  t: (key: string) => string
}

/**
 * Grid of effect preset thumbnails
 * Row 1: None, Emboss, Deboss (3 equal columns)
 * Row 2: Neon, Outline (2 items, left-aligned)
 */
export function EffectPresets({ appliedPreset, onApplyPreset, t }: EffectPresetsProps) {
  const presets: PresetItem[] = useMemo(
    () => [
      {
        label: t('none'),
        value: 'none' as const,
        thumbnail: PRESET_THUMBNAILS.none,
      },
      {
        label: t('emboss'),
        value: 'emboss' as const,
        thumbnail: PRESET_THUMBNAILS.emboss,
      },
      {
        label: t('deboss'),
        value: 'deboss' as const,
        thumbnail: PRESET_THUMBNAILS.deboss,
      },
      {
        label: t('neon'),
        value: 'neon' as const,
        thumbnail: PRESET_THUMBNAILS.neon,
      },
      {
        label: t('outline'),
        value: 'outline' as const,
        thumbnail: PRESET_THUMBNAILS.outline,
      },
    ],
    [t]
  )

  // Split into rows of 3 for grid layout
  const row1 = presets.slice(0, 3) // None, Emboss, Deboss
  const row2 = presets.slice(3, 6) // Neon, Outline, Embroidery

  return (
    <Box>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {/* Row 1: None, Emboss, Deboss - 3 equal columns */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
          }}
        >
          {row1.map(preset => (
            <PresetThumbnail
              key={preset.value}
              preset={preset}
              isSelected={appliedPreset === preset.value}
              onSelect={() => onApplyPreset(preset.value)}
              t={t}
            />
          ))}
        </div>

        {/* Row 2: Neon, Outline, Embroidery - 3 equal columns */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
          }}
        >
          {row2.map(preset => (
            <PresetThumbnail
              key={preset.value}
              preset={preset}
              isSelected={appliedPreset === preset.value}
              onSelect={() => onApplyPreset(preset.value)}
              t={t}
            />
          ))}
        </div>
      </div>
    </Box>
  )
}

interface PresetThumbnailProps {
  preset: PresetItem
  isSelected: boolean
  onSelect: () => void
  t: (key: string) => string
}

function PresetThumbnail({ preset, isSelected, onSelect, t }: PresetThumbnailProps) {
  return (
    <Box>
      <Tooltip content={`${t('apply')} ${preset.label}`}>
        <div
          role="button"
          tabIndex={0}
          style={{
            width: '100%',
            aspectRatio: '1',
            cursor: 'pointer',
            transition: `transform var(--p-motion-duration-150) var(--p-motion-ease)`,
          }}
          onClick={onSelect}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onSelect()
            }
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.02)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)'
          }}
          onMouseDown={e => {
            e.currentTarget.style.transform = 'scale(0.98)'
          }}
          onMouseUp={e => {
            e.currentTarget.style.transform = 'scale(1.02)'
          }}
        >
          <Box
            overflowX="hidden"
            overflowY="hidden"
            borderColor={isSelected ? 'border-emphasis' : 'border'}
            borderWidth={isSelected ? '050' : '025'}
            borderRadius="300"
          >
            <img
              src={preset.thumbnail}
              alt={preset.label}
              style={{
                userSelect: 'none',
                pointerEvents: 'none',
                width: '100%',
                height: '100%',
                display: 'block',
                objectFit: 'contain',
                objectPosition: 'center center',
              }}
            />
          </Box>
        </div>
      </Tooltip>
      <Box paddingBlockStart="100">
        <Text as="p" variant="bodySm" alignment="center" fontWeight={isSelected ? 'semibold' : 'regular'}>
          {preset.label}
        </Text>
      </Box>
    </Box>
  )
}
