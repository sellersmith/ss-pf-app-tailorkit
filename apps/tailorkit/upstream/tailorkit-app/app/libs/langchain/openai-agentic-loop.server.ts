/**
 * Elva AI agentic loop — Vercel AI SDK v6.
 * Replaces hand-rolled OpenAI loop + custom SSE markers with
 * streamText + stopWhen + createUIMessageStream + typed data parts.
 *
 * Stream contract: plans/260517-1211-elva-vercel-ai-sdk-migration/contract.md
 * Status emission, skill-result early-break, channel filter preserved.
 */

import { streamText, stepCountIs, createUIMessageStream, convertToModelMessages } from 'ai'
import type { UIMessage, ModelMessage } from 'ai'
import { openai } from '@ai-sdk/openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { buildElvaTools } from './tools/openai-tool-defs.server'
import { buildCapabilityContext } from './skills/builtin/capability-context'
import { BASE_AGENT_MODEL, CONTEXT_EVALUATION_MESSAGE, LANGUAGE_SUPPORT_MESSAGE } from './constant'
import type { SkillContext, SkillResult } from './skills/types'
import type { AssistantResponse } from './assistant.service'
import type { ElvaUIMessage, ElvaSkillKind } from './elva-ui-message'
import { trackFeatureEvent } from '~/bootstrap/fns/feature-tracking.server'

const MAX_TOOL_ITERATIONS = 5

// ── Types ─────────────────────────────────────────────────────────────

export interface AgenticLoopContext {
  shopData: any
  shopDomain: string
  documentContext?: string
  commandHint?: { command: string; spec: string } | null
  /**
   * Image attachments uploaded with the current user turn (S3 CDN URLs).
   * Injected as file parts in the UIMessage so gpt-5.4-mini gets native vision.
   */
  attachments?: { url: string; mediaType: string }[]
}

export interface AgenticLoopArgs {
  message: string
  conversationHistory: AssistantResponse[]
  context: AgenticLoopContext
  skillContext: SkillContext
  /** Channel — controls system prompt + tool subset */
  channel?: 'in-app' | 'crisp'
  /** Aborts the underlying streamText + resolves `done` with current text so MongoDB persist still runs. */
  abortSignal?: AbortSignal
}

export interface AgenticLoopResult {
  /** UI message stream consumed by createUIMessageStreamResponse */
  stream: ReadableStream
  /** Resolves to full assistant text (for MongoDB persistence) after stream completes */
  done: Promise<string>
}

// ── Status mapping ────────────────────────────────────────────────────

const TOOL_STATUS_MAP: Record<string, string> = {
  customize_product: 'generating-customization-plan',
  remove_element: 'removing-element',
  edit_element: 'editing-element',
  search_docs: 'searching-documentation',
  submit_feature_request: 'submitting-feature-request',
  analyze_screenshot: 'analyzing-screenshot',
  search_code: 'searching-internal-knowledge',
  browse_storefront: 'checking-your-storefront',
}

// ── System Prompt ─────────────────────────────────────────────────────

function buildSystemPrompt(context: AgenticLoopContext, channel: 'in-app' | 'crisp' = 'in-app'): string {
  const sections: string[] = [
    'You are Elva, the AI assistant for TailorKit — a Shopify product personalizer app.',
    '',
    '**Your Role:**',
    '- Help merchants create product customization templates (option sets, text inputs, image uploads)',
    '- Answer questions about TailorKit features, troubleshooting, billing, and Shopify integration',
    '- When merchants describe a product, generate a customization plan using tools',
    '',
    '**Response Style:** Friendly, concise, actionable. ACT FIRST — generate a plan with sensible defaults '
      + 'rather than asking clarifying questions. Only ask when the request is truly ambiguous '
      + '(e.g., "customize my product" with zero specifics). For "add text engraving" or '
      + '"add color options" → just do it immediately with reasonable defaults.',
    '',
    '## Tool Usage Rules',
    '- When user describes ANY customization need → call customize_product IMMEDIATELY with best-guess defaults',
    '- When user asks to remove an element from a plan → call remove_element',
    '- When user asks to edit an element → call edit_element',
    '- When user asks about TailorKit features, setup, billing, troubleshooting, how-to questions, '
      + 'or anything that could benefit from documentation → call search_docs to find relevant information, '
      + 'then use the results to craft a helpful answer',
    '- When user explicitly wishes for a new feature, reports a bug, or suggests an improvement '
      + '→ call submit_feature_request to capture and route to the development team. '
      + 'Do NOT call for general questions, how-to queries, or customization requests. '
      + 'IMPORTANT: The request MUST contain a clear, specific description of what the merchant wants. '
      + 'If the input is vague (e.g., just "hi", "hello", a single word, or lacks actionable detail), '
      + 'do NOT submit — instead ask the merchant to describe their request in more detail. '
      + 'After submitting, set honest expectations: the request will be reviewed but implementation '
      + 'may differ due to technical feasibility.',
    '- For simple greetings or casual conversation → respond with text (no tool call needed)',
    '',
    '**Critical — Adding to an existing plan:**',
    'When the user asks to ADD, SUPPLEMENT, or INCLUDE new elements to an existing plan,',
    'you MUST call customize_product with a spec that includes BOTH the existing',
    'elements AND the new ones. Look at the prior plan in conversation history, list all',
    'existing steps, then append the new element. Pass the combined spec so the result is',
    'ONE complete plan with all elements. NEVER return just the new element alone.',
    '',
    '**Critical — Tool Result Behavior:**',
    'When customize_product, remove_element, or edit_element succeed, DO NOT add any explanation, '
      + 'summary, or follow-up text. The client renders an interactive card directly from the tool result.',
    '',
    buildCapabilityContext(),
  ]

  if (context.shopData) {
    const shop = context.shopData
    const info = [
      `Shop: ${context.shopDomain}`,
      shop.plan ? `Plan: ${typeof shop.plan === 'string' ? shop.plan : shop.plan.name}` : null,
    ]
      .filter(Boolean)
      .join(', ')
    sections.push('', '## Shop Context', info)
  }

  if (context.documentContext) {
    sections.push('', '## Relevant Documentation', context.documentContext)
  }

  if (context.commandHint) {
    const commandToolMap: Record<string, string> = {
      customize: 'Call the customize_product tool with their specification text.',
      docs: 'Call the search_docs tool with their query to find relevant documentation.',
      feedback: "Call the submit_feature_request tool to capture the merchant's request.",
    }
    const toolInstruction
      = commandToolMap[context.commandHint.command]
      || `Call the appropriate tool for the /${context.commandHint.command} command.`
    sections.push(
      '',
      '## Active Command',
      `The user is invoking the /${context.commandHint.command} command.`,
      toolInstruction
    )
  }

  // Anti-hallucination rules — strict grounding to TailorKit source of truth.
  // Applies to all channels but enforced especially hard on Crisp where mistakes
  // damage merchant trust and cost retention.
  sections.push(
    '',
    '## Anti-Hallucination Rules (STRICT)',
    'TailorKit UI labels, plan features, and workflows change over time. Your training data is stale.',
    'You MUST treat retrieved documentation as the only source of truth for facts about TailorKit.',
    '',
    '**Required behavior:**',
    '1. For ANY question about TailorKit features, UI navigation, settings, plan capabilities, '
      + 'or troubleshooting, call search_docs FIRST. Do not skip this step even if you "think" you know.',
    '2. Quote UI labels VERBATIM from retrieved documentation. Do not paraphrase, translate, '
      + 'or shorten button names, menu items, or settings.',
    '3. If retrieved documentation does not cover the question or is ambiguous, escalate with '
      + '[HUMAN SUPPORT NEEDED]. Do NOT fill in gaps with general Shopify knowledge or guesses.',
    '4. Never output internal code identifiers as if they were UI text. Forbidden patterns include '
      + 'ALL_CAPS_SNAKE_CASE tokens (e.g., FIXED, FREE, IMAGELESS_DROPDOWN_LIST), camelCase '
      + 'flags (e.g., charmBuilder, autoFulfillment), or file paths. If you see these in retrieved '
      + 'context, find the user-facing label they correspond to or escalate.',
    '5. If a merchant asks where to find a setting and you cannot find the exact navigation path '
      + 'in retrieved documentation, escalate. Do NOT invent menu paths like "Settings → Advanced".',
    '6. Never reply with the same boilerplate twice in a row. If your previous reply did not '
      + 'resolve the question, ask a specific diagnostic question or escalate. Do not repeat.',
    '',
    '**When in doubt → escalate.** A human handoff is always better than a confident wrong answer.'
  )

  // Crisp-specific rules: format, tone, escalation
  if (channel === 'crisp') {
    sections.push(
      '',
      '## Crisp Channel Rules',
      '- Format responses for Crisp chat (short paragraphs, no markdown cards).',
      '- Never mention "docs" or "documentation" — TailorKit is docless to merchants.',
      "- Reply in the user's language and tone (1-3 sentences unless giving steps). Use emojis appropriately.",
      '- Refer to the user by first name if detected from conversation.',
      '- You do NOT have UI rendering tools (customize_product, remove_element, edit_element).',
      '- For customization requests, guide the merchant step-by-step or direct them to use the in-app AI chat.',
      '- If you cannot resolve after 3 clarifying questions, respond with [HUMAN SUPPORT NEEDED] '
        + 'and a polite message letting them know a human will be with them shortly.',
      '- If user explicitly asks for a human agent, escalate immediately with [HUMAN SUPPORT NEEDED].',
      '- Cancellation intent ("cancel", "unsubscribe", "uninstall", "remove the app") → '
        + 'immediately escalate with [HUMAN SUPPORT NEEDED]. Do NOT provide uninstall steps. '
        + 'Ask only a single soft reason-for-leaving question if appropriate.'
    )
  }

  sections.push('', CONTEXT_EVALUATION_MESSAGE, '', LANGUAGE_SUPPORT_MESSAGE)
  return sections.join('\n')
}

// ── Message conversion ────────────────────────────────────────────────

/**
 * Convert AssistantResponse history → AI SDK UIMessage[] for convertToModelMessages.
 * If `attachments` provided, the CURRENT (last) user message also carries file parts
 * so convertToModelMessages serializes them as OpenAI `image_url` content blocks —
 * giving gpt-5.4-mini native vision on the just-uploaded images.
 */
function historyToUIMessages(
  history: AssistantResponse[],
  userMessage: string,
  attachments?: { url: string; mediaType: string }[]
): UIMessage[] {
  const ui: UIMessage[] = []
  for (const msg of history) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      ui.push({
        id: crypto.randomUUID(),
        role: msg.role,
        parts: [{ type: 'text', text: msg.content }],
      })
    }
  }
  const currentParts: UIMessage['parts'] = [{ type: 'text', text: userMessage }]
  if (attachments?.length) {
    for (const a of attachments) {
      currentParts.push({ type: 'file', mediaType: a.mediaType, url: a.url })
    }
  }
  ui.push({
    id: crypto.randomUUID(),
    role: 'user',
    parts: currentParts,
  })
  return ui
}

/** Build legacy ChatCompletionMessageParam[] for tools that still need it (extractLastPlan). */
function historyToLegacyMessages(history: AssistantResponse[]): ChatCompletionMessageParam[] {
  const out: ChatCompletionMessageParam[] = []
  for (const msg of history) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      out.push({ role: msg.role, content: msg.content })
    }
  }
  return out
}

// ── Loop ──────────────────────────────────────────────────────────────

export function runAgenticLoop(args: AgenticLoopArgs): AgenticLoopResult {
  const { message, conversationHistory, context, skillContext, channel = 'in-app', abortSignal } = args
  const systemPrompt = buildSystemPrompt(context, channel)

  // Mutable refs scoped to this turn.
  const liveMessages: ChatCompletionMessageParam[] = historyToLegacyMessages(conversationHistory)
  let lastPlan: SkillResult | null = null
  let fullText = ''
  let doneResolve!: (text: string) => void
  const done = new Promise<string>(r => (doneResolve = r))

  // Tool factories get a closure to read live messages (which include current-turn plans).
  const getMessages = () => {
    if (lastPlan) {
      return [
        ...liveMessages,
        { role: 'assistant' as const, content: `[SKILL_RESULT]${JSON.stringify(lastPlan)}[/SKILL_RESULT]` },
      ]
    }
    return liveMessages
  }

  const stream = createUIMessageStream<ElvaUIMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: 'data-status', data: { key: 'understanding-your-request' } })

      trackFeatureEvent(context.shopData, 'ai_assistant', 'chat_message_sent', {
        has_command: !!context.commandHint,
        command: context.commandHint?.command || null,
        history_length: conversationHistory.length,
      }).catch(() => {})

      const tools = buildElvaTools(
        channel,
        skillContext,
        (msg: string) => writer.write({ type: 'data-status', data: { key: msg } }),
        getMessages
      )

      const uiMessages = historyToUIMessages(conversationHistory, message, context.attachments)
      const modelMessages: ModelMessage[] = await convertToModelMessages(uiMessages)

      // Resolve `done` if client disconnects mid-stream so MongoDB persist + billing still fire.
      if (abortSignal) abortSignal.addEventListener('abort', () => doneResolve(fullText), { once: true })

      const result = streamText({
        model: openai(BASE_AGENT_MODEL),
        system: systemPrompt,
        messages: modelMessages,
        tools,
        temperature: 0.2,
        abortSignal,
        // Stop on step limit OR when a UI-rendering tool returned a *successful* skill result
        // (output has `kind`). Failures keep the loop running so the model can explain the error.
        stopWhen: [
          stepCountIs(MAX_TOOL_ITERATIONS),
          ({ steps }) => {
            const last = steps.at(-1)
            return !!last?.toolResults?.some(tr => {
              const out = tr.output as { kind?: unknown } | undefined
              return !!(out && typeof out === 'object' && 'kind' in out && out.kind)
            })
          },
        ],
        onStepFinish: ({ toolCalls, toolResults, text }) => {
          // Emit status BEFORE each tool call appears in the stream (best-effort)
          for (const tc of toolCalls) {
            const key = TOOL_STATUS_MAP[tc.toolName] ?? `executing-${tc.toolName}`
            writer.write({ type: 'data-status', data: { key } })
          }
          // Process tool results
          for (let i = 0; i < toolResults.length; i++) {
            const tr = toolResults[i]
            const tc = toolCalls[i]
            trackFeatureEvent(context.shopData, 'ai_assistant', 'tool_called', {
              tool_name: tc?.toolName,
              has_result: !!tr.output,
            }).catch(() => {})

            // UI-rendering skill result → emit data-skill-result, track for remove/edit chains
            const output = tr.output as { kind?: ElvaSkillKind; payload?: unknown }
            if (output && typeof output === 'object' && 'kind' in output && output.kind) {
              writer.write({ type: 'data-complete', data: {} })
              writer.write({
                type: 'data-skill-result',
                data: {
                  kind: output.kind,
                  toolCallId: tc?.toolCallId ?? '',
                  payload: output.payload,
                },
              })
              // Update lastPlan ref so subsequent remove/edit can find it
              if (output.payload) lastPlan = output.payload as SkillResult
            }
          }
          if (text) fullText += text
        },
        onFinish: ({ text }) => {
          // Persist final text for MongoDB save. If a skill-result fired, prefer that as marker.
          const persistText = lastPlan ? `[SKILL_RESULT]${JSON.stringify(lastPlan)}[/SKILL_RESULT]` : text || fullText
          doneResolve(persistText)
        },
      })

      writer.merge(result.toUIMessageStream({ sendStart: false, sendFinish: false }))
    },
    onError: err => {
      console.error('[Elva agentic loop] stream error:', err)
      doneResolve(fullText)
      return err instanceof Error ? err.message : 'Stream error'
    },
  })

  return { stream, done }
}
