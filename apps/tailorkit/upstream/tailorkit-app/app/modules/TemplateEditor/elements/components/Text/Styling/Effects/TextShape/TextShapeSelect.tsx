import { Box, InlineStack, Text } from '@shopify/polaris'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TextSettings } from '~/types/psd'
import { ELink } from '~/constants/enum'

interface ITextShapeSelectProps {
  textShape: TextSettings['textShape']
  hasCustomPath?: boolean
  hasFillShape?: boolean
  onChangeTextShape: (value: TextSettings['textShape']) => void
  onOpenCustomPathEditor?: () => void
  onOpenFillShapeEditor?: () => void
}

export const TextShapeSelect = (props: ITextShapeSelectProps) => {
  const { t } = useTranslation()
  const { textShape, hasCustomPath, hasFillShape, onChangeTextShape, onOpenCustomPathEditor, onOpenFillShapeEditor }
    = props

  const handleShapeChange = useCallback(
    (value: string) => {
      if (value === 'none' || value === 'circle' || value === 'curve') {
        onChangeTextShape(value)
      } else if (value === 'custom') {
        // If already has a custom path, just switch to it; otherwise open editor
        if (hasCustomPath) {
          onChangeTextShape('custom')
        } else {
          onOpenCustomPathEditor?.()
        }
      } else if (value === 'fill-shape') {
        // If already has a fill shape, just switch to it; otherwise open editor
        if (hasFillShape) {
          onChangeTextShape('fill-shape')
        } else {
          onOpenFillShapeEditor?.()
        }
      }
    },
    [onChangeTextShape, onOpenCustomPathEditor, onOpenFillShapeEditor, hasCustomPath, hasFillShape]
  )

  const textShapeOptions = useMemo(
    () => [
      {
        label: t('none'),
        value: 'none',
        thumbnail: ELink.TEXT_SHAPE_NONE,
      },
      {
        label: t('curve'),
        value: 'curve',
        thumbnail: ELink.TEXT_SHAPE_CURVE,
      },
      {
        label: t('circle'),
        value: 'circle',
        thumbnail: ELink.TEXT_SHAPE_CIRCLE,
      },
      {
        label: t('custom-path'),
        value: 'custom',
        thumbnail: ELink.TEXT_SHAPE_CUSTOM,
      },
      {
        label: t('fill-shape'),
        value: 'fill-shape',
        thumbnail: ELink.TEXT_SHAPE_FILL,
      },
    ],
    [t]
  )

  return (
    <Box paddingBlockStart="200">
      <Text as="h3" variant="bodyMd" fontWeight="semibold">
        {t('text-shape')}
      </Text>
      <Box paddingBlockStart="200">
        <div
          style={{
            width: '100%',
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <InlineStack gap="300" wrap={false}>
            {textShapeOptions.map(option => {
              const isSelected = textShape === option.value
              return (
                <Box key={option.value}>
                  <div
                    role="button"
                    tabIndex={0}
                    style={{
                      width: '80px',
                      aspectRatio: '1',
                      cursor: 'pointer',
                      transition: 'transform var(--p-motion-duration-150) var(--p-motion-ease)',
                    }}
                    onClick={() => handleShapeChange(option.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleShapeChange(option.value)
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
                        src={option.thumbnail}
                        alt={option.label}
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
                  <Box paddingBlockStart="100">
                    <Text as="p" variant="bodySm" alignment="center" fontWeight={isSelected ? 'semibold' : 'regular'}>
                      {option.label}
                    </Text>
                  </Box>
                </Box>
              )
            })}
          </InlineStack>
        </div>
      </Box>
    </Box>
  )
}
