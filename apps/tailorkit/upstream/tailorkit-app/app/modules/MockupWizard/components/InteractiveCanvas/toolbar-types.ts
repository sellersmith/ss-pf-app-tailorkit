import type { DrawingMode } from './types'

/** Shared paint/eraser control props used by both toolbars and overlay editing */
export interface PaintControlProps {
  paintToolHasOverlay: boolean
  paintToolMode: 'brush' | 'eraser'
  paintToolBrushSize: number
  onPaintToolModeChange: (mode: 'brush' | 'eraser') => void
  onPaintToolBrushSizeChange: (size: number) => void
  onPaintToolConfirm: () => void
  onPaintToolCancel: () => void
}

export interface MobileToolbarProps extends PaintControlProps {
  mobileMode: DrawingMode
  isPaintMode: boolean
  isAutoDetectMode: boolean
  isAutoDetectProcessing: boolean
  selectedShapeIndex: number | null
  isTouchDrawing: boolean
  isTouchMoving: boolean
  isTouchResizing: boolean
  isTouchRotating: boolean
  hasInteracted: boolean
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
  onSetMode: (mode: DrawingMode) => void
  onDeleteSelectedShape: () => void
  onAutoDetect: () => void
  onVectorUndo: () => void
  onVectorRedo: () => void
  onVectorFinish: () => void
  onVectorCancel: () => void
  onDeleteNodes: () => void
  onMagicWandToleranceChange: (v: number) => void
  onMagicWandConfirm: () => void
  onMagicWandCancel: () => void
  onAutoDetectConfirm: () => void
  onAutoDetectCancel: () => void
  onAutoDetectRetry: () => void
  getAutoDetectLabel: (phase: string, progress: { percent: number }, isMobile: boolean) => string
  onHintChange: (hint: string | null) => void
}

export interface DesktopToolbarProps extends PaintControlProps {
  mobileMode: DrawingMode
  isPaintMode: boolean
  isVectorMode: boolean
  isMagicWandMode: boolean
  isAutoDetectMode: boolean
  isAutoDetectProcessing: boolean
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
  onSetMode: (mode: DrawingMode) => void
  onAutoDetect: () => void
  onVectorUndo: () => void
  onVectorRedo: () => void
  onVectorFinish: () => void
  onVectorCancel: () => void
  onDeleteNodes: () => void
  onMagicWandToleranceChange: (v: number) => void
  onMagicWandConfirm: () => void
  onMagicWandCancel: () => void
  onAutoDetectConfirm: () => void
  onAutoDetectCancel: () => void
  onAutoDetectRetry: () => void
  getAutoDetectLabel: (phase: string, progress: { percent: number }, isMobile: boolean) => string
}
