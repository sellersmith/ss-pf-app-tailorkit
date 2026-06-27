/**
 * EditModeSection - Sidebar panel for edit mode settings
 *
 * Provides settings for:
 * - Resize viewport (input fields for width/height with aspect ratio lock)
 * - Show ruler (display rulers at top and left)
 * - Show grid (display grid overlay with snap support)
 *
 * Uses Polaris Checkbox components with indented sub-settings.
 * Canvas size UI follows TemplateEditor's TransformationPanel pattern.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Box, Text, BlockStack, InlineStack, Checkbox, RangeSlider, TextField, Button, Image } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import type { EditModeSettings, GridSettings, ViewBox } from '../../types'
import { MIN_GRID_SIZE, MAX_GRID_SIZE, MIN_VIEWPORT_SIZE } from '../../constants'
import { EXTRA_ICONS } from '~/constants/assets-url'

export interface EditModeSectionProps {
  /** Edit mode settings */
  editModeSettings: EditModeSettings
  /** Callback when edit mode settings change */
  onEditModeSettingsChange: (settings: Partial<EditModeSettings>) => void
  /** Grid settings */
  gridSettings: GridSettings
  /** Callback when grid settings change */
  onGridSettingsChange: (settings: Partial<GridSettings>) => void
  /** Current viewBox (for viewport resize) */
  viewBox?: ViewBox
  /** Callback when viewBox changes */
  onViewBoxChange?: (viewBox: ViewBox) => void
}

export default function EditModeSection({
  editModeSettings,
  onEditModeSettingsChange,
  gridSettings,
  onGridSettingsChange,
  viewBox,
  onViewBoxChange,
}: EditModeSectionProps) {
  const { t } = useTranslation()

  // Local state for viewport dimensions (to handle input editing)
  const [widthInput, setWidthInput] = useState(viewBox?.width.toString() ?? '100')
  const [heightInput, setHeightInput] = useState(viewBox?.height.toString() ?? '100')
  const [keepAspectRatio, setKeepAspectRatio] = useState(true)

  // Icon state for aspect ratio lock button (follows TemplateEditor's TransformationPanel pattern)
  const syncIconState = useMemo(
    () =>
      keepAspectRatio
        ? {
            source: EXTRA_ICONS.SYNC_ICON,
            alt: t('unlock-aspect-ratio'),
          }
        : {
            source: EXTRA_ICONS.UN_SYNC_ICON,
            alt: t('lock-aspect-ratio'),
          },
    [keepAspectRatio, t]
  )

  // Sync local state when viewBox changes externally
  useEffect(() => {
    if (viewBox) {
      setWidthInput(Math.round(viewBox.width).toString())
      setHeightInput(Math.round(viewBox.height).toString())
    }
  }, [viewBox])

  // Toggle handlers
  const handleToggleRuler = (checked: boolean) => {
    onEditModeSettingsChange({ showRuler: checked })
  }

  const handleToggleGrid = (checked: boolean) => {
    onEditModeSettingsChange({ showGrid: checked })
  }

  const handleGridSizeChange = (value: number) => {
    onGridSettingsChange({ size: value })
  }

  const handleSnapEnabledChange = (checked: boolean) => {
    onGridSettingsChange({ snapEnabled: checked })
  }

  // Viewport resize handlers
  const handleWidthChange = useCallback(
    (value: string) => {
      setWidthInput(value)
      const newWidth = parseInt(value, 10)
      if (!isNaN(newWidth) && newWidth >= MIN_VIEWPORT_SIZE && viewBox && onViewBoxChange) {
        if (keepAspectRatio) {
          const aspectRatio = viewBox.width / viewBox.height
          const newHeight = Math.round(newWidth / aspectRatio)
          setHeightInput(newHeight.toString())
          onViewBoxChange({ ...viewBox, width: newWidth, height: newHeight })
        } else {
          onViewBoxChange({ ...viewBox, width: newWidth })
        }
      }
    },
    [viewBox, onViewBoxChange, keepAspectRatio]
  )

  const handleHeightChange = useCallback(
    (value: string) => {
      setHeightInput(value)
      const newHeight = parseInt(value, 10)
      if (!isNaN(newHeight) && newHeight >= MIN_VIEWPORT_SIZE && viewBox && onViewBoxChange) {
        if (keepAspectRatio) {
          const aspectRatio = viewBox.width / viewBox.height
          const newWidth = Math.round(newHeight * aspectRatio)
          setWidthInput(newWidth.toString())
          onViewBoxChange({ ...viewBox, width: newWidth, height: newHeight })
        } else {
          onViewBoxChange({ ...viewBox, height: newHeight })
        }
      }
    },
    [viewBox, onViewBoxChange, keepAspectRatio]
  )

  const handleToggleAspectRatio = () => {
    setKeepAspectRatio(!keepAspectRatio)
  }

  return (
    <BlockStack gap="400">
      {/* Viewport resize section - follows TemplateEditor's TransformationPanel pattern */}
      <BlockStack gap="200">
        <Text as="span" variant="bodyMd" fontWeight="medium">
          {t('svg-dimensions')}
        </Text>
        {viewBox && onViewBoxChange && (
          <InlineStack gap="200" wrap={false} align="space-between">
            <TextField
              label={t('width')}
              labelHidden
              autoComplete="off"
              value={widthInput}
              onChange={handleWidthChange}
              prefix="W"
              suffix="px"
              type="number"
              min={MIN_VIEWPORT_SIZE}
            />
            <TextField
              label={t('height')}
              labelHidden
              autoComplete="off"
              value={heightInput}
              onChange={handleHeightChange}
              prefix="H"
              suffix="px"
              type="number"
              min={MIN_VIEWPORT_SIZE}
            />
            <Button
              icon={<Image source={syncIconState.source} alt={syncIconState.alt} style={{ display: 'block' }} />}
              variant="tertiary"
              onClick={handleToggleAspectRatio}
              accessibilityLabel={syncIconState.alt}
            />
          </InlineStack>
        )}
      </BlockStack>

      {/* Show Ruler checkbox */}
      <BlockStack gap="100">
        <Checkbox
          label={t('show-ruler')}
          helpText={t('drag-from-ruler-to-create-guidelines')}
          checked={editModeSettings.showRuler}
          onChange={handleToggleRuler}
        />
      </BlockStack>

      {/* Show Grid checkbox with sub-settings */}
      <BlockStack gap="100">
        <Checkbox
          label={t('show-grid')}
          helpText={t('display-grid-lines-for-alignment')}
          checked={editModeSettings.showGrid}
          onChange={handleToggleGrid}
        />

        {/* Grid sub-settings (indented when enabled) */}
        {editModeSettings.showGrid && (
          <Box paddingInlineStart="600">
            <BlockStack gap="200">
              {/* Grid size slider */}
              <RangeSlider
                label={t('grid-size')}
                value={gridSettings.size}
                min={MIN_GRID_SIZE}
                max={MAX_GRID_SIZE}
                step={1}
                output
                suffix={
                  <Text as="span" variant="bodySm">
                    {gridSettings.size}
                  </Text>
                }
                onChange={handleGridSizeChange}
              />

              {/* Snap to grid checkbox */}
              <Checkbox
                label={t('snap-to-grid')}
                checked={gridSettings.snapEnabled}
                onChange={handleSnapEnabledChange}
              />
            </BlockStack>
          </Box>
        )}
      </BlockStack>
    </BlockStack>
  )
}
