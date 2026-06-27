/**
 * Preflight review service validating context sufficiency before template generation.
 */

/* eslint-disable max-len */
import type { AssistantResponse } from '~/libs/langchain/assistant.service'
import type { ChatInvoker } from '../../services/ProductIntentAnalyzer'
import type { TemplateContextAnalyze } from '../context/ContextAnalyzer'
import { ContextAnalyzer } from '../context/ContextAnalyzer'
import { CONFIDENCE_THRESHOLDS } from '../constants/style.constants'
import { LANGUAGE_SUPPORT_MESSAGE } from '~/libs/langchain/constant'

/** Result of context sufficiency analysis with next action guidance. */
export interface ClarificationResult {
  /** Whether context is sufficient to proceed with template generation */
  proceed: boolean
  /** Parsed template context (only present when proceed is true) */
  context?: TemplateContextAnalyze
  /** Clarification message for user (only present when proceed is false) */
  message?: string
  /** Error message if analysis failed */
  errorMessage?: string
}

/** Validation service ensuring sufficient context before template generation with clarification questions. */
export class TemplateReview {
  /** Context analyzer for parsing and validating user input */
  private contextAnalyzer: ContextAnalyzer

  /** Creates TemplateReview with AI service for context validation and clarification. */
  constructor(private chatInvoker: ChatInvoker) {
    this.contextAnalyzer = new ContextAnalyzer(chatInvoker)
  }

  /** Evaluates context sufficiency using field validation and confidence thresholds. */
  private isContextSufficient(context: TemplateContextAnalyze): boolean {
    try {
      const productType = String(context?.product?.type || '')
        .trim()
        .toLowerCase()
      const styleTheme = String(context?.style?.theme || '')
        .trim()
        .toLowerCase()
      const width = Number(context?.product?.printableAreas?.width || 0)
      const height = Number(context?.product?.printableAreas?.height || 0)

      const hasProductType = productType && productType !== 'missing'
      const hasStyleTheme = styleTheme && styleTheme !== 'missing'
      const hasValidDims = width > 0 && height > 0

      // Use confidence-based sufficiency similar to ProductIntentAnalyzer pattern
      const confidence = Number(context?.confidence ?? 0)
      const meetsConfidence = confidence >= CONFIDENCE_THRESHOLDS.CONTEXT_SUFFICIENT

      // Accept either clearly sufficient fields OR high confidence from analyzer
      return Boolean((hasProductType && hasStyleTheme && hasValidDims) || meetsConfidence)
    } catch {
      return false
    }
  }

  /** Builds system message for clarification questions based on missing context fields. */
  private buildClarificationSystemMessage(partial: Partial<TemplateContextAnalyze> | null): string {
    const productType = String(partial?.product?.type || '')
      .trim()
      .toLowerCase()
    const styleTheme = String(partial?.style?.theme || '')
      .trim()
      .toLowerCase()
    const width = Number(partial?.product?.printableAreas?.width || 0)
    const height = Number(partial?.product?.printableAreas?.height || 0)

    const missing: string[] = []
    if (!productType || productType === 'missing') missing.push('product type')
    if (!styleTheme || styleTheme === 'missing') missing.push('style/theme')
    if (!(width > 0 && height > 0)) missing.push('print dimensions')

    const missingList = missing.length ? missing.join(', ') : 'key details'

    return [
      'You are assisting a merchant to create a print-on-demand personalization template.',
      `Some required context is missing: ${missingList}.`,
      '- Ask only 1–2 concise follow-up questions to collect the missing information.',
      '- Be specific and actionable. Do not include JSON or any special markers.',
      '- Do NOT output TEMPLATE_DATA or TEMPLATE_CARD in your response.',
      LANGUAGE_SUPPORT_MESSAGE,
    ].join('\n')
  }

  /** Analyzes context sufficiency and generates clarification questions if needed with streaming support. */
  async ensureContextOrClarify(
    prompt: string,
    conversationHistory?: AssistantResponse[],
    onChunk?: (chunk: string) => void
  ): Promise<ClarificationResult> {
    try {
      const context = await this.contextAnalyzer.analyzeContext(prompt, conversationHistory)
      if (this.isContextSufficient(context)) {
        return { proceed: true, context }
      }
      if (onChunk) {
        onChunk(`[STATUS]need-more-details-to-create-template[/STATUS]`)
        onChunk(`[STATUS]please-specify-product-and-style[/STATUS]`)
      }

      const systemMsg = this.buildClarificationSystemMessage(context)
      const messages = this.chatInvoker.buildMessages(prompt)
      messages.push({ role: 'system', content: systemMsg } as any)
      if (onChunk && this.chatInvoker.streamChat) {
        let full = ''
        const stream = await this.chatInvoker.streamChat(messages)
        for await (const chunk of stream) {
          const content = chunk?.content
          if (typeof content === 'string' && content) {
            full += content
            onChunk(content)
          }
        }
        return { proceed: false, message: full }
      }
      const reply = await this.chatInvoker.invokeChat(messages)
      if (onChunk && reply) onChunk(reply)
      return { proceed: false, message: reply }
    } catch (error: any) {
      if (onChunk) {
        onChunk(`[STATUS]need-more-details-to-create-template[/STATUS]`)
        onChunk(`[STATUS]please-specify-product-and-style[/STATUS]`)
      }
      const systemMsg = this.buildClarificationSystemMessage(null)
      const messages = this.chatInvoker.buildMessages(prompt)
      messages.push({ role: 'system', content: systemMsg } as any)
      if (onChunk && this.chatInvoker.streamChat) {
        let full = ''
        const stream = await this.chatInvoker.streamChat(messages)
        for await (const chunk of stream) {
          const content = chunk?.content
          if (typeof content === 'string' && content) {
            full += content
            onChunk(content)
          }
        }
        return { proceed: false, message: full }
      }
      const reply = await this.chatInvoker.invokeChat(messages)
      if (onChunk && reply) onChunk(reply)
      return { proceed: false, message: reply, errorMessage: typeof error === 'string' ? error : error?.message }
    }
  }
}
