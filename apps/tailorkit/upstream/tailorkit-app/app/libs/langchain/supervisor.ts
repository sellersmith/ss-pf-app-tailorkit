/**
 * Legacy supervisor types — kept for backward compatibility.
 * The SupervisorState interface is referenced by 8+ agent service files.
 * The actual supervisor logic has been replaced by openai-agentic-loop.server.ts.
 *
 * TODO: Migrate agent services to use a local context type, then delete this file.
 */

import type { AssistantResponse } from './assistant.service'
import type { ShopDocument } from '~/models/Shop.d'
import type { AdminApiContext } from '@shopify/shopify-app-remix/server'

export interface SupervisorState {
  query: string
  conversationId: string
  conversationHistory: AssistantResponse[]
  context?: {
    shopData: ShopDocument
    shopDomain: string
    accessToken?: string
    shopifyAdmin: AdminApiContext
    documentContext?: string
    [key: string]: any
  }
  selectedAgent?: string
  agentResponse?: string
  routingReason?: string
}
