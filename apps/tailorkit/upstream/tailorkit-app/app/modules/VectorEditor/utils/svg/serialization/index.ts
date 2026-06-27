/* eslint-disable max-lines */
/**
 * SVG Serialization Utilities
 * Convert SVG effect definitions to SVG markup strings
 */

import type {
  GradientDef,
  GradientStop,
  LinearGradientDef,
  RadialGradientDef,
  FilterDef,
  FilterPrimitive,
  MaskDef,
  ClipPathDef,
  Paint,
  ColorAdjustments,
  PathStyleWithSubpaths,
  PathStyle,
  LightSource,
  FeDiffuseLighting,
  FeSpecularLighting,
  FeMorphology,
} from '../types/effects'
import type { ParsedPathExtended, ParsedSvgExtended, SvgDefs } from '../types/parsed'
import type { PathCommand } from '../pathParsing'
import { serializePathCommands, formatCoord } from '../pathParsing'
import { parseAllSegments } from '../pathGeometry'
import type { ConnectedSegment, SvgEffectGroup } from '../../../types'
import { findAffectingGroup } from '../effectGroups'
import { areSubpathStylesUniform, computeEffectiveSubpathStyle } from '../../subpathStyles'
import { getPathFilterPresetById, buildPathFilterCssPreview } from '../../filters'

/**
 * Build CSS filter string from color adjustments
 * Used to apply brightness, contrast, saturation, etc. via CSS filter property
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

// =============================================================================
// Gradient Serialization
// =============================================================================

/**
 * Serialize gradient stops
 */
export function serializeGradientStops(stops: GradientStop[]): string {
  return stops
    .map(stop => {
      const attrs = [`offset="${stop.offset * 100}%"`, `stop-color="${stop.color}"`]
      if (stop.opacity !== undefined) {
        attrs.push(`stop-opacity="${stop.opacity}"`)
      }
      return `<stop ${attrs.join(' ')}/>`
    })
    .join('')
}

/**
 * Serialize a linear gradient
 */
export function serializeLinearGradient(gradient: LinearGradientDef): string {
  const attrs = [
    `id="${gradient.id}"`,
    `x1="${formatCoord(gradient.x1)}"`,
    `y1="${formatCoord(gradient.y1)}"`,
    `x2="${formatCoord(gradient.x2)}"`,
    `y2="${formatCoord(gradient.y2)}"`,
  ]

  if (gradient.gradientUnits) {
    attrs.push(`gradientUnits="${gradient.gradientUnits}"`)
  }
  if (gradient.spreadMethod) {
    attrs.push(`spreadMethod="${gradient.spreadMethod}"`)
  }
  if (gradient.gradientTransform) {
    attrs.push(`gradientTransform="${gradient.gradientTransform}"`)
  }

  const stops = serializeGradientStops(gradient.stops)
  return `<linearGradient ${attrs.join(' ')}>${stops}</linearGradient>`
}

/**
 * Serialize a radial gradient
 */
export function serializeRadialGradient(gradient: RadialGradientDef): string {
  const attrs = [
    `id="${gradient.id}"`,
    `cx="${formatCoord(gradient.cx)}"`,
    `cy="${formatCoord(gradient.cy)}"`,
    `r="${formatCoord(gradient.r)}"`,
  ]

  if (gradient.fx !== undefined) {
    attrs.push(`fx="${formatCoord(gradient.fx)}"`)
  }
  if (gradient.fy !== undefined) {
    attrs.push(`fy="${formatCoord(gradient.fy)}"`)
  }
  if (gradient.fr !== undefined) {
    attrs.push(`fr="${formatCoord(gradient.fr)}"`)
  }
  if (gradient.gradientUnits) {
    attrs.push(`gradientUnits="${gradient.gradientUnits}"`)
  }
  if (gradient.spreadMethod) {
    attrs.push(`spreadMethod="${gradient.spreadMethod}"`)
  }
  if (gradient.gradientTransform) {
    attrs.push(`gradientTransform="${gradient.gradientTransform}"`)
  }

  const stops = serializeGradientStops(gradient.stops)
  return `<radialGradient ${attrs.join(' ')}>${stops}</radialGradient>`
}

/**
 * Serialize any gradient
 */
export function serializeGradient(gradient: GradientDef): string {
  if (gradient.type === 'linearGradient') {
    return serializeLinearGradient(gradient)
  }

  return serializeRadialGradient(gradient)
}

// =============================================================================
// Filter Serialization
// =============================================================================

/**
 * Serialize a light source element for lighting filters
 */
function serializeLightSource(light: LightSource): string {
  switch (light.type) {
    case 'distantLight':
      return `<feDistantLight azimuth="${light.azimuth}" elevation="${light.elevation}"/>`
    case 'pointLight':
      return `<fePointLight x="${light.x}" y="${light.y}" z="${light.z}"/>`
    case 'spotLight': {
      const attrs = [
        `x="${light.x}"`,
        `y="${light.y}"`,
        `z="${light.z}"`,
        `pointsAtX="${light.pointsAtX}"`,
        `pointsAtY="${light.pointsAtY}"`,
        `pointsAtZ="${light.pointsAtZ}"`,
      ]
      if (light.specularExponent !== undefined) attrs.push(`specularExponent="${light.specularExponent}"`)
      if (light.limitingConeAngle !== undefined) attrs.push(`limitingConeAngle="${light.limitingConeAngle}"`)
      return `<feSpotLight ${attrs.join(' ')}/>`
    }
    default:
      return ''
  }
}

/**
 * Serialize a filter primitive
 */
export function serializeFilterPrimitive(primitive: FilterPrimitive): string {
  const baseAttrs: string[] = []
  if (primitive.result) baseAttrs.push(`result="${primitive.result}"`)
  if (primitive.in) baseAttrs.push(`in="${primitive.in}"`)

  switch (primitive.type) {
    case 'feGaussianBlur': {
      const stdDev = Array.isArray(primitive.stdDeviation) ? primitive.stdDeviation.join(' ') : primitive.stdDeviation
      const attrs = [...baseAttrs, `stdDeviation="${stdDev}"`]
      if (primitive.edgeMode) attrs.push(`edgeMode="${primitive.edgeMode}"`)
      return `<feGaussianBlur ${attrs.join(' ')}/>`
    }

    case 'feColorMatrix': {
      const attrs = [...baseAttrs, `type="${primitive.matrixType}"`]
      if (primitive.values !== undefined) {
        const values = Array.isArray(primitive.values) ? primitive.values.join(' ') : primitive.values
        attrs.push(`values="${values}"`)
      }
      return `<feColorMatrix ${attrs.join(' ')}/>`
    }

    case 'feDropShadow': {
      const stdDev = Array.isArray(primitive.stdDeviation) ? primitive.stdDeviation.join(' ') : primitive.stdDeviation
      const attrs = [...baseAttrs, `dx="${primitive.dx}"`, `dy="${primitive.dy}"`, `stdDeviation="${stdDev}"`]
      if (primitive.floodColor) attrs.push(`flood-color="${primitive.floodColor}"`)
      if (primitive.floodOpacity !== undefined) attrs.push(`flood-opacity="${primitive.floodOpacity}"`)
      return `<feDropShadow ${attrs.join(' ')}/>`
    }

    case 'feBlend': {
      const attrs = [...baseAttrs, `mode="${primitive.mode}"`]
      if (primitive.in2) attrs.push(`in2="${primitive.in2}"`)
      return `<feBlend ${attrs.join(' ')}/>`
    }

    case 'feOffset': {
      const attrs = [...baseAttrs, `dx="${primitive.dx}"`, `dy="${primitive.dy}"`]
      return `<feOffset ${attrs.join(' ')}/>`
    }

    case 'feFlood': {
      const attrs = [...baseAttrs, `flood-color="${primitive.floodColor}"`]
      if (primitive.floodOpacity !== undefined) attrs.push(`flood-opacity="${primitive.floodOpacity}"`)
      return `<feFlood ${attrs.join(' ')}/>`
    }

    case 'feComposite': {
      const attrs = [...baseAttrs, `operator="${primitive.operator}"`]
      if (primitive.in2) attrs.push(`in2="${primitive.in2}"`)
      if (primitive.k1 !== undefined) attrs.push(`k1="${primitive.k1}"`)
      if (primitive.k2 !== undefined) attrs.push(`k2="${primitive.k2}"`)
      if (primitive.k3 !== undefined) attrs.push(`k3="${primitive.k3}"`)
      if (primitive.k4 !== undefined) attrs.push(`k4="${primitive.k4}"`)
      return `<feComposite ${attrs.join(' ')}/>`
    }

    case 'feMerge': {
      const nodes = primitive.nodes.map(n => `<feMergeNode${n.in ? ` in="${n.in}"` : ''}/>`).join('')
      return `<feMerge${baseAttrs.length ? ` ${baseAttrs.join(' ')}` : ''}>${nodes}</feMerge>`
    }

    case 'feTurbulence': {
      const baseFreq = Array.isArray(primitive.baseFrequency)
        ? primitive.baseFrequency.join(' ')
        : primitive.baseFrequency
      const attrs = [...baseAttrs, `type="${primitive.turbulenceType}"`, `baseFrequency="${baseFreq}"`]
      if (primitive.numOctaves !== undefined) attrs.push(`numOctaves="${primitive.numOctaves}"`)
      if (primitive.seed !== undefined) attrs.push(`seed="${primitive.seed}"`)
      if (primitive.stitchTiles) attrs.push(`stitchTiles="${primitive.stitchTiles}"`)
      return `<feTurbulence ${attrs.join(' ')}/>`
    }

    case 'feDisplacementMap': {
      const attrs = [...baseAttrs, `scale="${primitive.scale}"`]
      if (primitive.in2) attrs.push(`in2="${primitive.in2}"`)
      if (primitive.xChannelSelector) attrs.push(`xChannelSelector="${primitive.xChannelSelector}"`)
      if (primitive.yChannelSelector) attrs.push(`yChannelSelector="${primitive.yChannelSelector}"`)
      return `<feDisplacementMap ${attrs.join(' ')}/>`
    }

    case 'feDiffuseLighting': {
      const diffuse = primitive as FeDiffuseLighting
      const attrs = [...baseAttrs]
      if (diffuse.surfaceScale !== undefined) attrs.push(`surfaceScale="${diffuse.surfaceScale}"`)
      if (diffuse.diffuseConstant !== undefined) attrs.push(`diffuseConstant="${diffuse.diffuseConstant}"`)
      if (diffuse.lightingColor) attrs.push(`lighting-color="${diffuse.lightingColor}"`)
      const lightSource = serializeLightSource(diffuse.lightSource)
      return `<feDiffuseLighting ${attrs.join(' ')}>${lightSource}</feDiffuseLighting>`
    }

    case 'feSpecularLighting': {
      const specular = primitive as FeSpecularLighting
      const attrs = [...baseAttrs]
      if (specular.surfaceScale !== undefined) attrs.push(`surfaceScale="${specular.surfaceScale}"`)
      if (specular.specularConstant !== undefined) attrs.push(`specularConstant="${specular.specularConstant}"`)
      if (specular.specularExponent !== undefined) attrs.push(`specularExponent="${specular.specularExponent}"`)
      if (specular.lightingColor) attrs.push(`lighting-color="${specular.lightingColor}"`)
      const lightSource = serializeLightSource(specular.lightSource)
      return `<feSpecularLighting ${attrs.join(' ')}>${lightSource}</feSpecularLighting>`
    }

    case 'feMorphology': {
      const morph = primitive as FeMorphology
      const radius = Array.isArray(morph.radius) ? morph.radius.join(' ') : morph.radius
      const attrs = [...baseAttrs, `operator="${morph.operator}"`, `radius="${radius}"`]
      return `<feMorphology ${attrs.join(' ')}/>`
    }

    case 'feComponentTransfer': {
      const funcChildren: string[] = []

      // Serialize each function element
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

      return `<feComponentTransfer${baseAttrs.length ? ` ${baseAttrs.join(' ')}` : ''}>${funcChildren.join('')}</feComponentTransfer>`
    }

    case 'feConvolveMatrix': {
      const order = Array.isArray(primitive.order) ? primitive.order.join(' ') : primitive.order
      const attrs = [...baseAttrs, `order="${order}"`, `kernelMatrix="${primitive.kernelMatrix.join(' ')}"`]
      if (primitive.divisor !== undefined) attrs.push(`divisor="${primitive.divisor}"`)
      if (primitive.bias !== undefined) attrs.push(`bias="${primitive.bias}"`)
      if (primitive.targetX !== undefined) attrs.push(`targetX="${primitive.targetX}"`)
      if (primitive.targetY !== undefined) attrs.push(`targetY="${primitive.targetY}"`)
      if (primitive.edgeMode) attrs.push(`edgeMode="${primitive.edgeMode}"`)
      if (primitive.preserveAlpha !== undefined) attrs.push(`preserveAlpha="${primitive.preserveAlpha}"`)
      return `<feConvolveMatrix ${attrs.join(' ')}/>`
    }

    default:
      return ''
  }
}

/**
 * Serialize a complete filter
 */
export function serializeFilter(filter: FilterDef): string {
  const attrs = [`id="${filter.id}"`]
  if (filter.filterUnits) attrs.push(`filterUnits="${filter.filterUnits}"`)
  if (filter.primitiveUnits) attrs.push(`primitiveUnits="${filter.primitiveUnits}"`)
  if (filter.x !== undefined) attrs.push(`x="${formatCoord(Number(filter.x))}"`)
  if (filter.y !== undefined) attrs.push(`y="${formatCoord(Number(filter.y))}"`)
  if (filter.width !== undefined) attrs.push(`width="${formatCoord(Number(filter.width))}"`)
  if (filter.height !== undefined) attrs.push(`height="${formatCoord(Number(filter.height))}"`)

  // Add CSS filter preview and preset metadata for path filter presets
  // Used by compositor for rendering:
  // - data-css-filter: CSS filter string for non-leather techniques
  // - data-preset-id: preset identifier for technique detection
  // - data-preset-params: JSON params for leather technique color computation
  if (filter.presetId) {
    const preset = getPathFilterPresetById(filter.presetId)
    if (preset) {
      const cssPreview = buildPathFilterCssPreview(preset, filter.presetParams)
      if (cssPreview) {
        attrs.push(`data-css-filter="${cssPreview}"`)
      }
      attrs.push(`data-preset-id="${filter.presetId}"`)
      // Include preset params for leather technique rendering in compositor
      if (filter.presetParams && Object.keys(filter.presetParams).length > 0) {
        // Escape quotes in JSON for HTML attribute
        const paramsJson = JSON.stringify(filter.presetParams).replace(/"/g, '&quot;')
        attrs.push(`data-preset-params="${paramsJson}"`)
      }
    }
  }

  const primitives = filter.primitives.map(serializeFilterPrimitive).join('')
  return `<filter ${attrs.join(' ')}>${primitives}</filter>`
}

// =============================================================================
// Mask Serialization
// =============================================================================

/**
 * Serialize a mask
 */
export function serializeMask(mask: MaskDef): string {
  const attrs = [`id="${mask.id}"`]
  if (mask.maskUnits) attrs.push(`maskUnits="${mask.maskUnits}"`)
  if (mask.maskContentUnits) attrs.push(`maskContentUnits="${mask.maskContentUnits}"`)
  if (mask.maskType) attrs.push(`mask-type="${mask.maskType}"`)
  if (mask.x !== undefined) attrs.push(`x="${formatCoord(Number(mask.x))}"`)
  if (mask.y !== undefined) attrs.push(`y="${formatCoord(Number(mask.y))}"`)
  if (mask.width !== undefined) attrs.push(`width="${formatCoord(Number(mask.width))}"`)
  if (mask.height !== undefined) attrs.push(`height="${formatCoord(Number(mask.height))}"`)

  return `<mask ${attrs.join(' ')}>${mask.content}</mask>`
}

// =============================================================================
// ClipPath Serialization
// =============================================================================

/**
 * Serialize a clipPath
 */
export function serializeClipPath(clipPath: ClipPathDef): string {
  const attrs = [`id="${clipPath.id}"`]
  if (clipPath.clipPathUnits) attrs.push(`clipPathUnits="${clipPath.clipPathUnits}"`)

  const pathAttrs = [`d="${clipPath.pathData}"`]
  if (clipPath.clipRule) pathAttrs.push(`clip-rule="${clipPath.clipRule}"`)

  return `<clipPath ${attrs.join(' ')}><path ${pathAttrs.join(' ')}/></clipPath>`
}

// =============================================================================
// Defs Serialization
// =============================================================================

/**
 * Serialize all SVG definitions
 */
export function serializeDefs(defs: SvgDefs): string {
  const parts: string[] = []

  // Gradients
  defs.gradients.forEach((gradient: GradientDef) => {
    parts.push(serializeGradient(gradient))
  })

  // Filters
  defs.filters.forEach((filter: FilterDef) => {
    parts.push(serializeFilter(filter))
  })

  // Masks
  defs.masks.forEach((mask: MaskDef) => {
    parts.push(serializeMask(mask))
  })

  // ClipPaths
  defs.clipPaths.forEach((clipPath: ClipPathDef) => {
    parts.push(serializeClipPath(clipPath))
  })

  if (parts.length === 0) return ''
  return `<defs>${parts.join('\n')}</defs>`
}

/**
 * Serialize effect group definitions (clip paths and masks for SVG-only mode)
 * Used when clip/hole paths are applied in non-overlay mode
 */
export function serializeEffectGroupDefs(paths: ParsedPathExtended[], effectGroups: SvgEffectGroup[]): string {
  if (effectGroups.length === 0) return ''

  const parts: string[] = []

  for (const group of effectGroups) {
    const effectPath = paths[group.effectPathIndex]
    if (!effectPath) continue

    const d = serializePathCommands(effectPath.commands)

    if (group.type === 'clip') {
      // Generate clipPath definition
      parts.push(`<clipPath id="${group.defId}"><path d="${d}"/></clipPath>`)
    } else {
      // Generate mask definition for holes (white background, black hole shape)
      parts.push(
        `<mask id="${group.defId}"><rect x="-10000" y="-10000" width="20000" height="20000" fill="white"/><path d="${d}" fill="black"/></mask>`
      )
    }
  }

  return parts.join('\n')
}

// =============================================================================
// Paint Serialization
// =============================================================================

/**
 * Serialize a paint value to SVG attribute string
 */
export function serializePaint(paint: Paint): string {
  switch (paint.type) {
    case 'color':
      return paint.color
    case 'gradient':
      return `url(#${paint.gradientId})`
    case 'none':
      return 'none'
    default:
      return 'none'
  }
}

// =============================================================================
// Path Serialization
// =============================================================================

/**
 * Serialize an extended path to SVG element
 */
export function serializePathExtended(path: ParsedPathExtended): string {
  const { style, commands, id, transform } = path
  const d = serializePathCommands(commands)

  const attrs: string[] = [`d="${d}"`]

  // ID
  if (id) {
    attrs.push(`id="${id}"`)
  }

  // Fill
  attrs.push(`fill="${serializePaint(style.fill)}"`)
  if (style.fill.type === 'color' && style.fill.opacity !== undefined) {
    attrs.push(`fill-opacity="${style.fill.opacity}"`)
  }

  // Fill rule
  if (style.fillRule) {
    attrs.push(`fill-rule="${style.fillRule}"`)
  }

  // Fill opacity (separate from paint opacity)
  if (style.fillOpacity !== undefined) {
    attrs.push(`fill-opacity="${style.fillOpacity}"`)
  }

  // Stroke
  if (style.stroke) {
    attrs.push(`stroke="${serializePaint(style.stroke)}"`)
    if (style.stroke.type === 'color' && style.stroke.opacity !== undefined) {
      attrs.push(`stroke-opacity="${style.stroke.opacity}"`)
    }
  }

  // Stroke properties
  if (style.strokeWidth !== undefined) {
    attrs.push(`stroke-width="${style.strokeWidth}"`)
  }
  if (style.strokeOpacity !== undefined) {
    attrs.push(`stroke-opacity="${style.strokeOpacity}"`)
  }
  if (style.strokeLinecap) {
    attrs.push(`stroke-linecap="${style.strokeLinecap}"`)
  }
  if (style.strokeLinejoin) {
    attrs.push(`stroke-linejoin="${style.strokeLinejoin}"`)
  }
  if (style.strokeMiterlimit !== undefined) {
    attrs.push(`stroke-miterlimit="${style.strokeMiterlimit}"`)
  }
  if (style.strokeDasharray && style.strokeDasharray.length > 0) {
    attrs.push(`stroke-dasharray="${style.strokeDasharray.join(' ')}"`)
  }
  if (style.strokeDashoffset !== undefined) {
    attrs.push(`stroke-dashoffset="${style.strokeDashoffset}"`)
  }

  // Opacity
  if (style.opacity !== undefined) {
    attrs.push(`opacity="${style.opacity}"`)
  }

  // Build style attribute (mix-blend-mode and CSS filter for color adjustments ONLY)
  // NOTE: For serialization, we keep SVG filter URL in separate attribute for parsing compatibility
  const styleAttrs: string[] = []
  if (style.mixBlendMode && style.mixBlendMode !== 'normal') {
    styleAttrs.push(`mix-blend-mode: ${style.mixBlendMode}`)
  }

  // CSS filter for color adjustments ONLY (brightness, contrast, etc.)
  // The SVG filter URL stays in the filter attribute below for parsing to extract
  if (style.colorAdjustments) {
    const cssFilter = buildCssFilterString(style.colorAdjustments)
    if (cssFilter) {
      styleAttrs.push(`filter: ${cssFilter}`)
    }
  }

  if (styleAttrs.length > 0) {
    attrs.push(`style="${styleAttrs.join('; ')}"`)
  }

  // SVG filter attribute - KEEP SEPARATE for parsing compatibility
  // The parser extracts filterId from filter="url(#...)" attribute
  if (style.filterId) {
    attrs.push(`filter="url(#${style.filterId})"`)
  }

  // Mask
  if (style.maskId) {
    attrs.push(`mask="url(#${style.maskId})"`)
  }

  // Clip path
  if (style.clipPathId) {
    attrs.push(`clip-path="url(#${style.clipPathId})"`)
  }

  // Color adjustments as JSON data attribute (for round-trip preservation)
  if (style.colorAdjustments) {
    attrs.push(`data-adjustments='${JSON.stringify(style.colorAdjustments)}'`)
  }

  // Transform
  if (transform) {
    attrs.push(`transform="${transform}"`)
  }

  return `<path ${attrs.join(' ')}/>`
}

/**
 * Serialize an extended path with effect group (clip/mask from SVG-only mode)
 * Applies clip-path or mask attribute based on effect groups
 * @param path - The path to serialize
 * @param pathIndex - Index of this path in the paths array
 * @param effectGroups - Effect groups for clip/hole effects
 * @param isClipPath - Whether this path is a clip path (marked with data-clip)
 * @param isHolePath - Whether this path is a hole path (marked with data-hole)
 */
export function serializePathWithEffectGroup(
  path: ParsedPathExtended,
  pathIndex: number,
  effectGroups?: SvgEffectGroup[],
  isClipPath = false,
  isHolePath = false
): string {
  const { style, commands, id, transform } = path
  const d = serializePathCommands(commands)

  const attrs: string[] = [`d="${d}"`]

  // ID
  if (id) {
    attrs.push(`id="${id}"`)
  }

  // Fill
  attrs.push(`fill="${serializePaint(style.fill)}"`)
  if (style.fill.type === 'color' && style.fill.opacity !== undefined) {
    attrs.push(`fill-opacity="${style.fill.opacity}"`)
  }

  // Fill rule
  if (style.fillRule) {
    attrs.push(`fill-rule="${style.fillRule}"`)
  }

  // Fill opacity (separate from paint opacity)
  if (style.fillOpacity !== undefined) {
    attrs.push(`fill-opacity="${style.fillOpacity}"`)
  }

  // Stroke
  if (style.stroke) {
    attrs.push(`stroke="${serializePaint(style.stroke)}"`)
    if (style.stroke.type === 'color' && style.stroke.opacity !== undefined) {
      attrs.push(`stroke-opacity="${style.stroke.opacity}"`)
    }
  }

  // Stroke properties
  if (style.strokeWidth !== undefined) {
    attrs.push(`stroke-width="${style.strokeWidth}"`)
  }
  if (style.strokeOpacity !== undefined) {
    attrs.push(`stroke-opacity="${style.strokeOpacity}"`)
  }
  if (style.strokeLinecap) {
    attrs.push(`stroke-linecap="${style.strokeLinecap}"`)
  }
  if (style.strokeLinejoin) {
    attrs.push(`stroke-linejoin="${style.strokeLinejoin}"`)
  }
  if (style.strokeMiterlimit !== undefined) {
    attrs.push(`stroke-miterlimit="${style.strokeMiterlimit}"`)
  }
  if (style.strokeDasharray && style.strokeDasharray.length > 0) {
    attrs.push(`stroke-dasharray="${style.strokeDasharray.join(' ')}"`)
  }
  if (style.strokeDashoffset !== undefined) {
    attrs.push(`stroke-dashoffset="${style.strokeDashoffset}"`)
  }

  // Opacity
  if (style.opacity !== undefined) {
    attrs.push(`opacity="${style.opacity}"`)
  }

  // Build style attribute (mix-blend-mode and CSS filter for color adjustments ONLY)
  const styleAttrs: string[] = []
  if (style.mixBlendMode && style.mixBlendMode !== 'normal') {
    styleAttrs.push(`mix-blend-mode: ${style.mixBlendMode}`)
  }

  if (style.colorAdjustments) {
    const cssFilter = buildCssFilterString(style.colorAdjustments)
    if (cssFilter) {
      styleAttrs.push(`filter: ${cssFilter}`)
    }
  }

  if (styleAttrs.length > 0) {
    attrs.push(`style="${styleAttrs.join('; ')}"`)
  }

  // SVG filter attribute
  if (style.filterId) {
    attrs.push(`filter="url(#${style.filterId})"`)
  }

  // Mask - check style first, then effect groups
  if (style.maskId) {
    attrs.push(`mask="url(#${style.maskId})"`)
  } else if (effectGroups && !style.clipPathId) {
    // Apply mask from effect group (hole) if not already masked/clipped by style
    const affectingGroup = findAffectingGroup(pathIndex, effectGroups)
    if (affectingGroup && affectingGroup.type === 'hole') {
      attrs.push(`mask="url(#${affectingGroup.defId})"`)
    }
  }

  // Clip path - check style first, then effect groups
  if (style.clipPathId) {
    attrs.push(`clip-path="url(#${style.clipPathId})"`)
  } else if (effectGroups && !style.maskId) {
    // Apply clip from effect group if not already masked/clipped by style
    const affectingGroup = findAffectingGroup(pathIndex, effectGroups)
    if (affectingGroup && affectingGroup.type === 'clip') {
      attrs.push(`clip-path="url(#${affectingGroup.defId})"`)
    }
  }

  // Color adjustments as JSON data attribute (for round-trip preservation)
  if (style.colorAdjustments) {
    attrs.push(`data-adjustments='${JSON.stringify(style.colorAdjustments)}'`)
  }

  // Mark clip/hole paths with data attributes (for round-trip preservation)
  // These paths act as effect definitions and should be restored as clip/hole when reloaded
  if (isClipPath) {
    attrs.push(`data-clip="true"`)
  }
  if (isHolePath) {
    attrs.push(`data-hole="true"`)
  }

  // Transform
  if (transform) {
    attrs.push(`transform="${transform}"`)
  }

  return `<path ${attrs.join(' ')}/>`
}

// =============================================================================
// Subpath-Aware Serialization
// =============================================================================

/**
 * Extract commands for a specific segment, ensuring first command is M (moveto)
 */
function extractSegmentCommands(commands: PathCommand[], segment: ConnectedSegment): PathCommand[] {
  const result: PathCommand[] = []

  for (let i = segment.startIndex; i <= segment.endIndex; i++) {
    const cmd = commands[i]
    if (cmd.type.toUpperCase() === 'Z') {
      // Include Z command for closed segments
      result.push({ ...cmd })
    } else if (i === segment.startIndex && cmd.type.toUpperCase() !== 'M') {
      // First command must be M - convert if necessary
      result.push({ type: 'M', x: cmd.x, y: cmd.y })
    } else {
      result.push({ ...cmd })
    }
  }

  return result
}

/**
 * Serialize a path with potential per-subpath styles
 * Returns single <path> if all subpaths have same style, multiple <path> elements if styles differ
 */
export function serializePathWithSubpaths(path: ParsedPathExtended): string {
  const styleWithSubpaths = path.style as PathStyleWithSubpaths

  // If no subpath overrides, use standard serialization
  if (!styleWithSubpaths.subpathStyles || styleWithSubpaths.subpathStyles.size === 0) {
    return serializePathExtended(path)
  }

  const segments = parseAllSegments(path.commands)

  // Check if all subpaths have the same effective style
  if (areSubpathStylesUniform(styleWithSubpaths, segments)) {
    return serializePathExtended(path)
  }

  // Different styles - split into multiple path elements
  const pathElements: string[] = []

  for (const segment of segments) {
    const segmentCommands = extractSegmentCommands(path.commands, segment)
    const override = styleWithSubpaths.subpathStyles.get(segment.startIndex)
    const effectiveStyle: PathStyle = override
      ? computeEffectiveSubpathStyle(styleWithSubpaths, override)
      : styleWithSubpaths

    // Create a path with segment commands and effective style
    // Note: transform is applied to the group wrapper, not individual paths
    const segmentPath: ParsedPathExtended = {
      ...path,
      commands: segmentCommands,
      style: effectiveStyle,
      transform: undefined, // Will be applied to group wrapper
    }

    pathElements.push(serializePathExtended(segmentPath))
  }

  // Wrap in group if transform exists
  if (path.transform && pathElements.length > 1) {
    return `<g transform="${path.transform}">\n${pathElements.join('\n')}\n</g>`
  }

  return pathElements.join('\n')
}

// =============================================================================
// Complete SVG Serialization
// =============================================================================

/**
 * Options for rebuilding SVG string
 */
export interface RebuildSvgOptions {
  /** Effect groups for clip/hole effects on other paths */
  effectGroups?: SvgEffectGroup[]
  /** Indices of paths marked as clip paths */
  clipPathIndices?: number[]
  /** Indices of paths marked as hole paths */
  holePathIndices?: number[]
}

/**
 * Rebuild complete SVG string from extended parsed data
 * Automatically handles per-subpath styling by splitting paths when needed
 * @param parsedSvg - The extended parsed SVG data
 * @param options - Options including effectGroups and clip/hole path indices
 */
export function rebuildSvgStringExtended(
  parsedSvg: ParsedSvgExtended,
  options?: RebuildSvgOptions | SvgEffectGroup[]
): string {
  const { paths, viewBox, width, height, defs } = parsedSvg

  // Handle backwards compatibility: if options is an array, treat it as effectGroups
  const opts: RebuildSvgOptions = Array.isArray(options) ? { effectGroups: options } : options || {}
  const { effectGroups, clipPathIndices = [], holePathIndices = [] } = opts

  // Create sets for fast lookup
  const clipIndicesSet = new Set(clipPathIndices)
  const holeIndicesSet = new Set(holePathIndices)

  // Build defs section including effect group definitions
  const baseDefs = serializeDefs(defs)
  const effectDefs = effectGroups ? serializeEffectGroupDefs(paths, effectGroups) : ''

  // Combine defs - if base defs exist, inject effect defs inside; otherwise create new defs block
  let defsStr = ''
  if (baseDefs && effectDefs) {
    // Insert effect defs before closing </defs> tag
    defsStr = baseDefs.replace('</defs>', `\n${effectDefs}\n</defs>`)
  } else if (baseDefs) {
    defsStr = baseDefs
  } else if (effectDefs) {
    defsStr = `<defs>\n${effectDefs}\n</defs>`
  }

  // Use subpath-aware serialization with effect group support
  const pathElements = paths
    .map((path, index) => {
      const isClipPath = clipIndicesSet.has(index)
      const isHolePath = holeIndicesSet.has(index)

      if (effectGroups && effectGroups.length > 0) {
        // Use effect group-aware serialization with clip/hole markers
        return serializePathWithEffectGroup(path, index, effectGroups, isClipPath, isHolePath)
      }
      // Fall back to standard subpath-aware serialization
      return serializePathWithSubpaths(path)
    })
    .join('\n')

  const viewBoxStr = `${formatCoord(viewBox.x)} ${formatCoord(viewBox.y)} ${formatCoord(viewBox.width)} ${formatCoord(viewBox.height)}`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxStr}" width="${formatCoord(width)}" height="${formatCoord(height)}">
${defsStr}
${pathElements}
</svg>`
}

// =============================================================================
// Overlay Serialization (Re-export)
// =============================================================================

export {
  buildOverlaySvgOutput,
  serializeClipPathOverlay,
  serializeFilterOverlay,
  serializeCombinedOverlay,
  serializeEditableSvg,
} from './overlaySerializer'
