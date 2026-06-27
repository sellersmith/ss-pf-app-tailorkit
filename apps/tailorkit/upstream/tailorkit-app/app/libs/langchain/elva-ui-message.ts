/**
 * Shared UIMessage types for Elva AI SDK v6 migration.
 * Server emits via createUIMessageStream, client consumes via useChat.
 * Schema lives in plans/260517-1211-elva-vercel-ai-sdk-migration/contract.md
 */
import type { UIMessage } from 'ai'

export type ElvaSkillKind =
  | 'customize'
  | 'remove'
  | 'edit'
  | 'docs'
  | 'feature-request'
  | 'screenshot'
  | 'code-search'
  | 'storefront'

/** UI-rendering kinds — when these fire, loop must stop (no follow-up text). */
export const UI_RENDERING_SKILL_KINDS: ReadonlySet<ElvaSkillKind> = new Set(['customize', 'remove', 'edit'])

/** Tool names that trigger UI-rendering skill results. Used by stopWhen. */
export const UI_RENDERING_TOOL_NAMES = ['customize_product', 'remove_element', 'edit_element'] as const

export type ElvaUIDataTypes = {
  status: { key: string }
  complete: Record<string, never>
  'skill-result': {
    kind: ElvaSkillKind
    toolCallId: string
    payload: unknown
  }
}

export type ElvaUIMessage = UIMessage<unknown, ElvaUIDataTypes>
