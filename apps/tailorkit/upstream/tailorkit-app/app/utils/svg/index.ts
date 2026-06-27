/**
 * SVG utilities barrel file
 *
 * Re-exports all SVG-related utilities.
 */

export * from './parsing'
export * from './data-uri'
// Note: optimization.server.ts is server-only and should be imported directly

// VectorEditor extraction - color and effect utilities
export * from './color-matrix'
export * from './path-geometry'
export * from './gradient-parsing'
export * from './filter-parsing'
export * from './effect-groups'
