import { useCallback } from 'react'
import type Konva from 'konva'
import type { KonvaEditorState } from 'extensions/tailorkit-src/src/assets/handlers/event-handlers/image-editor/types/editor-types'

export interface ClipGroupTransformData {
  absoluteWidth: number
  absoluteHeight: number
  absoluteX: number
  absoluteY: number
  rotation: number
}

export interface ClipGroupProps {
  clipGroup: KonvaEditorState | null
  editInnerImage: boolean
  width: number
  height: number
  onInnerTransform?: (state: ClipGroupTransformData) => void
}

/**
 * Custom hook for managing clipGroup inner image interactions
 */
export function useClipGroup({ onInnerTransform }: Pick<ClipGroupProps, 'onInnerTransform'>) {
  /**
   * Handles drag end event for inner image in clipGroup
   */
  const handleInnerDragEnd = useCallback(
    (e: { target: Konva.Node }) => {
      if (!onInnerTransform) return
      const node = e.target
      onInnerTransform({
        absoluteWidth: node.width(),
        absoluteHeight: node.height(),
        absoluteX: node.x(),
        absoluteY: node.y(),
        rotation: node.rotation() || 0,
      })
    },
    [onInnerTransform]
  )

  /**
   * Creates a transform end handler for inner image in clipGroup
   */
  const createHandleInnerTransformEnd = useCallback(
    (imageRef: React.RefObject<any>, innerImageNodeRef: React.RefObject<any>) => {
      return () => {
        if (!onInnerTransform) return
        const node = imageRef?.current || innerImageNodeRef.current
        if (!node) return

        const scaleX = node.scaleX()
        const scaleY = node.scaleY()
        node.scaleX(1)
        node.scaleY(1)

        onInnerTransform({
          absoluteWidth: Math.max(5, node.width() * scaleX),
          absoluteHeight: Math.max(5, node.height() * scaleY),
          absoluteX: node.x(),
          absoluteY: node.y(),
          rotation: node.rotation() || 0,
        })
      }
    },
    [onInnerTransform]
  )

  return {
    handleInnerDragEnd,
    createHandleInnerTransformEnd,
  }
}
