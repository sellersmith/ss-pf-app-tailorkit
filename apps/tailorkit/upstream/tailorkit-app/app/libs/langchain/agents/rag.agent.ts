import { BaseAgent, type AgentConfig } from './base.agent'
import type { AssistantResponse } from '../assistant.service'
import { findRelevantDocumentation } from '~/utils/openai-client.server'
import { AGENT_MODEL, CONTEXT_EVALUATION_MESSAGE } from '../constant'

export class RAGAgent extends BaseAgent {
  // Simple in-memory LRU cache (shopDomain:searchQuery -> docs)
  private static readonly _cache = new Map<string, string>()
  private static readonly MAX_CACHE_ENTRIES = 100

  constructor() {
    const config: AgentConfig = {
      name: 'Knowledge Retrieval',
      description: 'Intelligently retrieves relevant documentation and knowledge when needed',
      systemPrompt: `You are a knowledge retrieval specialist for TailorKit AI Assistant.
      Your role is to:
      1. **Analyze queries** to determine if they need additional documentation or knowledge
      2. **Retrieve relevant information** from the knowledge base when appropriate
      3. **Enhance responses** with factual, up-to-date information

      **When to retrieve documentation:**
      - Technical questions about TailorKit features
      - Setup, configuration, or integration queries
      - Troubleshooting and error resolution
      - How-to questions and tutorials
      - Product-specific information needs

      **When NOT to retrieve:**
      - Simple greetings or casual conversation
      - Image generation requests
      - Design creation tasks
      - Questions already answered in conversation history
      - Requests that don't require factual knowledge

      **Output format:**
      If retrieval is needed: Return "RETRIEVE: [search query]"
      If no retrieval needed: Return "NO_RETRIEVAL"

      Be precise and focused in your retrieval decisions.

${CONTEXT_EVALUATION_MESSAGE}`,
      model: AGENT_MODEL.RAG,
      temperature: 0.1, // Very low temperature for consistent decisions
    }
    super(config)
  }

  async canHandle(query: string, context?: any): Promise<boolean> {
    // RAG agent is a utility agent, not a primary responder
    return false
  }

  /**
   * Determines if documentation retrieval is needed and returns the search query
   */
  async shouldRetrieve(args: {
    query: string
    conversationHistory?: AssistantResponse[]
    context?: any
  }): Promise<{ shouldRetrieve: boolean; searchQuery?: string }> {
    const { query, conversationHistory = [] } = args

    const messages = this.buildMessages(
      `Analyze this query and determine if documentation retrieval is needed: "${query}"`,
      conversationHistory
    )

    try {
      const decision = await this.invokeChat(messages)

      if (decision.startsWith('RETRIEVE:')) {
        const searchQuery = decision.replace('RETRIEVE:', '').trim()
        return { shouldRetrieve: true, searchQuery }
      }

      return { shouldRetrieve: false }
    } catch (error) {
      console.error('RAGAgent decision failed:', error)
      return { shouldRetrieve: false }
    }
  }

  /**
   * Retrieves relevant documentation based on the search query
   */
  async retrieveDocumentation(args: {
    searchQuery: string
    context?: any
    match_threshold?: number
    match_count?: number
  }): Promise<string | null> {
    const { searchQuery, context, match_threshold = 0.85, match_count = 3 } = args

    if (!context?.shopData || !context?.shopDomain) {
      console.warn('RAGAgent: Missing required context for retrieval')
      return null
    }

    // --- LRU cache lookup --------------------------------------------------
    const shopDomain = context!.shopDomain as string
    const cacheKey = `${shopDomain}:${searchQuery}`
    if (RAGAgent._cache.has(cacheKey)) {
      // Move key to the end to mark it as recently used
      const cached = RAGAgent._cache.get(cacheKey) as string
      RAGAgent._cache.delete(cacheKey)
      RAGAgent._cache.set(cacheKey, cached)
      return cached
    }

    try {
      const { documents } = await findRelevantDocumentation(
        'match_documents',
        searchQuery,
        shopDomain,
        context!.shopData,
        { match_threshold, match_count }
      )

      if (documents && documents.length > 0) {
        const result = documents.map((doc: any) => `## ${doc.title}\n${doc.content}`).join('\n\n')

        // ---- save to cache ----
        RAGAgent._cache.set(cacheKey, result)
        // Enforce max size
        if (RAGAgent._cache.size > RAGAgent.MAX_CACHE_ENTRIES) {
          // delete oldest (first) key
          const firstKey = RAGAgent._cache.keys().next().value
          if (firstKey) {
            RAGAgent._cache.delete(firstKey)
          }
        }

        return result
      }

      return null
    } catch (error) {
      console.error('RAGAgent documentation retrieval failed:', error)
      return null
    }
  }

  /**
   * Main process method - combines decision and retrieval
   */
  async process(args: { query: string; conversationHistory?: AssistantResponse[]; context?: any }): Promise<string> {
    const { shouldRetrieve, searchQuery } = await this.shouldRetrieve(args)

    if (!shouldRetrieve || !searchQuery) {
      return ''
    }

    const result = await this.retrieveDocumentation({
      searchQuery,
      context: args.context,
    })

    return result || ''
  }
}
