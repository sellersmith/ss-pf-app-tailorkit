/* eslint-disable max-len */
import { BaseAgent, type AgentConfig } from './base.agent'
import type { AssistantResponse } from '../assistant.service'
import { ProductIntentAnalyzer, type ChatInvoker } from './services/ProductIntentAnalyzer'
import { ProductRecommendationService } from './services/ProductRecommendationService'
import type { BaseChatOpenAICallOptions } from '@langchain/openai'
import { AGENT_MODEL, CONTEXT_EVALUATION_MESSAGE, LANGUAGE_SUPPORT_MESSAGE } from '../constant'

export class OnboardingAgent extends BaseAgent {
  /**
   * Very small in-memory cache so we don’t call the LLM twice for the
   * exact same user query (canHandle → process).
   *
   * Key = raw user query string, Value = intent object returned by
   * ProductIntentAnalyzer.
   * This is only per-instance and therefore per Lambda / Node process – it
   * auto-expires when the process dies, so no manual eviction required.
   */
  private intentCache = new Map<string, Awaited<ReturnType<ProductIntentAnalyzer['analyzeProductIntent']>>>()
  private intentAnalyzer: ProductIntentAnalyzer
  private recommendationService: ProductRecommendationService

  constructor() {
    const config: AgentConfig = {
      name: 'AI Onboarding',
      description:
        '**AGENT MISSION**: Helps users setup/create personalized products.\n Context can be provided by the user or AI. User also can select/change style, occasion, audience, etc. for personalized products',
      systemPrompt: `You are the AI Onboarding specialist for TailorKit, a Shopify product personalizer app.

**Your Role**: Guide new users through product personalization and help them get started with TailorKit.

**Core Purpose**:
- Assist users who want to create personalized products for their store
- Provide encouraging, friendly support for getting started
- Help users understand TailorKit's capabilities

**How You Operate**:
When users express interest in creating, personalizing, or recommending products, our specialized services will:
- Analyze their shop and existing products
- Find relevant products from their catalog or our print-on-demand collection
- Generate personalized product recommendations with visual mockups
- Provide ready-to-customize product suggestions

For general onboarding questions (setup, installation, account issues), provide helpful guidance based on the user's context and any available documentation.

**Response Style**:
- Friendly and encouraging
- Focus on the value of personalization
- Keep responses concise but helpful
- Respond in the same language as the user's query

**Important**: You don't need to worry about technical implementation details, product fetching, or card formatting - our backend services handle all the complex product operations automatically.

${CONTEXT_EVALUATION_MESSAGE}
${LANGUAGE_SUPPORT_MESSAGE}
`,
      model: AGENT_MODEL.ONBOARDING,
      temperature: 0.3,
    }
    super(config)

    // Initialize services with ChatInvoker interface
    const chatInvoker: ChatInvoker = {
      invokeChat: (messages: any[], options?: BaseChatOpenAICallOptions) => this.invokeChat(messages, options),
      buildMessages: (prompt: string) => this.buildMessages(prompt),
      streamChat: (messages: any[]) => this.chat.stream(messages),
    }

    this.intentAnalyzer = new ProductIntentAnalyzer(chatInvoker)
    this.recommendationService = new ProductRecommendationService(chatInvoker)
  }

  async canHandle(query: string, context?: any): Promise<boolean> {
    // check cache first
    const key = query.trim().toLowerCase()
    let intent = this.intentCache.get(key)
    if (!intent) {
      intent = await this.intentAnalyzer.analyzeProductIntent(query)
      this.cacheSet(key, intent)
    }
    return intent.shouldRecommend
  }

  async process(args: { query: string; conversationHistory?: AssistantResponse[]; context?: any }): Promise<string> {
    const { query, conversationHistory = [], context } = args

    const keyProc = query.trim().toLowerCase()
    let intent = this.intentCache.get(keyProc)
    if (!intent) {
      intent = await this.intentAnalyzer.analyzeProductIntent(query)
      this.cacheSet(keyProc, intent)
    }

    if (intent.shouldRecommend) {
      return this.recommendationService.handleProductRecommendation(
        query,
        context,
        false,
        intent.searchQuery,
        undefined,
        this.createChatInvoker()
      )
    }

    return this.handleRegularOnboarding(query, conversationHistory, context)
  }

  async streamProcess(args: {
    query: string
    conversationHistory?: AssistantResponse[]
    context?: any
    onChunk: (chunk: string) => void
  }): Promise<string> {
    const { query, conversationHistory = [], context, onChunk } = args

    const keyStream = query.trim().toLowerCase()
    let intent = this.intentCache.get(keyStream)
    if (!intent) {
      intent = await this.intentAnalyzer.analyzeProductIntent(query)
      this.cacheSet(keyStream, intent)
    }

    if (intent.shouldRecommend) {
      return this.recommendationService.handleProductRecommendation(
        query,
        context,
        true,
        intent.searchQuery,
        onChunk,
        this.createChatInvoker()
      )
    }

    return (
      super.streamProcess?.({ query, conversationHistory, context, onChunk })
      || this.process({ query, conversationHistory, context })
    )
  }

  /**
   * Create a ChatInvoker interface for the services
   */
  private createChatInvoker(): ChatInvoker {
    return {
      invokeChat: (messages: any[]) => this.invokeChat(messages),
      buildMessages: (prompt: string) => this.buildMessages(prompt),
      streamChat: (messages: any[]) => this.chat.stream(messages),
    }
  }

  /**
   * Handle regular onboarding queries
   */
  private async handleRegularOnboarding(
    query: string,
    conversationHistory: AssistantResponse[],
    context: any
  ): Promise<string> {
    const messages = this.buildMessages(query, conversationHistory)

    if (context?.documentContext) {
      messages.push({ role: 'system', content: `Relevant documentation:\n\n${context.documentContext}` } as any)
    }

    if (context?.shopData) {
      messages.splice(1, 0, {
        role: 'system',
        content: `User context: Shop domain: ${context.shopData.shopDomain}, Setup completed: ${context.shopData.setupCompleted || false}`,
      } as any)
    }

    return this.invokeChat(messages)
  }

  private cacheSet(key: string, value: Awaited<ReturnType<ProductIntentAnalyzer['analyzeProductIntent']>>): void {
    if (this.intentCache.size >= 500) {
      // delete oldest (first inserted) key
      const firstKey = this.intentCache.keys().next().value
      if (firstKey) this.intentCache.delete(firstKey)
    }
    this.intentCache.set(key, value)
  }
}
