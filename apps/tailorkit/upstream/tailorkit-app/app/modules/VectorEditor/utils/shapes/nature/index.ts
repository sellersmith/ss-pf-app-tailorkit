/**
 * Nature Shapes Module - Main Entry Point
 * Exports all types and generators for nature shapes (leaves and flowers)
 */

// Types and color presets
export type { NaturePathResult, NatureShapeGenerator, LeafColorKey, FlowerColorKey, StemColorKey } from './types'

export { LEAF_COLORS, FLOWER_COLORS, STEM_COLORS } from './types'

// Leaf generators
export * from './leaves'

// Flower generators
export * from './flowers'
