import type { ShopDocument } from '~/models/Shop'

/**
 * Interface for errors returned by MCP authentication
 */
interface McpAuthError {
  code: string
  status: number
  message: string
}

/**
 * Result of a successful MCP authentication
 */
interface McpAuthSuccess {
  shop: ShopDocument
  shopDomain: string
}

/**
 * Result of MCP authentication verification
 */
type McpAuthResult = McpAuthSuccess | McpAuthError

/**
 * Context for MCP request processing
 */
interface McpRequestContext {
  shop: ShopDocument
  shopDomain: string
  body: any
}

export type { McpAuthError, McpAuthResult, McpRequestContext }
