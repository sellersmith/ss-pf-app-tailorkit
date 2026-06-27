import React, { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { ButtonGroup, Button, Icon } from '@shopify/polaris'
import {
  CursorIcon,
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
import { MagicWandControls } from './magic-wand-controls'
import { AutoDetectMobileControls } from './auto-detect-mobile-controls'
import { DesktopPaintControls } from './desktop-paint-controls'
import type { MobileToolbarProps } from './toolbar-types'
export type { MobileToolbarProps } from './toolbar-types'

interface ToolEntry {
  id: string
  active: boolean
  button: ReactNode
  subControls?: ReactNode
}

export function MobileToolbar(p: MobileToolbarProps) {
  const { t } = useTranslation()
  const { onHintChange } = p

  const hint = useCallback(
    (text: string, onClick: () => void) => () => {
      onHintChange(text)
      onClick()
    },
    [onHintChange]
  )

  const tools: ToolEntry[] = [
    {
      id: 'autodetect',
      active: p.isAutoDetectMode,
      button: (
        <div
          className={`${styles.autoDetectBtn} ${
            p.isAutoDetectProcessing ? `${styles.autoDetectBtnAnimating} ${styles.autoDetectBtnDisabled}` : ''
          }`}
        >
          <Button
            id="mockup-wizard-btn-autodetect-mobile"
            pressed={p.isAutoDetectMode}
            onClick={hint(t('auto-detect-and-outline-the-main-subject'), p.onAutoDetect)}
            size="slim"
            icon={<Icon source={WandIcon} tone="success" />}
          >
            {p.isAutoDetectProcessing
              ? p.getAutoDetectLabel(p.autoDetectPhase, p.autoDetectProgress, true)
              : t('auto-detect')}
          </Button>
        </div>
      ),
      subControls: (
        <AutoDetectMobileControls
          isAutoDetectMode={p.isAutoDetectMode}
          autoDetectPhase={p.autoDetectPhase}
          autoDetectHasOverlay={p.autoDetectHasOverlay}
          onConfirm={p.onAutoDetectConfirm}
          onCancel={p.onAutoDetectCancel}
          onRetry={p.onAutoDetectRetry}
        />
      ),
    },
    {
      id: 'pan',
      // Merged Select + Move/resize: pan mode also handles direct manipulation
      // (move shape, drag handles to resize/rotate) when a shape is selected.
      active: (p.mobileMode === 'pan' || p.mobileMode === 'manipulate') && !p.isAutoDetectMode,
      button: (
        <Button
          id="mockup-wizard-btn-pan"
          pressed={(p.mobileMode === 'pan' || p.mobileMode === 'manipulate') && !p.isAutoDetectMode}
          onClick={hint(t('tap-to-select-hold-to-remove-and-drag-to-pan'), () => p.onSetMode('pan'))}
          size="slim"
          icon={CursorIcon}
          accessibilityLabel={t('select-and-pan-mode')}
        >
          {t('select')}
        </Button>
      ),
      subControls:
        p.selectedShapeIndex !== null
        && (p.mobileMode === 'pan' || p.mobileMode === 'manipulate')
        && !p.isAutoDetectMode ? (
          <Button
            id="mockup-wizard-btn-delete-shape"
            onClick={p.onDeleteSelectedShape}
            size="slim"
            icon={DeleteIcon}
            tone="critical"
            accessibilityLabel={t('delete-selected-shape')}
          >
            {t('delete')}
          </Button>
        ) : null,
    },
    {
      id: 'rectangle',
      active: p.mobileMode === 'rectangle' && !p.isAutoDetectMode,
      button: (
        <Button
          id="mockup-wizard-btn-rectangle"
          pressed={p.mobileMode === 'rectangle' && !p.isAutoDetectMode}
          onClick={hint(t('drag-to-draw-rectangles'), () => p.onSetMode('rectangle'))}
          size="slim"
          icon={CornerSquareIcon}
        >
          {t('draw-rectangle')}
        </Button>
      ),
    },
    {
      id: 'ellipse',
      active: p.mobileMode === 'ellipse' && !p.isAutoDetectMode,
      button: (
        <Button
          id="mockup-wizard-btn-ellipse"
          pressed={p.mobileMode === 'ellipse' && !p.isAutoDetectMode}
          onClick={hint(t('drag-to-draw-ellipses'), () => p.onSetMode('ellipse'))}
          size="slim"
          icon={CornerRoundIcon}
        >
          {t('draw-ellipse')}
        </Button>
      ),
    },
    {
      id: 'paint',
      active: p.isPaintMode && !p.isAutoDetectMode,
      button: (
        <Button
          id="mockup-wizard-btn-paint"
          pressed={p.isPaintMode && !p.isAutoDetectMode}
          onClick={hint(t('paint-to-define-a-personalization-area'), () => p.onSetMode('paint'))}
          size="slim"
          icon={PaintBrushFlatIcon}
        >
          {t('paint-area')}
        </Button>
      ),
      subControls: p.isPaintMode ? (
        <DesktopPaintControls
          visible
          mode={p.paintToolMode}
          confirmDisabled={!p.paintToolHasOverlay}
          brushSize={p.paintToolBrushSize}
          onModeChange={p.onPaintToolModeChange}
          onBrushSizeChange={p.onPaintToolBrushSizeChange}
          onConfirm={p.onPaintToolConfirm}
          onCancel={p.onPaintToolCancel}
        />
      ) : null,
    },
    {
      id: 'vector',
      active: p.mobileMode === 'vector' && !p.isAutoDetectMode,
      button: (
        <Button
          id="mockup-wizard-btn-vector"
          pressed={p.mobileMode === 'vector' && !p.isAutoDetectMode}
          onClick={hint(
            t(
              p.nodeEditingIsActive
                ? 'drag-nodes-to-reshape-drag-empty-area-to-marquee-select-hold-on-node-to-remove'
                : 'tap-to-add-points-drag-for-curves-tap-first-point-to-close'
            ),
            () => p.onSetMode('vector')
          )}
          size="slim"
          icon={EditIcon}
        >
          {t('draw-freeform')}
        </Button>
      ),
      subControls: (
        <>
          {p.vectorToolIsDrawing && !p.nodeEditingIsActive && (
            <>
              <ButtonGroup variant="segmented">
                <Button
                  id="mockup-wizard-btn-undo"
                  onClick={p.onVectorUndo}
                  size="slim"
                  icon={UndoIcon}
                  disabled={!p.vectorToolCanUndo}
                  accessibilityLabel={t('undo')}
                />
                <Button
                  id="mockup-wizard-btn-redo"
                  onClick={p.onVectorRedo}
                  size="slim"
                  icon={RedoIcon}
                  disabled={!p.vectorToolCanRedo}
                  accessibilityLabel={t('redo')}
                />
              </ButtonGroup>
              <ButtonGroup variant="segmented">
                <Button
                  id="mockup-wizard-btn-complete"
                  onClick={p.onVectorFinish}
                  size="slim"
                  icon={CheckIcon}
                  variant="primary"
                  accessibilityLabel={t('complete-path')}
                />
                <Button
                  id="mockup-wizard-btn-cancel"
                  onClick={p.onVectorCancel}
                  size="slim"
                  icon={XIcon}
                  accessibilityLabel={t('cancel-drawing')}
                />
              </ButtonGroup>
            </>
          )}
          {p.nodeEditingIsActive && p.nodeEditingSelectedNodeIndex !== null && (
            <Button
              onClick={p.onDeleteNodes}
              size="slim"
              icon={DeleteIcon}
              tone="critical"
              accessibilityLabel={t('delete-selected-nodes')}
            >
              {t('delete')}
            </Button>
          )}
        </>
      ),
    },
    {
      id: 'magicwand',
      active: p.mobileMode === 'magicwand' && !p.isAutoDetectMode,
      button: (
        <Button
          id="mockup-wizard-btn-magicwand"
          pressed={p.mobileMode === 'magicwand' && !p.isAutoDetectMode}
          onClick={hint(t('click-to-auto-select-a-color-region'), () => p.onSetMode('magicwand'))}
          size="slim"
          icon={TargetIcon}
        >
          {t('magic-wand')}
        </Button>
      ),
      subControls:
        p.mobileMode === 'magicwand' && !p.isAutoDetectMode ? (
          <MagicWandControls
            tolerance={p.magicWandTolerance}
            hasOverlay={p.magicWandHasOverlay}
            onToleranceChange={p.onMagicWandToleranceChange}
            onConfirm={p.onMagicWandConfirm}
            onCancel={p.onMagicWandCancel}
          />
        ) : null,
    },
  ]

  const activeIndex = tools.findIndex(tool => tool.active)
  const activeId = activeIndex >= 0 ? tools[activeIndex]!.id : null

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
    <div ref={containerRef} className={styles.mobileToolbarArea}>
      <div className={styles.drawingModeToolbar}>
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
    </div>
  )
}
