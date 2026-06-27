/* eslint-disable max-len */
/* eslint-disable max-lines */
import { EventEmitter } from 'events'
import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import type { Server as SocketIOServer, Socket } from 'socket.io'
import { randomUUID } from 'crypto'
import { type Types as MongooseTypes } from 'mongoose'
import { TOOLS } from './tools'
import { MCP_TOOLS } from '~/routes/api.mcp.$tool/constants'
import { findRelevantDocumentation, generateAIResponse } from '~/utils/openai-client.server'
import type { ICreateTemplateArgs, IManageLayerArgs } from './types'
import { MCP_TOOLS_EVENTS_MARKDOWN } from './types'
import { uuid, validateUUID } from '~/utils/uuid'
import ConnectedClientModel, { type ConnectedClientPojo } from '~/models/ConnectedClient.server'
import { CrossServerCommunicationManager } from '../storefront/cross-server-communication'

interface MCPToolCall {
  id: string
  name: string
  arguments: any
}

class TailorKitAdminMcpWithSocketServer extends EventEmitter {
  private io: SocketIOServer
  private shopDomain: string
  private localClients: Map<string, Socket> = new Map() // Only for locally connected clients
  private pendingActions: Map<string, any> = new Map()
  private lastAccessTime: number = Date.now()
  private serverInstanceId: string
  private crossServerManager?: CrossServerCommunicationManager

  constructor(io: SocketIOServer, shopDomain: string, enableCrossServerCommunication: boolean = false) {
    super()

    this.io = io
    this.shopDomain = shopDomain
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

      socket.on('adminMcp:register_session', async data => {
        sessionId = data.sessionId || this.generateClientId()

        // Store only local socket connection
        this.localClients.set(sessionId!, socket)

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
        } catch (error: any) {
          console.error(`❌ MongoDB Error registering admin client with session ${sessionId}:`, error)
        }

        socket.emit('adminMcp:connected', {
          clientId: sessionId,
          serverId: this.serverInstanceId,
          message: 'TailorKit Admin MCP Server connected via Socket.IO',
        })
      })

      socket.on('adminMcp:message', message => {
        if (sessionId) {
          this.handleClientMessage(sessionId, message)
        }
      })

      socket.on('adminMcp:action_result', data => {
        if (sessionId) {
          this.handleActionResult(sessionId, data)
        }
      })

      socket.on('adminMcp:state_update', data => {})

      socket.on('adminMcp:pong', () => {
        if (sessionId) {
          ConnectedClientModel.updateOne({ clientId: sessionId }, { $set: { lastPingAt: new Date() } }).catch(
            (err: any) => console.error(`Error updating lastPingAt for session ${sessionId} on pong:`, err)
          )
        }
      })

      socket.on('disconnect', async reason => {
        if (sessionId) {
          try {
            await ConnectedClientModel.deleteOne({ clientId: sessionId })
          } catch (error) {
            console.error(`❌ MongoDB Error unregistering admin client with session ${sessionId}:`, error)
          }

          this.cleanupPendingActionsForClient(sessionId)
          this.localClients.delete(sessionId)
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

  private handleClientMessage(clientId: string, message: any): void {
    switch (message.type) {
      case 'error':
        console.error(`❌ Client ${clientId} error:`, message.error)
        this.handleActionError(clientId, message)
        this.cleanupPendingActionsForClient(clientId, message.requestId)
        break
    }
  }

  private handleActionResult(clientId: string, data: any): void {
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

  private handleActionError(clientId: string, data: any): void {
    const { requestId, error } = data
    const pendingAction = this.pendingActions.get(requestId)

    if (pendingAction) {
      clearTimeout(pendingAction.timeout)
      this.pendingActions.delete(requestId)
      pendingAction.reject(new Error(error))
    }
  }

  /**
   * Find which server instance a client is connected to
   */
  private async findClientServer(clientId: string): Promise<ConnectedClientPojo | null> {
    try {
      const client = await ConnectedClientModel.findOne({ clientId }).lean().exec()
      return client as ConnectedClientPojo | null
    } catch (error) {
      console.error(`❌ Error finding client ${clientId} in database:`, error)
      return null
    }
  }

  private async executeClientAction(clientId: string, action: string, params: any): Promise<any> {
    // First check if client is connected locally
    const localSocket = this.localClients.get(clientId)

    if (localSocket && localSocket.connected) {
      return this.executeLocalClientAction(clientId, localSocket, action, params)
    }

    // Client not local, check if it exists globally
    const clientInfo = await this.findClientServer(clientId)

    if (!clientInfo) {
      throw new Error(`Client ${clientId} not found in any server instance`)
    }

    if (clientInfo.serverId === this.serverInstanceId) {
      // Client should be local but socket not found - possibly disconnected
      throw new Error(`Client ${clientId} registered to this server but socket not found - possibly disconnected`)
    }

    // Client is on another server - use cross-server communication if available
    if (this.crossServerManager) {
      const result = await this.crossServerManager.executeCrossServerAction(clientId, action, params, 'adminMcp')
      return result
    }
    throw new Error(
      `Client ${clientId} is connected to server ${clientInfo.serverId}. Cross-server communication not enabled. Enable it in constructor.`
    )
  }

  /**
   * Execute action on a locally connected client
   */
  private async executeLocalClientAction(clientId: string, socket: Socket, action: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId()
      const timeout = setTimeout(() => {
        this.pendingActions.delete(requestId)
        reject(new Error(`Action ${action} for client ${clientId} timeout after 15 seconds`))
      }, 15000)

      this.pendingActions.set(requestId, {
        resolve,
        reject,
        timeout,
        clientId,
        action,
        createdAt: Date.now(),
      })

      socket.emit('adminMcp:execute_action', {
        requestId,
        action,
        params,
      })
    })
  }

  // Get MCP tools definition for OpenAI function calling
  getMCPTools(): ChatCompletionTool[] {
    return TOOLS
  }

  /**
   * Some times, the id is returned from AI assistant is not a valid UUID, so we need to generate a new one
   * @param id - The id to validate
   * @returns The valid id
   */
  getValidId(id: string): string {
    const isValidId = validateUUID(id)
    if (!isValidId) {
      return uuid()
    }
    return id
  }

  validateShopDomain(shopDomain: string): boolean {
    return shopDomain === this.shopDomain
  }

  async createTemplateHandler(
    params: ICreateTemplateArgs & { clientId: string }
  ): Promise<ICreateTemplateArgs & { responseContent: string }> {
    const templateId = this.getValidId(params.templateId)

    const eventDataString = JSON.stringify({
      eventName: MCP_TOOLS_EVENTS_MARKDOWN.TEMPLATE_CREATED,
      data: { ...params, templateId },
    })

    const result = await this.executeClientAction(params.clientId, MCP_TOOLS.CREATE_TEMPLATE, {
      ...params,
      templateId,
      responseContent: eventDataString,
    })
    return result
  }

  async manageLayerHandler(
    params: IManageLayerArgs & { clientId: string }
  ): Promise<IManageLayerArgs & { responseContent: string }> {
    const layerId = this.getValidId(params.layer._id)
    const templateId = this.getValidId(params.templateId)

    const eventDataString = JSON.stringify({
      eventName: MCP_TOOLS_EVENTS_MARKDOWN.LAYER_CREATED_OR_UPDATED,
      data: params,
    })

    return this.executeClientAction(params.clientId, MCP_TOOLS.MANAGE_LAYER, {
      ...params,
      templateId,
      _id: layerId,
      responseContent: eventDataString,
    })
  }

  async assistantHandler(params: any): Promise<any> {
    const { documents, searchError } = await findRelevantDocumentation(
      'match_documents',
      params.userMessage,
      params.shopDomain,
      params.shopData
    )
    if (searchError) {
      console.error('Error searching vector database:', searchError)
      throw new Error('Vector search failed')
    }

    // Prepare document context for AI response
    const documentContext = documents ? documents.map((doc: any) => `## ${doc.title}\n${doc.content}`).join('\n\n') : ''
    // Get AI response using Crisp's function
    const aiResponse = await generateAIResponse({
      userQuery: params.userMessage,
      documentContext,
      conversationHistory: params.conversationHistory,
    })

    // Check if human support is needed
    const isHumanNeeded = aiResponse?.includes('[HUMAN SUPPORT NEEDED]')

    // Clean up the response if human support is needed
    const responseContent = isHumanNeeded ? aiResponse?.replace(/\[HUMAN SUPPORT NEEDED\]\s*/, '') : aiResponse

    return this.executeClientAction(params.clientId, MCP_TOOLS.ASSISTANT, {
      ...params,
      responseContent,
    })
  }

  // Get sanitized result of the MCP tool call
  getSanitizedResultMCPTool(name: string, response: any): any {
    const { result } = response || {}

    switch (name) {
      case MCP_TOOLS.ASSISTANT:
        return result.responseContent
      case MCP_TOOLS.CREATE_TEMPLATE:
        return result.responseContent
      case MCP_TOOLS.MANAGE_LAYER:
        return result.responseContent
      case MCP_TOOLS.READ_COLLECTION_DATA:
        return result.responseContent
      default:
        return result
    }
  }

  // Execute MCP tool call
  async executeMCPTool(toolCall: MCPToolCall, clientId: string): Promise<any> {
    const { name, arguments: args } = toolCall
    const { shopDomain } = args

    if (!this.validateShopDomain(shopDomain)) {
      throw new Error(
        `Access denied: You are not allowed to access this shop domain: ${shopDomain}. Only shop domain: ${this.shopDomain} is allowed.`
      )
    }

    const params = { ...args, clientId }
    switch (name) {
      case MCP_TOOLS.CREATE_TEMPLATE:
        return this.createTemplateHandler(params)
      case MCP_TOOLS.MANAGE_LAYER:
        return this.manageLayerHandler(params)
      // case MCP_TOOLS.READ_COLLECTION_DATA:
      //   return this.readCollectionDataHandler(params)
      case MCP_TOOLS.ASSISTANT:
        return this.assistantHandler(params)

      default:
        throw new Error(`Unknown MCP tool: ${name}`)
    }
  }

  // Health check and utilities
  ping(): void {
    // Ping all locally connected clients
    this.io.emit('adminMcp:ping')

    // Update lastPingAt for all clients of this serverInstanceId
    ConnectedClientModel.updateMany({ serverId: this.serverInstanceId }, { $set: { lastPingAt: new Date() } }).catch(
      (err: any) => console.error('Error updating lastPingAt on ping:', err)
    )
  }

  getConnectedClients(): string[] {
    return Array.from(this.localClients.keys())
  }

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

  getServerStats(): any {
    return {
      serverInstanceId: this.serverInstanceId,
      localConnectedClients: this.localClients.size,
      pendingActions: this.pendingActions.size,
      uptime: process.uptime(),
      lastAccessTime: this.lastAccessTime,
      memoryUsage: process.memoryUsage(),
      crossServerEnabled: !!this.crossServerManager,
    }
  }

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
   * Clean up stale clients that haven't pinged in a while
   * @param maxStaleTime Maximum time in milliseconds since last ping before considering a client stale
   */
  async cleanupStaleClients(maxStaleTime: number = 30000): Promise<void> {
    try {
      const staleThreshold = new Date(Date.now() - maxStaleTime)

      // Find stale clients for this server instance
      const staleClients = await ConnectedClientModel.find({
        serverId: this.serverInstanceId,
        lastPingAt: { $lt: staleThreshold },
      })
        .lean()
        .exec()

      if (staleClients.length > 0) {
        // Remove stale clients from local tracking
        staleClients.forEach(client => {
          this.localClients.delete(client.clientId)
          this.cleanupPendingActionsForClient(client.clientId)
        })

        // Remove stale clients from database
        await ConnectedClientModel.deleteMany({
          serverId: this.serverInstanceId,
          lastPingAt: { $lt: staleThreshold },
        })
      }
    } catch (error) {
      console.error('❌ Error cleaning up stale clients:', error)
    }
  }

  /**
   * Check server health and perform maintenance tasks
   */
  async checkHealth(): Promise<{
    status: 'healthy' | 'unhealthy'
    details: {
      connectedClients: number
      pendingActions: number
      staleClients: number
      memoryUsage: NodeJS.MemoryUsage
      uptime: number
    }
  }> {
    try {
      // Get stale clients count
      const staleThreshold = new Date(Date.now() - 30000) // 30 seconds
      const staleCount = await ConnectedClientModel.countDocuments({
        serverId: this.serverInstanceId,
        lastPingAt: { $lt: staleThreshold },
      })

      // Clean up if there are stale clients
      if (staleCount > 0) {
        await this.cleanupStaleClients()
      }

      // Get current memory usage
      const memoryUsage = process.memoryUsage()

      // Check if memory usage is within acceptable limits
      const isMemoryHealthy = memoryUsage.heapUsed < 1024 * 1024 * 1024 // 1GB limit

      const details = {
        connectedClients: this.localClients.size,
        pendingActions: this.pendingActions.size,
        staleClients: staleCount,
        memoryUsage,
        uptime: process.uptime(),
      }

      return {
        status: isMemoryHealthy && staleCount === 0 ? 'healthy' : 'unhealthy',
        details,
      }
    } catch (error) {
      console.error('❌ Error checking server health:', error)
      return {
        status: 'unhealthy',
        details: {
          connectedClients: this.localClients.size,
          pendingActions: this.pendingActions.size,
          staleClients: 0,
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime(),
        },
      }
    }
  }

  /**
   * Start periodic health checks
   * @param interval Interval in milliseconds between health checks
   */
  startHealthMonitoring(interval: number = 60000): NodeJS.Timer {
    return setInterval(async () => {
      const health = await this.checkHealth()

      if (health.status === 'unhealthy') {
        console.warn('⚠️ Server health check failed:', health.details)
      } else {
        // console.log('✅ Server health check passed:', health.details)
      }
    }, interval)
  }

  /**
   * Gracefully shut down the server instance
   */
  async close(): Promise<void> {
    try {
      // Notify all local clients about shutdown
      this.localClients.forEach(socket => {
        socket.emit('adminMcp:server_shutdown', {
          message: 'Server is shutting down',
          serverId: this.serverInstanceId,
        })
      })

      // Clean up all pending actions
      const pendingRequestIds = Array.from(this.pendingActions.keys())
      pendingRequestIds.forEach(requestId => {
        const pendingAction = this.pendingActions.get(requestId)
        if (pendingAction) {
          clearTimeout(pendingAction.timeout)
          pendingAction.reject(new Error('Server shutting down'))
        }
      })
      this.pendingActions.clear()

      // Remove all clients registered to this server from the global registry
      await ConnectedClientModel.deleteMany({ serverId: this.serverInstanceId })

      // Disconnect all local clients
      this.localClients.forEach(socket => {
        socket.disconnect(true)
      })
      this.localClients.clear()

      // Clean up cross-server communication if enabled
      if (this.crossServerManager) {
        // Notify other servers about shutdown
        this.io.serverSideEmit('server_shutdown', {
          serverId: this.serverInstanceId,
          timestamp: Date.now(),
        })
      }

      // Close Socket.IO server
      await new Promise<void>((resolve, reject) => {
        this.io.close(err => {
          if (err) {
            console.error('❌ Error closing Socket.IO server:', err)
            reject(err)
          } else {
            resolve()
          }
        })
      })
    } catch (error) {
      console.error('❌ Error during server shutdown:', error)
      throw error
    }
  }

  private generateClientId(): string {
    return `tk_${randomUUID().replace(/-/g, '').slice(0, 10)}`
  }

  private generateRequestId(): string {
    return `req_${randomUUID().replace(/-/g, '')}_${Date.now()}`
  }

  private cleanupPendingActionsForClient(clientId: string, specificRequestId?: string): void {
    // Get all pending actions for this client
    const pendingRequestIds: string[] = []

    this.pendingActions.forEach((action, requestId) => {
      // If the action belongs to this client and either no specific requestId was provided
      // or it matches the specific requestId we're looking for
      if (action.clientId === clientId && (!specificRequestId || requestId === specificRequestId)) {
        pendingRequestIds.push(requestId)
      }
    })

    // Reject all pending promises and clean up
    pendingRequestIds.forEach(requestId => {
      const pendingAction = this.pendingActions.get(requestId)
      if (pendingAction) {
        clearTimeout(pendingAction.timeout)
        pendingAction.reject(new Error(`Operation cancelled: client ${clientId} disconnected or errored`))
        this.pendingActions.delete(requestId)
      }
    })
  }

  updateLastAccessTime(): void {
    this.lastAccessTime = Date.now()
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
    const localSocket = this.localClients.get(sessionId)
    if (localSocket && localSocket.connected) {
      localSocket.emit('adminMcp:session_associated', {
        sessionId: connectedSessionId,
        message: 'Client associated with session',
      })
    }
  }
}

// Singleton instance with proper lifecycle management
let mcpServerInstance: TailorKitAdminMcpWithSocketServer | null = null
let ioReference: SocketIOServer | null = null

export function getTailorKitAdminMcpWithSocketServer(
  io: SocketIOServer,
  shopDomain: string,
  enableCrossServerCommunication: boolean = true
): TailorKitAdminMcpWithSocketServer {
  // If we already have an instance but with a different io server, close and recreate
  if (mcpServerInstance && io !== ioReference) {
    mcpServerInstance.close()
    mcpServerInstance = null
  }

  if (!mcpServerInstance) {
    mcpServerInstance = new TailorKitAdminMcpWithSocketServer(io, shopDomain, enableCrossServerCommunication)
    ioReference = io
  } else {
    // Update last access time to track usage
    mcpServerInstance.updateLastAccessTime()
  }

  return mcpServerInstance
}

// New function to check server health and reset if needed
export function validateAdminMCPServerInstance(io: SocketIOServer): boolean {
  if (!mcpServerInstance) {
    return false
  }

  // Check if clients are still connected
  const connectedClients = mcpServerInstance.getConnectedClients()
  if (connectedClients.length === 0) {
    console.log('⚠️ No clients connected to MCP Server, keeping instance alive')
  }

  // Ensure the io reference is still valid
  if (io !== ioReference) {
    console.log('⚠️ IO reference mismatch, recreating MCP Server')
    mcpServerInstance.close()
    mcpServerInstance = null
    return false
  }

  return true
}

// New function to explicitly reset the server if needed
export function resetAdminMCPServerInstance(): void {
  if (mcpServerInstance) {
    mcpServerInstance.close()
    mcpServerInstance = null
    ioReference = null
  }
}

export type { TailorKitAdminMcpWithSocketServer }
