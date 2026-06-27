/**
 * AI Element Tools — Tool-based agent architecture for element generation.
 *
 * Usage:
 *   import { CommandPipeline, ELEMENT_ADAPTERS, registerAdapters } from '~/components/AIChat/element-tools'
 *   registerAdapters(ELEMENT_ADAPTERS)
 *   const pipeline = new CommandPipeline()
 *   const result = pipeline.executeBatch(toolCalls, editorContext)
 */

export { CommandPipeline, registerAdapters } from './command-pipeline'
export { ELEMENT_ADAPTERS } from './adapters'
export { validateToolArgs, getOpenAIFunctionDefs } from './registry'
export type {
  ToolCall,
  ToolCallBatch,
  ToolName,
  AIElementType,
  EditorContext,
  BatchResult,
  Command,
  CommandResult,
  ElementAdapter,
} from './types'
