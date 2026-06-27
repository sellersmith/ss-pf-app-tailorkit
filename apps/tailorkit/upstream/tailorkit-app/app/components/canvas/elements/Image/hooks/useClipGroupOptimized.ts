import { useCallback, useRef } from 'react'
import type Konva from 'konva'

export interface ClipGroupTransformData {
  absoluteWidth: number
  absoluteHeight: number
  absoluteX: number
  absoluteY: number
  rotation: number
}

export interface ClipGroupProps {
  onInnerTransform?: (state: ClipGroupTransformData) => void
}

/**
 * Optimized custom hook for managing clipGroup inner image interactions
 * Features immediate cache management and smooth transform handling
 */
export function useClipGroupOptimized({ onInnerTransform }: ClipGroupProps) {
  // Track transform state for optimization
  const isTransformingRef = useRef(false)
  const transformStartTimeRef = useRef(0)

  /**
   * Handles drag start event for inner image in clipGroup
   */
  const handleInnerDragStart = useCallback(() => {
    isTransformingRef.current = true
    transformStartTimeRef.current = Date.now()
  }, [])

  /**
   * Handles transform start event for inner image in clipGroup
   */
  const handleInnerTransformStart = useCallback(() => {
    isTransformingRef.current = true
    transformStartTimeRef.current = Date.now()
  }, [])

  /**
   * Handles drag end event for inner image in clipGroup with optimized timing
   */
  const handleInnerDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (!onInnerTransform) return

      const node = e.target
      const transformData = {
        absoluteWidth: node.width(),
        absoluteHeight: node.height(),
        absoluteX: node.x(),
        absoluteY: node.y(),
        rotation: node.rotation() || 0,
      }

      // Immediate callback for responsive UI
      onInnerTransform(transformData)

      isTransformingRef.current = false
    },
    [onInnerTransform]
  )

  /**
   * Creates an optimized transform end handler for inner image in clipGroup
   */
  const createHandleInnerTransformEnd = useCallback(
    (imageRef: React.RefObject<Konva.Image>, innerImageNodeRef: React.RefObject<Konva.Image>) => {
      return () => {
        if (!onInnerTransform) return

        const node = imageRef?.current || innerImageNodeRef.current
        if (!node) return

        const scaleX = node.scaleX()
        const scaleY = node.scaleY()

        // Reset scale immediately for consistent behavior
        node.scaleX(1)
        node.scaleY(1)

        const transformData = {
          absoluteWidth: Math.max(5, node.width() * scaleX),
          absoluteHeight: Math.max(5, node.height() * scaleY),
          absoluteX: node.x(),
          absoluteY: node.y(),
          rotation: node.rotation() || 0,
        }

        // Immediate callback for responsive UI
        onInnerTransform(transformData)

        isTransformingRef.current = false

        // Force immediate redraw to prevent visual glitches
        const layer = node.getLayer()
        if (layer) {
          layer.batchDraw()
        }
      }
    },
    [onInnerTransform]
  )

  /**
   * Check if currently transforming (useful for cache management)
   */
  const isTransforming = useCallback(() => {
    return isTransformingRef.current
  }, [])

  /**
   * Get transform duration (useful for debouncing decisions)
   */
  const getTransformDuration = useCallback(() => {
    return Date.now() - transformStartTimeRef.current
  }, [])

  return {
    handleInnerDragStart,
    handleInnerDragEnd,
    handleInnerTransformStart,
    createHandleInnerTransformEnd,
    isTransforming,
    getTransformDuration,
  }
}
