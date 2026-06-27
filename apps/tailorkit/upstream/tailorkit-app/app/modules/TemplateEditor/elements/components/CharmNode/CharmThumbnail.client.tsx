import { Fragment, memo, useCallback, useEffect, useRef, useState } from 'react'
import type Konva from 'konva'
import { Image as KonvaImage } from 'react-konva'
import type { CharmTransformInstance } from '~/types/psd'
import { CHARM_THUMB_SIZE, CHARM_HIT_AREA_PADDING, stopBubble, computeEditorCharmNodeY } from './charm-node-utils'
import { getCharmKonvaPivot } from 'extensions/tailorkit-src/src/assets/features/charm-builder/charm-anchor-utils'
import { LAYER_STROKE_COLOR, LAYER_STROKE_WIDTH } from '~/constants/canvas'
import { getCachedImage, removeCacheListener } from './charm-image-cache'
import { KonvaRemoveBackgroundLoading } from '~/components/canvas/elements/LoadingAnimation/KonvaRemoveBackgroundLoading.client'

/**
 * Hook to get a cached image, triggering re-render when loaded.
 * Uses the shared charm-image-cache for deduplication.
 */
function useCachedImage(url: string | undefined): HTMLImageElement | null {
  const [, forceUpdate] = useState(0)

  const triggerUpdate = useCallback(() => {
    forceUpdate(n => n + 1)
  }, [])

  useEffect(() => {
    if (!url) return

    // Get image (may trigger load)
    getCachedImage(url, triggerUpdate)

    return () => {
      removeCacheListener(url, triggerUpdate)
    }
  }, [url, triggerUpdate])

  // Return cached image or null — shimmer shows while loading, never shows stale image
  return url ? getCachedImage(url) : null
}

export interface CharmThumbnailProps {
  /** Unique instance ID — used as Konva node id for sibling lookup during scale sync */
  instanceId: string
  thumbnailUrl: string
  transform: CharmTransformInstance
  isLoading?: boolean
  /** Product title for accessibility (P1-7) */
  title?: string
  /** Whether this charm is currently selected (P1-7 accessibility) */
  isSelected?: boolean
  /**
   * Anchor position from the charm-node settings (FIXED-mode slot anchor convention).
   * Controls the rotation pivot so the charm swings around its slot attachment point
   * instead of its own bbox center, mirroring storefront behavior. Undefined falls
   * back to bbox-center pivot for backward compatibility (e.g. FREE-mode usage).
   */
  anchorPosition?: 'top' | 'center' | 'bottom'
  /** P1-10: Callback receives native event for shift-key detection */
  onSelect: (node: Konva.Image, nativeEvent?: MouseEvent) => void
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void
}

/**
 * Render a single charm product thumbnail as a draggable Konva Image.
 * Width/height are CONSTANT – visual size is controlled by scaleX/scaleY props.
 *
 * Performance optimizations:
 * - Uses shared image cache to avoid duplicate loads for same thumbnail URL
 * - Wrapped with React.memo to prevent re-renders when props haven't changed
 * - Loading state passed as prop (batch lookup in parent) instead of internal subscription
 */
function CharmThumbnailComponent({
  instanceId,
  thumbnailUrl,
  transform,
  isLoading = false,
  title = 'Charm',
  isSelected = false,
  anchorPosition,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
}: CharmThumbnailProps) {
  const image = useCachedImage(thumbnailUrl)
  const imageRef = useRef<Konva.Image>(null)
  const [isHovered, setIsHovered] = useState(false)

  const showStroke = isSelected || isHovered

  // Cursor management: show pointer on hover (matches text/image layer behavior)
  const handleMouseEnter = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    setIsHovered(true)
    const stage = e.target.getStage()
    if (stage) stage.container().style.cursor = 'pointer'
  }, [])

  const handleMouseLeave = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    setIsHovered(false)
    const stage = e.target.getStage()
    if (stage) stage.container().style.cursor = ''
  }, [])

  // P1-10: Pass native event for shift-key multi-select detection
  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true
      if (imageRef.current) onSelect(imageRef.current, e.evt)
    },
    [onSelect]
  )

  const handleTap = useCallback(
    (e: Konva.KonvaEventObject<Event>) => {
      e.cancelBubble = true
      // Touch events don't have shiftKey, pass undefined
      if (imageRef.current) onSelect(imageRef.current, undefined)
    },
    [onSelect]
  )

  // P1-5: Expanded hit area for touch targets (44px minimum per iOS/Android guidelines)
  const hitFunc = useCallback((context: Konva.Context, shape: Konva.Shape) => {
    const padding = CHARM_HIT_AREA_PADDING
    const size = CHARM_THUMB_SIZE + padding * 2
    context.beginPath()
    context.rect(-padding, -padding, size, size)
    context.closePath()
    context.fillStrokeShape(shape)
  }, [])

  const scaledSize = CHARM_THUMB_SIZE * transform.scale
  const isImageLoading = !image

  // Anchor the rotation pivot at the slot attachment point (top / center / bottom of
  // the bbox) so the charm swings around its slot like a pendant on a chain. Pivot
  // config comes from the same helper storefront + print use, so all 3 stay in sync.
  const pivot = getCharmKonvaPivot(anchorPosition, CHARM_THUMB_SIZE)
  const nodeY = computeEditorCharmNodeY(transform.y, pivot.offsetY, transform.scale, CHARM_THUMB_SIZE)

  return (
    <Fragment>
      {image && (
        <KonvaImage
          ref={imageRef}
          id={`charm-${instanceId}`}
          image={image}
          x={transform.x}
          y={nodeY}
          width={CHARM_THUMB_SIZE}
          height={CHARM_THUMB_SIZE}
          offsetX={pivot.offsetX}
          offsetY={pivot.offsetY}
          scaleX={transform.scale}
          scaleY={transform.scale}
          rotation={transform.rotation}
          draggable
          // Stroke: hover = blue outline, selected = blue outline (same as regular layers)
          stroke={showStroke ? LAYER_STROKE_COLOR : undefined}
          strokeWidth={showStroke ? LAYER_STROKE_WIDTH / transform.scale : 0}
          // P1-7: Accessibility - name for screen readers
          name={`charm-${title}${isSelected ? '-selected' : ''}`}
          // P1-5: Expanded touch target
          hitFunc={hitFunc}
          onMouseDown={stopBubble}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          onTap={handleTap}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        />
      )}
      {(isLoading || isImageLoading) && (
        <KonvaRemoveBackgroundLoading
          x={transform.x - scaledSize / 2}
          y={transform.y - scaledSize / 2}
          width={scaledSize}
          height={scaledSize}
          rotation={transform.rotation}
          isVisible
        />
      )}
    </Fragment>
  )
}

/**
 * Memoized CharmThumbnail - only re-renders when props actually change.
 * Custom comparison handles transform object shallow comparison.
 */
export const CharmThumbnail = memo(CharmThumbnailComponent, (prevProps, nextProps) => {
  // Quick reference equality check first
  if (prevProps === nextProps) return true

  // Compare primitive props
  if (prevProps.instanceId !== nextProps.instanceId) return false
  if (prevProps.thumbnailUrl !== nextProps.thumbnailUrl) return false
  if (prevProps.isLoading !== nextProps.isLoading) return false
  if (prevProps.title !== nextProps.title) return false
  if (prevProps.isSelected !== nextProps.isSelected) return false
  if (prevProps.anchorPosition !== nextProps.anchorPosition) return false

  // Compare transform values (shallow comparison of object properties)
  const prevT = prevProps.transform
  const nextT = nextProps.transform
  if (
    prevT.x !== nextT.x
    || prevT.y !== nextT.y
    || prevT.scale !== nextT.scale
    || prevT.rotation !== nextT.rotation
    || prevT.instanceId !== nextT.instanceId
  ) {
    return false
  }

  // Compare callback references (stable if parent uses useCallback)
  if (prevProps.onSelect !== nextProps.onSelect) return false
  if (prevProps.onDragStart !== nextProps.onDragStart) return false
  if (prevProps.onDragMove !== nextProps.onDragMove) return false
  if (prevProps.onDragEnd !== nextProps.onDragEnd) return false

  return true
})

CharmThumbnail.displayName = 'CharmThumbnail'
