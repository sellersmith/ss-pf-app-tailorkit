/**
 * Core types for the AI Element Tool system.
 *
 * Architecture (Figma MCP-inspired):
 * - Tools: atomic operations the AI can call via function calling
 * - Commands: executable + undoable wrappers around tool calls
 * - Adapters: per-element-type creation logic delegating to existing createElement
 * - Pipeline: batch execute + undo + rollback
 */

import type { TLayerStore } from '~/stores/modules/layer'
import type { CustomizationItemType } from '~/shared/customization-items/types'

// Re-export for convenience
export type { CustomizationItemType }

/** The 5 tools the AI can call */
export type ToolName = 'create_element' | 'set_customization' | 'set_settings' | 'remove_element' | 'set_conditional'

/** Element types the AI can create */
export type AIElementType = 'text' | 'text_customer' | 'image' | 'imageless'

/** Tool call from the AI model (matches OpenAI function calling output) */
export interface ToolCall {
  name: ToolName
  args: Record<string, any>
  /** Auto-generated call ID for tracking */
  id?: string
  /** Plan step this call belongs to (for per-step progress tracking) */
  stepId?: string
}

/** A batch of tool calls returned by the server */
export interface ToolCallBatch {
  calls: ToolCall[]
  skill: string
}

/** Context available during command execution (client-side) */
export interface EditorContext {
  canvasWidth: number
  canvasHeight: number
  shopDomain: string
  t: (key: string) => string
  textLayerCount: number
  imagelessLayerCount: number
  multiLayoutLayerCount: number
}

/** Result of executing a single command */
export interface CommandResult {
  success: boolean
  layerStore?: TLayerStore
  error?: string
  /** Reference key for cross-referencing between tool calls */
  elementRef?: string
}

/** Result of executing a full batch */
export interface BatchResult {
  success: boolean
  createdStores: TLayerStore[]
  errors: string[]
  /** Number of commands executed before failure (for partial rollback info) */
  executedCount: number
}

/** A command wraps a tool call with execute + undo capability */
export interface Command {
  toolCall: ToolCall
  execute(context: EditorContext, createdElements: Map<string, TLayerStore>): CommandResult
  undo(context: EditorContext): void
}

/** Adapter interface — each element type implements this to bridge tool args → createElement */
export interface ElementAdapter {
  createElement(args: Record<string, any>, context: EditorContext): TLayerStore
  removeElement(layerStore: TLayerStore): void
}
