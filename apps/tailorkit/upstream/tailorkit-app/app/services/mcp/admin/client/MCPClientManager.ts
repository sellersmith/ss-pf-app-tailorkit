import { authenticatedFetch } from '~/shopify/fns.client'
import { CONNECTION_ACTION } from '~/routes/api.connections/constant'
import { AdminMCPClientCore } from './AdminMCPClientCore'
import { MCPActionHandler } from './mcpActionHandler'
import type { MCPMessage } from './types'

export class MCPClientManager {
  private static instance: MCPClientManager | null = null
  private mcpClient: AdminMCPClientCore | null = null
  private actionHandler: MCPActionHandler | null = null
  private sessionCheckInterval: number | null = null

  // private constructor() {}

  static getInstance(): MCPClientManager {
    if (!MCPClientManager.instance) {
      MCPClientManager.instance = new MCPClientManager()
    }
    return MCPClientManager.instance
  }

  async initialize(origin: string, path: string): Promise<void> {
    if (this.mcpClient) {
      console.warn('MCP Client already initialized')
      return
    }

    try {
      // Get session ID from API
      const response = await authenticatedFetch(
        `/api/connections?action=${CONNECTION_ACTION.CHECK_ADMIN_MCP_CONNECTION}`
      )

      if (!response.success) {
        throw new Error('Failed to get session ID')
      }

      const { sessionId } = response.mcp || { sessionId: null }

      // Initialize MCP client with session ID
      this.mcpClient = new AdminMCPClientCore(origin, path, sessionId)
      this.actionHandler = new MCPActionHandler(this.mcpClient)

      // Connect action handler to client
      this.mcpClient.onActionRequest = (message: MCPMessage) => {
        this.actionHandler?.handleAction(message)
      }

      // Connect to MCP server
      await this.mcpClient.connect()

      console.log('🚀 MCP Client Manager initialized successfully')
    } catch (error) {
      console.error('Failed to initialize MCP Client Manager:', error)
      this.cleanup()
      throw error
    }
  }

  private async reinitialize(sessionId: string): Promise<void> {
    if (!this.mcpClient) return

    const origin = this.mcpClient.getOrigin()
    const path = this.mcpClient.getPath()

    await this.cleanup()
    this.mcpClient = new AdminMCPClientCore(origin, path, sessionId)
    this.actionHandler = new MCPActionHandler(this.mcpClient)

    // Connect action handler to client
    this.mcpClient.onActionRequest = (message: MCPMessage) => {
      this.actionHandler?.handleAction(message)
    }

    // Connect to MCP server
    await this.mcpClient.connect()
  }

  getMCPClient(): AdminMCPClientCore | null {
    return this.mcpClient
  }

  getActionHandler(): MCPActionHandler | null {
    return this.actionHandler
  }

  async cleanup(): Promise<void> {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval)
      this.sessionCheckInterval = null
    }

    if (this.actionHandler) {
      this.actionHandler.cleanup()
      this.actionHandler = null
    }

    if (this.mcpClient) {
      await this.mcpClient.disconnect()
      this.mcpClient = null
    }
  }
}
