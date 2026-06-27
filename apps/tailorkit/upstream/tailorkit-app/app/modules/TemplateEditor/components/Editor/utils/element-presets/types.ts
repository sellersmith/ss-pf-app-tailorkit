/**
 * Shared types for all element presets (text + image).
 * Preset functions return config objects — callers are responsible for element creation.
 */

import type { EffectConfig } from '~/modules/TemplateEditor/elements/effects/types'
import type { TextSettings } from '~/types/psd'

// ============================================================================
// Shared
// ============================================================================

/** Post-action instructing the caller which personalization panel to open */
export interface PostAction {
  type:
    | 'open-personalize-text'
    | 'open-personalize-color'
    | 'open-personalize-font'
    | 'open-personalize-image'
    | 'open-personalize-mask'
  config: Record<string, unknown>
}

// ============================================================================
// Text presets
// ============================================================================

/** Single element config produced by a text preset */
export interface TextPresetElementConfig {
  /** Text settings passed to createTextElement */
  settings: TextSettings
  /** Post-actions to execute after this element is created */
  postActions: PostAction[]
}

/** Result from any text preset function */
export interface TextPresetResult {
  elements: TextPresetElementConfig[]
}

// ============================================================================
// Image presets (consumed by Phase 3)
// ============================================================================

export interface ImagePostAddAction {
  type: 'personalize-image' | 'personalize-mask'
  config: {
    label?: string
    source?: 'buyer' | 'seller'
    enableUpload?: boolean
    enableEditAll?: boolean
    required?: boolean
    enableAIEffects?: boolean
    aiEffectStyles?: string[]
    advancedOptionCount?: number
    optionSet?: { label: string; options: string[] }
    /** Mask shape names to auto-populate (e.g. ['Circle', 'Heart']) */
    maskShapes?: string[]
  }
}

/** Image preset result — instructs the caller to open a panel */
export interface ImagePresetResult {
  action: 'open-panel'
  panel: 'image' | 'ai-image'
  postAddActions?: ImagePostAddAction[]
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type { TextSettings, EffectConfig }
