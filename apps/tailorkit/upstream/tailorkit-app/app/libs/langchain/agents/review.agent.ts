import { ChatOpenAI } from '@langchain/openai'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { AGENT_MODEL } from '../constant'

export interface ReviewResult {
  decision: 'complete' | 'retry' | 'handoff' | 'error'
  critique?: string
}

interface ReviewArgs {
  query: string
  agentKey: string
  agentResponse: string
}

/**
 * ReviewAgent evaluates the output of a specialist agent and decides whether:
 *  - the answer is good enough ("complete")
 *  - the same agent should try again ("retry")
 *  - we should hand off to the General agent ("handoff")
 *  - an unrecoverable error occurred ("error")
 */
export class ReviewAgent {
  private chat: ChatOpenAI

  constructor() {
    this.chat = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: AGENT_MODEL.REVIEW,
      temperature: 0,
      maxTokens: 256,
    })
  }

  async process(args: ReviewArgs): Promise<ReviewResult> {
    const { query, agentKey, agentResponse } = args

    const systemPrompt = [
      'You are a strict quality reviewer for TailorKit AI assistants.',
      "You must decide if the assistant's answer should be returned to the user, retried, or handed off.",
      'Rules:',
      '1. Return pure JSON with keys "decision" and optional "critique" – **no markdown**.',
      '2. "decision" must be one of: complete, retry, handoff, error.',
      '3. If decision is not "complete", include a short "critique" (max 2 sentences).',
    ].join('\n')

    const reviewPrompt = [
      `User query: "${query}"`,
      `Agent: ${agentKey}`,
      'Agent response:',
      agentResponse,
      '',
      'Evaluate and respond with JSON.',
    ].join('\n')

    try {
      const result: any = await this.chat.invoke([new SystemMessage(systemPrompt), new HumanMessage(reviewPrompt)])

      const text = (result.content as string).trim()
      return JSON.parse(text) as ReviewResult
    } catch (error) {
      console.error('ReviewAgent error – falling back to complete:', error)
      return { decision: 'complete' }
    }
  }
}
