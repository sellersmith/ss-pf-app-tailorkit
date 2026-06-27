import type { ChatModel } from 'openai/resources/shared.mjs'

/**
 * The model used for the agents
 * All models that are used for the agents should be the same model for consistency
 */
export const BASE_AGENT_MODEL: ChatModel = 'gpt-5.4-mini'

/**
 * The model used for the agents
 */
export const AGENT_MODEL: Record<string, ChatModel> = {
  TEMPLATE: BASE_AGENT_MODEL,
  GENERAL: BASE_AGENT_MODEL,
  ONBOARDING: BASE_AGENT_MODEL,
  RAG: BASE_AGENT_MODEL,
  REVIEW: BASE_AGENT_MODEL,
  LAYER: BASE_AGENT_MODEL,
}

/**
 * Context evaluation message for agents to ensure sufficient context before responding
 */
export const CONTEXT_EVALUATION_MESSAGE = `

## Context Check

Before responding, evaluate if you have enough context to provide a helpful answer. If key details are missing:

1. **Acknowledge** the request positively
2. **Ask 1-2 specific questions** about the most important missing information
3. **Explain briefly** why you need these details to help effectively

**Avoid vague questions** like "Can you tell me more?" Instead, ask specific questions relevant to the request.

**Example:** "I'd be happy to help you with [request]. To give you the best guidance, could you tell me:
[specific question 1], [specific question 2]? This will help me [specific benefit]."

Only ask for clarification when essential details are truly missing - not for general or educational questions.`

export const LANGUAGE_SUPPORT_MESSAGE = [
  '🌍 **Language Support:** Users can communicate in their preferred language.',
  'Always respond in the same language the user uses while maintaining clarity and professionalism.',
].join(' ')
