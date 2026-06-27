/**
 * Skill system types for TailorKit AI Chat.
 * Skills are transparent, user-invoked AI capabilities (vs black-box intent routing).
 * Follows JIT pattern: skill handlers loaded only when invoked.
 */

import type { z } from 'zod'

/** Context passed to skill handlers during execution */
export interface SkillContext {
  shopDomain: string
  shopData: any
  accessToken?: string
  shopifyAdmin?: any
  templateId?: string
  editorTemplate?: any
  /** Structured references from @mentions in chat input */
  mentions?: SkillMention[]
  /** Conversation ID for message persistence */
  conversationId?: string
}

/** A resolved @mention reference from the chat input */
export interface SkillMention {
  type: 'layer' | 'optionSet'
  id: string
  label: string
}

/** Structured preview for a generated option group (shared between backend and frontend) */
export interface OptionGroupPreview {
  /** Display label for the option group */
  label: string
  /** TailorKit option set type */
  optionSetType: string
  /** Display style (imageless_swatch, imageless_checkbox, etc.) */
  displayStyle: string
  /** Layer type to create */
  layerType: string
  /** Option values with optional pricing */
  values: Array<{
    name: string
    pricing?: number | null
    isDefault?: boolean
  }>
  /** Font sub-customization names (for preview display) */
  fontOptions?: string[]
  /** Color sub-customization names (for preview display) */
  colorOptions?: string[]
}

// ── Execution Plan types (Planning Agent) ───────────────────────────

/** Execution plan produced by the planning-aware generate-options skill */
export interface ExecutionPlan {
  title: string
  steps: PlanStep[]
  flags: PlanFlag[]
}

export interface PlanStep {
  /** Unique step ID (e.g., "step_1") */
  id: string
  /** Execution order (1-based) */
  order: number
  /** Human-readable label, e.g., "Product Type" */
  label: string
  /** Element type to create */
  elementType: 'text' | 'text_customer' | 'image' | 'imageless'
  /** Default text content displayed on canvas (for text/text_customer elements) */
  content?: string | null
  /** Google Font family name (e.g., "Pacifico", "Roboto") */
  fontFamily?: string | null
  /** Font size in pixels */
  fontSize?: number | null
  /** Text color as hex code (e.g., "#FF0000") */
  textColor?: string | null
  /** Horizontal text alignment */
  textAlign?: 'left' | 'center' | 'right' | null
  /** Display style for imageless elements */
  displayStyle?: string | null
  /** Option values with optional pricing */
  values?: Array<{ name: string; value?: string | null; pricing?: number | null }>
  /** Settings for text_customer / image elements */
  settings?: {
    placeholder?: string | null
    characterLimit?: number | null
    required?: boolean | null
    allowMultiLineText?: boolean | null
  } | null
  /** Conditional visibility dependency */
  condition?: {
    dependsOnStep: string
    whenValue: string
    action: 'show' | 'hide'
  } | null
}

export interface PlanFlag {
  /** Which step this flag applies to (null = plan-level) */
  stepId?: string | null
  /** Flag severity */
  type: 'limitation' | 'suggestion' | 'manual_required'
  /** Human-readable message */
  message: string
}

// ── Skill Result ────────────────────────────────────────────────────

/** Result returned by a skill handler */
export interface SkillResult {
  success: boolean
  /** Structured preview data for the client to render */
  preview?: OptionGroupPreview[]
  /** Execution plan with steps + conditions (Planning Agent output) */
  plan?: ExecutionPlan
  /** Raw data for client to apply on confirm */
  data?: any
  /** Error message if success is false */
  error?: string
  /** Status messages emitted during execution (for SSE) */
  statusMessages?: string[]
}

/** Callback for streaming status messages during skill execution */
export type SkillStatusCallback = (message: string) => void

/** Skill handler function signature */
export type SkillHandler = (
  input: string,
  context: SkillContext,
  onStatus?: SkillStatusCallback
) => Promise<SkillResult>

/** Registry entry for a skill (backend) */
export interface SkillRegistryEntry {
  id: string
  command: string
  description: string
  /** Whether this skill is active or still under development */
  status: 'active' | 'coming_soon'
  /** Zod schema for input validation (optional — free-form text is valid) */
  inputSchema?: z.ZodSchema
  /** Dynamic import thunk — handler loaded JIT only when skill is invoked */
  handler: () => Promise<{ default: SkillHandler }>
}
