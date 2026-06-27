export interface AIRequestPayload {
  message: string
  userMessageId: string
  assistantMessageId: string
  conversationHistory: any[]
  conversationId: string
  suggestionId?: string
  stream?: boolean
}
