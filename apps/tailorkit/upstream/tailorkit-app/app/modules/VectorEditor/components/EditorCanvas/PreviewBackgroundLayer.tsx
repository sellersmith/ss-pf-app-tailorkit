import { useMemo, useState, useCallback, forwardRef } from 'react'
import type { PreviewImageConfig } from '../../types'
import type { Point } from '../../utils/svg'
import { COLORS } from '../../constants'
import styles from './styles.module.css'

interface PreviewBackgroundLayerProps {
  /** Preview image configuration from TemplateEditor */
  config: PreviewImageConfig
  /** Current viewport scale */
  scale: number
  /** Current viewport offset */
  offset: Point
  /** SVG workspace dimensions (template canvas dimensions) */
  workspaceDimensions: { width: number; height: number }
}

/**
 * PreviewBackgroundLayer renders the preview product image from TemplateEditor
 * as a non-editable environmental background in VectorEditor.
 *
 * The preview image is positioned such that the SVG workspace (template canvas)
 * appears at the correct position relative to the preview image, matching
 * how it appears in TemplateEditor.
 *
 * Coordinate system:
 * - In TemplateEditor: preview.left/top positions the preview relative to template canvas origin
 * - In VectorEditor: SVG workspace origin is at (0, 0), preview is rendered at (left, top)
 *
 * The preview image is:
 * - Non-interactive (no selection, dragging, or transformation)
 * - Rendered below the SVG content layer
 * - Supports rotation via CSS transform
 *
 * The ref is forwarded to the positioned workspace-sized container so EditorCanvas
 * can apply the same real-time gesture CSS transform used for SVGPreviewLayer,
 * keeping the preview in sync during mobile pan/pinch without waiting for commitViewport().
 */
const PreviewBackgroundLayer = forwardRef<HTMLDivElement, PreviewBackgroundLayerProps>(function PreviewBackgroundLayer(
  { config, scale, offset, workspaceDimensions },
  ref
) {
  const [imageError, setImageError] = useState(false)

  const handleImageLoad = useCallback(() => {
    setImageError(false)
  }, [])

  const handleImageError = useCallback(() => {
    setImageError(true)
  }, [])

  // Container covers the SVG workspace in screen space, positioned at (offset.x, offset.y).
  // Matching SVGPreviewLayer's pattern so EditorCanvas can apply the same gesture transform.
  // NOTE: no z-index here to avoid creating a stacking context.
  const containerStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      left: offset.x,
      top: offset.y,
      width: workspaceDimensions.width * scale,
      height: workspaceDimensions.height * scale,
      pointerEvents: 'none' as const,
      overflow: 'visible' as const,
    }),
    [offset.x, offset.y, workspaceDimensions.width, workspaceDimensions.height, scale]
  )

  // Image position is relative to the workspace container (SVG coords → screen coords
  // with the offset already accounted for by the container's own position).
  const imageStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      left: config.left * scale,
      top: config.top * scale,
      width: config.width * scale,
      height: config.height * scale,
      // Use top-left rotation pivot (0, 0) to match Konva's default behavior in TemplateEditor.
      transformOrigin: '0 0',
      transform: config.rotation ? `rotate(${config.rotation}deg)` : undefined,
      imageRendering: scale < 1 ? ('auto' as const) : ('crisp-edges' as const),
    }),
    [config, scale]
  )

  // Workspace boundary indicator fills the container (same bounds as workspace)
  const workspaceBorderStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      left: 0,
      top: 0,
      width: '100%',
      height: '100%',
      border: `2px dashed ${COLORS.viewBoxBoundary}`,
      borderRadius: 2,
      pointerEvents: 'none' as const,
      zIndex: 1,
    }),
    []
  )

  // Don't render if image failed to load
  if (imageError) return null

  return (
    <div ref={ref} style={containerStyle}>
      {/* Preview product image */}
      <img
        src={config.src}
        alt="Preview background"
        className={styles.previewImage}
        style={imageStyle}
        onLoad={handleImageLoad}
        onError={handleImageError}
        draggable={false}
      />

      {/* Workspace boundary indicator (dashed border showing template canvas) */}
      <div style={workspaceBorderStyle} />
    </div>
  )
})

export default PreviewBackgroundLayer
