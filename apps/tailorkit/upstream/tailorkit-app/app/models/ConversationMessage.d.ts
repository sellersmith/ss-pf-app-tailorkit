import type { ConversationRole, FeedbackType } from '~/enums/conversationMessage'

interface ConversationMessageDocument {
  /**
   * The id of the message
   */
  id: string
  /**
   * The shop domain
   */
  shopDomain: string
  /**
   * The conversation id
   */
  conversationId: string
  /**
   * The content of the message
   */
  content: string
  /**
   * The role of the message
   */
  role: ConversationRole
  /**
   * The feedback of user for the message
   */
  feedback: FeedbackType | null
  /**
   * The metadata of the message
   */
  metadata?: Record<string, any>
  /**
   * The timestamp of the message
   */
  timestamp: Date
  /**
   * The last updated timestamp of the message
   */
  lastUpdated: Date
}

export { ConversationMessageDocument }
