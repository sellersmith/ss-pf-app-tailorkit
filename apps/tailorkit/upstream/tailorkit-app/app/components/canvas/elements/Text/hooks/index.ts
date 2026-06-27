/**
 * Custom hooks for KonvaTextPath component
 *
 * This file provides a centralized export for all text-related custom hooks,
 * enabling better code organization and reusability across the application.
 */

export { useAutoTextScale } from './useTextScaling'
export { usePathGeometry } from './usePathGeometry'
export { useCircleAnchors } from './useCircleAnchors'
export { useCurveAnchors } from './useCurveAnchors'
export { useKonvaTextSelectors } from './useKonvaTextSelectors'
export { usePerformanceMonitoring, useOperationPerformance } from './usePerformanceMonitoring'
export { useTextEffectsRenderer } from './useTextEffectsRenderer'
export { useSVGTextEffects } from './useSVGTextEffects'
export { usePaintsLoader } from './usePaintLoader'
export type { LoadedImage, UsePaintLoaderResult } from './usePaintLoader'
export { calculateSafeRadius, validateGeometryParams, isValidTextPathGeometry } from './utils'

/**
 * Example usage:
 *
 * ```typescript
 * import {
 *   usePathGeometry,
 *   useCircleAnchors,
 *   useKonvaTextSelectors,
 *   usePerformanceMonitoring
 * } from './hooks'
 *
 * // In your component:
 * const { isSelected, scale, isAnchorDragging } = useKonvaTextSelectors({ componentId })
 * const { fullCirclePath, textPath } = usePathGeometry({ width, height, ... })
 * const { anchorsJSX } = useCircleAnchors({ width, height, ... })
 * usePerformanceMonitoring({ componentName: 'MyComponent', componentId })
 * ```
 */
