import { LANGUAGE_SUPPORT_MESSAGE } from '~/libs/langchain/constant'
import type { ChatInvoker } from '.'

export class EmitStatusService {
  private chatInvoker: ChatInvoker

  constructor(chatInvoker: ChatInvoker) {
    this.chatInvoker = chatInvoker
  }

  /**
   * Repetition status message via SSE
   */
  async emitStatus(onChunk: (chunk: string) => void, message: string, delay = 150): Promise<void> {
    onChunk(`[STATUS]${message}[/STATUS]`)
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  async generateAIResponse(args: {
    query: string
    contextMessage: string
    isStreaming: boolean
    onChunk?: (chunk: string) => void
  }): Promise<string> {
    const { query, contextMessage, isStreaming, onChunk } = args
    const messages = this.chatInvoker.buildMessages(query)
    messages.push({ role: 'system', content: contextMessage })

    if (isStreaming && onChunk && this.chatInvoker.streamChat) {
      let fullResponse = ''
      try {
        const stream = await this.chatInvoker.streamChat(messages)
        for await (const chunk of stream) {
          const content = chunk.content
          if (typeof content === 'string' && content) {
            fullResponse += content
            onChunk(content)
          }
        }
        return fullResponse
      } catch (error) {
        console.error('Streaming error:', error)
        const friendly = await this.generateUserFriendlyError(error, query, 'Streaming AI response', {
          reassureContinuation: true,
        })
        const msg = `\n${friendly}`
        onChunk(msg)
        return msg
      }
    } else {
      return this.chatInvoker.invokeChat(messages)
    }
  }

  /**
   * Emit a chunk of text for SSE streaming
   */
  async generateUserFriendlyMessage(args: {
    onChunk: (chunk: string) => void
    userMessage: string
    progressHint: string
  }): Promise<string> {
    const { onChunk, userMessage, progressHint } = args
    // Prefer progressHint; sanitize markers and trim
    const input = typeof progressHint === 'string' ? progressHint.trim() : ''
    const withoutStatus = input.replace(/\[STATUS\]|\[\/STATUS\]/g, '').trim()
    const sanitized = withoutStatus.replace(/\[ERROR\]|\[COMPLETE\]/g, '').trim()
    if (!sanitized) {
      if (typeof onChunk === 'function') onChunk('')
      return ''
    }

    // Build a short prompt to convert progress hints into a concise, friendly sentence
    const prompt = [
      'You are a helpful assistant.',
      'Rewrite the following short progress update.',
      'Make it concise and friendly for end users waiting.',
      '',
      'Rules:',
      '- Keep it one short sentence.',
      '- Use present-continuous',
      '- Always start with a first-person phrase in the user’s language',
      '- Do not include any JSON.',
      '- Do not include special markers like [STATUS], [ERROR], [COMPLETE], TEMPLATE_DATA, TEMPLATE_CARD, etc.',
      `- Use the user's message to determine the language of the response: ${userMessage}`,
      `- ${LANGUAGE_SUPPORT_MESSAGE}`,
      '',
      `Your progress is: ${sanitized}`,
    ].join('\n')

    const messages = this.chatInvoker.buildMessages(userMessage)
    messages.push({ role: 'system', content: prompt })

    if (onChunk && this.chatInvoker.streamChat) {
      let fullResponse = ''
      try {
        const stream = await this.chatInvoker.streamChat(messages)
        for await (const chunk of stream) {
          const content = chunk.content
          if (typeof content === 'string' && content) {
            fullResponse += content
            onChunk(content)
          }
        }
        return fullResponse
      } catch (error) {
        console.error('Streaming error:', error)
        const friendly = await this.generateUserFriendlyError(error, userMessage, 'Streaming AI response', {
          reassureContinuation: true,
        })
        const msg = `\n${friendly}`
        onChunk(msg)
        return msg
      }
    } else {
      return this.chatInvoker.invokeChat(messages)
    }
  }

  /**
   * Sanitize error information to avoid leaking sensitive paths or stack traces.
   *
   * @param error - The original error object or message
   * @returns A safe object with optional name and a cleaned message
   */
  private sanitizeError(error: unknown): { name?: string; message: string } {
    if (!error) return { message: 'Unknown error' }
    if (typeof error === 'string') return { message: error }
    const e = error as { name?: string; message?: string }
    const raw = e?.message || 'Unknown error'
    // Strip common absolute path patterns and long stack-like segments
    const withoutPaths = raw
      .replace(/\b\/?[A-Za-z]:\\[^\n]+/g, '[path]')
      .replace(/\b\/(?:[\w.-]+\/)+[\w.-]+/g, '[path]')
    const withoutStack = withoutPaths.replace(/\n\s*at\s+.*(\n|$)/g, '\n')
    return { name: e?.name, message: withoutStack.trim() }
  }

  /**
   * Use AI to rewrite a technical error message into a concise, user-friendly explanation
   * with suggested next steps. Avoids exposing sensitive implementation details.
   *
   * @param error - The thrown error to rewrite for the end user
   * @param operationHint - Optional human-readable operation context (e.g., "Create template")
   * @returns A short end-user friendly message
   */
  async generateUserFriendlyError(
    error: unknown,
    userMessage: string,
    operationHint?: string,
    options?: { reassureContinuation?: boolean }
  ): Promise<string> {
    const { name, message } = this.sanitizeError(error)
    const hint = operationHint ? `Operation: ${operationHint}\n` : ''
    const { reassureContinuation = true } = options || {}
    const reassuranceRule = reassureContinuation
      ? ' - Also add one short, positive reassurance that the remaining steps will continue and the user’s template will still be created.\n'
      : ''
    const prompt = `${hint}. You are a helpful assistant. Convert the following technical error into a short, user-friendly message that:
 - Starts with a brief and sincere apology (one short sentence)
 - Does not include any JSON or any special markers like [STATUS], [ERROR], [COMPLETE], TEMPLATE_DATA, TEMPLATE_CARD, etc.
 - Explains what likely went wrong in non-technical language
 - Avoids internal details, file paths, or stack traces
 - Use the user's message to determine the language of the response: ${userMessage}
 - ${LANGUAGE_SUPPORT_MESSAGE}
${reassuranceRule}

Original Error${name ? ` (${name})` : ''}: ${message}\n\nRespond in one short paragraph.`

    try {
      // Reuse the same chat invoker to keep tone/locale consistent with the conversation
      const aiText = await this.chatInvoker.invokeChat([{ role: 'user', content: prompt }])
      return aiText?.trim() || message
    } catch {
      // Fallback to sanitized message if AI fails
      return message
    }
  }

  /**
   * Emit a friendly, apologetic error message (STATUS/ERROR) while reassuring continuation.
   */
  async emitFriendlyError(args: {
    onChunk: (chunk: string) => void
    error: unknown
    userMessage: string
    operationHint: string
    options?: { reassureContinuation?: boolean }
  }): Promise<string> {
    const { onChunk, error, userMessage, operationHint, options } = args

    const base = await this.generateUserFriendlyError(error, userMessage, operationHint, options)
    const msg = `\n\n${base}\n\n`
    if (typeof onChunk === 'function') {
      onChunk(msg)
    }
    return msg
  }
}
