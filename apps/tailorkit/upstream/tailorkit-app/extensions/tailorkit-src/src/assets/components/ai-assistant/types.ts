// Simple message type
export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

// Track conversation history for backend API
export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

// Props for AiAssistant component
export interface AiAssistantProps {
  preMadePrompt?: string
}
