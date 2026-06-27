/**
 * DesktopPaintControls — brush/eraser toggle, brush size, confirm/cancel.
 * Shown when paint tool is active and has painted overlay.
 * Also reused by auto-detect and magic wand when in overlay editing mode.
 */

import React from 'react'
import { ButtonGroup, Button, Tooltip } from '@shopify/polaris'
import { PaintBrushFlatIcon, DeleteIcon, MinusIcon, PlusIcon, CheckIcon, XIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { PAINT_CONSTANTS } from '../../constants'
import styles from '../../styles.module.css'

interface DesktopPaintControlsProps {
  visible: boolean
  mode: 'brush' | 'eraser'
  brushSize: number
  /** Disable confirm button when there's nothing to confirm */
  confirmDisabled?: boolean
  onModeChange: (mode: 'brush' | 'eraser') => void
  onBrushSizeChange: (size: number) => void
  onConfirm: () => void
  onCancel: () => void
}

export function DesktopPaintControls({
  visible,
  mode,
  brushSize,
  confirmDisabled,
  onModeChange,
  onBrushSizeChange,
  onConfirm,
  onCancel,
}: DesktopPaintControlsProps) {
  const { t } = useTranslation()

  if (!visible) return null

  return (
    <div className={styles.desktopVectorControls}>
      {/* Brush / Eraser toggle */}
      <ButtonGroup variant="segmented">
        <Tooltip content={t('paint-brush')} dismissOnMouseOut>
          <Button
            pressed={mode === 'brush'}
            onClick={() => onModeChange('brush')}
            icon={PaintBrushFlatIcon}
            size="slim"
            accessibilityLabel={t('paint-brush')}
          />
        </Tooltip>
        <Tooltip content={t('eraser')} dismissOnMouseOut>
          <Button
            pressed={mode === 'eraser'}
            onClick={() => onModeChange('eraser')}
            icon={DeleteIcon}
            size="slim"
            accessibilityLabel={t('eraser')}
          />
        </Tooltip>
      </ButtonGroup>

      {/* Brush size */}
      <ButtonGroup variant="segmented">
        <Tooltip content={t('decrease-brush-size')} dismissOnMouseOut>
          <Button
            onClick={() =>
              onBrushSizeChange(Math.max(brushSize - PAINT_CONSTANTS.BRUSH_SIZE_STEP, PAINT_CONSTANTS.MIN_BRUSH_SIZE))
            }
            size="slim"
            icon={MinusIcon}
            disabled={brushSize <= PAINT_CONSTANTS.MIN_BRUSH_SIZE}
            accessibilityLabel={t('decrease-brush-size')}
          />
        </Tooltip>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 8px',
            fontSize: 12,
            fontWeight: 600,
            minWidth: 32,
            justifyContent: 'center',
          }}
        >
          {brushSize}
        </div>
        <Tooltip content={t('increase-brush-size')} dismissOnMouseOut>
          <Button
            onClick={() =>
              onBrushSizeChange(Math.min(brushSize + PAINT_CONSTANTS.BRUSH_SIZE_STEP, PAINT_CONSTANTS.MAX_BRUSH_SIZE))
            }
            size="slim"
            icon={PlusIcon}
            disabled={brushSize >= PAINT_CONSTANTS.MAX_BRUSH_SIZE}
            accessibilityLabel={t('increase-brush-size')}
          />
        </Tooltip>
      </ButtonGroup>

      {/* Confirm / Cancel */}
      <ButtonGroup variant="segmented">
        <Tooltip content={t('confirm-and-create-selection-shape')} dismissOnMouseOut>
          <Button
            onClick={onConfirm}
            size="slim"
            icon={CheckIcon}
            variant="primary"
            disabled={confirmDisabled}
            accessibilityLabel={t('confirm-selection')}
          />
        </Tooltip>
        <Tooltip content={t('discard-current-selection')} dismissOnMouseOut>
          <Button onClick={onCancel} size="slim" icon={XIcon} accessibilityLabel={t('cancel-selection')} />
        </Tooltip>
      </ButtonGroup>
    </div>
  )
}
