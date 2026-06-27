/**
 * use-canvas-tools.ts
 * Initializes and wires all drawing tool hooks used by InteractiveCanvas.
 */
import { useCallback, useRef } from 'react'
import type { VectorShape, ShapeSelection } from '../../types'
import { useVectorSelectionTool } from '../../hooks/useVectorSelectionTool'
import { useVectorNodeEditing } from '../../hooks/useVectorNodeEditing'
import { useMagicWandTool } from '../../hooks/useMagicWandTool'
import { useShapeDrawingTool } from '../../hooks/useShapeDrawingTool'
import { useAutoDetectTool } from '../../hooks/useAutoDetectTool'
import { usePaintTool } from '../../hooks/use-paint-tool'
import type { UseInteractionStateReturn } from './use-interaction-state'
import type { DrawingMode } from './types'

interface UseCanvasToolsParams {
  isVectorMode: boolean
  isMagicWandMode: boolean
  isAutoDetectMode: boolean
  mobileMode: DrawingMode
  isMobileView: boolean
  image: HTMLImageElement | null
  viewportScale: number
  shapeSelections: ShapeSelection[]
  onShapeSelectionsChange: (s: ShapeSelection[]) => void
  interaction: UseInteractionStateReturn
  transformCanvasToImage: (cx: number, cy: number) => { x: number; y: number }
  transformImageToCanvas: (ix: number, iy: number) => { x: number; y: number }
  setIsVectorMode: (v: boolean) => void
  setIsMagicWandMode: (v: boolean) => void
  setIsAutoDetectMode: (v: boolean) => void
  setMobileMode: (mode: DrawingMode) => void
  setHasInteracted: (v: boolean) => void
}

export function useCanvasTools(p: UseCanvasToolsParams) {
  const {
    isVectorMode,
    isMagicWandMode,
    mobileMode,
    isMobileView,
    image,
    viewportScale,
    shapeSelections,
    onShapeSelectionsChange,
    interaction,
    transformCanvasToImage,
    transformImageToCanvas,
    setIsVectorMode,
    setIsMagicWandMode,
    setIsAutoDetectMode,
    setMobileMode,
    setHasInteracted,
  } = p

  const vectorTool = useVectorSelectionTool({
    isActive: isVectorMode,
    viewportScale,
    transformCanvasToImage,
    transformImageToCanvas,
    onVectorShapeComplete: useCallback(
      (shape: VectorShape) => {
        const next = [...shapeSelections, shape]
        onShapeSelectionsChange(next)
        interaction.setSelectedShapeIndex(next.length - 1)
        setIsVectorMode(true)
        setMobileMode('vector')
      },
      [shapeSelections, onShapeSelectionsChange, interaction, setIsVectorMode, setMobileMode]
    ),
  })

  const magicWand = useMagicWandTool({
    isActive: isMagicWandMode,
    image,
    transformCanvasToImage,
    onShapeComplete: useCallback(
      (shape: VectorShape) => {
        const next = [...shapeSelections, shape]
        onShapeSelectionsChange(next)
        interaction.setSelectedShapeIndex(next.length - 1)
        setIsMagicWandMode(false)
        setIsVectorMode(true)
        setMobileMode('vector')
        setHasInteracted(true)
      },
      [
        shapeSelections,
        onShapeSelectionsChange,
        interaction,
        setIsMagicWandMode,
        setIsVectorMode,
        setMobileMode,
        setHasInteracted,
      ]
    ),
  })

  const autoDetect = useAutoDetectTool({
    isActive: p.isAutoDetectMode,
    image,
    transformImageToCanvas,
    isMobileView,
    onShapeComplete: useCallback(
      (shape: VectorShape) => {
        const next = [...shapeSelections, shape]
        onShapeSelectionsChange(next)
        interaction.setSelectedShapeIndex(next.length - 1)
        setIsAutoDetectMode(false)
        setIsVectorMode(true)
        setMobileMode('vector')
        setHasInteracted(true)
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [shapeSelections, onShapeSelectionsChange]
    ),
  })

  const nodeEditing = useVectorNodeEditing({
    shapeSelections,
    selectedShapeIndex: interaction.selectedShapeIndex,
    onShapeSelectionsChange,
    transformImageToCanvas,
    viewportScale,
  })

  const paintTool = usePaintTool({
    isActive: mobileMode === 'paint' && !p.isAutoDetectMode,
    image,
    transformCanvasToImage,
    onShapeComplete: useCallback(
      (shape: VectorShape) => {
        const next = [...shapeSelections, shape]
        onShapeSelectionsChange(next)
        interaction.setSelectedShapeIndex(next.length - 1)
        setMobileMode('vector')
        setIsVectorMode(true)
        setHasInteracted(true)
      },
      [shapeSelections, onShapeSelectionsChange, interaction, setMobileMode, setIsVectorMode, setHasInteracted]
    ),
  })

  const shapeTool = useShapeDrawingTool({
    isActive: (mobileMode === 'rectangle' || mobileMode === 'ellipse') && !isVectorMode && !isMagicWandMode,
    shapeType: mobileMode === 'ellipse' ? 'ellipse' : 'rectangle',
    image,
    transformCanvasToImage,
    transformImageToCanvas,
    onShapeComplete: shape => {
      onShapeSelectionsChange([...shapeSelections, shape])
      interaction.setSelectedShapeIndex(shapeSelections.length)
      // Auto-switch to pan/select after a shape is created — pan mode now
      // handles direct manipulation (move/resize/rotate) on touched shapes.
      if (isMobileView) setMobileMode('pan')
    },
    onShiftExpand: shape => {
      const idx = interaction.selectedShapeIndex
      if (idx !== null) {
        const existing = shapeSelections[idx]
        if (existing && existing.type !== 'vector') {
          const mx = Math.min(existing.x, shape.x)
          const my = Math.min(existing.y, shape.y)
          const updated = [...shapeSelections]
          updated[idx] = {
            ...existing,
            x: mx,
            y: my,
            width: Math.max(existing.x + existing.width, shape.x + shape.width) - mx,
            height: Math.max(existing.y + existing.height, shape.y + shape.height) - my,
          }
          onShapeSelectionsChange(updated)
          return
        }
      }
      onShapeSelectionsChange([...shapeSelections, shape])
      interaction.setSelectedShapeIndex(shapeSelections.length)
    },
  })

  // Stable refs for async/event callbacks
  const vectorToolRef = useRef(vectorTool)
  vectorToolRef.current = vectorTool
  const magicWandRef = useRef(magicWand)
  magicWandRef.current = magicWand
  const autoDetectRef = useRef(autoDetect)
  autoDetectRef.current = autoDetect
  const nodeEditingRef = useRef(nodeEditing)
  nodeEditingRef.current = nodeEditing
  const shapeToolRef = useRef(shapeTool)
  shapeToolRef.current = shapeTool
  const paintToolRef = useRef(paintTool)
  paintToolRef.current = paintTool
  const nodeEditingDeleteSelectedRef = useRef<(() => boolean) | null>(null)
  nodeEditingDeleteSelectedRef.current = nodeEditing.deleteSelectedNodes

  return {
    vectorTool,
    magicWand,
    autoDetect,
    nodeEditing,
    shapeTool,
    paintTool,
    vectorToolRef,
    magicWandRef,
    autoDetectRef,
    nodeEditingRef,
    shapeToolRef,
    paintToolRef,
    nodeEditingDeleteSelectedRef,
  }
}
