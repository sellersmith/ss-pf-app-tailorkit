/**
 * Feature Loader Type Definitions
 *
 * Type definitions for all lazy-loaded feature modules.
 * Each feature module must implement BaseFeatureModule.
 */

import type { KonvaCanvasManager as KonvaCanvasManagerType } from '../../shared/libraries/konva/core/konva-canvas-manager'
import type Konva from 'konva'
import type { TransformerConfig } from 'konva/lib/shapes/Transformer'
import type { KonvaEditor, KonvaEditorConfig } from '../handlers/event-handlers/image-editor/types/editor-types'
import type { StorefrontInteractiveCanvasManager as StorefrontInteractiveCanvasManagerType } from './storefront-interactive-canvas-manager'

// ============================================================================
// Base Types
// ============================================================================

/**
 * Base interface all feature modules must implement
 */
export interface BaseFeatureModule {
  ready: boolean
}

/**
 * Feature configuration for the registry
 */
export interface FeatureConfig {
  /** Feature name (used as key) */
  name: string
  /** Script filename for storefront (e.g., 'tailorkit-konva.js') */
  scriptName: string
  /** Window property key (e.g., 'TailorKitKonva') */
  windowKey: string
  /** Custom event name when feature is ready */
  readyEvent: string
}

// ============================================================================
// Konva Feature Types
// ============================================================================

/**
 * Type for the initKonvaEditor function
 */
export type InitKonvaEditorFn = (
  containerId: string,
  imageElement: HTMLImageElement,
  config: KonvaEditorConfig,
  transformerConfig?: Partial<TransformerConfig>
) => Promise<KonvaEditor>

/**
 * Konva feature module interface
 */
export interface KonvaFeatureModule extends BaseFeatureModule {
  Konva: typeof Konva
  KonvaCanvasManager: typeof KonvaCanvasManagerType
  initKonvaEditor: InitKonvaEditorFn
  /** Interactive canvas manager — included in konva bundle to share ONE Konva instance. */
  StorefrontInteractiveCanvasManager: typeof StorefrontInteractiveCanvasManagerType
}

// ============================================================================
// Pinch-Zoom Feature Types
// ============================================================================

/**
 * Pinch-zoom feature module interface
 * This feature primarily registers a web component, so the module API is minimal
 */
export interface PinchZoomFeatureModule extends BaseFeatureModule {
  TailorKitZoom?: unknown
  getZoomSettings?: () => { enabled: boolean; showIndicator: boolean }
  removeThemeZoom?: () => void
}

// ============================================================================
// Charm-Builder Feature Types
// ============================================================================

/**
 * Charm-builder feature module interface
 * Provides charm picker registration and charm layer rendering for storefront
 */
export interface CharmBuilderFeatureModule extends BaseFeatureModule {
  registerCharmPickerElement: () => void
  renderCharmNodeLayer: (ctx: any, layer: any) => Promise<void>
  CHARM_CHANGE_EVENT: string
  /** Get per-slot product ID assignments (FIXED mode). Returns empty array if not available. */
  getSlotAssignments: (layerId: string) => (string | null)[]
  /** Get per-instance FREE mode positions. Returns empty array if not available. */
  getFreeModePositions: (layerId: string) => Array<{ pid: string; x: number; y: number; r: number; s: number }>
  /** Free a specific slot in the cache (called by deleteLayer for precise slot removal). */
  freeSlotInCache: (layerId: string, slotIdx: number) => void
}

// ============================================================================
// Feature Name Union Type
// ============================================================================

/**
 * Union type of all available feature names
 */
export type FeatureName = 'konva' | 'pinch-zoom' | 'charm-builder'

/**
 * Map feature names to their module types
 */
export type FeatureModuleMap = {
  konva: KonvaFeatureModule
  'pinch-zoom': PinchZoomFeatureModule
  'charm-builder': CharmBuilderFeatureModule
}
