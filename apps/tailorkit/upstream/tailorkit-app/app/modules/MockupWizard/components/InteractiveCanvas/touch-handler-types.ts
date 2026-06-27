import type { ShapeSelection } from '../../types'
import type { UseInteractionStateReturn } from './use-interaction-state'
import type { UseCanvasZoomReturn } from './use-canvas-zoom'
import type { DrawingMode } from './types'

export interface TouchHandlerParams {
  isMobileView: boolean
  image: HTMLImageElement | null
  canvasRef: React.RefObject<HTMLCanvasElement>
  shapeSelections: ShapeSelection[]
  onShapeSelectionsChange: (s: ShapeSelection[]) => void
  interaction: UseInteractionStateReturn
  zoom: UseCanvasZoomReturn
  mobileMode: DrawingMode
  isWithinImageBounds: (x: number, y: number) => boolean
  transformCanvasToImage: (cx: number, cy: number) => { x: number; y: number }
  findShapeAtPoint: (x: number, y: number, shapes: ShapeSelection[]) => number | null
  isOverInteractiveElement: (x: number, y: number) => boolean
  vectorTool: { handleMouseDown: (cx: number, cy: number) => void }
  vectorToolRef: React.MutableRefObject<{
    isDrawing: boolean
    handleMouseMove: (cx: number, cy: number) => void
    handleMouseUp: () => void
  }>
  nodeEditingRef: React.MutableRefObject<{
    isActive: boolean
    isMarqueeSelecting: boolean
    handleMouseDown: (x: number, y: number, shift?: boolean, isMobile?: boolean) => boolean
    handleMouseMove: (x: number, y: number) => void
    handleMouseUp: () => void
  }>
  magicWand: { cvReady: boolean; hasOverlay: boolean; handleTap: (cx: number, cy: number) => void }
  shapeTool: {
    handleMouseDown: (cx: number, cy: number, shift: boolean) => void
    handleMouseMove: (cx: number, cy: number) => void
    handleMouseUp: () => void
  }
  paintTool: {
    isPainting: boolean
    handlePointerDown: (cx: number, cy: number) => void
    handlePointerMove: (cx: number, cy: number) => void
    handlePointerUp: () => void
  }
  lastMagicWandTapRef: React.MutableRefObject<number>
  deleteShape: (index: number) => void
  setHasInteracted: (v: boolean) => void
  setMobileMode: (mode: DrawingMode) => void
  setIsVectorMode: (v: boolean) => void
}

export function getCanvasCoords(touch: Touch, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect()
  return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
}
