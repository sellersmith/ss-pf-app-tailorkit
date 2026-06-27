import type React from 'react'
import type { ShapeSelection } from '../../types'
import type { PathCommand } from '~/modules/VectorEditor/utils/svg'
import type { UseInteractionStateReturn } from './use-interaction-state'
import type { UseCanvasZoomReturn } from './use-canvas-zoom'

export interface MouseHandlerParams {
  image: HTMLImageElement | null
  canvasRef: React.RefObject<HTMLCanvasElement>
  getCanvasCoordinates: (event: React.MouseEvent<HTMLCanvasElement>) => { x: number; y: number } | null
  getCanvasContext: () => CanvasRenderingContext2D | null
  shapeSelections: ShapeSelection[]
  onShapeSelectionsChange: (s: ShapeSelection[]) => void
  interaction: UseInteractionStateReturn
  zoom: UseCanvasZoomReturn
  isVectorMode: boolean
  isMagicWandMode: boolean
  isVectorModeRef: React.MutableRefObject<boolean>
  findShapeAtPoint: (x: number, y: number, shapes: ShapeSelection[]) => number | null
  isWithinImageBounds: (x: number, y: number) => boolean
  transformCanvasToImage: (cx: number, cy: number) => { x: number; y: number }
  isMobileView: boolean
  magicWand: { cvReady: boolean; isProcessing: boolean; handleTap: (cx: number, cy: number) => void }
  nodeEditing: {
    isActive: boolean
    isMarqueeSelecting: boolean
    hoveredNodeIndex: number | null
    hoveredCp: unknown | null
    selectedNodeIndices: Set<number>
    handleMouseDown: (x: number, y: number, shift: boolean) => boolean
    handleMouseMove: (x: number, y: number, shift?: boolean) => boolean
    handleMouseUp: () => boolean
  }
  vectorTool: {
    isDrawing: boolean
    handleMouseDown: (cx: number, cy: number) => void
    handleMouseMove: (cx: number, cy: number) => void
    handleMouseUp: () => void
  }
  shapeTool: {
    isDrawing: boolean
    handleMouseDown: (cx: number, cy: number, shift: boolean) => void
    handleMouseMove: (cx: number, cy: number) => void
    handleMouseUp: () => void
  }
  paintTool: {
    isPainting: boolean
    brushSize: number
    handlePointerDown: (cx: number, cy: number) => void
    handlePointerMove: (cx: number, cy: number) => void
    handlePointerUp: () => void
  }
  isPaintMode: boolean
  serializePathCommandsToD: (cmds: PathCommand[]) => string
  vectorDrawingStartedRef: React.MutableRefObject<boolean>
  setHasInteracted: (v: boolean) => void
  setMobileMode: (mode: 'pan' | 'rectangle' | 'ellipse' | 'vector' | 'magicwand' | 'manipulate' | 'paint') => void
  setIsVectorMode: (v: boolean) => void
}
