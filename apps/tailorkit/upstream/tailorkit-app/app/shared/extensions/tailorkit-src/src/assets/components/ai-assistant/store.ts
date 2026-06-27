import { signal } from '@preact/signals'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export const messages = signal<ChatMessage[]>([])
export const status = signal<'idle' | 'processing' | 'streaming' | 'done'>('idle')
