/* eslint-disable max-lines */
/* eslint-disable max-len */
import { EventEmitter } from 'events'
import type { DOMElement } from 'extensions/tailorkit-src/src/assets/services/mcp/dom-scanner'
import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import type { Server as SocketIOServer, Socket } from 'socket.io'
import { randomUUID } from 'crypto'
import ConnectedClientModel, {
  type ConnectedClientDocument,
  type ConnectedClientPojo,
} from '~/models/ConnectedClient.server'
import type { Types as MongooseTypes } from 'mongoose'
import { CrossServerCommunicationManager } from './cross-server-communication'

interface MCPToolCall {
  id: string
  name: string
  arguments: any
}

interface ProductPersonalizerDOM {
  availableOptions: DOMElement[]
  selectedOptions: DOMElement[]
  currentStep: string
  productData: any
}

interface PendingAction {
  resolve: (value: any) => void
  reject: (reason: any) => void
  timeout: NodeJS.Timeout
  clientId: string
  action: string
  createdAt: number
}

class TailorKitSocketIOMCPServer extends EventEmitter {
  private io: SocketIOServer
  private localClients: Map<string, Socket> = new Map() // Only for locally connected clients
  private pendingActions: Map<string, PendingAction> = new Map()
  private clientDOMs: Map<string, ProductPersonalizerDOM> = new Map() // Could be moved to Redis/DB for true global state
  private lastAccessTime: number = Date.now()
  private serverInstanceId: string
  private crossServerManager?: CrossServerCommunicationManager

  constructor(io: SocketIOServer, enableCrossServerCommunication: boolean = false) {
    super()

    this.io = io
    this.serverInstanceId = randomUUID()
    this.setMaxListeners(Infinity)

    if (enableCrossServerCommunication) {
      this.crossServerManager = new CrossServerCommunicationManager(io, this.serverInstanceId)
      // Provide access to local clients for cross-server communication
      this.crossServerManager.setLocalSocketGetter((clientId: string) => this.localClients.get(clientId))
    }

    this.setupSocketHandlers()
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', async (socket: Socket) => {
      let sessionId: string | null = null

      socket.on('mcp:register_session', async data => {
        sessionId = data.sessionId || this.generateSessionId()

        // Store only local socket connection
        this.localClients.set(sessionId!, socket)

        console.log(
          `🔌 TailorKit client connected with session: ${sessionId} (Socket ID: ${socket.id}) to server ${this.serverInstanceId}`
        )

        try {
          // Use upsert to handle reconnections gracefully
          await ConnectedClientModel.findOneAndUpdate(
            { clientId: sessionId },
            {
              clientId: sessionId,
              serverId: this.serverInstanceId,
              socketId: socket.id,
              connectedAt: new Date(),
              lastPingAt: new Date(),
            },
            { upsert: true, new: true }
          )
          console.log(
            `📝 Client with session ${sessionId} registered globally in MongoDB by server ${this.serverInstanceId}`
          )
        } catch (error: any) {
          console.error(`❌ MongoDB Error registering client with session ${sessionId}:`, error)
        }

        socket.emit('mcp:connected', {
          clientId: sessionId,
          serverId: this.serverInstanceId,
          message: 'TailorKit MCP Server connected via Socket.IO',
        })

        console.log(`🆔 Using session ${sessionId} on server ${this.serverInstanceId}`)
      })

      socket.on('mcp:message', message => {
        if (sessionId) {
          this.handleClientMessage(sessionId, message)
        }
      })

      socket.on('mcp:action_result', data => {
        if (sessionId) {
          this.handleActionResult(sessionId, data)
        }
      })

      socket.on('mcp:state_update', data => {
        if (sessionId) {
          this.updateClientState(sessionId, data.state)
        }
      })

      socket.on('mcp:pong', () => {
        if (sessionId) {
          console.log(`💓 Pong from session ${sessionId}`)
          ConnectedClientModel.updateOne({ clientId: sessionId }, { $set: { lastPingAt: new Date() } }).catch(
            (err: any) => console.error(`Error updating lastPingAt for session ${sessionId} on pong:`, err)
          )
        }
      })

      socket.on('disconnect', async (reason: string) => {
        if (sessionId) {
          console.log(
            `🔌 Client with session ${sessionId} (Socket ID: ${socket.id}) disconnected from server ${this.serverInstanceId}: ${reason}`
          )

          try {
            await ConnectedClientModel.deleteOne({ clientId: sessionId })
            console.log(`📝 Client with session ${sessionId} unregistered globally from MongoDB`)
          } catch (error) {
            console.error(`❌ MongoDB Error unregistering client with session ${sessionId}:`, error)
          }

          this.cleanupPendingActionsForClient(sessionId)
          this.localClients.delete(sessionId)
          this.clientDOMs.delete(sessionId)
        }
      })

      socket.on('error', error => {
        if (sessionId) {
          console.error(`❌ Socket error for session ${sessionId}:`, error)
          this.cleanupPendingActionsForClient(sessionId)
        }
      })
    })
  }

  private handleClientMessage(sessionId: string, message: any): void {
    console.log(`📨 Message from ${sessionId}:`, message.type)

    switch (message.type) {
      case 'error':
        console.error(`❌ Client ${sessionId} error:`, message.error)
        this.handleActionError(sessionId, message)
        this.cleanupPendingActionsForClient(sessionId, message.requestId)
        break
    }
  }

  private handleActionResult(sessionId: string, data: any): void {
    const { requestId, success, result, error } = data
    const pendingAction = this.pendingActions.get(requestId)

    if (pendingAction) {
      clearTimeout(pendingAction.timeout)
      this.pendingActions.delete(requestId)

      if (success) {
        pendingAction.resolve(result)
      } else {
        pendingAction.reject(new Error(error || 'Action failed'))
      }
    }
  }

  private handleActionError(sessionId: string, data: any): void {
    const { requestId, error } = data
    const pendingAction = this.pendingActions.get(requestId)

    if (pendingAction) {
      clearTimeout(pendingAction.timeout)
      this.pendingActions.delete(requestId)
      pendingAction.reject(new Error(error))
    }
  }

  private updateClientState(sessionId: string, dom: ProductPersonalizerDOM): void {
    this.clientDOMs.set(sessionId, dom)
    this.emit('domUpdated', { clientId: sessionId, dom })
  }

  async getPersonalizerDom(sessionId: string): Promise<ProductPersonalizerDOM> {
    const result = await this.executeClientAction(sessionId, 'getPersonalizerDom', {})
    return result
  }

  async executePersonalizerDomOptions(
    sessionId: string,
    script: string,
    recallGetPersonalizerDom: boolean
  ): Promise<DOMElement[]> {
    const result = await this.executeClientAction(sessionId, 'executePersonalizerDomOptions', {
      script,
      recallGetPersonalizerDom,
    })
    return result
  }

  /**
   * Find which server instance a client is connected to
   */
  private async findClientServer(sessionId: string): Promise<ConnectedClientPojo | null> {
    try {
      const client = await ConnectedClientModel.findOne({ clientId: sessionId }).lean().exec()
      return client as ConnectedClientPojo | null
    } catch (error) {
      console.error(`❌ Error finding client ${sessionId} in database:`, error)
      return null
    }
  }

  /**
   * Execute action on a client, handling both local and cross-server scenarios
   */
  private async executeClientAction(sessionId: string, action: string, params: any): Promise<any> {
    // First check if client is connected locally
    const localSocket = this.localClients.get(sessionId)

    if (localSocket && localSocket.connected) {
      console.log(`🎯 Executing action ${action} on local client ${sessionId}`)
      return this.executeLocalClientAction(sessionId, localSocket, action, params)
    }

    // Client not local, check if it exists globally
    const clientInfo = await this.findClientServer(sessionId)

    if (!clientInfo) {
      throw new Error(`Client ${sessionId} not found in any server instance`)
    }

    if (clientInfo.serverId === this.serverInstanceId) {
      // Client should be local but socket not found - possibly disconnected
      throw new Error(`Client ${sessionId} registered to this server but socket not found - possibly disconnected`)
    }

    // Client is on another server - use cross-server communication if available
    console.warn(
      `🌐 Client ${sessionId} is connected to server ${clientInfo.serverId}, not this server (${this.serverInstanceId}). Using cross-server communication.`
    )

    if (this.crossServerManager) {
      console.log(`🌐 Executing cross-server action ${action} for client ${sessionId}`)
      return this.crossServerManager.executeCrossServerAction(sessionId, action, params)
    }
    throw new Error(
      `Client ${sessionId} is connected to server ${clientInfo.serverId}. Cross-server communication not enabled. Enable it in constructor.`
    )
  }

  /**
   * Execute action on a locally connected client
   */
  private async executeLocalClientAction(sessionId: string, socket: Socket, action: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId()
      const timeout = setTimeout(() => {
        this.pendingActions.delete(requestId)
        reject(new Error(`Action ${action} for client ${sessionId} timeout after 15 seconds`))
      }, 15000)

      this.pendingActions.set(requestId, {
        resolve,
        reject,
        timeout,
        clientId: sessionId,
        action,
        createdAt: Date.now(),
      })

      socket.emit('mcp:execute_action', {
        requestId,
        action,
        params,
      })
    })
  }

  getMCPTools(): ChatCompletionTool[] {
    return [
      {
        type: 'function',
        function: {
          name: 'get_personalizer_dom',
          description: [
            'Get the current DOM of the personalizer options and extract the data for the AI to use',
            'This tool can be called multiple times if needed to be re-called in current context to get the latest DOM data',
          ].join('. '),
          parameters: {
            type: 'object',
            properties: {
              clientId: {
                type: 'string',
                description:
                  'Client ID. Ensure this is the ID of a client currently connected to an MCP server instance.',
              },
            },
            required: ['clientId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'execute_personalizer_dom_options',
          description: [
            'Extract DOM data from the personalizer DOM and generate JavaScript event handlers.',
            'Ensure each interactive element (e.g., input, select) is processed exactly once.',
            'After executing scripts that change states or conditions (e.g., selecting "3 persons", "have a dog", or "not have a dog"), you must call "get_personalizer_dom" again to fetch the updated DOM before further processing.',
            'GUIDELINES:',
            '1. Always explicitly dispatch appropriate events to elements after changing their states.',
            'Examples:',
            '- Radio input for option set:',
            '  const fieldset = document.querySelector(\\\'fieldset[data-layer-id="{LAYER_DATA_ID}"][data-id="{FIELDSET_DATA_ID}"]\\\');',
            '  const inputRadio = fieldset.querySelector(\\\'input[type="radio"][data-name="{DATA_NAME}"]\\\');',
            '  inputRadio.click();',
            '  inputRadio.dispatchEvent(new Event("click", { bubbles: true }));',
            '- Text input for text customization:',
            '  const fieldset = document.querySelector(\\\'fieldset[data-layer-id="{LAYER_DATA_ID}"][data-id="{FIELDSET_DATA_ID}"]\\\');',
            '  const inputText = fieldset.querySelector(\\\'input[type="text"][data-id="{FIELDSET_DATA_ID}"]\\\');',
            '  inputText.value = "VALUE";',
            '  inputText.dispatchEvent(new Event("keyup", { bubbles: true }));',
          ].join(' '),
          parameters: {
            type: 'object',
            properties: {
              clientId: {
                type: 'string',
                description:
                  'Client ID. Ensure this is the ID of a client currently connected to an MCP server instance.',
              },
              script: { type: 'string', description: 'JavaScript code to execute' },
              recallGetPersonalizerDom: {
                type: 'boolean',
                description:
                  'Whether to revalidate the DOM if changing quantity of object or condition like "3 persons" or "have a dog" or "not have a dog"',
              },
            },
            required: ['clientId', 'script', 'recallGetPersonalizerDom'],
          },
        },
      },
    ]
  }

  getSanitizedResultMCPTool(name: string, result: any): any {
    switch (name) {
      case 'get_personalizer_dom':
        return result.availableOptions
      case 'execute_personalizer_dom_options':
        return result
      default:
        return result
    }
  }

  sanitizeToolResults(
    toolResults: Array<{ role: 'function'; name: string; content: string }>
  ): Array<{ role: 'function'; name: string; content: string }> {
    let lastGetPersonalizerDomIndex = -1
    for (let i = toolResults.length - 1; i >= 0; i--) {
      if (toolResults[i].name === 'get_personalizer_dom') {
        lastGetPersonalizerDomIndex = i
        break
      }
    }

    if (lastGetPersonalizerDomIndex === -1) {
      return toolResults
    }

    return toolResults.map((result, index) => {
      if (result.name === 'get_personalizer_dom' && index !== lastGetPersonalizerDomIndex) {
        return {
          role: result.role,
          name: result.name,
          content: JSON.stringify({
            message: 'Previous get_personalizer_dom call sanitized to prevent hallucination',
            sanitized: true,
            originalIndex: index,
          }),
        }
      }
      return result
    })
  }

  async executeMCPTool(toolCall: MCPToolCall, clientId: string): Promise<any> {
    const { name, arguments: args } = toolCall
    // It's crucial that the clientId provided to these tools corresponds to a client
    // actually connected to an MCP server instance that can process the action.
    // The current implementation relies on the client being connected to THIS server instance
    // for `executeClientAction` to work.
    const params = { ...args, clientId }

    switch (name) {
      case 'get_personalizer_dom': {
        const result = await this.getPersonalizerDom(params.clientId)
        return result
      }
      case 'execute_personalizer_dom_options': {
        const result = await this.executePersonalizerDomOptions(
          params.clientId,
          params.script,
          params.recallGetPersonalizerDom
        )
        return result
      }
      default:
        throw new Error(`Unknown MCP tool: ${name}`)
    }
  }

  ping(): void {
    // Ping all locally connected clients
    this.io.emit('mcp:ping')

    // Update lastPingAt for all clients of this serverInstanceId
    ConnectedClientModel.updateMany({ serverId: this.serverInstanceId }, { $set: { lastPingAt: new Date() } }).catch(
      (err: any) => console.error('Error updating lastPingAt on ping:', err)
    )
  }

  /**
   * Get IDs of clients connected to this server instance
   */
  getLocalConnectedClientIds(): string[] {
    return Array.from(this.localClients.keys())
  }

  /**
   * Get IDs of all clients connected globally across all servers
   */
  async getGlobalConnectedClientIds(): Promise<string[]> {
    try {
      const clients = await ConnectedClientModel.find({}, { clientId: 1, _id: 0 }).lean().exec()
      return (clients as { clientId: string }[]).map(c => c.clientId)
    } catch (error) {
      console.error('❌ MongoDB Error fetching global client IDs:', error)
      return []
    }
  }

  async getGlobalConnectedClientsData(): Promise<ConnectedClientPojo[]> {
    try {
      const resultsFromDb = await ConnectedClientModel.find({}).lean().exec()

      return resultsFromDb.map((doc: any) => ({
        _id: doc._id as MongooseTypes.ObjectId,
        clientId: doc.clientId,
        serverId: doc.serverId,
        connectedAt: doc.connectedAt,
        lastPingAt: doc.lastPingAt,
        socketId: doc.socketId,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        __v: doc.__v,
      }))
    } catch (error) {
      console.error('❌ MongoDB Error fetching global clients data:', error)
      return []
    }
  }

  /**
   * Check if a client is connected globally (on any server)
   */
  async isClientConnectedGlobally(sessionId: string): Promise<boolean> {
    try {
      const client = await ConnectedClientModel.findOne({ clientId: sessionId }).lean().exec()
      return !!client
    } catch (error) {
      console.error(`❌ Error checking if client ${sessionId} is connected globally:`, error)
      return false
    }
  }

  /**
   * Get server instance ID where a client is connected
   */
  async getClientServerInstanceId(sessionId: string): Promise<string | null> {
    try {
      const client = await ConnectedClientModel.findOne({ clientId: sessionId }, { serverId: 1, _id: 0 }).lean().exec()
      return client ? client.serverId : null
    } catch (error) {
      console.error(`❌ Error getting server instance for client ${sessionId}:`, error)
      return null
    }
  }

  /**
   * Legacy methods for backward compatibility - now use global data
   */
  getClientsBySession(sessionId: string): string[] {
    // This method needs refactoring for global sessions
    // For now, return empty array and log warning
    console.warn(`getClientsBySession() called but not implemented for global clients. SessionId: ${sessionId}`)
    return []
  }

  getClientSession(sessionId: string): string | undefined {
    // This method needs refactoring for global sessions
    console.warn(`getClientSession() called but not implemented for global clients. SessionId: ${sessionId}`)
    return sessionId // Return self for backward compatibility
  }

  getPreferredClientForSession(sessionId: string): string | null {
    // For global clients, just return the sessionId if it exists globally
    // This is async now, but keeping sync for compatibility - should be refactored
    console.warn(`getPreferredClientForSession() called - this should be made async for global clients`)
    return sessionId
  }

  async associateClientWithSession(sessionId: string, connectedSessionId: string): Promise<void> {
    // For global clients, we might need to implement session association in the database
    console.log(`🔗 Global session association not fully implemented: ${sessionId} -> ${connectedSessionId}`)

    const localSocket = this.localClients.get(sessionId)
    if (localSocket && localSocket.connected) {
      localSocket.emit('mcp:session_associated', {
        sessionId: connectedSessionId,
        message: 'Client associated with session',
      })
    }
  }

  getClientDOM(sessionId: string): ProductPersonalizerDOM | undefined {
    return this.clientDOMs.get(sessionId)
  }

  async getServerStats(): Promise<any> {
    let globalClientsCount = 0
    let globalClientsData: ConnectedClientPojo[] = []

    try {
      globalClientsCount = await ConnectedClientModel.countDocuments()
      globalClientsData = await this.getGlobalConnectedClientsData()
    } catch (error) {
      console.error('❌ MongoDB Error counting global clients:', error)
    }

    return {
      serverInstanceId: this.serverInstanceId,
      localConnectedClients: this.localClients.size,
      globalConnectedClients: globalClientsCount,
      globalClientsData: globalClientsData,
      totalLocalDOMs: this.clientDOMs.size,
      pendingActions: this.pendingActions.size,
      uptime: process.uptime(),
      lastAccessTime: this.lastAccessTime,
    }
  }

  updateLastAccessTime(): void {
    this.lastAccessTime = Date.now()
  }

  private generateSessionId(): string {
    return `-----123tk_${randomUUID().replace(/-/g, '').slice(0, 10)}`
  }

  private generateRequestId(): string {
    return `req_${randomUUID().replace(/-/g, '')}_${Date.now()}`
  }

  async close(): Promise<void> {
    console.log(`🔌 Shutting down TailorKit Socket.IO MCP Server ${this.serverInstanceId}`)

    // Clean up all pending actions for this server instance
    const pendingRequestIds = Array.from(this.pendingActions.keys())
    pendingRequestIds.forEach(requestId => {
      const pendingAction = this.pendingActions.get(requestId)
      if (pendingAction) {
        clearTimeout(pendingAction.timeout)
        pendingAction.reject(new Error('Server shutting down'))
        this.pendingActions.delete(requestId)
      }
    })

    // Remove all clients for this server instance from the global registry
    try {
      await ConnectedClientModel.deleteMany({ serverId: this.serverInstanceId })
      console.log(`📝 Removed all clients for server ${this.serverInstanceId} from global registry`)
    } catch (error) {
      console.error(`❌ Error removing clients from global registry during shutdown:`, error)
    }

    // Close the Socket.IO server
    this.io.close()
  }

  private cleanupPendingActionsForClient(sessionId: string, specificRequestId?: string): void {
    const pendingRequestIds: string[] = []
    this.pendingActions.forEach((action, requestId) => {
      if (action.clientId === sessionId && (!specificRequestId || requestId === specificRequestId)) {
        pendingRequestIds.push(requestId)
      }
    })
    pendingRequestIds.forEach(requestId => {
      const pendingAction = this.pendingActions.get(requestId)
      if (pendingAction) {
        clearTimeout(pendingAction.timeout)
        pendingAction.reject(new Error(`Operation cancelled for client ${sessionId}: client disconnected or errored`))
        this.pendingActions.delete(requestId)
      }
    })
  }

  /**
   * Get statistics for all servers globally
   */
  async getGlobalServerStats(): Promise<any> {
    try {
      const clientsByServer = await ConnectedClientModel.aggregate([
        {
          $group: {
            _id: '$serverId',
            clientCount: { $sum: 1 },
            clients: { $push: '$clientId' },
            lastActivity: { $max: '$lastPingAt' },
          },
        },
      ])

      const totalClients = await ConnectedClientModel.countDocuments()

      return {
        totalGlobalClients: totalClients,
        serverInstances: clientsByServer.map(server => ({
          serverId: server._id,
          clientCount: server.clientCount,
          clients: server.clients,
          lastActivity: server.lastActivity,
          isCurrentServer: server._id === this.serverInstanceId,
        })),
        currentServerInstanceId: this.serverInstanceId,
      }
    } catch (error) {
      console.error('❌ Error getting global server stats:', error)
      return {
        error: 'Failed to fetch global server statistics',
        currentServerInstanceId: this.serverInstanceId,
      }
    }
  }

  /**
   * Remove stale clients from the global registry
   * Should be called periodically to clean up disconnected clients
   */
  async cleanupStaleClients(maxAgeMinutes: number = 5): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000)
      const result = await ConnectedClientModel.deleteMany({
        lastPingAt: { $lt: cutoffTime },
      })

      if (result.deletedCount > 0) {
        console.log(`🧹 Cleaned up ${result.deletedCount} stale clients from global registry`)
      }

      return result.deletedCount
    } catch (error) {
      console.error('❌ Error cleaning up stale clients:', error)
      return 0
    }
  }
}

// Singleton instance with proper lifecycle management
let mcpServerInstance: TailorKitSocketIOMCPServer | null = null
let ioReference: SocketIOServer | null = null
// No longer need mongoUriReference as Mongoose connection is global

export function getTailorKitSocketIOMCPServer(
  io: SocketIOServer,
  enableCrossServerCommunication: boolean = true
): TailorKitSocketIOMCPServer {
  if (mcpServerInstance && io !== ioReference) {
    console.log('🔄 Replacing TailorKit Socket.IO MCP Server due to new IO instance.')
    // The close method on the instance will just close its io server.
    // Mongoose connection is managed globally.
    if (mcpServerInstance.close) {
      // Check if close method exists (it's async now but called without await here)
      mcpServerInstance.close().catch(err => console.error('Error during non-awaited close in replacement:', err))
    }
    mcpServerInstance = null
  }

  if (!mcpServerInstance) {
    // Mongoose is assumed to be connected by `~/bootstrap/db/connect-db.server`
    mcpServerInstance = new TailorKitSocketIOMCPServer(io, enableCrossServerCommunication)
    ioReference = io
    console.log(
      `✅ TailorKit Socket.IO MCP Server initialized (Server ID: ${mcpServerInstance['serverInstanceId']}) using global Mongoose connection. Cross-server communication: ${enableCrossServerCommunication ? 'enabled' : 'disabled'}`
    )
  } else {
    mcpServerInstance.updateLastAccessTime()
  }
  return mcpServerInstance
}

export async function ensureConnectedClientIndexes(): Promise<void> {
  // This function should be called once at application startup
  // to ensure MongoDB indexes for the connected_clients_registry collection.
  // Mongoose typically handles index creation based on schema definitions
  // (index: true, unique: true) when the model is compiled and the application connects.
  // This provides an explicit way to trigger it if needed.
  try {
    // ConnectedClientModel is already imported and available in this scope
    await ConnectedClientModel.ensureIndexes()
    console.log('MongoDB indexes explicitly ensured for connected_clients_registry via Mongoose.')
  } catch (error) {
    console.error('Error explicitly ensuring MongoDB indexes for connected_clients_registry via Mongoose:', error)
    // Depending on your error handling strategy, you might want to re-throw or handle differently
  }
}

export async function resetMCPServerInstance(): Promise<void> {
  if (mcpServerInstance) {
    console.log(`🔄 Resetting TailorKit Socket.IO MCP Server (Server ID: ${mcpServerInstance['serverInstanceId']})`)
    if (mcpServerInstance.close) {
      await mcpServerInstance.close()
    }
    mcpServerInstance = null
    ioReference = null
  }
}

export type {
  MCPToolCall,
  ProductPersonalizerDOM,
  TailorKitSocketIOMCPServer,
  ConnectedClientDocument, // Now imported
  ConnectedClientPojo, // Now imported
}
