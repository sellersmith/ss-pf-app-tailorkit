/* eslint-disable max-len */
/**
 * Main AI agent for TailorKit template operations including creation, editing, and intent analysis.
 * Handles all template-related user requests through specialized services and orchestrators.
 */

import { BaseAgent, type AgentConfig } from './base.agent'
import type { AssistantResponse } from '../assistant.service'
import type { ChatInvoker } from './services/ProductIntentAnalyzer'
import type { BaseChatOpenAICallOptions } from '@langchain/openai'
import { TEMPLATE_INTENT_TYPES_MAP } from './constants/templates'
import { TemplateIntentAnalyzer } from './templates/TemplateIntentAnalyzer'
import { AGENT_MODEL, CONTEXT_EVALUATION_MESSAGE } from '../constant'
import { TemplateComposer } from './templates/services/TemplateComposer'
import { TemplateReview } from './templates/services/TemplateReview'
import { TemplateOperationParameterExtractor } from './templates/TemplateOperationParameterExtractor'
import type { TemplateContext } from './templates/context/TemplateContextProvider'
import { TemplateContextProvider } from './templates/context/TemplateContextProvider'
import type { SupervisorState } from '../supervisor'
import { LayerExecuteService } from './templates/services/LayerExecuteService'
import { OptionSetExecuteService } from './templates/services/OptionExecuteService'
import { TemplateExecutor } from './services/executors/TemplateExecutor'
import { EditOrchestrator } from './services/EditOrchestrator'

const CONVERSATION_HISTORY_LIMIT = 10

/**
 * Primary agent for AI-powered template operations in TailorKit.
 * Coordinates between intent analysis, template creation, and editing workflows.
 */
export class TemplateAgent extends BaseAgent {
  /** In-memory cache to avoid duplicate LLM calls for same query (canHandle → process) */
  private intentCache = new Map<string, Awaited<ReturnType<TemplateIntentAnalyzer['analyzeTemplateIntent']>>>()
  private intentAnalyzer: TemplateIntentAnalyzer
  private templateComposer: TemplateComposer
  private templateReview: TemplateReview
  private layerExecuteService: LayerExecuteService
  private optionSetExecuteService: OptionSetExecuteService
  private templateExecutor: TemplateExecutor
  private chatInvoker: ChatInvoker

  constructor() {
    const config: AgentConfig = {
      name: 'AI Template Management',
      description:
        '**AGENT MISSION**: Dedicated to generating and refining design templates. It structures layouts, organizes layers, and builds option sets that make personalized products possible in TailorKit. Unlike the Onboarding Agent (which helps users set up product context, styles, occasions, and audiences), the Template Agent focuses only on the creative template design itself.',
      systemPrompt: [
        'You are the AI Template specialist for TailorKit, a Shopify product personalizer app.',
        '',
        '**Your Role**:',
        '- Help users create new personalization templates or modify existing ones',
        '- Ensure outputs respect print production constraints and provide great UX',
        '',
        '**Capabilities**:',
        '- Create templates given product type, style/theme, and purpose',
        '- Modify layers (text, image, shape, effects, order, size)',
        '- Modify option sets (add/update/remove choices, mapping, display)',
        '',
        '**Response Style**:',
        '- Friendly, concise, and actionable',
        '- If key details are missing, ask only 1-2 precise questions',
        '',
        CONTEXT_EVALUATION_MESSAGE,
      ].join('\n'),
      model: AGENT_MODEL.TEMPLATE,
      temperature: 0.1,
      maxTokens: 32000,
    }
    super(config)

    // Initialize services with ChatInvoker interface
    const chatInvoker: ChatInvoker = {
      invokeChat: (messages: any[], options?: BaseChatOpenAICallOptions) => this.invokeChat(messages, options),
      buildMessages: (prompt: string) => this.buildMessages(prompt),
      streamChat: (messages: any[]) => this.chat.stream(messages),
    }
    this.chatInvoker = chatInvoker

    this.intentAnalyzer = new TemplateIntentAnalyzer(chatInvoker)
    this.templateComposer = new TemplateComposer(chatInvoker)
    this.templateReview = new TemplateReview(chatInvoker)

    // Initialize direct executors (lazy for layer/option set)
    this.templateExecutor = new TemplateExecutor()
    this.layerExecuteService = new LayerExecuteService(chatInvoker)
    this.optionSetExecuteService = new OptionSetExecuteService(chatInvoker)
  }

  /**
   * Determines if this agent can handle the query based on template intent analysis.
   * @param query User's raw message
   * @param context Optional context with conversation history
   * @returns True if query is template-related
   */
  async canHandle(query: string, context?: any): Promise<boolean> {
    // check cache first
    const key = query.trim().toLowerCase()
    let intent = this.intentCache.get(key)
    if (!intent) {
      intent = await this.intentAnalyzer.analyzeTemplateIntent(query, context?.conversationHistory || [])
      this.cacheSet(key, intent)
    }
    return intent.intentType !== TEMPLATE_INTENT_TYPES_MAP.unknown
  }

  /**
   * Processes template requests (non-streaming).
   * @param args.query User prompt
   * @param args.conversationHistory Recent chat history
   * @param args.context Template and shop context
   * @returns Response string with template data or status updates
   */
  async process(args: {
    query: string
    conversationHistory?: AssistantResponse[]
    conversationId?: string
    context?: SupervisorState['context']
  }): Promise<string> {
    const { query, conversationHistory = [], conversationId, context } = args

    const latestMessagesFromConversation = conversationHistory?.slice(-CONVERSATION_HISTORY_LIMIT)

    const keyProc = query.trim().toLowerCase()
    let intent = this.intentCache.get(keyProc)
    if (!intent) {
      intent = await this.intentAnalyzer.analyzeTemplateIntent(query, latestMessagesFromConversation)
      this.cacheSet(keyProc, intent)
    }

    switch (intent.intentType) {
      case TEMPLATE_INTENT_TYPES_MAP.template_create: {
        // Run review gate first: clarify if context missing instead of running heavy composer
        const reviewResult = await this.templateReview.ensureContextOrClarify(query, latestMessagesFromConversation)

        if (!reviewResult.proceed) {
          return reviewResult.message || ''
        }

        return this.templateComposer.createTemplate({
          prompt: query,
          context,
          conversationHistory: latestMessagesFromConversation,
        })
      }
      case TEMPLATE_INTENT_TYPES_MAP.template_edit:
      case TEMPLATE_INTENT_TYPES_MAP.layer_create:
      case TEMPLATE_INTENT_TYPES_MAP.layer_edit:
      case TEMPLATE_INTENT_TYPES_MAP.layer_delete:
      case TEMPLATE_INTENT_TYPES_MAP.option_set_create:
      case TEMPLATE_INTENT_TYPES_MAP.option_set_edit:
      case TEMPLATE_INTENT_TYPES_MAP.option_set_delete:
        return this.handleEditOperation({
          query,
          intent,
          context,
          conversationId,
        })
      case TEMPLATE_INTENT_TYPES_MAP.general_template:
      default:
        return this.handleRegularTemplate(query, latestMessagesFromConversation, context)
    }
  }

  /**
   * Processes template requests with streaming response chunks.
   * @param args.query User prompt
   * @param args.conversationHistory Recent chat history
   * @param args.context Template and shop context
   * @param args.onChunk Callback for streaming response chunks
   * @returns Final complete response string
   */
  async streamProcess(args: {
    query: string
    conversationHistory?: AssistantResponse[]
    conversationId?: string
    context?: SupervisorState['context']
    onChunk: (chunk: string) => void
  }): Promise<string> {
    const { query, conversationHistory = [], conversationId, context, onChunk } = args
    const latestMessagesFromConversation = conversationHistory?.slice(-CONVERSATION_HISTORY_LIMIT)

    const keyStream = query.trim().toLowerCase()
    let intent = this.intentCache.get(keyStream)
    if (!intent) {
      intent = await this.intentAnalyzer.analyzeTemplateIntent(query, latestMessagesFromConversation)
      this.cacheSet(keyStream, intent)
    }

    switch (intent.intentType) {
      case TEMPLATE_INTENT_TYPES_MAP.template_create: {
        // Run review gate (streaming): clarify if context missing, emitting statuses
        const reviewResult = await this.templateReview.ensureContextOrClarify(
          query,
          latestMessagesFromConversation,
          onChunk
        )
        if (!reviewResult.proceed) {
          return reviewResult.message || ''
        }

        return this.templateComposer.createTemplate({
          prompt: query,
          context,
          onChunk,
          conversationHistory: latestMessagesFromConversation,
        })
      }

      case TEMPLATE_INTENT_TYPES_MAP.template_edit:
      case TEMPLATE_INTENT_TYPES_MAP.layer_create:
      case TEMPLATE_INTENT_TYPES_MAP.layer_edit:
      case TEMPLATE_INTENT_TYPES_MAP.layer_delete:
      case TEMPLATE_INTENT_TYPES_MAP.option_set_create:
      case TEMPLATE_INTENT_TYPES_MAP.option_set_edit:
      case TEMPLATE_INTENT_TYPES_MAP.option_set_delete:
        return this.handleEditOperation({
          query,
          intent,
          context: context ?? ({} as SupervisorState['context']),
          conversationId,
          onChunk,
        })
      case TEMPLATE_INTENT_TYPES_MAP.general_template:
      default:
        return (
          super.streamProcess?.({ query, conversationHistory, context, onChunk })
          || this.process({ query, conversationHistory, context: context ?? ({} as SupervisorState['context']) })
        )
    }
  }

  /** Handles general template-related queries that don't require specific operations */
  private async handleRegularTemplate(
    query: string,
    conversationHistory: AssistantResponse[],
    context?: SupervisorState['context']
  ): Promise<string> {
    const messages = this.buildMessages(query, conversationHistory)

    if (context?.documentContext) {
      messages.push({ role: 'system', content: `Relevant documentation:\n\n${context.documentContext}` } as any)
    }

    if (context?.shopData) {
      messages.splice(1, 0, {
        role: 'system',
        content: `User context: Shop domain: ${context.shopData.shopDomain}, Setup completed: ${(context.shopData as any).setupCompleted || false}`,
      } as any)
    }

    return this.invokeChat(messages)
  }

  /** Orchestrates edit operations for templates, layers, and option sets */
  private async handleEditOperation(args: {
    query: string
    intent: any
    context: SupervisorState['context']
    conversationId?: string
    onChunk?: (chunk: string) => void
  }): Promise<string> {
    // Initialize context provider with shopDomain per request
    const ctx = args.context
    const shopDomain = ctx?.shopDomain || ctx?.shopData?.shopDomain || ''
    const templateContextProvider = new TemplateContextProvider(shopDomain)
    const templateOperationParameterExtractor = new TemplateOperationParameterExtractor(this.chatInvoker)

    const editOrchestrator = new EditOrchestrator(this.chatInvoker, {
      templateOperationParameterExtractor,
      contextProvider: templateContextProvider,
      executeEditOperation: (smartIntent: any, opContext: SupervisorState['context'] & TemplateContext) =>
        this.executeEditOperation(smartIntent, opContext),
    })
    return editOrchestrator.handleEditOperation(args)
  }

  /** Executes the specific edit operation using appropriate service based on intent type */
  private async executeEditOperation(
    smartIntent: any,
    context: SupervisorState['context'] & TemplateContext
  ): Promise<any> {
    const { intentType, parameters } = smartIntent

    // Fast path: template-level
    if (intentType === TEMPLATE_INTENT_TYPES_MAP.template_edit) {
      const result = await this.templateExecutor.editTemplate(parameters, (context as any)?.templateContext)
      return result
    }

    if (intentType.startsWith('layer_')) {
      return this.layerExecuteService.executeFunction(intentType, parameters, context)
    }
    if (intentType.startsWith('option_set_')) {
      return this.optionSetExecuteService.executeFunction(intentType, parameters, context)
    }

    const supported = Object.keys(TEMPLATE_INTENT_TYPES_MAP).concat(['template_edit']).join(', ')
    throw new Error(`Unsupported edit operation: ${intentType}. Supported: ${supported}`)
  }

  private cacheSet(key: string, value: Awaited<ReturnType<TemplateIntentAnalyzer['analyzeTemplateIntent']>>): void {
    if (this.intentCache.size >= 500) {
      // delete oldest (first inserted) key
      const firstKey = this.intentCache.keys().next().value
      if (firstKey) this.intentCache.delete(firstKey)
    }
    this.intentCache.set(key, value)
  }
}
