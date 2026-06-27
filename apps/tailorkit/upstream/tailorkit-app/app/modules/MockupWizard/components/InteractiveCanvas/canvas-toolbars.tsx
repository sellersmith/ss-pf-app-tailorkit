import React from 'react'
import type { DrawingMode } from './types'
import { MobileToolbar } from './mobile-toolbar'
import { DesktopToolbar } from './desktop-toolbar'

interface CanvasToolbarsProps {
  isMobileView: boolean
  mobileMode: DrawingMode
  isPaintMode: boolean
  isVectorMode: boolean
  isMagicWandMode: boolean
  isAutoDetectMode: boolean
  isAutoDetectProcessing: boolean
  hasInteracted: boolean
  tipIndex: number
  selectedShapeIndex: number | null
  isTouchDrawing: boolean
  isTouchMoving: boolean
  isTouchResizing: boolean
  isTouchRotating: boolean
  autoDetectPhase: string
  autoDetectProgress: { percent: number }
  autoDetectHasOverlay: boolean
  autoDetectError: string | null
  vectorToolIsDrawing: boolean
  vectorToolCanUndo: boolean
  vectorToolCanRedo: boolean
  nodeEditingIsActive: boolean
  nodeEditingSelectedNodeIndex: number | null
  magicWandHasOverlay: boolean
  magicWandTolerance: number
  magicWandIsLoading: boolean
  magicWandError: string | null
  // Paint tool props
  paintToolHasOverlay: boolean
  paintToolMode: 'brush' | 'eraser'
  paintToolBrushSize: number
  onPaintToolModeChange: (mode: 'brush' | 'eraser') => void
  onPaintToolBrushSizeChange: (size: number) => void
  onPaintToolConfirm: () => void
  onPaintToolCancel: () => void
  labelFn: (phase: string, progress: { percent: number }, isMobile: boolean) => string
  onSetMobileMode: (mode: DrawingMode) => void
  onDeleteSelectedShape: () => void
  onSetDesktopMode: (mode: DrawingMode) => void
  onAutoDetectMobile: () => void
  onAutoDetectDesktop: () => void
  onAutoDetectConfirm: () => void
  onAutoDetectCancel: () => void
  onAutoDetectRetry: () => void
  onVectorUndo: () => void
  onVectorRedo: () => void
  onVectorFinish: () => void
  onVectorCancel: () => void
  onDeleteNodes: () => void
  onMagicWandToleranceChange: (v: number) => void
  onMagicWandConfirm: () => void
  onMagicWandCancel: () => void
  onMobileHintChange: (hint: string | null) => void
}

export function CanvasToolbars(p: CanvasToolbarsProps) {
  if (p.isMobileView) {
    return (
      <MobileToolbar
        mobileMode={p.mobileMode}
        isPaintMode={p.isPaintMode}
        isAutoDetectMode={p.isAutoDetectMode}
        isAutoDetectProcessing={p.isAutoDetectProcessing}
        selectedShapeIndex={p.selectedShapeIndex}
        isTouchDrawing={p.isTouchDrawing}
        isTouchMoving={p.isTouchMoving}
        isTouchResizing={p.isTouchResizing}
        isTouchRotating={p.isTouchRotating}
        hasInteracted={p.hasInteracted}
        autoDetectPhase={p.autoDetectPhase}
        autoDetectProgress={p.autoDetectProgress}
        autoDetectHasOverlay={p.autoDetectHasOverlay}
        autoDetectError={p.autoDetectError}
        vectorToolIsDrawing={p.vectorToolIsDrawing}
        vectorToolCanUndo={p.vectorToolCanUndo}
        vectorToolCanRedo={p.vectorToolCanRedo}
        nodeEditingIsActive={p.nodeEditingIsActive}
        nodeEditingSelectedNodeIndex={p.nodeEditingSelectedNodeIndex}
        magicWandHasOverlay={p.magicWandHasOverlay}
        magicWandTolerance={p.magicWandTolerance}
        paintToolHasOverlay={p.paintToolHasOverlay}
        paintToolMode={p.paintToolMode}
        paintToolBrushSize={p.paintToolBrushSize}
        onPaintToolModeChange={p.onPaintToolModeChange}
        onPaintToolBrushSizeChange={p.onPaintToolBrushSizeChange}
        onPaintToolConfirm={p.onPaintToolConfirm}
        onPaintToolCancel={p.onPaintToolCancel}
        onSetMode={p.onSetMobileMode}
        onDeleteSelectedShape={p.onDeleteSelectedShape}
        onAutoDetect={p.onAutoDetectMobile}
        onVectorUndo={p.onVectorUndo}
        onVectorRedo={p.onVectorRedo}
        onVectorFinish={p.onVectorFinish}
        onVectorCancel={p.onVectorCancel}
        onDeleteNodes={p.onDeleteNodes}
        onMagicWandToleranceChange={p.onMagicWandToleranceChange}
        onMagicWandConfirm={p.onMagicWandConfirm}
        onMagicWandCancel={p.onMagicWandCancel}
        onAutoDetectConfirm={p.onAutoDetectConfirm}
        onAutoDetectCancel={p.onAutoDetectCancel}
        onAutoDetectRetry={p.onAutoDetectRetry}
        getAutoDetectLabel={p.labelFn}
        onHintChange={p.onMobileHintChange}
      />
    )
  }
  return (
    <DesktopToolbar
      mobileMode={p.mobileMode}
      isPaintMode={p.isPaintMode}
      isVectorMode={p.isVectorMode}
      isMagicWandMode={p.isMagicWandMode}
      isAutoDetectMode={p.isAutoDetectMode}
      isAutoDetectProcessing={p.isAutoDetectProcessing}
      autoDetectPhase={p.autoDetectPhase}
      autoDetectProgress={p.autoDetectProgress}
      autoDetectHasOverlay={p.autoDetectHasOverlay}
      autoDetectError={p.autoDetectError}
      vectorToolIsDrawing={p.vectorToolIsDrawing}
      vectorToolCanUndo={p.vectorToolCanUndo}
      vectorToolCanRedo={p.vectorToolCanRedo}
      nodeEditingIsActive={p.nodeEditingIsActive}
      nodeEditingSelectedNodeIndex={p.nodeEditingSelectedNodeIndex}
      magicWandHasOverlay={p.magicWandHasOverlay}
      magicWandTolerance={p.magicWandTolerance}
      magicWandIsLoading={p.magicWandIsLoading}
      magicWandError={p.magicWandError}
      paintToolHasOverlay={p.paintToolHasOverlay}
      paintToolMode={p.paintToolMode}
      paintToolBrushSize={p.paintToolBrushSize}
      onPaintToolModeChange={p.onPaintToolModeChange}
      onPaintToolBrushSizeChange={p.onPaintToolBrushSizeChange}
      onPaintToolConfirm={p.onPaintToolConfirm}
      onPaintToolCancel={p.onPaintToolCancel}
      onSetMode={p.onSetDesktopMode}
      onAutoDetect={p.onAutoDetectDesktop}
      onVectorUndo={p.onVectorUndo}
      onVectorRedo={p.onVectorRedo}
      onVectorFinish={p.onVectorFinish}
      onVectorCancel={p.onVectorCancel}
      onDeleteNodes={p.onDeleteNodes}
      onMagicWandToleranceChange={p.onMagicWandToleranceChange}
      onMagicWandConfirm={p.onMagicWandConfirm}
      onMagicWandCancel={p.onMagicWandCancel}
      onAutoDetectConfirm={p.onAutoDetectConfirm}
      onAutoDetectCancel={p.onAutoDetectCancel}
      onAutoDetectRetry={p.onAutoDetectRetry}
      getAutoDetectLabel={p.labelFn}
    />
  )
}
