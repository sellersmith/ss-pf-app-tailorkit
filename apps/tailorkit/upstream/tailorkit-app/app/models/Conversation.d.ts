export interface ConversationDocument {
  shopDomain: string
  id: string
  title: string
  messages: string[]
  lastUpdated: Date
  metadata?: {
    keywords: string[]
    summary: string
  }
  createdAt: Date
  updatedAt: Date
}

export interface ConversationInput {
  id: string
  title: string
  messages: string[]
  keywords: string[]
  lastUpdated: Date
  metadata?: any
}
