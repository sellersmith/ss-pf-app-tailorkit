import { memo, useMemo, forwardRef } from 'react'
import { LockIcon } from '@shopify/polaris-icons'
import { Icon } from '@shopify/polaris'
import type { RasterImageInfo, ImageColorAdjustments, ParsedPath, AdjustmentMask } from '../../types'
import type { Point } from '../../utils/svg'
import { serializePathCommands } from '../../utils/svg'
import { getFilterPresetById, buildCssPreview } from '../../utils/filters'
import styles from './styles.module.css'

interface RasterBackgroundLayerProps {
  /** Loaded image info */
  imageInfo: RasterImageInfo | null
  /** Current viewport scale */
  scale: number
  /** Current viewport offset */
  offset: Point
  /** Color adjustments to apply to the image */
  colorAdjustments?: ImageColorAdjustments
  /** Whether to show the locked indicator (default: true) */
  showLockedIndicator?: boolean
  /** All parsed paths from the SVG */
  paths?: ParsedPath[]
  /** Indices of paths to use as clip paths */
  clipPathIndices?: number[]
  /** Indices of paths to use as hole paths (cutouts) */
  holePathIndices?: number[]
  /** Adjustment masks with their specific color adjustments */
  adjustmentMasks?: AdjustmentMask[]
  /**
   * Logical workspace dimensions (e.g. full template pixel size).
   * When provided, the image is stretched to fill these dimensions in SVG-coordinate space
   * regardless of its natural pixel dimensions. This corrects misalignment when the guide
   * image was captured at a downscaled resolution for performance.
   */
  workspaceDimensions?: { width: number; height: number }
}

/**
 * Builds a CSS filter string from ImageColorAdjustments.
 * For filter presets, uses buildCssPreview for dynamic CSS filter generation.
 * For individual adjustments, builds the filter from adjustment values.
 */
function buildCssFilter(adj?: ImageColorAdjustments): string {
  if (!adj) return 'none'

  // If a filter preset is active, use buildCssPreview for CSS approximation
  if (adj.filterPresetId) {
    const preset = getFilterPresetById(adj.filterPresetId)
    if (preset) {
      return buildCssPreview(preset, adj.filterPresetParams)
    }
  }

  const filters: string[] = []

  // Brightness: CSS brightness(1) is 100%, we map -100 to 100 range to 0 to 2
  if (adj.brightness !== undefined && adj.brightness !== 0) {
    filters.push(`brightness(${(100 + adj.brightness) / 100})`)
  }

  // Contrast: CSS contrast(1) is 100%, we map -100 to 100 range to 0 to 2
  if (adj.contrast !== undefined && adj.contrast !== 0) {
    filters.push(`contrast(${(100 + adj.contrast) / 100})`)
  }

  // Saturation: CSS saturate(1) is 100%, we map -100 to 100 range to 0 to 2
  if (adj.saturation !== undefined && adj.saturation !== 0) {
    filters.push(`saturate(${(100 + adj.saturation) / 100})`)
  }

  // Hue rotation: direct degrees
  if (adj.hueRotate !== undefined && adj.hueRotate !== 0) {
    filters.push(`hue-rotate(${adj.hueRotate}deg)`)
  }

  // Invert: 0-1 value
  if (adj.invert !== undefined && adj.invert > 0) {
    filters.push(`invert(${adj.invert})`)
  }

  // Sepia: 0-1 value
  if (adj.sepia !== undefined && adj.sepia > 0) {
    filters.push(`sepia(${adj.sepia})`)
  }

  // Grayscale: 0-1 value
  if (adj.grayscale !== undefined && adj.grayscale > 0) {
    filters.push(`grayscale(${adj.grayscale})`)
  }

  return filters.length > 0 ? filters.join(' ') : 'none'
}

/**
 * Build a combined clip path from paths.
 * Uses evenodd fill rule to create holes from hole paths.
 */
function buildClipPathData(
  paths: ParsedPath[],
  clipPathIndices: number[],
  holePathIndices: number[],
  imageWidth: number,
  imageHeight: number
): string | null {
  const hasClips = clipPathIndices.length > 0
  const hasHoles = holePathIndices.length > 0

  if (!hasClips && !hasHoles) return null

  const pathStrings: string[] = []

  if (hasClips) {
    // Use clip paths as the visible area
    for (const idx of clipPathIndices) {
      const path = paths[idx]
      if (path) {
        pathStrings.push(serializePathCommands(path.commands))
      }
    }
  } else if (hasHoles) {
    // No clip paths, use full image bounds as the base
    pathStrings.push(`M 0 0 L ${imageWidth} 0 L ${imageWidth} ${imageHeight} L 0 ${imageHeight} Z`)
  }

  // Add hole paths (will be subtracted via evenodd)
  if (hasHoles) {
    for (const idx of holePathIndices) {
      const path = paths[idx]
      if (path) {
        pathStrings.push(serializePathCommands(path.commands))
      }
    }
  }

  return pathStrings.join(' ')
}

/**
 * RasterBackgroundLayer renders a raster image as a locked background
 * in overlay mode. The image is positioned and scaled to match the viewport
 * and can have color adjustments applied via CSS filters.
 * Supports clip paths (show only inside), hole paths (cut out areas),
 * and adjustment masks (apply adjustments to specific regions).
 *
 * The ref is forwarded to the positioned container div so that EditorCanvas
 * can apply the same real-time gesture CSS transform used for SVGPreviewLayer,
 * keeping the raster image in sync during mobile pan/pinch gestures without
 * waiting for a React state update from commitViewport().
 */
export default memo(
  forwardRef<HTMLDivElement, RasterBackgroundLayerProps>(function RasterBackgroundLayer(
    {
      imageInfo,
      scale,
      offset,
      colorAdjustments,
      showLockedIndicator = true,
      paths = [],
      clipPathIndices = [],
      holePathIndices = [],
      adjustmentMasks = [],
      workspaceDimensions,
    },
    ref
  ) {
    // Build CSS filter from adjustments (includes filter preset support via buildCssPreview)
    const cssFilter = useMemo(() => buildCssFilter(colorAdjustments), [colorAdjustments])

    // Build clip path data from paths
    const clipPathData = useMemo(() => {
      if (!imageInfo) return null
      return buildClipPathData(paths, clipPathIndices, holePathIndices, imageInfo.naturalWidth, imageInfo.naturalHeight)
    }, [paths, clipPathIndices, holePathIndices, imageInfo])

    // Generate unique IDs for SVG elements
    // Include clip/hole state in the ID to force browser to use fresh definitions
    const clipKey = `${clipPathIndices.join(',')}-${holePathIndices.join(',')}-${adjustmentMasks.length}`
    const baseId = useMemo(() => `raster-${clipKey}`, [clipKey])

    // Check if we need SVG rendering (only for clip paths, holes, or adjustment masks)
    // Filter presets now use CSS filters, so they don't require SVG rendering
    const needsSvgRendering = clipPathData || adjustmentMasks.length > 0

    // Don't render if no image info
    if (!imageInfo) return null

    // Use workspace dimensions (template pixel size) when provided so the guide image fills the
    // full drawing area even if it was captured at a downscaled resolution for performance.
    const displayWidth = workspaceDimensions?.width ?? imageInfo.naturalWidth
    const displayHeight = workspaceDimensions?.height ?? imageInfo.naturalHeight

    // Calculate image dimensions at current scale
    const scaledWidth = displayWidth * scale
    const scaledHeight = displayHeight * scale

    // Positioned wrapper at (offset.x, offset.y) matching SVGPreviewLayer's pattern.
    // EditorCanvas forwards this ref and applies the same gesture CSS transform to it
    // during mobile pan/pinch so the raster image tracks the canvas in real time.
    // NOTE: no z-index here to avoid creating a stacking context (preserves mix-blend-mode).
    const wrapperStyle: React.CSSProperties = {
      position: 'absolute',
      left: offset.x,
      top: offset.y,
      width: scaledWidth,
      height: scaledHeight,
      pointerEvents: 'none',
    }

    // If we need SVG rendering (clip paths, holes, or adjustment masks)
    if (needsSvgRendering) {
      return (
        <div ref={ref} style={wrapperStyle}>
          <svg
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: scaledWidth,
              height: scaledHeight,
              overflow: 'visible',
            }}
            viewBox={`0 0 ${imageInfo.naturalWidth} ${imageInfo.naturalHeight}`}
            preserveAspectRatio="none"
          >
            <defs>
              {/* Main clip path for clip/hole functionality */}
              {clipPathData && (
                <clipPath id={`${baseId}-clip`}>
                  <path d={clipPathData} fillRule="evenodd" clipRule="evenodd" />
                </clipPath>
              )}
              {/* SVG masks for each adjustment mask - uses white (show) and black (hide) for proper hole subtraction */}
              {adjustmentMasks.map((mask, idx) => {
                const path = paths[mask.pathIndex]
                if (!path) return null

                const maskPathD = serializePathCommands(path.commands)

                return (
                  <mask key={`mask-def-${idx}`} id={`${baseId}-mask-${idx}`}>
                    {/* White fill shows the mask area */}
                    <path d={maskPathD} fill="white" />
                    {/* Black fill hides the hole areas (proper subtraction) */}
                    {holePathIndices.map(holeIdx => {
                      const holePath = paths[holeIdx]
                      if (!holePath) return null
                      return <path key={`hole-${holeIdx}`} d={serializePathCommands(holePath.commands)} fill="black" />
                    })}
                  </mask>
                )
              })}
            </defs>

            {/* Base image with global adjustments (and optional clip path) */}
            {/* All filters (including presets) use CSS filters for simplicity and reactivity */}
            <image
              href={imageInfo.url}
              x="0"
              y="0"
              width={imageInfo.naturalWidth}
              height={imageInfo.naturalHeight}
              clipPath={clipPathData ? `url(#${baseId}-clip)` : undefined}
              style={{ filter: cssFilter }}
              preserveAspectRatio="none"
            />

            {/* Adjustment mask overlays - each renders the image with specific adjustments masked to the shape minus holes */}
            {adjustmentMasks.map((mask, idx) => {
              const path = paths[mask.pathIndex]
              if (!path) return null
              const maskFilter = buildCssFilter(mask.adjustments)
              return (
                <image
                  key={`mask-${idx}`}
                  href={imageInfo.url}
                  x="0"
                  y="0"
                  width={imageInfo.naturalWidth}
                  height={imageInfo.naturalHeight}
                  mask={`url(#${baseId}-mask-${idx})`}
                  style={{ filter: maskFilter }}
                  preserveAspectRatio="none"
                />
              )
            })}
          </svg>
          {showLockedIndicator && (
            <div className={styles.lockedIndicator}>
              <Icon source={LockIcon} tone="base" />
              <span>Locked</span>
            </div>
          )}
        </div>
      )
    }

    // Default: render as simple image (no clipping or masks)
    return (
      <div ref={ref} style={wrapperStyle}>
        <img
          src={imageInfo.url}
          alt="Background"
          className={styles.rasterImage}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: scaledWidth,
            height: scaledHeight,
            filter: cssFilter,
            // Ensure crisp rendering at various scales
            imageRendering: scale < 1 ? 'auto' : 'crisp-edges',
          }}
          draggable={false}
        />
        {showLockedIndicator && (
          <div className={styles.lockedIndicator}>
            <Icon source={LockIcon} tone="base" />
            <span>Locked</span>
          </div>
        )}
      </div>
    )
  })
)
