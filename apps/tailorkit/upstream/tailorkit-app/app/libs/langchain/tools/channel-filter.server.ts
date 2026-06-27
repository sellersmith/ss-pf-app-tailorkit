/**
 * Channel-based tool filtering for Elva AI.
 * Crisp channel gets a subset of tools (no UI-rendering tools).
 * In-app channel gets all tools.
 */

import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import { ELVA_TOOLS } from './openai-tool-defs.server'

export type ElvaChannel = 'in-app' | 'crisp'

/** Tools allowed in Crisp channel (no customize/remove/edit — those need in-app UI) */
const CRISP_ALLOWED_TOOL_NAMES = new Set([
  'search_docs',
  'submit_feature_request',
  'analyze_screenshot',
  'search_code',
  'browse_storefront',
])

/**
 * Filter tools based on channel.
 * In-app returns all tools; Crisp returns only support-oriented tools.
 */
export function filterToolsForChannel(
  channel: ElvaChannel,
  tools: ChatCompletionTool[] = ELVA_TOOLS
): ChatCompletionTool[] {
  if (channel === 'in-app') return tools
  return tools.filter(t => t.type === 'function' && CRISP_ALLOWED_TOOL_NAMES.has(t.function.name))
}
