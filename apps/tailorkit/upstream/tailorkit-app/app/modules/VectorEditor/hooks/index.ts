/**
 * VectorEditor Hooks - Barrel Export
 */

// Core hooks
export { useEditorHistory } from './useEditorHistory'
export { useViewport } from './useViewport'
export { useKeyboardShortcuts } from './useKeyboardShortcuts'
export { useSvgLoader } from './useSvgLoader'
export { useEffectsManager } from './useEffectsManager'
export { useLayerOrdering } from './useLayerOrdering'
export { default as useTouchGestures } from './useTouchGestures'
export { useImageTracing } from './useImageTracing'

// Edit mode settings hooks
export { useEditModeSettings } from './useEditModeSettings'
export { useGridSettings } from './useGridSettings'
export { useGuidelines } from './useGuidelines'

// Types
export type { UseEffectsManagerOptions, UseEffectsManagerReturn } from './useEffectsManager'
export type { UseLayerOrderingProps } from './useLayerOrdering'
export type { UseEditModeSettingsReturn } from './useEditModeSettings'
export type { UseGridSettingsReturn } from './useGridSettings'
export type { UseGuidelinesReturn } from './useGuidelines'
