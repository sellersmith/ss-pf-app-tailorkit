import { type ConversationDocument } from '~/models/Conversation'
import { type ConversationMessageDocument } from '~/models/ConversationMessage'
import { uuid } from '~/utils/uuid'

export interface IMessageInput
  extends Omit<ConversationMessageDocument, 'shopDomain' | 'conversationId' | 'lastUpdated'> {}

export interface IConversationInput
  extends Omit<ConversationDocument, 'shopDomain' | 'updatedAt' | 'createdAt' | 'messages'> {
  messages: IMessageInput[]
}

export const DEFAULT_CONVERSATION: IConversationInput & {
  messages: ConversationMessageDocument[]
} = {
  id: uuid(),
  title: 'New Conversation',
  messages: [],
  metadata: {
    keywords: [],
    summary: '',
  },
  lastUpdated: new Date(),
}

export const CREDIT_USAGE = {
  TEXT: 1,
  TEXT_GENERATION: 1,
  IMAGE: 7,
}

// Custom markdown format for AI assistant
const CUSTOM_MARKDOWN = '~~~'

export const CUSTOM_AI_ASSISTANT_MARKDOWN_FORMAT = {
  GENERATING_IMAGE: `${CUSTOM_MARKDOWN}GENERATING_IMAGE${CUSTOM_MARKDOWN}`,
  GENERATED_IMAGE: `${CUSTOM_MARKDOWN}GENERATED_IMAGE${CUSTOM_MARKDOWN}`,
  IMAGE_GENERATION_START: `${CUSTOM_MARKDOWN}image${CUSTOM_MARKDOWN}`,
  IMAGE_GENERATION_END: `${CUSTOM_MARKDOWN}`,
}

export const AI_ASSISTANT_ADMIN_SYSTEM_MESSAGE = [
  'You are Elva, AI assistant for TailorKit - a Shopify product personalizer.',
  '',
  '## Response Protocol:',
  '1. **Always acknowledge first**: Send brief waiting message for any request requiring processing',
  '2. **Act immediately**: Use tools/functions without lengthy explanations',
  '3. **Stay in scope**: TailorKit, POD, e-commerce, product personalization only',
  '4. **Match user language**: Respond in the language user communicates in',
  '',
  '## Core Rules:',
  '- Never mention competitor apps or services',
  '- Provide factual information only - use tools when uncertain',
  '- Keep pre-action messages to one brief line',
  '- Redirect off-topic requests politely',
  '',
  'Be helpful, professional, and efficient. Quality support means quick acknowledgment followed by accurate assistance.',
].join('\n')
