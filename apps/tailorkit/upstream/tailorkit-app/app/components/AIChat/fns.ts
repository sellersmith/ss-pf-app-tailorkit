import { ConversationRole } from '~/enums/conversationMessage'
import type { ProductCardData } from '~/libs/langchain/agents/services/ContextBuilder'
import type { ProviderDocument } from '~/models/Provider'
import type { IMessageInput } from '~/routes/api.ai-assistant/constants'
import type { ExecutionPlan } from '~/libs/langchain/skills/types'
import { MCP_TOOLS_DATA_MARKDOWN_VALUE, MCP_TOOLS_EVENT_MARKDOWN_KEY } from '~/services/mcp/constants'
import type { TemplateData } from '~/libs/langchain/agents/templates/services/TemplateComposer'
import type { TLayerStore } from '~/stores/modules/layer'

// Constants for parsing patterns - more maintainable
const PARSING_PATTERNS = {
  PRODUCT_CARD: /\[PRODUCT_CARD:([^\]]+)\](.*)/,
  PRODUCT_DATA_PREFIX: 'PRODUCT_DATA:',
  TEMPLATE_CARD: /\[TEMPLATE_CARD:([^\]]+)\](.*)/,
  TEMPLATE_DATA_PREFIX: 'TEMPLATE_DATA:',
  SKILL_RESULT: /\[SKILL_RESULT\](.*)\[\/SKILL_RESULT\]/,
  STATUS_PATTERN: /\[STATUS\](.*?)\[\/STATUS\]/g,
  HUMAN_SUPPORT_MARKER: /\[HUMAN SUPPORT NEEDED\]/i,
  CASE_2_INDICATORS: ['imported', 'import from printify', 'getting started', 'first personalized product'],
} as const

// Type guards for better type safety
const isProductRecommendationBlock = (block: MessageBlock): block is ProductRecommendationBlock =>
  block.type === 'product_recommendation'

const isTemplateCreationBlock = (block: MessageBlock): block is TemplateCreationBlock =>
  block.type === 'template_creation'

const isSkillResultBlock = (block: MessageBlock): block is SkillResultBlock => block.type === 'skill_result'

const isHumanSupportBlock = (block: MessageBlock): block is HumanSupportBlock => {
  return block.type === 'human_support'
}

const isEventBlock = (block: MessageBlock): block is EventBlock => block.type === 'event'

const isTextBlock = (block: MessageBlock): block is TextBlock => block.type === 'text'

/**
 * Creates a message object for the conversation.
 *
 * @param input - Message fields used to construct an `IMessageInput`
 * @returns A normalized `IMessageInput` with timestamp and default feedback
 */
export function createMessage({ id, content, role, metadata }: IMessageInput): IMessageInput {
  return {
    id,
    content,
    role,
    timestamp: new Date(),
    feedback: null,
    metadata,
  }
}

/**
 * Validates the input for sending a message.
 *
 * Returns true only when not loading and there is either user input or a suggestion.
 */
export function validateInput(isLoading: boolean, input: string | undefined, suggestion?: any): boolean {
  return !isLoading && (!!input || !!suggestion)
}

/**
 * Retrieves the message content based on the suggestion and trimmed input.
 *
 * @param suggestion - Optional suggestion to use when input is empty
 * @param trimmedInput - User input without surrounding whitespace
 * @returns The content to send to the assistant
 */
export function getMessageContent(suggestion: any, trimmedInput: string): string {
  return suggestion?.id && trimmedInput === '' ? suggestion.content : trimmedInput
}

export type MessageBlock =
  | TextBlock
  | EventBlock
  | StatusBlock
  | ProductRecommendationBlock
  | TemplateCreationBlock
  | HumanSupportBlock
  | SkillResultBlock

export interface SkillResultBlock {
  type: 'skill_result'
  data: {
    success: boolean
    preview?: Array<{
      label: string
      optionSetType: string
      displayStyle: string
      layerType: string
      values: Array<{ name: string; pricing?: number | null; isDefault?: boolean }>
    }>
    /** Execution plan from the planning-aware skill (Phase 3+) */
    plan?: ExecutionPlan
    data?: any
    error?: string
  }
}

export interface TextBlock {
  type: 'text'
  content: string
}

export interface EventBlock {
  type: 'event'
  eventName: string
  data?: any
}

export interface StatusBlock {
  type: 'status'
  agent: string
  message: string
  timestamp: Date
}

/**
 * Image attached to a user message before send. CDN URL flows to the server
 * which injects it as a UIMessage file part for native gpt-5.4-mini vision.
 */
export interface FileAttachment {
  url: string
  mediaType: string
  name: string
}

export interface HumanSupportBlock {
  type: 'human_support'
}

export interface ProductRecommendationBlock {
  type: 'product_recommendation'
  id: string
  state: 'analyzing' | 'building' | 'complete'
  case: 1 | 2
  data: Partial<ProductRecommendationData>
}

export interface TemplateCreationBlock {
  type: 'template_creation'
  id: string
  state: 'analyzing' | 'complete' | 'building'
  data: Partial<TemplateData & { extractedLayerStores: TLayerStore[] }>
}

export interface ProductRecommendationData {
  title: string
  price: string
  variants: string[]
  /** GraphQL global product ID */
  productId?: string
  /** Variant IDs associated with the product */
  variantIds?: string[]
  personalizationStyle: string
  provider?: ProviderDocument | null
  rawProduct?: ProductCardData['rawProduct']
  badge?: {
    text: string
    type: 'info' | 'success' | 'warning'
  }
  mockupImage?: {
    url: string
    alt: string
  }
  ctaButton?: {
    text: string
    enabled: boolean
  }
  clipart?: {
    url: string
    alt: string
    position: {
      x: number
      y: number
    }
    dimensions: {
      width: number
      height: number
    }
    rotation: number
    reasoning?: string // AI's reasoning for the placement
    templateId?: string
  }
  callToActions?: {
    id: string
    text: string
    action: string
    enabled: boolean
  }[]
  published?: boolean
  productUrl?: string
  integrationUrl?: string
}

/**
 * Pushes a text block into the result, merging with the previous text block when possible.
 * This reduces array churn and renders more efficiently by minimizing nodes.
 */
function pushTextBlock(result: MessageBlock[], text: string) {
  if (!text) return
  const last = result[result.length - 1]
  if (last && isTextBlock(last)) {
    last.content = last.content ? `${last.content}\n${text}` : text
  } else {
    result.push({ type: 'text', content: text })
  }
}

/**
 * Optimized parsing function with better performance and maintainability
 */
export function parseBlocksFromRawString(input: string): MessageBlock[] {
  if (!input?.trim()) return []

  // Remove outer quotes if present
  let cleanInput = input.trim()
  if (cleanInput.startsWith('"') && cleanInput.endsWith('"')) {
    cleanInput = cleanInput.slice(1, -1)
  }

  const lines = cleanInput.split('\n')
  const result: MessageBlock[] = []

  // Pre-compile case type check for better performance
  const lowerCleanInput = cleanInput.toLowerCase()
  const shouldUseCaseType2 = PARSING_PATTERNS.CASE_2_INDICATORS.some(indicator => lowerCleanInput.includes(indicator))

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue
    const trimmedLower = trimmedLine.toLowerCase()

    // Handle product recommendation blocks
    {
      const cardMatch = trimmedLine.match(PARSING_PATTERNS.PRODUCT_CARD)
      if (cardMatch) {
        const cardId = cardMatch[1]
        const description = cardMatch[2].replace(/^\s*\(([^)]+)\).*$/, '$1')
        const caseType = shouldUseCaseType2 || description.toLowerCase().includes('imported') ? 2 : 1

        result.push({
          type: 'product_recommendation',
          id: cardId,
          state: 'building',
          case: caseType,
          data: {},
        })
        continue
      }
    }

    {
      const cardMatch = trimmedLine.match(PARSING_PATTERNS.TEMPLATE_CARD)
      if (cardMatch) {
        const cardId = cardMatch[1]

        result.push({
          type: 'template_creation',
          id: cardId,
          state: 'building',
          data: {},
        })
        continue
      }
    }

    // Handle human support marker
    // Handle human support marker inline at exact position (preserve surrounding text)
    if (PARSING_PATTERNS.HUMAN_SUPPORT_MARKER.test(trimmedLine)) {
      let remainder = trimmedLine

      // Process all occurrences in this line
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const match = remainder.match(PARSING_PATTERNS.HUMAN_SUPPORT_MARKER)
        if (!match || match.index === undefined) break

        const before = remainder.slice(0, match.index).trim()
        if (before) {
          pushTextBlock(result, before)
        }

        result.push({ type: 'human_support' })

        remainder = remainder.slice(match.index + match[0].length).trim()
      }

      if (remainder) {
        pushTextBlock(result, remainder)
      }
      continue
    }

    // Handle product data streaming
    if (trimmedLine.startsWith(PARSING_PATTERNS.PRODUCT_DATA_PREFIX)) {
      try {
        const dataContent = trimmedLine.substring(PARSING_PATTERNS.PRODUCT_DATA_PREFIX.length).trim()
        const productData = JSON.parse(dataContent)

        result.push({
          type: 'event',
          eventName: 'product_data_update',
          data: productData,
        })
        continue
      } catch (e) {
        console.error('Error parsing product data:', e, 'Line:', trimmedLine)
        continue
      }
    }

    // Handle template data streaming
    if (trimmedLine.startsWith(PARSING_PATTERNS.TEMPLATE_DATA_PREFIX)) {
      try {
        const dataContent = trimmedLine.substring(PARSING_PATTERNS.TEMPLATE_DATA_PREFIX.length).trim()
        const templateData = JSON.parse(dataContent)

        result.push({
          type: 'event',
          eventName: 'template_data_update',
          data: templateData,
        })
        continue
      } catch (e) {
        console.error('Error parsing template data:', e, 'Line:', trimmedLine)
        continue
      }
    }

    // Handle skill result blocks (from /generate-options etc.)
    {
      const skillMatch = trimmedLine.match(PARSING_PATTERNS.SKILL_RESULT)
      if (skillMatch) {
        try {
          const skillData = JSON.parse(skillMatch[1])
          result.push({ type: 'skill_result', data: skillData })
        } catch (e) {
          console.error('Error parsing skill result:', e)
        }
        continue
      }
    }

    // Handle MCP tools data
    if (trimmedLine.startsWith(MCP_TOOLS_DATA_MARKDOWN_VALUE)) {
      const dataContent = trimmedLine.substring(MCP_TOOLS_DATA_MARKDOWN_VALUE.length)
      let parsedText = dataContent

      try {
        if (dataContent.startsWith('"') && dataContent.endsWith('"')) {
          parsedText = JSON.parse(dataContent)
        }
      } catch {
        parsedText = dataContent
      }

      if (parsedText !== '') {
        pushTextBlock(result, parsedText)
      }
      continue
    }

    // Handle MCP tools events
    if (trimmedLine.startsWith(MCP_TOOLS_EVENT_MARKDOWN_KEY)) {
      let eventContent = trimmedLine.substring(MCP_TOOLS_EVENT_MARKDOWN_KEY.length)

      // Handle double "event: " prefix (malformed SSE)
      if (eventContent.startsWith(MCP_TOOLS_EVENT_MARKDOWN_KEY)) {
        eventContent = eventContent.substring(MCP_TOOLS_EVENT_MARKDOWN_KEY.length)
      }

      try {
        const eventData = JSON.parse(eventContent)
        result.push({
          type: 'event',
          eventName: eventData.eventName,
          data: eventData.data || {},
        })
      } catch (e) {
        console.error('Error parsing event:', e)
      }
      continue
    }

    // Handle plain text (filter out special markers)
    if (
      !trimmedLine.startsWith(MCP_TOOLS_DATA_MARKDOWN_VALUE)
      && !trimmedLine.startsWith(MCP_TOOLS_EVENT_MARKDOWN_KEY)
      && !trimmedLower.includes('[product_card:')
      && !trimmedLine.startsWith(PARSING_PATTERNS.PRODUCT_DATA_PREFIX)
      && !trimmedLower.includes('[template_card:')
      && !trimmedLine.startsWith(PARSING_PATTERNS.TEMPLATE_DATA_PREFIX)
      && !PARSING_PATTERNS.HUMAN_SUPPORT_MARKER.test(trimmedLine)
    ) {
      pushTextBlock(result, trimmedLine)
    }
  }

  return result
}

/**
 * Optimized status extraction with better performance
 */
export function extractStatusMessages(content: string): { statusMessages: StatusBlock[]; cleanContent: string } {
  const statusMessages: StatusBlock[] = []
  let cleanContent = content

  const matches = Array.from(content.matchAll(PARSING_PATTERNS.STATUS_PATTERN))

  for (const match of matches) {
    const statusMessage = match[1]

    if (statusMessage === '[COMPLETE]') {
      statusMessages.push({
        type: 'status',
        agent: 'complete',
        message: '',
        timestamp: new Date(),
      })
    } else {
      statusMessages.push({
        type: 'status',
        agent: '',
        message: statusMessage,
        timestamp: new Date(),
      })
    }

    cleanContent = cleanContent.replace(match[0], '')
  }

  return { statusMessages, cleanContent }
}

/**
 * Process AI SDK v6 UIMessage SSE stream.
 *
 * Parses typed parts (data-status, data-skill-result, data-complete, text-delta)
 * and translates back to the legacy content-string shape so downstream consumers
 * (parseBlocksFromRawString, ActionCardRenderer) keep working without changes:
 *   - data-status     → onStatus
 *   - data-complete   → onStatus({ agent: 'complete' })
 *   - data-skill-result → appended to content as [SKILL_RESULT]JSON[/SKILL_RESULT]
 *   - text-delta      → appended to content as plain text
 *
 * Bridges the Vercel AI SDK migration (Phase 07) without rewriting the entire UI tree.
 * Legacy markers in historical conversations also flow through transparently.
 */
/** AI SDK v6 UIMessage SSE part. Only the fields this bridge reads are modeled. */
interface StreamPart {
  type: 'data-status' | 'data-complete' | 'data-skill-result' | 'text-delta' | 'text' | 'error' | (string & {})
  data?: { key?: string; payload?: unknown }
  text?: string
  delta?: string
  errorText?: string
}

export async function processStreamResponseWithStatus(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onContent: (chunk: string) => void,
  onStatus: (status: StatusBlock) => void
): Promise<string> {
  let accumulatedContent = ''
  const decoder = new TextDecoder()
  let buffer = ''

  const handlePart = (part: StreamPart) => {
    switch (part.type) {
      case 'data-status': {
        const key = part.data?.key
        if (!key) return
        if (key === '[COMPLETE]') {
          onStatus({ type: 'status', agent: 'complete', message: '', timestamp: new Date() })
        } else {
          onStatus({ type: 'status', agent: '', message: String(key), timestamp: new Date() })
        }
        return
      }
      case 'data-complete': {
        onStatus({ type: 'status', agent: 'complete', message: '', timestamp: new Date() })
        return
      }
      case 'data-skill-result': {
        const payload = part.data?.payload
        if (payload !== undefined) {
          accumulatedContent += `[SKILL_RESULT]${JSON.stringify(payload)}[/SKILL_RESULT]\n`
          onContent(accumulatedContent)
        }
        return
      }
      case 'text-delta':
      case 'text': {
        const text = typeof part.text === 'string' ? part.text : typeof part.delta === 'string' ? part.delta : ''
        if (text) {
          accumulatedContent += text
          onContent(accumulatedContent)
        }
        return
      }
      case 'error': {
        const errText = typeof part.errorText === 'string' ? part.errorText : 'Stream error'
        accumulatedContent += `\n${errText}`
        onContent(accumulatedContent)
        return
      }
      // Ignore other part types (start-step, finish-step, reasoning, etc.)
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    // SSE: events separated by blank lines, each event has `data: <json>` lines
    const events = buffer.split('\n\n')
    buffer = events.pop() || ''

    for (const event of events) {
      for (const line of event.split('\n')) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6)
        if (!payload || payload === '[DONE]') continue
        try {
          const parsed: unknown = JSON.parse(payload)
          if (
            parsed
            && typeof parsed === 'object'
            && 'type' in parsed
            && typeof (parsed as { type?: unknown }).type === 'string'
          ) {
            handlePart(parsed as StreamPart)
          }
        } catch {
          // Legacy fallback — old server sent raw text in chunks. Treat as text content.
          accumulatedContent += payload
          onContent(accumulatedContent)
        }
      }
    }
  }

  // Flush any trailing buffered text (non-SSE legacy stream)
  if (buffer && !buffer.startsWith('data:')) {
    accumulatedContent += buffer
    onContent(accumulatedContent)
  }

  return accumulatedContent
}

/**
 * Processes the stream response from the AI assistant.
 *
 * Accumulates chunks and invokes the callback with the full content so far.
 */
export async function processStreamResponse(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callback: (chunk: string) => void
): Promise<string> {
  let accumulatedContent = ''
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    accumulatedContent += chunk
    callback(accumulatedContent)
  }

  return accumulatedContent
}

/**
 * Sends a request to the AI assistant with the provided parameters.
 *
 * The endpoint responds with Server-Sent Events (SSE). This function enables streaming.
 */
export async function sendAIRequest(params: {
  message: string
  conversationHistory: any[]
  conversationId: string
  suggestionId: string
  userMessageId: string
  assistantMessageId: string
  context?: { templates?: { id: string }[] }
  userMetadata?: Record<string, any>
  signal: AbortSignal
}): Promise<Response> {
  return fetch('/api/ai-assistant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      ...params,
      stream: true,
    }),
    signal: params.signal,
  })
}

/**
 * Handles the response from the AI assistant when an image is returned.
 *
 * @param jsonResponse - Response payload with optional `image` field
 * @param assistantMessageId - The message id to attribute the image to
 * @returns A message with image metadata or null when not applicable
 */
export async function handleImageResponse(
  jsonResponse: { success?: boolean; image?: string },
  assistantMessageId: string
): Promise<IMessageInput | null> {
  const { success, image } = jsonResponse
  if (success && image) {
    return createMessage({
      id: assistantMessageId,
      content: '',
      metadata: { url: image },
      role: ConversationRole.ASSISTANT,
      feedback: null,
      timestamp: new Date(),
    })
  }
  return null
}

// Export type guards for use in components
export {
  isProductRecommendationBlock,
  isEventBlock,
  isTextBlock,
  isTemplateCreationBlock,
  isHumanSupportBlock,
  isSkillResultBlock,
}
