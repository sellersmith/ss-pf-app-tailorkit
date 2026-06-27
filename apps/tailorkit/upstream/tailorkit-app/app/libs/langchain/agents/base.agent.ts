import type { BaseChatOpenAICallOptions } from '@langchain/openai'
import { ChatOpenAI } from '@langchain/openai'
import type { BaseMessage } from '@langchain/core/messages'
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages'
import type { AssistantResponse } from '../assistant.service'
import { BASE_AGENT_MODEL } from '../constant'

export interface AgentConfig {
  name: string
  description: string
  systemPrompt: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export abstract class BaseAgent {
  protected name: string
  protected description: string
  protected chat: ChatOpenAI
  protected systemPrompt: string

  constructor(config: AgentConfig) {
    this.name = config.name
    this.description = config.description
    this.systemPrompt = config.systemPrompt

    const baseChatModel = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: config.model || BASE_AGENT_MODEL,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 2000,
    })

    this.chat = baseChatModel.withRetry({
      stopAfterAttempt: 3,
    }) as any // Type assertion for compatibility
  }

  getName(): string {
    return this.name
  }

  getDescription(): string {
    return this.description
  }

  /** Expose system prompt for LangGraph node wrappers */
  getSystemPrompt(): string {
    return this.systemPrompt
  }

  /**
   * Check if this agent can handle the given query
   */
  abstract canHandle(query: string, context?: any): Promise<boolean>

  /**
   * Process the query and return a response
   */
  abstract process(args: { query: string; conversationHistory?: AssistantResponse[]; context?: any }): Promise<string>

  /**
   * Process the query with streaming support
   */
  async streamProcess(args: {
    query: string
    conversationHistory?: AssistantResponse[]
    context?: any
    onChunk: (chunk: string) => void
  }): Promise<string> {
    const { query, conversationHistory = [], context, onChunk } = args

    // Build base prompt with history
    const messages = this.buildMessages(query, conversationHistory)

    // Inject RAG-provided documentation (if any)
    if (context?.documentContext) {
      messages.push(new SystemMessage(`Relevant documentation:\n\n${context.documentContext}`))
    }

    // Use streaming from LangChain
    let accumulatedContent = ''

    try {
      const stream = await this.chat.stream(messages)

      for await (const chunk of stream) {
        const content = chunk.content
        if (typeof content === 'string' && content) {
          accumulatedContent += content
          onChunk(content)
        }
      }

      return accumulatedContent
    } catch (error) {
      console.error(`Error in ${this.name} agent streaming:`, error)
      // Fallback to non-streaming path that already includes documentContext via process()
      return this.process({ query, conversationHistory, context })
    }
  }

  /**
   * Helper method to invoke the chat model
   */
  protected async invokeChat(messages: BaseMessage[], options?: BaseChatOpenAICallOptions): Promise<string> {
    const result = await this.chat.invoke(messages, options)
    return result.content as string
  }

  /**
   * Build standard message array with system prompt and history
   */
  protected buildMessages(query: string, conversationHistory: AssistantResponse[] = []): BaseMessage[] {
    const messages: BaseMessage[] = [new SystemMessage(this.systemPrompt)]

    // Add conversation history
    for (const msg of conversationHistory) {
      if (msg.role === 'user') {
        messages.push(new HumanMessage(msg.content))
      } else if (msg.role === 'assistant') {
        messages.push(new AIMessage(msg.content))
      }
    }

    // Add current query
    messages.push(new HumanMessage(query))

    return messages
  }
}
