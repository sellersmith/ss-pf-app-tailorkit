/**
 * Common Objects Types
 * Types for multi-path composite objects
 */

import type { PathCommand } from '../../svg'

/**
 * Result of a composite object shape generator
 */
export interface ObjectPathResult {
  id: string
  name: string
  commands: PathCommand[]
  fill: string
  stroke: string
  strokeWidth: number
  zIndex: number
}

/**
 * Object shape generator function type
 */
export type ObjectShapeGenerator = (cx: number, cy: number, width: number, height: number) => ObjectPathResult[]

/**
 * Common object color presets
 */
export const OBJECT_COLORS = {
  // Sports equipment
  sports: {
    ball: { fill: '#FF9800', stroke: '#E65100' },
    basketball: { fill: '#FF5722', stroke: '#BF360C', lines: '#3E2723' },
    soccer: { fill: '#FFFFFF', stroke: '#424242', panels: '#212121' },
    tennis: { fill: '#CDDC39', stroke: '#827717', seam: '#FFFFFF' },
  },
  // Vehicles
  vehicles: {
    body: { fill: '#2196F3', stroke: '#0D47A1' },
    wheel: { fill: '#424242', stroke: '#212121', rim: '#9E9E9E' },
    window: { fill: '#B3E5FC', stroke: '#0288D1' },
    chrome: { fill: '#E0E0E0', stroke: '#9E9E9E' },
  },
  // Stationery
  stationery: {
    pencil: { body: '#FFC107', tip: '#795548', eraser: '#E91E63', metal: '#9E9E9E' },
    pen: { body: '#1565C0', clip: '#90CAF9', tip: '#212121' },
    eraser: { fill: '#E91E63', stroke: '#AD1457' },
    ruler: { fill: '#FFF9C4', stroke: '#F9A825', marks: '#212121' },
  },
  // Furniture
  furniture: {
    wood: { fill: '#8D6E63', stroke: '#5D4037' },
    fabric: { fill: '#7986CB', stroke: '#3949AB' },
    metal: { fill: '#78909C', stroke: '#455A64' },
  },
  // Containers
  containers: {
    glass: { fill: '#E3F2FD', stroke: '#1976D2', liquid: '#2196F3' },
    ceramic: { fill: '#ECEFF1', stroke: '#546E7A' },
    plastic: { fill: '#B2DFDB', stroke: '#00796B' },
    bottle: { fill: '#E3F2FD', stroke: '#90CAF9' },
    jar: { fill: '#FFF8E1', stroke: '#FFB74D', lid: '#8D6E63' },
    box: { fill: '#D7CCC8', stroke: '#8D6E63', flap: '#BCAAA4' },
  },
  // Electronics
  electronics: {
    screen: { fill: '#263238', stroke: '#37474F', display: '#4FC3F7' },
    body: { fill: '#ECEFF1', stroke: '#90A4AE' },
    button: { fill: '#424242', stroke: '#212121' },
    laptop: { fill: '#78909C', stroke: '#455A64' },
    headphones: { fill: '#212121', stroke: '#000000' },
    camera: { fill: '#263238', stroke: '#1A1A1A' },
  },
} as const
