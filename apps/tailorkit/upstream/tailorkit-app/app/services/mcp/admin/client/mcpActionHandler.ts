import { MCP_TOOLS } from '~/routes/api.mcp.$tool/constants'
import type { MCPMessage } from './types'
import type { AdminMCPClientCore } from './AdminMCPClientCore'

export interface ActionResult {
  success: boolean
  result?: any
  error?: string
}

export class MCPActionHandler {
  private mcpClient: AdminMCPClientCore
  private stateUpdateTimer: number | null = null

  constructor(mcpClient: AdminMCPClientCore) {
    this.mcpClient = mcpClient
  }

  async handleAction(message: MCPMessage): Promise<void> {
    const { requestId, action, params } = message
    console.log(`🛠️ Executing MCP action: ${action}`, { message, params })

    try {
      const result = await this.executeAction(action, params)

      console.log(`✅ MCP action ${action} completed`)
      this.mcpClient.sendActionResult(requestId!, true, result)

      // Update state after successful action with debounce
      this.scheduleStateUpdate({
        lastAction: action,
        timestamp: new Date().toISOString(),
      })
    } catch (error: any) {
      console.error(`❌ MCP action ${action} failed:`, error)
      this.mcpClient.sendActionResult(requestId!, false, undefined, error.message)
    }
  }

  private scheduleStateUpdate(state: any): void {
    if (this.stateUpdateTimer) {
      clearTimeout(this.stateUpdateTimer)
    }

    this.stateUpdateTimer = window.setTimeout(() => {
      if (this.mcpClient.isClientConnected()) {
        this.mcpClient.sendStateUpdate(state)
      }
      this.stateUpdateTimer = null
    }, 200) as any
  }

  private async executeAction(action: string, params?: any): Promise<any> {
    switch (action) {
      case MCP_TOOLS.CREATE_TEMPLATE:
        return this.handleCreateTemplate(params)
      case MCP_TOOLS.CREATE_LAYER:
        return this.handleCreateLayer(params)
      case MCP_TOOLS.ASSISTANT:
        return this.handleAssistant(params)
      default:
        throw new Error(`Unknown MCP action: ${action}`)
    }
  }

  private async handleCreateTemplate(params: any): Promise<ActionResult> {
    try {
      console.log('Creating template with params:', params)
      // Implement template creation logic here
      return {
        success: true,
        result: {
          message: 'Template created successfully',
          ...params,
        },
      }
    } catch (error: any) {
      console.error('Failed to create template:', error)
      return {
        success: false,
        error: error.message || 'Failed to create template',
      }
    }
  }

  private async handleCreateLayer(params: any): Promise<ActionResult> {
    try {
      console.log('Creating layer with params:', params)
      // Implement layer creation logic here
      return {
        success: true,
        result: {
          message: 'Layer created successfully',
          ...params,
        },
      }
    } catch (error: any) {
      console.error('Failed to create layer:', error)
      return {
        success: false,
        error: error.message || 'Failed to create layer',
      }
    }
  }

  private async handleAssistant(params: any): Promise<ActionResult> {
    try {
      console.log('Processing assistant action with params:', params)
      // Implement assistant logic here
      return {
        success: true,
        result: {
          message: 'Assistant action completed',
          ...params,
        },
      }
    } catch (error: any) {
      console.error('Failed to process assistant action:', error)
      return {
        success: false,
        error: error.message || 'Failed to process assistant action',
      }
    }
  }

  // Cleanup
  cleanup(): void {
    if (this.stateUpdateTimer) {
      clearTimeout(this.stateUpdateTimer)
      this.stateUpdateTimer = null
    }
  }
}
