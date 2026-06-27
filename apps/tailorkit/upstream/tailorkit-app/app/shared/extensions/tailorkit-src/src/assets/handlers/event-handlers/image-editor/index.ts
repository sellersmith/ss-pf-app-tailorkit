/**
 * Image Editor Module
 *
 * This module provides a Konva-based image editor with:
 * - Drag, scale, and rotation functionality
 * - Boundary clipping
 * - Fill or crop modes
 * - Undo/redo capabilities
 * - Memory-efficient state management
 *
 * NOTE: The actual implementation (initKonvaEditor, StageManager, ImageLayer, etc.)
 * is now bundled separately in tailorkit-konva.js to reduce the main bundle size.
 * Use loadFeature('konva') from feature-loader.ts to access these at runtime.
 */

// Export types for external use (types are stripped at compile time)
export type {
  KonvaEditor,
  KonvaEditorConfig,
  KonvaEditorState,
  KonvaEditorUpdateParams,
  MinimalTransformState,
} from './types/editor-types'
