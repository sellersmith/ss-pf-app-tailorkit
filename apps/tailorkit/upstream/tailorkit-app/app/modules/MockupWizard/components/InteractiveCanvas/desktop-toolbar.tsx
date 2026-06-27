import React, { useEffect, useRef, type ReactNode } from 'react'
import { ButtonGroup, Button, Tooltip, Icon } from '@shopify/polaris'
import {
  CornerSquareIcon,
  CornerRoundIcon,
  EditIcon,
  CheckIcon,
  XIcon,
  UndoIcon,
  RedoIcon,
  TargetIcon,
  WandIcon,
  PaintBrushFlatIcon,
  DeleteIcon,
} from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import styles from '../../styles.module.css'
import { DesktopMagicWandControls } from './desktop-magic-wand-controls'
import { DesktopAutoDetectControls } from './desktop-auto-detect-controls'
import { DesktopPaintControls } from './desktop-paint-controls'
import type { DesktopToolbarProps } from './toolbar-types'
export type { DesktopToolbarProps } from './toolbar-types'

interface ToolEntry {
  id: string
  /** True when this tool is the currently-active selection (matches Polaris `pressed`). */
  active: boolean
  button: ReactNode
  /** Sub-controls rendered inline only when this tool is active. */
  subControls?: ReactNode
}

/**
 * Toolbar layout: every tool button is always visible. The currently-active
 * tool (and its sub-controls) is moved to the FIRST position so the merchant
 * never has to scroll horizontally on mobile to reach the controls they're
 * working with.
 *
 * Default order when no tool is active: Auto detect, Rectangle, Ellipse, Paint,
 * Vector, Magic wand.
 */
export function DesktopToolbar(p: DesktopToolbarProps) {
  const { t } = useTranslation()

  const tools: ToolEntry[] = [
    {
      id: 'autodetect',
      active: p.isAutoDetectMode,
      button: (
        <Tooltip content={t('auto-detect-and-outline-the-main-subject')} dismissOnMouseOut>
          <div
            className={`${styles.autoDetectBtn} ${
              p.isAutoDetectProcessing ? `${styles.autoDetectBtnAnimating} ${styles.autoDetectBtnDisabled}` : ''
            }`}
          >
            <Button
              id="mockup-wizard-btn-autodetect"
              pressed={p.isAutoDetectMode}
              onClick={p.onAutoDetect}
              icon={<Icon source={WandIcon} tone="success" />}
            >
              {p.isAutoDetectProcessing
                ? p.getAutoDetectLabel(p.autoDetectPhase, p.autoDetectProgress, false)
                : t('auto-detect')}
            </Button>
          </div>
        </Tooltip>
      ),
      subControls: (
        <DesktopAutoDetectControls
          isAutoDetectMode={p.isAutoDetectMode}
          autoDetectPhase={p.autoDetectPhase}
          autoDetectHasOverlay={p.autoDetectHasOverlay}
          autoDetectError={p.autoDetectError}
          onConfirm={p.onAutoDetectConfirm}
          onCancel={p.onAutoDetectCancel}
          onRetry={p.onAutoDetectRetry}
        />
      ),
    },
    {
      id: 'rectangle',
      active: p.mobileMode === 'rectangle' && !p.isVectorMode && !p.isMagicWandMode && !p.isAutoDetectMode,
      button: (
        <Tooltip content={t('drag-to-draw-hold-shift-to-expand-a-selected-shape')} dismissOnMouseOut>
          <Button
            id="mockup-wizard-btn-rectangle"
            pressed={p.mobileMode === 'rectangle' && !p.isVectorMode && !p.isMagicWandMode && !p.isAutoDetectMode}
            onClick={() => p.onSetMode('rectangle')}
            icon={CornerSquareIcon}
          >
            {t('draw-rectangle')}
          </Button>
        </Tooltip>
      ),
    },
    {
      id: 'ellipse',
      active: p.mobileMode === 'ellipse' && !p.isVectorMode && !p.isMagicWandMode && !p.isAutoDetectMode,
      button: (
        <Tooltip content={t('drag-to-draw-hold-shift-to-expand-a-selected-shape')} dismissOnMouseOut>
          <Button
            id="mockup-wizard-btn-ellipse"
            pressed={p.mobileMode === 'ellipse' && !p.isVectorMode && !p.isMagicWandMode && !p.isAutoDetectMode}
            onClick={() => p.onSetMode('ellipse')}
            icon={CornerRoundIcon}
          >
            {t('draw-ellipse')}
          </Button>
        </Tooltip>
      ),
    },
    {
      id: 'paint',
      active: p.isPaintMode && !p.isAutoDetectMode,
      button: (
        <Tooltip content={t('paint-to-define-a-personalization-area')} dismissOnMouseOut>
          <Button
            id="mockup-wizard-btn-paint"
            pressed={p.isPaintMode && !p.isAutoDetectMode}
            onClick={() => p.onSetMode('paint')}
            icon={PaintBrushFlatIcon}
          >
            {t('paint-area')}
          </Button>
        </Tooltip>
      ),
      subControls: (
        <DesktopPaintControls
          visible={p.isPaintMode}
          mode={p.paintToolMode}
          confirmDisabled={!p.paintToolHasOverlay}
          brushSize={p.paintToolBrushSize}
          onModeChange={p.onPaintToolModeChange}
          onBrushSizeChange={p.onPaintToolBrushSizeChange}
          onConfirm={p.onPaintToolConfirm}
          onCancel={p.onPaintToolCancel}
        />
      ),
    },
    {
      id: 'vector',
      active: p.isVectorMode && !p.isAutoDetectMode,
      button: (
        <Tooltip
          content={t(
            p.nodeEditingIsActive
              ? 'Drag nodes to reshape. Drag empty area to marquee-select. Shift+click to add/remove from selection. Delete to remove nodes.'
              : 'Click to place points, drag for curves, click first point to close. Click a shape to edit nodes.'
          )}
          dismissOnMouseOut
        >
          <Button
            id="mockup-wizard-btn-vector"
            pressed={p.isVectorMode && !p.isAutoDetectMode}
            onClick={() => p.onSetMode('vector')}
            icon={EditIcon}
          >
            {t('draw-freeform')}
          </Button>
        </Tooltip>
      ),
      subControls:
        p.nodeEditingIsActive && p.nodeEditingSelectedNodeIndex !== null ? (
          <div className={styles.desktopVectorControls}>
            <Tooltip content={t('delete-selected-nodes')} dismissOnMouseOut>
              <Button
                onClick={p.onDeleteNodes}
                size="slim"
                icon={DeleteIcon}
                tone="critical"
                accessibilityLabel={t('delete-selected-nodes')}
              >
                {t('delete')}
              </Button>
            </Tooltip>
          </div>
        ) : p.vectorToolIsDrawing && !p.nodeEditingIsActive ? (
          <div className={styles.desktopVectorControls}>
            <ButtonGroup variant="segmented">
              <Tooltip content={t('undo')} dismissOnMouseOut>
                <Button
                  onClick={p.onVectorUndo}
                  size="slim"
                  icon={UndoIcon}
                  disabled={!p.vectorToolCanUndo}
                  accessibilityLabel={t('undo')}
                />
              </Tooltip>
              <Tooltip content={t('redo')} dismissOnMouseOut>
                <Button
                  onClick={p.onVectorRedo}
                  size="slim"
                  icon={RedoIcon}
                  disabled={!p.vectorToolCanRedo}
                  accessibilityLabel={t('redo')}
                />
              </Tooltip>
            </ButtonGroup>
            <ButtonGroup variant="segmented">
              <Tooltip content={t('complete-path')} dismissOnMouseOut>
                <Button
                  onClick={p.onVectorFinish}
                  size="slim"
                  icon={CheckIcon}
                  variant="primary"
                  accessibilityLabel={t('complete-path')}
                />
              </Tooltip>
              <Tooltip content={t('cancel-drawing')} dismissOnMouseOut>
                <Button onClick={p.onVectorCancel} size="slim" icon={XIcon} accessibilityLabel={t('cancel-drawing')} />
              </Tooltip>
            </ButtonGroup>
          </div>
        ) : null,
    },
    {
      id: 'magicwand',
      active: p.isMagicWandMode && !p.isAutoDetectMode,
      button: (
        <Tooltip content={t('click-to-auto-select-a-color-region')} dismissOnMouseOut>
          <Button
            id="mockup-wizard-btn-magicwand"
            pressed={p.isMagicWandMode && !p.isAutoDetectMode}
            onClick={() => p.onSetMode('magicwand')}
            icon={TargetIcon}
          >
            {t('magic-wand')}
          </Button>
        </Tooltip>
      ),
      subControls: (
        <DesktopMagicWandControls
          isMagicWandMode={p.isMagicWandMode}
          magicWandHasOverlay={p.magicWandHasOverlay}
          magicWandTolerance={p.magicWandTolerance}
          magicWandIsLoading={p.magicWandIsLoading}
          magicWandError={p.magicWandError}
          onToleranceChange={p.onMagicWandToleranceChange}
          onConfirm={p.onMagicWandConfirm}
          onCancel={p.onMagicWandCancel}
        />
      ),
    },
  ]

  const activeIndex = tools.findIndex(tool => tool.active)
  const activeId = activeIndex >= 0 ? tools[activeIndex]!.id : null

  // Scroll the toolbar so the clicked tool's button is at the left edge.
  // Tools stay in fixed order — no reordering on activation.
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<Map<string, HTMLElement>>(new Map())
  const lastActiveIdRef = useRef<string | null>(activeId)
  useEffect(() => {
    if (lastActiveIdRef.current === activeId || !activeId) return
    lastActiveIdRef.current = activeId
    const container = containerRef.current
    const buttonEl = buttonRefs.current.get(activeId)
    if (container && buttonEl) {
      container.scrollTo({ left: buttonEl.offsetLeft, behavior: 'smooth' })
    }
  }, [activeId])

  return (
    <div ref={containerRef} className={styles.desktopDrawingToolbar}>
      {tools.map(tool => (
        <div
          key={tool.id}
          ref={el => {
            if (el) buttonRefs.current.set(tool.id, el)
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          {tool.button}
          {tool.active && tool.subControls}
        </div>
      ))}
    </div>
  )
}
