import { MCP_TOOLS } from '../constants'
import { getListProductsHandler } from './shopify/product'
import { getListTemplatesHandler, getDetailTemplateHandler, createTemplateHandler } from './template'
import { getUserPreferencesHandler } from './user-preferences'

export interface MCPToolHandlerContext {
  body: any
  shopDomain: string
}

export type MCPToolHandler = (ctx: MCPToolHandlerContext) => Promise<any>

/**
 * Registry mapping MCP tool actions to their handlers.
 */
export const mcpToolRegistry: Record<string, MCPToolHandler> = {
  [MCP_TOOLS.GET_LIST_TEMPLATES]: getListTemplatesHandler,
  [MCP_TOOLS.GET_DETAIL_TEMPLATE]: getDetailTemplateHandler,
  [MCP_TOOLS.CREATE_TEMPLATE]: createTemplateHandler,
  [MCP_TOOLS.GET_LIST_PRODUCTS]: getListProductsHandler,
  [MCP_TOOLS.GET_USER_PREFERENCES]: getUserPreferencesHandler,
}
