/**
 * Filter Parsing Utilities
 * Parse SVG filter definitions from SVG strings
 */

import type {
  FilterDef,
  FilterPrimitive,
  FeGaussianBlur,
  FeColorMatrix,
  FeDropShadow,
  FeBlend,
  FeOffset,
  FeFlood,
  FeComposite,
  FeMerge,
  FeMergeNode,
  FeTurbulence,
  FeDisplacementMap,
  FeComponentTransfer,
  FeComponentTransferFunc,
  FeConvolveMatrix,
  BlendMode,
  ColorMatrixType,
  CompositeOperator,
  TurbulenceType,
  ComponentTransferType,
} from '../types/effects'
import { getPathFilterPresetById, buildPathFilterPrimitives } from '../../filters/pathFilterPresets'

/**
 * Parse common filter primitive attributes
 */
function parseBaseAttributes(element: string): {
  result?: string
  in?: string
  x?: string
  y?: string
  width?: string
  height?: string
} {
  const resultMatch = element.match(/result="([^"]*)"/i)
  const inMatch = element.match(/\sin="([^"]*)"/i)
  const xMatch = element.match(/\sx="([^"]*)"/i)
  const yMatch = element.match(/\sy="([^"]*)"/i)
  const widthMatch = element.match(/width="([^"]*)"/i)
  const heightMatch = element.match(/height="([^"]*)"/i)

  return {
    result: resultMatch ? resultMatch[1] : undefined,
    in: inMatch ? inMatch[1] : undefined,
    x: xMatch ? xMatch[1] : undefined,
    y: yMatch ? yMatch[1] : undefined,
    width: widthMatch ? widthMatch[1] : undefined,
    height: heightMatch ? heightMatch[1] : undefined,
  }
}

/**
 * Parse feGaussianBlur element
 */
function parseFeGaussianBlur(element: string): FeGaussianBlur | null {
  const stdDeviationMatch = element.match(/stdDeviation="([^"]*)"/i)
  if (!stdDeviationMatch) return null

  const stdDeviationStr = stdDeviationMatch[1]
  const parts = stdDeviationStr.split(/[\s,]+/).map(Number)
  const stdDeviation = parts.length === 2 ? ([parts[0], parts[1]] as [number, number]) : parts[0]

  const edgeModeMatch = element.match(/edgeMode="([^"]*)"/i)
  const edgeMode = edgeModeMatch ? (edgeModeMatch[1] as 'duplicate' | 'wrap' | 'none') : undefined

  const base = parseBaseAttributes(element)

  return {
    type: 'feGaussianBlur',
    stdDeviation,
    edgeMode,
    ...base,
  }
}

/**
 * Parse feColorMatrix element
 */
function parseFeColorMatrix(element: string): FeColorMatrix | null {
  const typeMatch = element.match(/type="([^"]*)"/i)
  const matrixType = typeMatch ? (typeMatch[1] as ColorMatrixType) : 'matrix'

  const valuesMatch = element.match(/values="([^"]*)"/i)
  let values: number[] | number | undefined

  if (valuesMatch) {
    const valuesStr = valuesMatch[1]
    if (matrixType === 'matrix') {
      values = valuesStr.split(/[\s,]+/).map(Number)
    } else {
      values = parseFloat(valuesStr)
    }
  }

  const base = parseBaseAttributes(element)

  return {
    type: 'feColorMatrix',
    matrixType,
    values,
    ...base,
  }
}

/**
 * Parse feDropShadow element
 */
function parseFeDropShadow(element: string): FeDropShadow | null {
  const dxMatch = element.match(/dx="([^"]*)"/i)
  const dyMatch = element.match(/dy="([^"]*)"/i)
  const stdDeviationMatch = element.match(/stdDeviation="([^"]*)"/i)

  const dx = dxMatch ? parseFloat(dxMatch[1]) : 0
  const dy = dyMatch ? parseFloat(dyMatch[1]) : 0

  let stdDeviation: number | [number, number] = 0
  if (stdDeviationMatch) {
    const parts = stdDeviationMatch[1].split(/[\s,]+/).map(Number)
    stdDeviation = parts.length === 2 ? ([parts[0], parts[1]] as [number, number]) : parts[0]
  }

  const floodColorMatch = element.match(/flood-color="([^"]*)"/i)
  const floodColor = floodColorMatch ? floodColorMatch[1] : undefined

  const floodOpacityMatch = element.match(/flood-opacity="([^"]*)"/i)
  const floodOpacity = floodOpacityMatch ? parseFloat(floodOpacityMatch[1]) : undefined

  const base = parseBaseAttributes(element)

  return {
    type: 'feDropShadow',
    dx,
    dy,
    stdDeviation,
    floodColor,
    floodOpacity,
    ...base,
  }
}

/**
 * Parse feBlend element
 */
function parseFeBlend(element: string): FeBlend | null {
  const modeMatch = element.match(/mode="([^"]*)"/i)
  const mode = modeMatch ? (modeMatch[1] as BlendMode) : 'normal'

  const in2Match = element.match(/in2="([^"]*)"/i)
  const in2 = in2Match ? in2Match[1] : undefined

  const base = parseBaseAttributes(element)

  return {
    type: 'feBlend',
    mode,
    in2,
    ...base,
  }
}

/**
 * Parse feOffset element
 */
function parseFeOffset(element: string): FeOffset | null {
  const dxMatch = element.match(/dx="([^"]*)"/i)
  const dyMatch = element.match(/dy="([^"]*)"/i)

  const dx = dxMatch ? parseFloat(dxMatch[1]) : 0
  const dy = dyMatch ? parseFloat(dyMatch[1]) : 0

  const base = parseBaseAttributes(element)

  return {
    type: 'feOffset',
    dx,
    dy,
    ...base,
  }
}

/**
 * Parse feFlood element
 */
function parseFeFlood(element: string): FeFlood | null {
  const floodColorMatch = element.match(/flood-color="([^"]*)"/i)
  const floodColor = floodColorMatch ? floodColorMatch[1] : '#000000'

  const floodOpacityMatch = element.match(/flood-opacity="([^"]*)"/i)
  const floodOpacity = floodOpacityMatch ? parseFloat(floodOpacityMatch[1]) : undefined

  const base = parseBaseAttributes(element)

  return {
    type: 'feFlood',
    floodColor,
    floodOpacity,
    ...base,
  }
}

/**
 * Parse feComposite element
 */
function parseFeComposite(element: string): FeComposite | null {
  const operatorMatch = element.match(/operator="([^"]*)"/i)
  const operator = operatorMatch ? (operatorMatch[1] as CompositeOperator) : 'over'

  const in2Match = element.match(/in2="([^"]*)"/i)
  const in2 = in2Match ? in2Match[1] : undefined

  const k1Match = element.match(/k1="([^"]*)"/i)
  const k2Match = element.match(/k2="([^"]*)"/i)
  const k3Match = element.match(/k3="([^"]*)"/i)
  const k4Match = element.match(/k4="([^"]*)"/i)

  const base = parseBaseAttributes(element)

  return {
    type: 'feComposite',
    operator,
    in2,
    k1: k1Match ? parseFloat(k1Match[1]) : undefined,
    k2: k2Match ? parseFloat(k2Match[1]) : undefined,
    k3: k3Match ? parseFloat(k3Match[1]) : undefined,
    k4: k4Match ? parseFloat(k4Match[1]) : undefined,
    ...base,
  }
}

/**
 * Parse feMerge element
 */
function parseFeMerge(element: string): FeMerge | null {
  const nodes: FeMergeNode[] = []
  const nodeRegex = /<feMergeNode[^>]*\/?>/gi
  let match: RegExpExecArray | null

  while ((match = nodeRegex.exec(element)) !== null) {
    const inMatch = match[0].match(/in="([^"]*)"/i)
    nodes.push({
      in: inMatch ? inMatch[1] : undefined,
    })
  }

  const base = parseBaseAttributes(element)

  return {
    type: 'feMerge',
    nodes,
    ...base,
  }
}

/**
 * Parse feTurbulence element
 */
function parseFeTurbulence(element: string): FeTurbulence | null {
  const typeMatch = element.match(/type="([^"]*)"/i)
  const turbulenceType = typeMatch ? (typeMatch[1] as TurbulenceType) : 'turbulence'

  const baseFrequencyMatch = element.match(/baseFrequency="([^"]*)"/i)
  let baseFrequency: number | [number, number] = 0
  if (baseFrequencyMatch) {
    const parts = baseFrequencyMatch[1].split(/[\s,]+/).map(Number)
    baseFrequency = parts.length === 2 ? ([parts[0], parts[1]] as [number, number]) : parts[0]
  }

  const numOctavesMatch = element.match(/numOctaves="([^"]*)"/i)
  const numOctaves = numOctavesMatch ? parseInt(numOctavesMatch[1], 10) : undefined

  const seedMatch = element.match(/seed="([^"]*)"/i)
  const seed = seedMatch ? parseInt(seedMatch[1], 10) : undefined

  const stitchTilesMatch = element.match(/stitchTiles="([^"]*)"/i)
  const stitchTiles = stitchTilesMatch ? (stitchTilesMatch[1] as 'stitch' | 'noStitch') : undefined

  const base = parseBaseAttributes(element)

  return {
    type: 'feTurbulence',
    turbulenceType,
    baseFrequency,
    numOctaves,
    seed,
    stitchTiles,
    ...base,
  }
}

/**
 * Parse feDisplacementMap element
 */
function parseFeDisplacementMap(element: string): FeDisplacementMap | null {
  const scaleMatch = element.match(/scale="([^"]*)"/i)
  const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 0

  const in2Match = element.match(/in2="([^"]*)"/i)
  const in2 = in2Match ? in2Match[1] : undefined

  const xChannelMatch = element.match(/xChannelSelector="([^"]*)"/i)
  const xChannelSelector = xChannelMatch ? (xChannelMatch[1] as 'R' | 'G' | 'B' | 'A') : undefined

  const yChannelMatch = element.match(/yChannelSelector="([^"]*)"/i)
  const yChannelSelector = yChannelMatch ? (yChannelMatch[1] as 'R' | 'G' | 'B' | 'A') : undefined

  const base = parseBaseAttributes(element)

  return {
    type: 'feDisplacementMap',
    scale,
    in2,
    xChannelSelector,
    yChannelSelector,
    ...base,
  }
}

/**
 * Parse a single feFunc element (feFuncR, feFuncG, feFuncB, feFuncA)
 */
function parseFeFuncElement(element: string): FeComponentTransferFunc | null {
  const typeMatch = element.match(/type="([^"]*)"/i)
  if (!typeMatch) return null

  const funcType = typeMatch[1] as ComponentTransferType

  const func: FeComponentTransferFunc = { type: funcType }

  // Parse tableValues for 'table' and 'discrete' types
  const tableValuesMatch = element.match(/tableValues="([^"]*)"/i)
  if (tableValuesMatch) {
    func.tableValues = tableValuesMatch[1].split(/[\s,]+/).map(Number)
  }

  // Parse slope and intercept for 'linear' type
  const slopeMatch = element.match(/slope="([^"]*)"/i)
  if (slopeMatch) {
    func.slope = parseFloat(slopeMatch[1])
  }

  const interceptMatch = element.match(/intercept="([^"]*)"/i)
  if (interceptMatch) {
    func.intercept = parseFloat(interceptMatch[1])
  }

  // Parse amplitude, exponent, offset for 'gamma' type
  const amplitudeMatch = element.match(/amplitude="([^"]*)"/i)
  if (amplitudeMatch) {
    func.amplitude = parseFloat(amplitudeMatch[1])
  }

  const exponentMatch = element.match(/exponent="([^"]*)"/i)
  if (exponentMatch) {
    func.exponent = parseFloat(exponentMatch[1])
  }

  const offsetMatch = element.match(/offset="([^"]*)"/i)
  if (offsetMatch) {
    func.offset = parseFloat(offsetMatch[1])
  }

  return func
}

/**
 * Parse feComponentTransfer element
 */
function parseFeComponentTransfer(element: string): FeComponentTransfer | null {
  const base = parseBaseAttributes(element)

  const result: FeComponentTransfer = {
    type: 'feComponentTransfer',
    ...base,
  }

  // Parse feFuncR
  const funcRMatch = element.match(/<feFuncR[^>]*\/?>/i)
  if (funcRMatch) {
    result.funcR = parseFeFuncElement(funcRMatch[0]) ?? undefined
  }

  // Parse feFuncG
  const funcGMatch = element.match(/<feFuncG[^>]*\/?>/i)
  if (funcGMatch) {
    result.funcG = parseFeFuncElement(funcGMatch[0]) ?? undefined
  }

  // Parse feFuncB
  const funcBMatch = element.match(/<feFuncB[^>]*\/?>/i)
  if (funcBMatch) {
    result.funcB = parseFeFuncElement(funcBMatch[0]) ?? undefined
  }

  // Parse feFuncA
  const funcAMatch = element.match(/<feFuncA[^>]*\/?>/i)
  if (funcAMatch) {
    result.funcA = parseFeFuncElement(funcAMatch[0]) ?? undefined
  }

  return result
}

/**
 * Parse feConvolveMatrix element
 */
function parseFeConvolveMatrix(element: string): FeConvolveMatrix | null {
  // Parse order - required for kernelMatrix size
  const orderMatch = element.match(/order="([^"]*)"/i)
  let order: number | [number, number] = 3 // Default 3x3
  if (orderMatch) {
    const parts = orderMatch[1].split(/[\s,]+/).map(Number)
    order = parts.length === 2 ? ([parts[0], parts[1]] as [number, number]) : parts[0]
  }

  // Parse kernelMatrix - required
  const kernelMatrixMatch = element.match(/kernelMatrix="([^"]*)"/i)
  if (!kernelMatrixMatch) return null
  const kernelMatrix = kernelMatrixMatch[1].split(/[\s,]+/).map(Number)

  // Parse divisor
  const divisorMatch = element.match(/divisor="([^"]*)"/i)
  const divisor = divisorMatch ? parseFloat(divisorMatch[1]) : undefined

  // Parse bias
  const biasMatch = element.match(/bias="([^"]*)"/i)
  const bias = biasMatch ? parseFloat(biasMatch[1]) : undefined

  // Parse targetX
  const targetXMatch = element.match(/targetX="([^"]*)"/i)
  const targetX = targetXMatch ? parseInt(targetXMatch[1], 10) : undefined

  // Parse targetY
  const targetYMatch = element.match(/targetY="([^"]*)"/i)
  const targetY = targetYMatch ? parseInt(targetYMatch[1], 10) : undefined

  // Parse edgeMode
  const edgeModeMatch = element.match(/edgeMode="([^"]*)"/i)
  const edgeMode = edgeModeMatch ? (edgeModeMatch[1] as 'duplicate' | 'wrap' | 'none') : undefined

  // Parse preserveAlpha
  const preserveAlphaMatch = element.match(/preserveAlpha="([^"]*)"/i)
  const preserveAlpha = preserveAlphaMatch ? preserveAlphaMatch[1] === 'true' : undefined

  const base = parseBaseAttributes(element)

  return {
    type: 'feConvolveMatrix',
    order,
    kernelMatrix,
    divisor,
    bias,
    targetX,
    targetY,
    edgeMode,
    preserveAlpha,
    ...base,
  }
}

/**
 * Parse a single filter primitive element
 */
export function parseFilterPrimitive(element: string, tagName: string): FilterPrimitive | null {
  switch (tagName.toLowerCase()) {
    case 'fegaussianblur':
      return parseFeGaussianBlur(element)
    case 'fecolormatrix':
      return parseFeColorMatrix(element)
    case 'fedropshadow':
      return parseFeDropShadow(element)
    case 'feblend':
      return parseFeBlend(element)
    case 'feoffset':
      return parseFeOffset(element)
    case 'feflood':
      return parseFeFlood(element)
    case 'fecomposite':
      return parseFeComposite(element)
    case 'femerge':
      return parseFeMerge(element)
    case 'feturbulence':
      return parseFeTurbulence(element)
    case 'fedisplacementmap':
      return parseFeDisplacementMap(element)
    case 'fecomponenttransfer':
      return parseFeComponentTransfer(element)
    case 'feconvolvematrix':
      return parseFeConvolveMatrix(element)
    default:
      return null
  }
}

/**
 * Parse a complete filter element
 */
function parseFilter(filterElement: string): FilterDef | null {
  // Extract id
  const idMatch = filterElement.match(/id="([^"]*)"/i)
  if (!idMatch) return null

  const id = idMatch[1]

  // Extract filter attributes
  const filterUnitsMatch = filterElement.match(/filterUnits="([^"]*)"/i)
  const filterUnits = filterUnitsMatch ? (filterUnitsMatch[1] as 'userSpaceOnUse' | 'objectBoundingBox') : undefined

  const primitiveUnitsMatch = filterElement.match(/primitiveUnits="([^"]*)"/i)
  const primitiveUnits = primitiveUnitsMatch
    ? (primitiveUnitsMatch[1] as 'userSpaceOnUse' | 'objectBoundingBox')
    : undefined

  const xMatch = filterElement.match(/\sx="([^"]*)"/i)
  const yMatch = filterElement.match(/\sy="([^"]*)"/i)
  const widthMatch = filterElement.match(/width="([^"]*)"/i)
  const heightMatch = filterElement.match(/height="([^"]*)"/i)

  // Extract preset metadata (used to restore UI state when reopening editor)
  const presetIdMatch = filterElement.match(/data-preset-id="([^"]*)"/i)
  const presetId = presetIdMatch ? presetIdMatch[1] : undefined

  const presetParamsMatch = filterElement.match(/data-preset-params="([^"]*)"/i)
  let presetParams: Record<string, number> | undefined
  if (presetParamsMatch) {
    try {
      // Unescape HTML entities (quotes are escaped as &quot;)
      const unescapedJson = presetParamsMatch[1].replace(/&quot;/g, '"')
      presetParams = JSON.parse(unescapedJson)
    } catch {
      // Invalid JSON, ignore preset params
      presetParams = undefined
    }
  }

  // Parse all filter primitives
  const primitives: FilterPrimitive[] = []
  const primitiveTagNames = [
    'feGaussianBlur',
    'feColorMatrix',
    'feDropShadow',
    'feBlend',
    'feOffset',
    'feFlood',
    'feComposite',
    'feMerge',
    'feTurbulence',
    'feDisplacementMap',
    'feDiffuseLighting',
    'feSpecularLighting',
    'feComponentTransfer',
    'feConvolveMatrix',
  ]

  for (const tagName of primitiveTagNames) {
    const regex = new RegExp(`<${tagName}[^>]*(?:\\/>|>[\\s\\S]*?<\\/${tagName}>)`, 'gi')
    let match: RegExpExecArray | null

    while ((match = regex.exec(filterElement)) !== null) {
      const primitive = parseFilterPrimitive(match[0], tagName)
      if (primitive) {
        primitives.push(primitive)
      }
    }
  }

  // If this filter has a preset, rebuild primitives from preset params
  // This ensures the filter renders correctly with dynamic primitives
  // (e.g., edgeDistortion adds/removes primitives based on its value)
  let finalPrimitives = primitives
  if (presetId) {
    const preset = getPathFilterPresetById(presetId)
    if (preset) {
      finalPrimitives = buildPathFilterPrimitives(preset, presetParams)
    }
  }

  return {
    id,
    filterUnits,
    primitiveUnits,
    x: xMatch ? xMatch[1] : undefined,
    y: yMatch ? yMatch[1] : undefined,
    width: widthMatch ? widthMatch[1] : undefined,
    height: heightMatch ? heightMatch[1] : undefined,
    primitives: finalPrimitives,
    presetId,
    presetParams,
  }
}

/**
 * Extract all filters from an SVG string
 */
export function extractFilters(svgString: string): Map<string, FilterDef> {
  const filters = new Map<string, FilterDef>()

  // Match filter elements (including self-closing and with content)
  const filterRegex = /<filter[^>]*(?:\/>|>[\s\S]*?<\/filter>)/gi
  let match: RegExpExecArray | null

  while ((match = filterRegex.exec(svgString)) !== null) {
    const filter = parseFilter(match[0])
    if (filter) {
      filters.set(filter.id, filter)
    }
  }

  return filters
}

/**
 * Check if a filter value is a filter reference
 */
export function isFilterReference(value: string): boolean {
  return value.startsWith('url(#') && value.endsWith(')')
}

/**
 * Extract filter ID from a url() reference
 */
export function extractFilterId(value: string): string | null {
  const match = value.match(/url\(#([^)]+)\)/)
  return match ? match[1] : null
}
