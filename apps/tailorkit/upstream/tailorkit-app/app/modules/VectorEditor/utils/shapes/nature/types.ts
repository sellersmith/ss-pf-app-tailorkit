/**
 * Nature Shapes Types and Color Presets
 * Types and color configurations for leaves and flowers
 */

import type { PathCommand } from '../../svg'

/**
 * Result of a composite nature shape generator
 */
export interface NaturePathResult {
  id: string
  name: string
  commands: PathCommand[]
  fill: string
  stroke: string
  strokeWidth: number
  zIndex: number
}

/**
 * Nature shape generator function type
 */
export type NatureShapeGenerator = (cx: number, cy: number, width: number, height: number) => NaturePathResult[]

/**
 * Leaf color presets
 */
export const LEAF_COLORS = {
  green: {
    fill: '#4CAF50',
    stroke: '#2E7D32',
    vein: '#388E3C',
  },
  darkGreen: {
    fill: '#2E7D32',
    stroke: '#1B5E20',
    vein: '#1B5E20',
  },
  lightGreen: {
    fill: '#8BC34A',
    stroke: '#558B2F',
    vein: '#689F38',
  },
  autumn: {
    fill: '#FF9800',
    stroke: '#E65100',
    vein: '#F57C00',
  },
  autumnRed: {
    fill: '#F44336',
    stroke: '#C62828',
    vein: '#D32F2F',
  },
  autumnYellow: {
    fill: '#FFC107',
    stroke: '#FF8F00',
    vein: '#FFA000',
  },
  tropical: {
    fill: '#00BFA5',
    stroke: '#00897B',
    vein: '#009688',
  },
} as const

/**
 * Flower color presets
 */
export const FLOWER_COLORS = {
  red: {
    petal: '#F44336',
    petalStroke: '#C62828',
    center: '#FFEB3B',
    centerStroke: '#F9A825',
  },
  pink: {
    petal: '#E91E63',
    petalStroke: '#AD1457',
    center: '#FFEB3B',
    centerStroke: '#F9A825',
  },
  yellow: {
    petal: '#FFEB3B',
    petalStroke: '#F9A825',
    center: '#795548',
    centerStroke: '#5D4037',
  },
  white: {
    petal: '#FFFFFF',
    petalStroke: '#E0E0E0',
    center: '#FFEB3B',
    centerStroke: '#F9A825',
  },
  purple: {
    petal: '#9C27B0',
    petalStroke: '#6A1B9A',
    center: '#FFEB3B',
    centerStroke: '#F9A825',
  },
  orange: {
    petal: '#FF9800',
    petalStroke: '#E65100',
    center: '#795548',
    centerStroke: '#5D4037',
  },
  blue: {
    petal: '#2196F3',
    petalStroke: '#1565C0',
    center: '#FFEB3B',
    centerStroke: '#F9A825',
  },
  cherryBlossom: {
    petal: '#FFCDD2',
    petalStroke: '#F48FB1',
    center: '#FFEB3B',
    centerStroke: '#F9A825',
  },
  lotus: {
    petal: '#F8BBD9',
    petalStroke: '#F06292',
    center: '#FFEB3B',
    centerStroke: '#FFC107',
  },
} as const

/**
 * Stem color presets
 */
export const STEM_COLORS = {
  green: {
    fill: '#4CAF50',
    stroke: '#2E7D32',
  },
  brown: {
    fill: '#795548',
    stroke: '#5D4037',
  },
} as const

export type LeafColorKey = keyof typeof LEAF_COLORS
export type FlowerColorKey = keyof typeof FLOWER_COLORS
export type StemColorKey = keyof typeof STEM_COLORS
