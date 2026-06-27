/* eslint-disable max-len */
/**
 * SVGPreviewLayer - Renders SVG with effects using native browser rendering
 * This layer displays the visual preview with filters, gradients, masks, etc.
 * It is non-interactive (pointer-events: none) - all interaction is handled by CanvasInteractionLayer
 */

import { useMemo, forwardRef } from 'react'
import type { ParsedSvgExtended, ParsedPathExtended, SvgDefs, ColorAdjustments, SvgEffectGroup } from '../../utils/svg'
import { serializePathCommands, findAffectingGroup } from '../../utils/svg'
import type { Point } from '../../types'
import styles from './styles.module.css'

/**
 * Build CSS filter string from color adjustments
 * Used to apply brightness, contrast, saturation, etc. via CSS filter property
 * This allows color adjustments to coexist with SVG filters (blur, shadow)
 */
function buildCssFilterString(adjustments: ColorAdjustments): string {
  const filters: string[] = []

  if (adjustments.brightness !== undefined && adjustments.brightness !== 0) {
    filters.push(`brightness(${1 + adjustments.brightness / 100})`)
  }
  if (adjustments.contrast !== undefined && adjustments.contrast !== 0) {
    filters.push(`contrast(${1 + adjustments.contrast / 100})`)
  }
  if (adjustments.saturation !== undefined && adjustments.saturation !== 0) {
    filters.push(`saturate(${1 + adjustments.saturation / 100})`)
  }
  if (adjustments.hueRotate !== undefined && adjustments.hueRotate !== 0) {
    filters.push(`hue-rotate(${adjustments.hueRotate}deg)`)
  }
  if (adjustments.grayscale !== undefined && adjustments.grayscale !== 0) {
    filters.push(`grayscale(${adjustments.grayscale})`)
  }
  if (adjustments.sepia !== undefined && adjustments.sepia !== 0) {
    filters.push(`sepia(${adjustments.sepia})`)
  }
  if (adjustments.invert !== undefined && adjustments.invert !== 0) {
    filters.push(`invert(${adjustments.invert})`)
  }

  return filters.join(' ')
}

export interface SVGPreviewLayerProps {
  parsedSvg: ParsedSvgExtended
  scale: number
  offset: Point
  width: number
  height: number
  /** Effect groups for clip/hole paths in SVG-only mode */
  effectGroups?: SvgEffectGroup[]
  /** Indices of paths marked as holes (cutouts) - rendered as transparent in overlay mode */
  holePathIndices?: number[]
}

/**
 * Build SVG defs section (gradients, filters, masks, clipPaths, and effect group defs)
 */
function buildDefsSection(defs: SvgDefs, paths: ParsedPathExtended[], effectGroups?: SvgEffectGroup[]): string {
  const parts: string[] = []

  // Gradients
  defs.gradients.forEach((gradient, id) => {
    if (gradient.type === 'linearGradient') {
      const stops = gradient.stops
        .map(stop => {
          const opacity = stop.opacity !== undefined ? ` stop-opacity="${stop.opacity}"` : ''
          return `<stop offset="${stop.offset * 100}%" stop-color="${stop.color}"${opacity}/>`
        })
        .join('')
      parts.push(
        `<linearGradient id="${id}" x1="${gradient.x1}" y1="${gradient.y1}" x2="${gradient.x2}" y2="${gradient.y2}"${gradient.gradientUnits ? ` gradientUnits="${gradient.gradientUnits}"` : ''}>${stops}</linearGradient>`
      )
    } else if (gradient.type === 'radialGradient') {
      const stops = gradient.stops
        .map(stop => {
          const opacity = stop.opacity !== undefined ? ` stop-opacity="${stop.opacity}"` : ''
          return `<stop offset="${stop.offset * 100}%" stop-color="${stop.color}"${opacity}/>`
        })
        .join('')
      const fx = gradient.fx !== undefined ? ` fx="${gradient.fx}"` : ''
      const fy = gradient.fy !== undefined ? ` fy="${gradient.fy}"` : ''
      parts.push(
        `<radialGradient id="${id}" cx="${gradient.cx}" cy="${gradient.cy}" r="${gradient.r}"${fx}${fy}${gradient.gradientUnits ? ` gradientUnits="${gradient.gradientUnits}"` : ''}>${stops}</radialGradient>`
      )
    }
  })

  // Filters
  defs.filters.forEach((filter, id) => {
    const primitives = filter.primitives
      .map(primitive => {
        switch (primitive.type) {
          case 'feGaussianBlur': {
            const stdDev = Array.isArray(primitive.stdDeviation)
              ? primitive.stdDeviation.join(' ')
              : primitive.stdDeviation
            return `<feGaussianBlur stdDeviation="${stdDev}"${primitive.result ? ` result="${primitive.result}"` : ''}${primitive.in ? ` in="${primitive.in}"` : ''}/>`
          }
          case 'feColorMatrix': {
            const values = Array.isArray(primitive.values) ? primitive.values.join(' ') : primitive.values
            return `<feColorMatrix type="${primitive.matrixType}"${primitive.in ? ` in="${primitive.in}"` : ''}${values !== undefined ? ` values="${values}"` : ''}${primitive.result ? ` result="${primitive.result}"` : ''}/>`
          }
          case 'feDropShadow': {
            const stdDev = Array.isArray(primitive.stdDeviation)
              ? primitive.stdDeviation.join(' ')
              : primitive.stdDeviation
            return `<feDropShadow dx="${primitive.dx}" dy="${primitive.dy}" stdDeviation="${stdDev}"${primitive.floodColor ? ` flood-color="${primitive.floodColor}"` : ''}${primitive.floodOpacity !== undefined ? ` flood-opacity="${primitive.floodOpacity}"` : ''}/>`
          }
          case 'feBlend':
            return `<feBlend mode="${primitive.mode}"${primitive.in ? ` in="${primitive.in}"` : ''}${primitive.in2 ? ` in2="${primitive.in2}"` : ''}/>`
          case 'feOffset':
            return `<feOffset dx="${primitive.dx}" dy="${primitive.dy}"${primitive.result ? ` result="${primitive.result}"` : ''}${primitive.in ? ` in="${primitive.in}"` : ''}/>`
          case 'feFlood':
            return `<feFlood flood-color="${primitive.floodColor}"${primitive.floodOpacity !== undefined ? ` flood-opacity="${primitive.floodOpacity}"` : ''}${primitive.result ? ` result="${primitive.result}"` : ''}/>`
          case 'feComposite':
            return `<feComposite operator="${primitive.operator}"${primitive.in ? ` in="${primitive.in}"` : ''}${primitive.in2 ? ` in2="${primitive.in2}"` : ''}${primitive.result ? ` result="${primitive.result}"` : ''}/>`
          case 'feMerge': {
            const nodes = primitive.nodes.map(n => `<feMergeNode${n.in ? ` in="${n.in}"` : ''}/>`).join('')
            return `<feMerge>${nodes}</feMerge>`
          }
          case 'feTurbulence': {
            const baseFreq = Array.isArray(primitive.baseFrequency)
              ? primitive.baseFrequency.join(' ')
              : primitive.baseFrequency
            return `<feTurbulence type="${primitive.turbulenceType}" baseFrequency="${baseFreq}"${primitive.numOctaves ? ` numOctaves="${primitive.numOctaves}"` : ''}${primitive.seed ? ` seed="${primitive.seed}"` : ''}${primitive.result ? ` result="${primitive.result}"` : ''}/>`
          }
          case 'feDisplacementMap':
            return `<feDisplacementMap scale="${primitive.scale}"${primitive.in ? ` in="${primitive.in}"` : ''}${primitive.in2 ? ` in2="${primitive.in2}"` : ''}${primitive.xChannelSelector ? ` xChannelSelector="${primitive.xChannelSelector}"` : ''}${primitive.yChannelSelector ? ` yChannelSelector="${primitive.yChannelSelector}"` : ''}${primitive.result ? ` result="${primitive.result}"` : ''}/>`
          case 'feDiffuseLighting': {
            // Build light source element
            let lightSource = ''
            if (primitive.lightSource) {
              switch (primitive.lightSource.type) {
                case 'distantLight':
                  lightSource = `<feDistantLight azimuth="${primitive.lightSource.azimuth}" elevation="${primitive.lightSource.elevation}"/>`
                  break
                case 'pointLight':
                  lightSource = `<fePointLight x="${primitive.lightSource.x}" y="${primitive.lightSource.y}" z="${primitive.lightSource.z}"/>`
                  break
                case 'spotLight': {
                  const spotAttrs = [
                    `x="${primitive.lightSource.x}"`,
                    `y="${primitive.lightSource.y}"`,
                    `z="${primitive.lightSource.z}"`,
                    `pointsAtX="${primitive.lightSource.pointsAtX}"`,
                    `pointsAtY="${primitive.lightSource.pointsAtY}"`,
                    `pointsAtZ="${primitive.lightSource.pointsAtZ}"`,
                  ]
                  if (primitive.lightSource.specularExponent !== undefined) {
                    spotAttrs.push(`specularExponent="${primitive.lightSource.specularExponent}"`)
                  }
                  if (primitive.lightSource.limitingConeAngle !== undefined) {
                    spotAttrs.push(`limitingConeAngle="${primitive.lightSource.limitingConeAngle}"`)
                  }
                  lightSource = `<feSpotLight ${spotAttrs.join(' ')}/>`
                  break
                }
              }
            }
            const diffuseAttrs: string[] = []
            if (primitive.in) diffuseAttrs.push(`in="${primitive.in}"`)
            if (primitive.surfaceScale !== undefined) diffuseAttrs.push(`surfaceScale="${primitive.surfaceScale}"`)
            if (primitive.diffuseConstant !== undefined) {
              diffuseAttrs.push(`diffuseConstant="${primitive.diffuseConstant}"`)
            }
            if (primitive.lightingColor) diffuseAttrs.push(`lighting-color="${primitive.lightingColor}"`)
            if (primitive.result) diffuseAttrs.push(`result="${primitive.result}"`)
            return `<feDiffuseLighting ${diffuseAttrs.join(' ')}>${lightSource}</feDiffuseLighting>`
          }
          case 'feSpecularLighting': {
            // Build light source element
            let lightSource = ''
            if (primitive.lightSource) {
              switch (primitive.lightSource.type) {
                case 'distantLight':
                  lightSource = `<feDistantLight azimuth="${primitive.lightSource.azimuth}" elevation="${primitive.lightSource.elevation}"/>`
                  break
                case 'pointLight':
                  lightSource = `<fePointLight x="${primitive.lightSource.x}" y="${primitive.lightSource.y}" z="${primitive.lightSource.z}"/>`
                  break
                case 'spotLight': {
                  const spotAttrs = [
                    `x="${primitive.lightSource.x}"`,
                    `y="${primitive.lightSource.y}"`,
                    `z="${primitive.lightSource.z}"`,
                    `pointsAtX="${primitive.lightSource.pointsAtX}"`,
                    `pointsAtY="${primitive.lightSource.pointsAtY}"`,
                    `pointsAtZ="${primitive.lightSource.pointsAtZ}"`,
                  ]
                  if (primitive.lightSource.specularExponent !== undefined) {
                    spotAttrs.push(`specularExponent="${primitive.lightSource.specularExponent}"`)
                  }
                  if (primitive.lightSource.limitingConeAngle !== undefined) {
                    spotAttrs.push(`limitingConeAngle="${primitive.lightSource.limitingConeAngle}"`)
                  }
                  lightSource = `<feSpotLight ${spotAttrs.join(' ')}/>`
                  break
                }
              }
            }
            const specularAttrs: string[] = []
            if (primitive.in) specularAttrs.push(`in="${primitive.in}"`)
            if (primitive.surfaceScale !== undefined) specularAttrs.push(`surfaceScale="${primitive.surfaceScale}"`)
            if (primitive.specularConstant !== undefined) {
              specularAttrs.push(`specularConstant="${primitive.specularConstant}"`)
            }
            if (primitive.specularExponent !== undefined) {
              specularAttrs.push(`specularExponent="${primitive.specularExponent}"`)
            }
            if (primitive.lightingColor) specularAttrs.push(`lighting-color="${primitive.lightingColor}"`)
            if (primitive.result) specularAttrs.push(`result="${primitive.result}"`)
            return `<feSpecularLighting ${specularAttrs.join(' ')}>${lightSource}</feSpecularLighting>`
          }
          case 'feMorphology': {
            const radius = Array.isArray(primitive.radius) ? primitive.radius.join(' ') : primitive.radius
            const morphAttrs: string[] = [`operator="${primitive.operator}"`, `radius="${radius}"`]
            if (primitive.in) morphAttrs.push(`in="${primitive.in}"`)
            if (primitive.result) morphAttrs.push(`result="${primitive.result}"`)
            return `<feMorphology ${morphAttrs.join(' ')}/>`
          }
          case 'feComponentTransfer': {
            const funcChildren: string[] = []
            const serializeFunc = (func: typeof primitive.funcR, channel: 'R' | 'G' | 'B' | 'A'): string => {
              if (!func) return ''
              const funcAttrs = [`type="${func.type}"`]
              if (func.tableValues && func.tableValues.length > 0) {
                funcAttrs.push(`tableValues="${func.tableValues.join(' ')}"`)
              }
              if (func.slope !== undefined) funcAttrs.push(`slope="${func.slope}"`)
              if (func.intercept !== undefined) funcAttrs.push(`intercept="${func.intercept}"`)
              if (func.amplitude !== undefined) funcAttrs.push(`amplitude="${func.amplitude}"`)
              if (func.exponent !== undefined) funcAttrs.push(`exponent="${func.exponent}"`)
              if (func.offset !== undefined) funcAttrs.push(`offset="${func.offset}"`)
              return `<feFunc${channel} ${funcAttrs.join(' ')}/>`
            }
            if (primitive.funcR) funcChildren.push(serializeFunc(primitive.funcR, 'R'))
            if (primitive.funcG) funcChildren.push(serializeFunc(primitive.funcG, 'G'))
            if (primitive.funcB) funcChildren.push(serializeFunc(primitive.funcB, 'B'))
            if (primitive.funcA) funcChildren.push(serializeFunc(primitive.funcA, 'A'))
            const transferAttrs: string[] = []
            if (primitive.in) transferAttrs.push(`in="${primitive.in}"`)
            if (primitive.result) transferAttrs.push(`result="${primitive.result}"`)
            return `<feComponentTransfer${transferAttrs.length > 0 ? ` ${transferAttrs.join(' ')}` : ''}>${funcChildren.join('')}</feComponentTransfer>`
          }
          case 'feConvolveMatrix': {
            const order = Array.isArray(primitive.order) ? primitive.order.join(' ') : primitive.order
            const convolveAttrs: string[] = [`order="${order}"`, `kernelMatrix="${primitive.kernelMatrix.join(' ')}"`]
            if (primitive.in) convolveAttrs.push(`in="${primitive.in}"`)
            if (primitive.divisor !== undefined) convolveAttrs.push(`divisor="${primitive.divisor}"`)
            if (primitive.bias !== undefined) convolveAttrs.push(`bias="${primitive.bias}"`)
            if (primitive.targetX !== undefined) convolveAttrs.push(`targetX="${primitive.targetX}"`)
            if (primitive.targetY !== undefined) convolveAttrs.push(`targetY="${primitive.targetY}"`)
            if (primitive.edgeMode) convolveAttrs.push(`edgeMode="${primitive.edgeMode}"`)
            if (primitive.preserveAlpha !== undefined) convolveAttrs.push(`preserveAlpha="${primitive.preserveAlpha}"`)
            if (primitive.result) convolveAttrs.push(`result="${primitive.result}"`)
            return `<feConvolveMatrix ${convolveAttrs.join(' ')}/>`
          }
          default:
            return ''
        }
      })
      .join('')

    // Add filter region attributes to ensure full coverage
    // Default region (-10% to 120%) may clip effects that extend beyond shape bounds
    // Using -50% to 200% gives plenty of room for shadows and blur effects
    parts.push(
      `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"${filter.filterUnits ? ` filterUnits="${filter.filterUnits}"` : ''}>${primitives}</filter>`
    )
  })

  // Masks
  defs.masks.forEach((mask, id) => {
    parts.push(`<mask id="${id}"${mask.maskType ? ` mask-type="${mask.maskType}"` : ''}>${mask.content}</mask>`)
  })

  // Clip paths
  defs.clipPaths.forEach((clipPath, id) => {
    parts.push(`<clipPath id="${id}"><path d="${clipPath.pathData}"/></clipPath>`)
  })

  // Effect group clip paths (for SVG-only mode)
  effectGroups?.forEach(group => {
    if (group.type === 'clip') {
      const effectPath = paths[group.effectPathIndex]
      if (effectPath) {
        const d = serializePathCommands(effectPath.commands)
        parts.push(`<clipPath id="${group.defId}"><path d="${d}"/></clipPath>`)
      }
    }
  })

  // Effect group masks for holes (for SVG-only mode)
  // Mask: white background (shows everything), black hole shape (hides areas)
  effectGroups?.forEach(group => {
    if (group.type === 'hole') {
      const effectPath = paths[group.effectPathIndex]
      if (effectPath) {
        const d = serializePathCommands(effectPath.commands)
        parts.push(
          `<mask id="${group.defId}"><rect x="-10000" y="-10000" width="20000" height="20000" fill="white"/><path d="${d}" fill="black"/></mask>`
        )
      }
    }
  })

  return parts.length > 0 ? `<defs>${parts.join('')}</defs>` : ''
}

/**
 * Build path element with extended styling
 * @param path - The parsed path with extended style
 * @param index - The path index in the paths array
 * @param effectGroups - Effect groups for SVG-only mode
 * @param isHolePath - Whether this path is marked as a hole (cutout)
 */
function buildPathElement(
  path: ParsedPathExtended,
  index: number,
  effectGroups?: SvgEffectGroup[],
  isHolePath = false
): string {
  const { style, commands, id, transform } = path
  const d = serializePathCommands(commands)

  const attrs: string[] = [`d="${d}"`]

  // ID
  if (id) {
    attrs.push(`id="${id}"`)
  }

  // Hole paths are rendered as transparent (no fill/stroke) in overlay mode
  // The actual hole effect is applied by RasterBackgroundLayer masking the image
  // We skip fill/stroke rendering to avoid showing the original shape color
  if (isHolePath) {
    attrs.push(`fill="none"`)
    attrs.push(`stroke="none"`)
  } else {
    // Fill
    if (style.fill.type === 'color') {
      attrs.push(`fill="${style.fill.color}"`)
      if (style.fill.opacity !== undefined) {
        attrs.push(`fill-opacity="${style.fill.opacity}"`)
      }
    } else if (style.fill.type === 'gradient') {
      attrs.push(`fill="url(#${style.fill.gradientId})"`)
    } else {
      attrs.push(`fill="none"`)
    }
  }

  // Skip fill/stroke attributes for hole paths (they're rendered as transparent)
  if (!isHolePath) {
    // Fill rule
    if (style.fillRule) {
      attrs.push(`fill-rule="${style.fillRule}"`)
    }

    // Fill opacity
    if (style.fillOpacity !== undefined) {
      attrs.push(`fill-opacity="${style.fillOpacity}"`)
    }

    // Stroke
    if (style.stroke) {
      if (style.stroke.type === 'color') {
        attrs.push(`stroke="${style.stroke.color}"`)
        if (style.stroke.opacity !== undefined) {
          attrs.push(`stroke-opacity="${style.stroke.opacity}"`)
        }
      } else if (style.stroke.type === 'gradient') {
        attrs.push(`stroke="url(#${style.stroke.gradientId})"`)
      } else {
        attrs.push(`stroke="none"`)
      }
    }

    // Stroke width
    if (style.strokeWidth !== undefined) {
      attrs.push(`stroke-width="${style.strokeWidth}"`)
    }

    // Stroke opacity
    if (style.strokeOpacity !== undefined) {
      attrs.push(`stroke-opacity="${style.strokeOpacity}"`)
    }

    // Stroke line cap
    if (style.strokeLinecap) {
      attrs.push(`stroke-linecap="${style.strokeLinecap}"`)
    }

    // Stroke line join
    if (style.strokeLinejoin) {
      attrs.push(`stroke-linejoin="${style.strokeLinejoin}"`)
    }

    // Stroke miter limit
    if (style.strokeMiterlimit !== undefined) {
      attrs.push(`stroke-miterlimit="${style.strokeMiterlimit}"`)
    }

    // Stroke dash array
    if (style.strokeDasharray && style.strokeDasharray.length > 0) {
      attrs.push(`stroke-dasharray="${style.strokeDasharray.join(' ')}"`)
    }

    // Stroke dash offset
    if (style.strokeDashoffset !== undefined) {
      attrs.push(`stroke-dashoffset="${style.strokeDashoffset}"`)
    }

    // Opacity
    if (style.opacity !== undefined) {
      attrs.push(`opacity="${style.opacity}"`)
    }
  }

  // Build style attribute (mix-blend-mode and combined filter)
  const styleAttrs: string[] = []
  if (style.mixBlendMode && style.mixBlendMode !== 'normal') {
    styleAttrs.push(`mix-blend-mode: ${style.mixBlendMode}`)
  }

  // Build combined filter value (SVG filter URL + CSS adjustments)
  // Both use the CSS filter property, so they must be combined into a single value
  const filterParts: string[] = []

  // Add SVG filter URL first (blur, shadow, etc.)
  if (style.filterId) {
    filterParts.push(`url(#${style.filterId})`)
  }

  // Add CSS filter functions (brightness, contrast, etc.)
  if (style.colorAdjustments) {
    const cssFilter = buildCssFilterString(style.colorAdjustments)
    if (cssFilter) {
      filterParts.push(cssFilter)
    }
  }

  // Combine into style attribute
  if (filterParts.length > 0) {
    styleAttrs.push(`filter: ${filterParts.join(' ')}`)
  }

  if (styleAttrs.length > 0) {
    attrs.push(`style="${styleAttrs.join('; ')}"`)
  }

  // NOTE: Don't add separate filter="url(...)" attribute - it conflicts with CSS filter in style
  // The SVG filter URL is now included in the style attribute above

  // Mask
  if (style.maskId) {
    attrs.push(`mask="url(#${style.maskId})"`)
  }

  // Clip path (from style)
  if (style.clipPathId) {
    attrs.push(`clip-path="url(#${style.clipPathId})"`)
  }

  // Apply clip/mask from effect groups (SVG-only mode clip/hole)
  // Only apply if not already clipped/masked by style
  if (effectGroups && !style.clipPathId && !style.maskId) {
    const affectingGroup = findAffectingGroup(index, effectGroups)
    if (affectingGroup) {
      if (affectingGroup.type === 'clip') {
        attrs.push(`clip-path="url(#${affectingGroup.defId})"`)
      } else {
        attrs.push(`mask="url(#${affectingGroup.defId})"`)
      }
    }
  }

  // Transform
  if (transform) {
    attrs.push(`transform="${transform}"`)
  }

  return `<path ${attrs.join(' ')}/>`
}

/**
 * Build complete SVG string from parsed SVG data
 * Uses 100% width/height to let the container control actual rendering size,
 * which ensures sharp rendering at any zoom level
 * @param parsedSvg - The parsed SVG data
 * @param effectGroups - Effect groups for SVG-only mode
 * @param holePathIndices - Indices of paths marked as holes (rendered transparent)
 */
function buildSvgString(
  parsedSvg: ParsedSvgExtended,
  effectGroups?: SvgEffectGroup[],
  holePathIndices?: number[]
): string {
  const { viewBox, defs, paths } = parsedSvg
  const holeIndicesSet = new Set(holePathIndices || [])

  const defsSection = buildDefsSection(defs, paths, effectGroups)
  const pathElements = paths
    .map((path, index) => buildPathElement(path, index, effectGroups, holeIndicesSet.has(index)))
    .join('\n')

  const viewBoxStr = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`

  // Use 100% width/height instead of fixed viewBox dimensions
  // This allows the SVG to scale naturally with the container size
  // overflow="visible" ensures content outside viewBox is still visible during editing
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxStr}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" overflow="visible">
${defsSection}
${pathElements}
</svg>`
}

const SVGPreviewLayer = forwardRef<HTMLDivElement, SVGPreviewLayerProps>(function SVGPreviewLayer(
  { parsedSvg, scale, offset, width, height, effectGroups, holePathIndices },
  ref
) {
  // Memoize SVG string to prevent unnecessary re-renders
  const svgContent = useMemo(() => {
    return buildSvgString(parsedSvg, effectGroups, holePathIndices)
  }, [parsedSvg, effectGroups, holePathIndices])

  // Calculate actual display dimensions (viewBox * zoom scale)
  // This ensures SVG is rasterized at the zoomed size, not the original size
  // Using CSS transform: scale() would cause blur because browser rasterizes SVG
  // at the original container size first, then scales up the pixels
  const displayWidth = parsedSvg.viewBox.width * scale
  const displayHeight = parsedSvg.viewBox.height * scale

  // Use CSS positioning for panning, but set actual container size for zoom
  // This way the browser renders SVG at full resolution for crisp edges
  const containerStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      left: offset.x,
      top: offset.y,
      width: displayWidth,
      height: displayHeight,
      // No CSS transform: scale() - we size the container directly for sharp rendering
    }),
    [offset.x, offset.y, displayWidth, displayHeight]
  )

  return (
    <div ref={ref} className={styles.svgPreviewLayer} style={containerStyle}>
      <div
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: svgContent }}
        className={styles.svgContainer}
      />
    </div>
  )
})

export default SVGPreviewLayer
