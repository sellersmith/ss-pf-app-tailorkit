import type { ShopDocument } from '~/models/Shop'
import { MCP_TOOLS_EVENT_MARKDOWN_KEY } from '~/services/mcp/constants'
import { MCP_TOOLS_EVENTS_MARKDOWN } from '~/services/mcp/admin/types'

/**
 * Validates shop data and connected clients
 */
export const validateShopAndClients = (shopData: ShopDocument, globalClientIds: string[]) => {
  if (!shopData) {
    throw new Error('Shop data not found')
  }

  if (!globalClientIds || globalClientIds.length === 0) {
    throw new Error('No TailorKit clients connected to this server instance')
  }
}

/**
 * Formats MCP tool names
 */
export const formatMCPToolNames = (tools: any[]) => {
  return tools.map(t => ({
    ...t,
    function: {
      name: t.function.name,
      description: t.function.description,
    },
  }))
}

/**
 * Logs error with context
 */
export const logError = (error: any, context: string) => {
  console.error(`Error in ${context}:`, error)
  return error
}

/**
 * Stream headers for SSE
 */
export const STREAM_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
}

/**
 * Generates loading event markdown
 */
export const generateLoadingEventMarkdown = (isLoading: boolean) => {
  const eventDataString = JSON.stringify({
    eventName: isLoading ? MCP_TOOLS_EVENTS_MARKDOWN.LOADING : MCP_TOOLS_EVENTS_MARKDOWN.LOADING_DONE,
  })

  return `${MCP_TOOLS_EVENT_MARKDOWN_KEY}${eventDataString}\n\n`
}
