import type Konva from 'konva'
import type { RefObject } from 'react'
import { Group, Image as KonvaImageComponent } from 'react-konva'
import type { ClipGroupTransformData } from './hooks/useClipGroup'
import type { IMaskConfig } from './KonvaImageWithMask.client'
import { useMemo, useRef, useEffect, useCallback } from 'react'
import type { NodeImage } from '~/types/psd'
import { useRAFDebounce } from '~/modules/TemplateEditor/hooks/useRAFDebounce'
import { isSvgImage } from '~/utils/file-types'
import { MASK_COMPOSITE_CACHE_GROUP_NAME, type CachedGroupAttrs } from '~/utils/konva-cache'

interface LayerProps {
  id: string
  name: string
  onDblClick?: () => void
  x: number
  y: number
}

interface ClipGroupRendererProps {
  clipGroup: NodeImage['clipGroup']
  editInnerImage: boolean
  width: number
  height: number
  rotation: number
  visible: boolean
  img: HTMLImageElement
  /** Image source URL - used to detect SVG images for aspect ratio handling */
  src?: string
  mask?: IMaskConfig | null
  getProcessedMask?: HTMLImageElement | HTMLCanvasElement | null
  otherProps: LayerProps
  imageRef?: RefObject<Konva.Image>
  innerImageNodeRef: RefObject<Konva.Image | null>
  imageNode: RefObject<Konva.Image | null>
  onInnerTransform?: (state: ClipGroupTransformData) => void
  handleInnerDragStart?: () => void
  handleInnerDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void
  handleInnerTransformStart?: () => void
  handleInnerTransformEnd: () => void
  isTransforming?: () => boolean
}

/**
 * Renders clipGroup: container group that clips the inner image and applies mask overlay
 * Uses RAF-based debounced caching for optimal performance during mask/position changes
 */
export function ClipGroupRenderer({
  clipGroup,
  editInnerImage,
  width,
  height,
  rotation,
  visible,
  img,
  src,
  mask,
  getProcessedMask,
  otherProps: { name, ...layerProps },
  imageRef,
  innerImageNodeRef,
  imageNode,
  handleInnerDragStart,
  handleInnerDragEnd,
  handleInnerTransformStart,
  handleInnerTransformEnd,
  isTransforming,
}: ClipGroupRendererProps) {
  // Calculate clip group dimensions with aspect-ratio-preserving fallback
  // When absoluteWidth/absoluteHeight are not set (e.g., AI-generated vectors without editing),
  // calculate dimensions that preserve the image's aspect ratio while fitting within the container.
  // Only applies to SVG images to maintain backward compatibility with raster images.
  const { cgW, cgH, cgX, cgY } = useMemo(() => {
    let w = clipGroup?.absoluteWidth || 0
    let h = clipGroup?.absoluteHeight || 0
    let x = clipGroup?.absoluteX ?? 0
    let y = clipGroup?.absoluteY ?? 0

    // Only apply aspect ratio preservation for SVG images
    const isSvg = isSvgImage(src)
    if (!w || !h) {
      if (isSvg) {
        // Use image's natural dimensions for aspect ratio calculation
        const naturalWidth = img.naturalWidth > 0 ? img.naturalWidth : width
        const naturalHeight = img.naturalHeight > 0 ? img.naturalHeight : height
        const imgAspect = naturalWidth / naturalHeight
        const containerAspect = width / height

        if (imgAspect > containerAspect) {
          // Image is wider than container - fit to width
          w = width
          h = width / imgAspect
        } else {
          // Image is taller than container - fit to height
          h = height
          w = height * imgAspect
        }

        // Center the image if position was not explicitly set
        const hasExplicitPosition = clipGroup?.absoluteX !== undefined || clipGroup?.absoluteY !== undefined
        if (!hasExplicitPosition) {
          x = (width - w) / 2
          y = (height - h) / 2
        }
      } else {
        // For raster images, use container dimensions (backward compatible behavior)
        w = width
        h = height
      }
    }

    return { cgW: w, cgH: h, cgX: x, cgY: y }
  }, [clipGroup, width, height, img.naturalWidth, img.naturalHeight, src])

  const cgRotation = clipGroup?.rotation ?? 0

  // Mutable ref for the container group (used for caching operations)
  const containerGroupRef = useRef<Konva.Group | null>(null)

  // Store values in refs so getClientRect override can read current values at call time
  const editInnerImageRef = useRef(editInnerImage)
  editInnerImageRef.current = editInnerImage
  const dimensionsRef = useRef({ width, height })
  dimensionsRef.current = { width, height }

  // Ref callback to set up getClientRect override once when Group mounts (no useEffect needed)
  const setupContainerGroup = useCallback((node: Konva.Group | null) => {
    containerGroupRef.current = node
    if (!node) return

    // Only set up override once per node
    if ((node as any).__getClientRectOverridden) return
    ;(node as any).__getClientRectOverridden = true

    const originalGetClientRect = node.getClientRect.bind(node)

    // Override to return container bounds only (not including inner image extending outside)
    node.getClientRect = (config?: any) => {
      // In edit inner mode, use original behavior (transformer binds to inner image)
      if (editInnerImageRef.current) {
        return originalGetClientRect(config)
      }

      const { width: w, height: h } = dimensionsRef.current

      if (config?.skipTransform) {
        return { x: 0, y: 0, width: w, height: h }
      }

      // Return container's transformed rect
      const transform = node.getAbsoluteTransform()
      const topLeft = transform.point({ x: 0, y: 0 })
      const topRight = transform.point({ x: w, y: 0 })
      const bottomLeft = transform.point({ x: 0, y: h })
      const bottomRight = transform.point({ x: w, y: h })

      const minX = Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x)
      const maxX = Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x)
      const minY = Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y)
      const maxY = Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y)

      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    }
  }, [])

  // Immediate and debounced cache operations for optimal performance
  const applyCacheOperationImmediate = useCallback(() => {
    if (!containerGroupRef.current) return

    // Check if currently transforming to avoid cache operations during transforms
    const currentlyTransforming = isTransforming ? isTransforming() : false

    if (editInnerImage || currentlyTransforming) {
      // Clear cache immediately when editing or transforming for responsive interaction
      containerGroupRef.current.clearCache()
    } else if (mask && getProcessedMask) {
      // Cache when not editing/transforming to optimize mask rendering
      containerGroupRef.current.cache()
    }
  }, [editInnerImage, mask, getProcessedMask, isTransforming])

  const applyCacheOperationDebounced = useCallback(() => {
    if (!containerGroupRef.current) return

    // Check if currently transforming to avoid cache operations during transforms
    const currentlyTransforming = isTransforming ? isTransforming() : false

    // Only apply caching with debounce for non-critical updates when not transforming
    if (!editInnerImage && !currentlyTransforming && mask && getProcessedMask) {
      containerGroupRef.current.cache()
    }
  }, [editInnerImage, mask, getProcessedMask, isTransforming])

  // Use RAF debouncing for non-critical cache operations (reduced to 16ms for smoother updates)
  const debouncedCacheOperation = useRAFDebounce(applyCacheOperationDebounced, 16)

  // Immediate cache operations for transform-related changes (cgW, cgH, cgX, cgY, cgRotation)
  useEffect(() => {
    applyCacheOperationImmediate()
  }, [applyCacheOperationImmediate, cgW, cgH, cgX, cgY, cgRotation])

  // Debounced cache operations for mask-related changes
  useEffect(() => {
    debouncedCacheOperation()
  }, [debouncedCacheOperation, mask?.src, mask?.globalCompositeOperation])

  // Ensure we clear any stale cached pixels when mask is removed or becomes invalid
  useEffect(() => {
    if (!mask || !getProcessedMask) {
      if (containerGroupRef.current) {
        containerGroupRef.current.clearCache()
        containerGroupRef.current.getLayer()?.batchDraw()
      }
    }
  }, [mask, getProcessedMask])

  /**
   * Mark group for cache restoration during export when mask is applied.
   * This ensures the mask composite operation is properly cached when the stage is cloned
   * for download/export operations. Without this, the globalCompositeOperation won't work
   * correctly and black areas of the mask will be visible instead of transparent.
   *
   * IMPORTANT: We preserve the original name (e.g., "layer") by appending the cache name.
   * Konva names are space-separated like CSS classes, so "layer mask-composite-cache-group"
   * allows both selection (via .layer) and cache restoration (via .mask-composite-cache-group).
   */
  useEffect(() => {
    if (containerGroupRef.current && mask && getProcessedMask) {
      // Preserve original name and add cache group name (space-separated like CSS classes)
      const baseName = name || ''
      const cacheGroupName = MASK_COMPOSITE_CACHE_GROUP_NAME
      const combinedName = baseName ? `${baseName} ${cacheGroupName}` : cacheGroupName
      containerGroupRef.current.name(combinedName)

      // Store cache dimensions as data attributes for cache restoration during export
      const groupAttrs = containerGroupRef.current.attrs as CachedGroupAttrs
      groupAttrs['data-cache-width'] = width
      groupAttrs['data-cache-height'] = height
    } else if (containerGroupRef.current && !mask) {
      // Restore original name when mask is removed (instead of clearing completely)
      containerGroupRef.current.name(name || '')
    }
  }, [mask, getProcessedMask, width, height, name])

  // Clear cache when img changes to ensure the new image is rendered
  useEffect(() => {
    if (containerGroupRef.current) {
      containerGroupRef.current.clearCache()
      // Re-apply cache after clearing if we have mask
      if (mask && getProcessedMask && !editInnerImage) {
        containerGroupRef.current.cache()
      }
      containerGroupRef.current.getLayer()?.batchDraw()
    }
  }, [img, mask, getProcessedMask, editInnerImage])

  // Extract layer props (name already extracted at function parameter level)
  const { id, onDblClick, x: groupX, y: groupY, ...restProps } = layerProps

  // Group props based on edit mode
  const groupProps = useMemo(
    () =>
      editInnerImage
        ? { id: `${id}-container`, name: undefined, draggable: false }
        : { id, name, onDblClick, ...restProps },
    [editInnerImage, id, name, onDblClick, restProps]
  )

  // Enhanced transform handlers that immediately clear cache for smooth UX
  const enhancedHandleInnerDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      // Immediately clear cache before calling original handler
      if (containerGroupRef.current) {
        containerGroupRef.current.clearCache()
      }
      handleInnerDragEnd(e)
      // Trigger immediate cache update after transform
      applyCacheOperationImmediate()
    },
    [handleInnerDragEnd, applyCacheOperationImmediate]
  )

  const enhancedHandleInnerTransformEnd = useCallback(() => {
    // Immediately clear cache before calling original handler
    if (containerGroupRef.current) {
      containerGroupRef.current.clearCache()
    }
    handleInnerTransformEnd()
    // Trigger immediate cache update after transform
    applyCacheOperationImmediate()
  }, [handleInnerTransformEnd, applyCacheOperationImmediate])

  // Add local transform start handler to immediately clear cache
  const handleLocalTransformStart = useCallback(() => {
    if (containerGroupRef.current) {
      containerGroupRef.current.clearCache()
    }
  }, [])

  // Inner image props for edit mode - enhanced with immediate cache management
  const innerImageProps = useMemo(
    () =>
      editInnerImage
        ? {
            id,
            name,
            onDblClick,
            onDragStart: handleInnerDragStart || handleLocalTransformStart,
            onDragEnd: enhancedHandleInnerDragEnd,
            onTransformStart: handleInnerTransformStart || handleLocalTransformStart,
            onTransformEnd: enhancedHandleInnerTransformEnd,
          }
        : {},
    [
      editInnerImage,
      id,
      name,
      onDblClick,
      handleInnerDragStart,
      handleInnerTransformStart,
      handleLocalTransformStart,
      enhancedHandleInnerDragEnd,
      enhancedHandleInnerTransformEnd,
    ]
  )

  return (
    <Group
      ref={setupContainerGroup}
      rotation={rotation}
      visible={visible}
      width={width}
      height={height}
      x={groupX}
      y={groupY}
      {...groupProps}
      clipFunc={ctx => {
        ctx.beginPath()
        ctx.rect(0, 0, width, height)
        ctx.closePath()
      }}
    >
      <KonvaImageComponent
        ref={editInnerImage ? imageRef || innerImageNodeRef : imageRef || imageNode}
        x={cgX}
        y={cgY}
        rotation={cgRotation}
        visible={visible}
        width={cgW}
        height={cgH}
        image={img}
        draggable={Boolean(editInnerImage)}
        {...innerImageProps}
      />

      {/* Apply mask overlay at container level - cached group isolates composite operation */}
      {mask && getProcessedMask && (
        <KonvaImageComponent
          x={0}
          y={0}
          width={width}
          height={height}
          image={getProcessedMask as CanvasImageSource}
          listening={false}
          globalCompositeOperation={mask.globalCompositeOperation ?? 'destination-in'}
        />
      )}
    </Group>
  )
}
