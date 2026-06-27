/**
 * Overlay Serialization Utilities
 * Generate SVG output for raster image overlay mode
 */

import type { ParsedPathExtended, SvgDefs } from '../types/parsed'
import type { OverlaySvgOutput, OverlayState, ImageColorAdjustments, RasterImageInfo } from '../../../types'
import { serializePathCommands, formatCoord } from '../pathParsing'
import { serializeDefs, serializeFilterPrimitive } from './index'
import { getFilterPresetById, buildFilterPrimitives, buildCssPreview } from '../../filters'

/**
 * Create SVG opening tag with standard namespace and dimensions
 */
function createSvgOpenTag(width: number, height: number): string {
  const w = formatCoord(width)
  const h = formatCoord(height)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`
}

/**
 * Build feColorMatrix values from ImageColorAdjustments
 * Returns a 4x5 matrix as a string for use in SVG filter
 *
 * IMPORTANT: This must match CSS filter behavior exactly!
 * CSS brightness(X) multiplies RGB by X
 * CSS contrast(X) applies: output = (input - 0.5) * X + 0.5
 * CSS saturate(X) uses standard luminance-based saturation matrix
 */
function buildColorMatrix(adj: ImageColorAdjustments): string {
  // feColorMatrix operates on 0-1 range (not 0-255)
  // Start with identity matrix: [R, G, B, A, offset] for each row
  let matrix = [
    1,
    0,
    0,
    0,
    0, // Red row
    0,
    1,
    0,
    0,
    0, // Green row
    0,
    0,
    1,
    0,
    0, // Blue row
    0,
    0,
    0,
    1,
    0, // Alpha row
  ]

  // Helper to multiply current matrix by a new matrix
  const multiplyMatrix = (m: number[]) => {
    const result = new Array(20).fill(0)
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 5; col++) {
        let sum = 0
        for (let k = 0; k < 4; k++) {
          sum += m[row * 5 + k] * matrix[k * 5 + col]
        }
        if (col === 4) {
          sum += m[row * 5 + 4]
        }
        result[row * 5 + col] = sum
      }
    }
    matrix = result
  }

  // Apply brightness: CSS brightness(X) multiplies RGB by X
  // X = (100 + value) / 100, so value=0 -> X=1 (no change), value=50 -> X=1.5
  if (adj.brightness !== undefined && adj.brightness !== 0) {
    const scale = (100 + adj.brightness) / 100
    multiplyMatrix([scale, 0, 0, 0, 0, 0, scale, 0, 0, 0, 0, 0, scale, 0, 0, 0, 0, 0, 1, 0])
  }

  // Apply contrast: CSS contrast(X) applies output = (input - 0.5) * X + 0.5
  // Which is: output = input * X + 0.5 * (1 - X)
  if (adj.contrast !== undefined && adj.contrast !== 0) {
    const scale = (100 + adj.contrast) / 100
    const offset = 0.5 * (1 - scale)
    multiplyMatrix([scale, 0, 0, 0, offset, 0, scale, 0, 0, offset, 0, 0, scale, 0, offset, 0, 0, 0, 1, 0])
  }

  // Apply saturation: CSS saturate(X) uses luminance-based formula
  // Luminance coefficients: R=0.2126, G=0.7152, B=0.0722
  if (adj.saturation !== undefined && adj.saturation !== 0) {
    const s = (100 + adj.saturation) / 100
    const lumR = 0.2126
    const lumG = 0.7152
    const lumB = 0.0722
    multiplyMatrix([
      lumR * (1 - s) + s,
      lumG * (1 - s),
      lumB * (1 - s),
      0,
      0,
      lumR * (1 - s),
      lumG * (1 - s) + s,
      lumB * (1 - s),
      0,
      0,
      lumR * (1 - s),
      lumG * (1 - s),
      lumB * (1 - s) + s,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
    ])
  }

  // Apply hue rotation: CSS hue-rotate(Xdeg)
  if (adj.hueRotate !== undefined && adj.hueRotate !== 0) {
    const rad = (adj.hueRotate * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const lumR = 0.2126
    const lumG = 0.7152
    const lumB = 0.0722
    multiplyMatrix([
      lumR + cos * (1 - lumR) + sin * -lumR,
      lumG + cos * -lumG + sin * -lumG,
      lumB + cos * -lumB + sin * (1 - lumB),
      0,
      0,
      lumR + cos * -lumR + sin * 0.143,
      lumG + cos * (1 - lumG) + sin * 0.14,
      lumB + cos * -lumB + sin * -0.283,
      0,
      0,
      lumR + cos * -lumR + sin * -(1 - lumR),
      lumG + cos * -lumG + sin * lumG,
      lumB + cos * (1 - lumB) + sin * lumB,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
    ])
  }

  // Apply invert: CSS invert(X) where X is 0-1
  if (adj.invert !== undefined && adj.invert > 0) {
    const inv = adj.invert
    const scale = 1 - 2 * inv
    multiplyMatrix([scale, 0, 0, 0, inv, 0, scale, 0, 0, inv, 0, 0, scale, 0, inv, 0, 0, 0, 1, 0])
  }

  // Apply sepia: CSS sepia(X) where X is 0-1
  if (adj.sepia !== undefined && adj.sepia > 0) {
    const s = adj.sepia
    const inv = 1 - s
    multiplyMatrix([
      inv + s * 0.393,
      s * 0.769,
      s * 0.189,
      0,
      0,
      s * 0.349,
      inv + s * 0.686,
      s * 0.168,
      0,
      0,
      s * 0.272,
      s * 0.534,
      inv + s * 0.131,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
    ])
  }

  // Apply grayscale: CSS grayscale(X) where X is 0-1
  // This is equivalent to saturate(1 - X)
  if (adj.grayscale !== undefined && adj.grayscale > 0) {
    const s = 1 - adj.grayscale // grayscale(1) = saturate(0)
    const lumR = 0.2126
    const lumG = 0.7152
    const lumB = 0.0722
    multiplyMatrix([
      lumR * (1 - s) + s,
      lumG * (1 - s),
      lumB * (1 - s),
      0,
      0,
      lumR * (1 - s),
      lumG * (1 - s) + s,
      lumB * (1 - s),
      0,
      0,
      lumR * (1 - s),
      lumG * (1 - s),
      lumB * (1 - s) + s,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
    ])
  }

  // Format matrix values with proper precision
  return matrix.map(v => v.toFixed(4)).join(' ')
}

/**
 * Serialize path commands to SVG path element
 */
function serializePath(path: ParsedPathExtended, includeStyle = true): string {
  const d = serializePathCommands(path.commands)
  const attrs: string[] = [`d="${d}"`]

  if (includeStyle) {
    // Fill - preserve original fill value (compositor handles leather technique rendering)
    if (path.style?.fill) {
      if (path.style.fill.type === 'color') {
        attrs.push(`fill="${path.style.fill.color}"`)
        if (path.style.fill.opacity !== undefined && path.style.fill.opacity < 1) {
          attrs.push(`fill-opacity="${path.style.fill.opacity}"`)
        }
      } else if (path.style.fill.type === 'gradient') {
        attrs.push(`fill="url(#${path.style.fill.gradientId})"`)
      } else {
        attrs.push('fill="none"')
      }
    } else if ((path as unknown as { fill?: string }).fill && (path as unknown as { fill?: string }).fill !== 'none') {
      attrs.push(`fill="${(path as unknown as { fill?: string }).fill}"`)
    }

    // Fill rule
    if ((path as unknown as { fillRule?: string }).fillRule) {
      attrs.push(`fill-rule="${(path as unknown as { fillRule?: string }).fillRule}"`)
    }

    // Stroke
    if (path.style?.stroke) {
      if (path.style.stroke.type === 'color') {
        attrs.push(`stroke="${path.style.stroke.color}"`)
        if (path.style.stroke.opacity !== undefined && path.style.stroke.opacity < 1) {
          attrs.push(`stroke-opacity="${path.style.stroke.opacity}"`)
        }
      } else if (path.style.stroke.type === 'gradient') {
        attrs.push(`stroke="url(#${path.style.stroke.gradientId})"`)
      }
    } else if ((path as unknown as { stroke?: string }).stroke) {
      attrs.push(`stroke="${(path as unknown as { stroke?: string }).stroke}"`)
    }

    // Stroke width
    if ((path as unknown as { strokeWidth?: number }).strokeWidth !== undefined) {
      attrs.push(`stroke-width="${(path as unknown as { strokeWidth?: number }).strokeWidth}"`)
    }

    // Opacity
    if (path.style?.opacity !== undefined && path.style.opacity < 1) {
      attrs.push(`opacity="${path.style.opacity}"`)
    }

    // Filter
    if (path.style?.filterId) {
      attrs.push(`filter="url(#${path.style.filterId})"`)
    }

    // Mix blend mode (as style attribute for CSS compatibility)
    if (path.style?.mixBlendMode && path.style.mixBlendMode !== 'normal') {
      attrs.push(`style="mix-blend-mode: ${path.style.mixBlendMode}"`)
    }
  }

  return `<path ${attrs.join(' ')}/>`
}

/**
 * Generate SVG containing only clipPath definitions from drawn paths
 */
export function serializeClipPathOverlay(
  paths: ParsedPathExtended[],
  width: number,
  height: number,
  clipPathIndices: number[] = []
): string {
  if (paths.length === 0) {
    return `${createSvgOpenTag(width, height)}
  <defs>
    <clipPath id="overlay-clip">
    </clipPath>
  </defs>
</svg>`
  }

  // Use specified clip path indices or all paths
  const clipPaths = clipPathIndices.length > 0 ? clipPathIndices.map(i => paths[i]).filter(Boolean) : paths

  const pathElements = clipPaths
    .map(path => {
      const d = serializePathCommands(path.commands)
      return `      <path d="${d}"/>`
    })
    .join('\n')

  return `${createSvgOpenTag(width, height)}
  <defs>
    <clipPath id="overlay-clip">
${pathElements}
    </clipPath>
  </defs>
</svg>`
}

/**
 * Generate SVG containing only filter definitions for color adjustments or filter preset
 */
export function serializeFilterOverlay(
  adjustments: ImageColorAdjustments | undefined,
  width: number,
  height: number
): string {
  if (!adjustments) {
    return `${createSvgOpenTag(width, height)}
  <defs>
    <filter id="overlay-filter">
    </filter>
  </defs>
</svg>`
  }

  // If a filter preset is applied, include CSS filter for canvas rendering
  // The compositor will use the data-css-filter attribute for efficient rendering
  if (adjustments.filterPresetId) {
    const preset = getFilterPresetById(adjustments.filterPresetId)
    if (preset) {
      // Build CSS filter string for canvas rendering
      const cssFilter = buildCssPreview(preset, adjustments.filterPresetParams)
      // Also build SVG primitives as fallback for environments that don't support CSS filters
      const primitives = buildFilterPrimitives(preset, adjustments.filterPresetParams)
      const filterContent = primitives.map(serializeFilterPrimitive).join('\n      ')
      const filterAttrs = `id="overlay-filter" x="-10%" y="-10%" width="120%" height="120%"`
      const cssAttrs = `color-interpolation-filters="sRGB" data-css-filter="${cssFilter}"`
      return `${createSvgOpenTag(width, height)}
  <defs>
    <filter ${filterAttrs} ${cssAttrs}>
      ${filterContent}
    </filter>
  </defs>
</svg>`
    }
  }

  // Otherwise use feColorMatrix for individual adjustments
  const matrixValues = buildColorMatrix(adjustments)

  return `${createSvgOpenTag(width, height)}
  <defs>
    <filter id="overlay-filter" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="${matrixValues}"/>
    </filter>
  </defs>
</svg>`
}

/**
 * Generate combined overlay SVG with all paths and effects
 */
export function serializeCombinedOverlay(
  paths: ParsedPathExtended[],
  defs: SvgDefs,
  overlayState: OverlayState,
  width: number,
  height: number
): string {
  const defsContent: string[] = []

  // Add clip path if there are clip path indices
  if (overlayState.clipPathIndices.length > 0) {
    const clipPaths = overlayState.clipPathIndices
      .map(i => paths[i])
      .filter(Boolean)
      .map(path => {
        const d = serializePathCommands(path.commands)
        return `      <path d="${d}"/>`
      })
      .join('\n')
    defsContent.push(`    <clipPath id="overlay-clip">\n${clipPaths}\n    </clipPath>`)
  }

  // Add hole paths as a mask if there are hole path indices
  if (overlayState.holePathIndices.length > 0) {
    const holePaths = overlayState.holePathIndices
      .map(i => paths[i])
      .filter(Boolean)
      .map(path => {
        const d = serializePathCommands(path.commands)
        return `      <path d="${d}" fill="black"/>`
      })
      .join('\n')
    defsContent.push(`    <mask id="overlay-mask">
      <rect x="0" y="0" width="${formatCoord(width)}" height="${formatCoord(height)}" fill="white"/>
${holePaths}
    </mask>`)
  }

  // Add color filter if there are adjustments or a filter preset
  if (overlayState.imageColorAdjustments) {
    // If a filter preset is applied, include CSS filter for canvas rendering
    if (overlayState.imageColorAdjustments.filterPresetId) {
      const preset = getFilterPresetById(overlayState.imageColorAdjustments.filterPresetId)
      if (preset) {
        // Build CSS filter string for canvas rendering
        const cssFilter = buildCssPreview(preset, overlayState.imageColorAdjustments.filterPresetParams)
        // Also build SVG primitives as fallback
        const primitives = buildFilterPrimitives(preset, overlayState.imageColorAdjustments.filterPresetParams)
        const filterContent = primitives.map(serializeFilterPrimitive).join('\n      ')
        const filterAttrs = `id="overlay-filter" x="-10%" y="-10%" width="120%" height="120%"`
        const cssAttrs = `color-interpolation-filters="sRGB" data-css-filter="${cssFilter}"`
        defsContent.push(`    <filter ${filterAttrs} ${cssAttrs}>
      ${filterContent}
    </filter>`)
      }
    } else {
      // Use feColorMatrix for individual adjustments
      const matrixValues = buildColorMatrix(overlayState.imageColorAdjustments)
      defsContent.push(`    <filter id="overlay-filter" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="${matrixValues}"/>
    </filter>`)
    }
  }

  // Add adjustment masks (each path with its own color adjustments)
  if (overlayState.adjustmentMasks.length > 0) {
    overlayState.adjustmentMasks.forEach((mask, idx) => {
      const path = paths[mask.pathIndex]
      if (!path) return

      const maskPathD = serializePathCommands(path.commands)

      // Create mask element with the path shape
      let maskContent = `      <path d="${maskPathD}" fill="white"/>`

      // Subtract hole paths from the adjustment mask
      overlayState.holePathIndices.forEach(holeIdx => {
        const holePath = paths[holeIdx]
        if (holePath) {
          maskContent += `\n      <path d="${serializePathCommands(holePath.commands)}" fill="black"/>`
        }
      })

      defsContent.push(`    <mask id="overlay-adjustment-mask-${idx}">
${maskContent}
    </mask>`)

      // Create filter for this adjustment mask's color adjustments
      if (mask.adjustments && Object.keys(mask.adjustments).length > 0) {
        const adjustmentMatrix = buildColorMatrix(mask.adjustments)
        defsContent.push(`    <filter id="overlay-adjustment-filter-${idx}" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="${adjustmentMatrix}"/>
    </filter>`)
      }
    })
  }

  // Add other defs (gradients, filters used by paths)
  const existingDefs = serializeDefs(defs)
  if (existingDefs) {
    // Extract content between <defs> tags
    const match = existingDefs.match(/<defs>([\s\S]*?)<\/defs>/)
    if (match && match[1].trim()) {
      defsContent.push(match[1].trim())
    }
  }

  // Serialize all drawn paths (excluding those used as holes)
  // Clip paths ARE included if they have visible fill/stroke (so the color is preserved)
  const holeIndices = new Set(overlayState.holePathIndices)
  const drawnPaths = paths
    .filter((_, i) => !holeIndices.has(i))
    .map(path => `    ${serializePath(path)}`)
    .join('\n')

  const defsSection = defsContent.length > 0 ? `  <defs>\n${defsContent.join('\n')}\n  </defs>` : ''

  const pathsSection = drawnPaths ? `  <g id="overlay-paths">\n${drawnPaths}\n  </g>` : ''

  return `${createSvgOpenTag(width, height)}
${defsSection}
${pathsSection}
</svg>`.replace(/\n\n+/g, '\n')
}

/**
 * Check if any color adjustments or filter preset have been applied
 */
function hasColorAdjustments(adj?: ImageColorAdjustments): boolean {
  if (!adj) return false
  return (
    !!adj.filterPresetId
    || (adj.brightness !== undefined && adj.brightness !== 0)
    || (adj.contrast !== undefined && adj.contrast !== 0)
    || (adj.saturation !== undefined && adj.saturation !== 0)
    || (adj.hueRotate !== undefined && adj.hueRotate !== 0)
    || (adj.invert !== undefined && adj.invert !== 0)
    || (adj.sepia !== undefined && adj.sepia !== 0)
    || (adj.grayscale !== undefined && adj.grayscale !== 0)
  )
}

/**
 * Serialize all paths to SVG for resuming editing
 * Unlike combinedSvg, this includes ALL paths (including clip/hole paths)
 */
export function serializeEditableSvg(
  paths: ParsedPathExtended[],
  defs: SvgDefs,
  width: number,
  height: number
): string {
  const defsContent: string[] = []

  // Add other defs (gradients, filters used by paths)
  const existingDefs = serializeDefs(defs)
  if (existingDefs) {
    const match = existingDefs.match(/<defs>([\s\S]*?)<\/defs>/)
    if (match && match[1].trim()) {
      defsContent.push(match[1].trim())
    }
  }

  // Serialize ALL paths (for editing purposes)
  const allPaths = paths.map(path => `    ${serializePath(path)}`).join('\n')

  const defsSection = defsContent.length > 0 ? `  <defs>\n${defsContent.join('\n')}\n  </defs>` : ''
  const pathsSection = allPaths ? `  <g id="editable-paths">\n${allPaths}\n  </g>` : ''

  return `${createSvgOpenTag(width, height)}
${defsSection}
${pathsSection}
</svg>`.replace(/\n\n+/g, '\n')
}

/**
 * Build complete overlay SVG output
 */
export function buildOverlaySvgOutput(options: {
  paths: ParsedPathExtended[]
  defs: SvgDefs
  overlayState: OverlayState
  imageInfo: RasterImageInfo
}): OverlaySvgOutput {
  const { paths, defs, overlayState, imageInfo } = options
  const { naturalWidth: width, naturalHeight: height } = imageInfo

  return {
    clipPathSvg: serializeClipPathOverlay(paths, width, height, overlayState.clipPathIndices),
    filterSvg: serializeFilterOverlay(overlayState.imageColorAdjustments, width, height),
    combinedSvg: serializeCombinedOverlay(paths, defs, overlayState, width, height),
    // SVG containing all paths for resuming editing (pass as svgDataUri to VectorEditor)
    editableSvg: serializeEditableSvg(paths, defs, width, height),
    // Include overlay state for resuming editing (deep copy to avoid mutation issues)
    overlayState: {
      imageColorAdjustments: overlayState.imageColorAdjustments ? { ...overlayState.imageColorAdjustments } : undefined,
      clipPathIndices: [...overlayState.clipPathIndices],
      holePathIndices: [...overlayState.holePathIndices],
      adjustmentMasks: overlayState.adjustmentMasks.map(mask => ({
        pathIndex: mask.pathIndex,
        adjustments: { ...mask.adjustments },
      })),
    },
    metadata: {
      imageWidth: width,
      imageHeight: height,
      hasClipPaths: overlayState.clipPathIndices.length > 0,
      hasFilters: hasColorAdjustments(overlayState.imageColorAdjustments),
      hasDrawnPaths: paths.length > 0,
      hasHoles: overlayState.holePathIndices.length > 0,
      hasAdjustmentMasks: overlayState.adjustmentMasks.length > 0,
    },
  }
}
