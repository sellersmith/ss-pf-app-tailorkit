/* eslint-disable max-len */
/**
 * Serializes FilterPrimitive[] into SVG `<filter>` markup string.
 *
 * Extracted from VectorEditor's SVGPreviewLayer.buildDefsSection() to enable
 * reuse in the template preview generator. Handles all primitive types used by
 * path filter presets (debossing, embossing, hot-foil-stamping, laser-engraving,
 * laser-annealing).
 */

import type { FilterPrimitive } from '~/types/svg-effects'

/** Helper to serialize a light source element for feDiffuseLighting/feSpecularLighting */
function serializeLightSource(lightSource: { type: string; [key: string]: unknown } | undefined): string {
  if (!lightSource) return ''
  switch (lightSource.type) {
    case 'distantLight':
      return `<feDistantLight azimuth="${lightSource.azimuth}" elevation="${lightSource.elevation}"/>`
    case 'pointLight':
      return `<fePointLight x="${lightSource.x}" y="${lightSource.y}" z="${lightSource.z}"/>`
    case 'spotLight': {
      const attrs = [
        `x="${lightSource.x}"`,
        `y="${lightSource.y}"`,
        `z="${lightSource.z}"`,
        `pointsAtX="${lightSource.pointsAtX}"`,
        `pointsAtY="${lightSource.pointsAtY}"`,
        `pointsAtZ="${lightSource.pointsAtZ}"`,
      ]
      if (lightSource.specularExponent !== undefined) attrs.push(`specularExponent="${lightSource.specularExponent}"`)
      if (lightSource.limitingConeAngle !== undefined) {
        attrs.push(`limitingConeAngle="${lightSource.limitingConeAngle}"`)
      }
      return `<feSpotLight ${attrs.join(' ')}/>`
    }
    default:
      return ''
  }
}

/** Serialize a single FilterPrimitive to its SVG tag string */
function serializePrimitive(p: FilterPrimitive): string {
  const inAttr = (v?: string) => (v ? ` in="${v}"` : '')
  const resultAttr = (v?: string) => (v ? ` result="${v}"` : '')

  switch (p.type) {
    case 'feGaussianBlur': {
      const stdDev = Array.isArray(p.stdDeviation) ? p.stdDeviation.join(' ') : p.stdDeviation
      return `<feGaussianBlur stdDeviation="${stdDev}"${resultAttr(p.result)}${inAttr(p.in)}/>`
    }
    case 'feColorMatrix': {
      const values = Array.isArray(p.values) ? p.values.join(' ') : p.values
      return `<feColorMatrix type="${p.matrixType}"${inAttr(p.in)}${values !== undefined ? ` values="${values}"` : ''}${resultAttr(p.result)}/>`
    }
    case 'feDropShadow': {
      const stdDev = Array.isArray(p.stdDeviation) ? p.stdDeviation.join(' ') : p.stdDeviation
      return `<feDropShadow dx="${p.dx}" dy="${p.dy}" stdDeviation="${stdDev}"${p.floodColor ? ` flood-color="${p.floodColor}"` : ''}${p.floodOpacity !== undefined ? ` flood-opacity="${p.floodOpacity}"` : ''}/>`
    }
    case 'feBlend':
      return `<feBlend mode="${p.mode}"${inAttr(p.in)}${p.in2 ? ` in2="${p.in2}"` : ''}/>`
    case 'feOffset':
      return `<feOffset dx="${p.dx}" dy="${p.dy}"${resultAttr(p.result)}${inAttr(p.in)}/>`
    case 'feFlood':
      return `<feFlood flood-color="${p.floodColor}"${p.floodOpacity !== undefined ? ` flood-opacity="${p.floodOpacity}"` : ''}${resultAttr(p.result)}/>`
    case 'feComposite':
      return `<feComposite operator="${p.operator}"${inAttr(p.in)}${p.in2 ? ` in2="${p.in2}"` : ''}${resultAttr(p.result)}/>`
    case 'feMerge': {
      const nodes = p.nodes.map(n => `<feMergeNode${inAttr(n.in)}/>`).join('')
      return `<feMerge>${nodes}</feMerge>`
    }
    case 'feTurbulence': {
      const baseFreq = Array.isArray(p.baseFrequency) ? p.baseFrequency.join(' ') : p.baseFrequency
      return `<feTurbulence type="${p.turbulenceType}" baseFrequency="${baseFreq}"${p.numOctaves ? ` numOctaves="${p.numOctaves}"` : ''}${p.seed ? ` seed="${p.seed}"` : ''}${resultAttr(p.result)}/>`
    }
    case 'feDisplacementMap':
      return `<feDisplacementMap scale="${p.scale}"${inAttr(p.in)}${p.in2 ? ` in2="${p.in2}"` : ''}${p.xChannelSelector ? ` xChannelSelector="${p.xChannelSelector}"` : ''}${p.yChannelSelector ? ` yChannelSelector="${p.yChannelSelector}"` : ''}${resultAttr(p.result)}/>`
    case 'feDiffuseLighting': {
      const attrs: string[] = []
      if (p.in) attrs.push(`in="${p.in}"`)
      if (p.surfaceScale !== undefined) attrs.push(`surfaceScale="${p.surfaceScale}"`)
      if (p.diffuseConstant !== undefined) attrs.push(`diffuseConstant="${p.diffuseConstant}"`)
      if (p.lightingColor) attrs.push(`lighting-color="${p.lightingColor}"`)
      if (p.result) attrs.push(`result="${p.result}"`)
      return `<feDiffuseLighting ${attrs.join(' ')}>${serializeLightSource(p.lightSource)}</feDiffuseLighting>`
    }
    case 'feSpecularLighting': {
      const attrs: string[] = []
      if (p.in) attrs.push(`in="${p.in}"`)
      if (p.surfaceScale !== undefined) attrs.push(`surfaceScale="${p.surfaceScale}"`)
      if (p.specularConstant !== undefined) attrs.push(`specularConstant="${p.specularConstant}"`)
      if (p.specularExponent !== undefined) attrs.push(`specularExponent="${p.specularExponent}"`)
      if (p.lightingColor) attrs.push(`lighting-color="${p.lightingColor}"`)
      if (p.result) attrs.push(`result="${p.result}"`)
      return `<feSpecularLighting ${attrs.join(' ')}>${serializeLightSource(p.lightSource)}</feSpecularLighting>`
    }
    case 'feMorphology': {
      const radius = Array.isArray(p.radius) ? p.radius.join(' ') : p.radius
      return `<feMorphology operator="${p.operator}" radius="${radius}"${inAttr(p.in)}${resultAttr(p.result)}/>`
    }
    default:
      return ''
  }
}

/**
 * Serialize an array of FilterPrimitive[] into a complete SVG `<filter>` element string.
 *
 * @param filterId - The filter element ID (referenced via `filter="url(#id)"`)
 * @param primitives - Array of filter primitives from `buildPathFilterPrimitives()`
 * @returns SVG `<filter>` element string ready for injection into `<defs>`
 */
export function serializeSvgFilter(filterId: string, primitives: FilterPrimitive[], presetId?: string): string {
  const content = primitives.map(serializePrimitive).join('')
  const presetAttr = presetId ? ` data-preset-id="${presetId}"` : ''
  return `<filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%"${presetAttr}>${content}</filter>`
}
