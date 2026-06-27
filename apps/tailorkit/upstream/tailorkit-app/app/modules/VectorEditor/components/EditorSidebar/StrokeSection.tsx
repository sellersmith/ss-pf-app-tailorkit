/**
 * StrokeSection - Stroke color and width controls for the sidebar
 * Extracted from StrokeButton, without the Popover wrapper
 */

import { Box, Button, TextField, BlockStack, Text } from '@shopify/polaris'
import { DeleteIcon } from '@shopify/polaris-icons'
import EditorColorPicker from '~/components/common/ColorPicker'
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import type { StrokeSectionProps } from './types'

export default function StrokeSection({ color, width, disabled, onColorChange, onWidthChange }: StrokeSectionProps) {
  const { t } = useTranslation()

  // Show 0 if no stroke, otherwise show the actual width
  const hasStroke = color && color !== 'none'
  const externalDisplayWidth = hasStroke ? (width ?? 1) : 0

  // Local state to handle the input value during editing
  // This prevents the input from being reset while the user is typing
  const [localWidth, setLocalWidth] = useState<string>(String(externalDisplayWidth))

  // Sync local state with external props when they change (e.g., from parent or undo/redo)
  useEffect(() => {
    setLocalWidth(String(externalDisplayWidth))
  }, [externalDisplayWidth])

  if (disabled) {
    return (
      <Box padding="300">
        <Text as="p" tone="subdued">
          {t('select-a-path-to-edit-stroke')}
        </Text>
      </Box>
    )
  }

  return (
    <BlockStack gap="300">
      <Text as="span" variant="headingSm">
        {t('stroke-color')}
      </Text>
      <EditorColorPicker
        value={color === 'none' ? '' : color || '#000000'}
        showInPopover={false}
        onChange={onColorChange}
      />
      {/* Always show stroke width - displays 0 when no stroke */}
      <Text as="span" variant="headingSm">
        {t('stroke-width')}
      </Text>
      <TextField
        label=""
        labelHidden
        type="number"
        value={localWidth}
        onChange={value => {
          // Update local state immediately for responsive UI
          setLocalWidth(value)

          const numValue = parseFloat(value)
          if (isNaN(numValue) || numValue === 0) {
            // Setting width to 0 or empty removes the stroke
            onColorChange('none')
            onWidthChange(0)
          } else {
            // If there's no stroke color, add a default black stroke
            if (!hasStroke) {
              onColorChange('#000000')
            }
            onWidthChange(numValue)
          }
        }}
        min={0}
        step={0.5}
        autoComplete="off"
        suffix="px"
      />
      {hasStroke && (
        <Button icon={DeleteIcon} tone="critical" onClick={() => onColorChange('none')}>
          {t('remove-stroke')}
        </Button>
      )}
    </BlockStack>
  )
}
