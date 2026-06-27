/**
 * Cross-Server Communication for TailorKit MCP Server
 *
 * This module provides utilities for implementing cross-server communication
 * when clients are connected to different server instances.
 *
 * IMPLEMENTATION OPTIONS:
 *
 * 1. Socket.IO Redis Adapter (Recommended)
 * 2. Message Queue (Redis Pub/Sub, RabbitMQ, etc.)
 * 3. HTTP API calls between servers
 * 4. gRPC for low-latency communication
 */

import type { Server as SocketIOServer } from 'socket.io'
import ConnectedClientModel from '~/models/ConnectedClient.server'

export interface CrossServerActionRequest {
  requestId: string
  targetClientId: string
  action: string
  params: any
  sourceServerId: string
  timestamp: number
  mcpType: 'mcp' | 'adminMcp'
}

export interface CrossServerActionResponse {
  requestId: string
  success: boolean
  result?: any
  error?: string
  targetServerId: string
  timestamp: number
}

/**
 * OPTION 1: Socket.IO Redis Adapter Implementation
 *
 * To use this approach, install the Redis adapter:
 * npm install @socket.io/redis-adapter redis
 *
 * Then in your server setup:
 *
 * import { createAdapter } from '@socket.io/redis-adapter'
 * import { createClient } from 'redis'
 *
 * const pubClient = createClient({ url: 'redis://localhost:6379' })
 * const subClient = pubClient.duplicate()
 *
 * await Promise.all([pubClient.connect(), subClient.connect()])
 *
 * io.adapter(createAdapter(pubClient, subClient))
 */

export class CrossServerCommunicationManager {
  private io: SocketIOServer
  private serverInstanceId: string
  private getLocalSocketFn?: (clientId: string) => any
  private pendingCrossServerActions: Map<
    string,
    {
      resolve: (value: any) => void
      reject: (reason: any) => void
      timeout: NodeJS.Timeout
    }
  > = new Map()

  constructor(io: SocketIOServer, serverInstanceId: string) {
    this.io = io
    this.serverInstanceId = serverInstanceId
    this.setupCrossServerHandlers()
  }

  setLocalSocketGetter(fn: (clientId: string) => any): void {
    this.getLocalSocketFn = fn
  }

  private setupCrossServerHandlers(): void {
    // Listen for cross-server action requests (from other servers)
    this.io.on('cross_server_action_request', this.handleCrossServerActionRequest.bind(this))

    // Listen for cross-server action responses (responses to our requests)
    this.io.on('cross_server_action_response', this.handleCrossServerActionResponse.bind(this))

    console.log(`🌐 Cross-server communication handlers set up for server: ${this.serverInstanceId}`)
  }

  private async handleCrossServerActionRequest(data: CrossServerActionRequest): Promise<void> {
    const { requestId, targetClientId, action, params, sourceServerId, mcpType } = data

    console.log(
      `🌐 [${this.serverInstanceId}] Received cross-server action request: ${action} for client ${targetClientId} from server ${sourceServerId}`
    )

    try {
      // Check if the target client is connected to this server
      const localSocket = this.getLocalSocket(targetClientId)

      if (!localSocket || !localSocket.connected) {
        console.log(`🌐 [${this.serverInstanceId}] Client ${targetClientId} not found locally, ignoring request`)
        return
      }

      console.log(`🌐 [${this.serverInstanceId}] Executing local action ${action} for client ${targetClientId}`)

      // Execute the action locally
      const result = await this.executeLocalAction(localSocket, action, params, mcpType)

      console.log(`🌐 [${this.serverInstanceId}] Local action completed, sending response back to ${sourceServerId}`)

      // Send response back to requesting server
      this.io.serverSideEmit('cross_server_action_response', {
        requestId,
        success: true,
        result,
        targetServerId: sourceServerId,
        timestamp: Date.now(),
      } as CrossServerActionResponse)
    } catch (error: any) {
      console.error(`🌐 [${this.serverInstanceId}] Error executing cross-server action:`, error)

      // Send error response back to requesting server
      this.io.serverSideEmit('cross_server_action_response', {
        requestId,
        success: false,
        error: error.message,
        targetServerId: sourceServerId,
        timestamp: Date.now(),
      } as CrossServerActionResponse)
    }
  }

  private handleCrossServerActionResponse(data: CrossServerActionResponse): void {
    const { requestId, success, result, error, targetServerId } = data

    console.log(
      `🌐 [${this.serverInstanceId}] Received cross-server action response for request ${requestId} (success: ${success})`
    )

    // Only handle responses meant for this server
    if (targetServerId !== this.serverInstanceId) {
      console.log(`🌐 [${this.serverInstanceId}] Response is for server ${targetServerId}, ignoring`)
      return
    }

    const pendingAction = this.pendingCrossServerActions.get(requestId)

    if (pendingAction) {
      clearTimeout(pendingAction.timeout)
      this.pendingCrossServerActions.delete(requestId)

      if (success) {
        console.log(`🌐 [${this.serverInstanceId}] Cross-server action successful, resolving with result`)
        pendingAction.resolve(result)
      } else {
        console.error(`🌐 [${this.serverInstanceId}] Cross-server action failed:`, error)
        pendingAction.reject(new Error(error || 'Cross-server action failed'))
      }
    } else {
      console.warn(`🌐 [${this.serverInstanceId}] No pending action found for request ${requestId}`)
    }
  }

  async executeCrossServerAction(
    targetClientId: string,
    action: string,
    params: any,
    mcpType: 'mcp' | 'adminMcp' = 'mcp'
  ): Promise<any> {
    console.log(`🌐 [${this.serverInstanceId}] Executing cross-server action: ${action} for client ${targetClientId}`)

    // Find which server the client is connected to
    const clientInfo = await ConnectedClientModel.findOne({ clientId: targetClientId }).lean().exec()

    if (!clientInfo) {
      throw new Error(`Client ${targetClientId} not found in any server instance`)
    }

    if (clientInfo.serverId === this.serverInstanceId) {
      throw new Error(`Client ${targetClientId} is on this server, use local execution`)
    }

    console.log(`🌐 [${this.serverInstanceId}] Client ${targetClientId} is on server ${clientInfo.serverId}`)

    return new Promise((resolve, reject) => {
      const requestId = `cross_${this.generateRequestId()}`
      const timeout = setTimeout(() => {
        this.pendingCrossServerActions.delete(requestId)
        reject(new Error(`Cross-server action ${action} for client ${targetClientId} timeout after 30 seconds`))
      }, 30000) // Longer timeout for cross-server actions

      this.pendingCrossServerActions.set(requestId, { resolve, reject, timeout })

      console.log(
        `🌐 [${this.serverInstanceId}] Sending cross-server request ${requestId} to server ${clientInfo.serverId}`
      )

      // Emit cross-server action request - use serverSideEmit for server-to-server communication
      this.io.serverSideEmit('cross_server_action_request', {
        requestId,
        targetClientId,
        action,
        params,
        sourceServerId: this.serverInstanceId,
        mcpType,
        timestamp: Date.now(),
      } as CrossServerActionRequest)
    })
  }

  private async executeLocalAction(
    socket: any,
    action: string,
    params: any,
    mcpType: 'mcp' | 'adminMcp'
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId()
      const timeout = setTimeout(() => {
        reject(new Error(`Local action ${action} timeout`))
      }, 15000)

      // Store temporary handler for this request
      const responseHandler = (data: any) => {
        if (data.requestId === requestId) {
          clearTimeout(timeout)
          socket.off(`${mcpType}:action_result`, responseHandler)

          if (data.success) {
            resolve(data.result)
          } else {
            reject(new Error(data.error || 'Action failed'))
          }
        }
      }

      socket.on(`${mcpType}:action_result`, responseHandler)

      socket.emit(`${mcpType}:execute_action`, {
        requestId,
        action,
        params,
      })
    })
  }

  private getLocalSocket(clientId: string): any {
    if (this.getLocalSocketFn) {
      return this.getLocalSocketFn(clientId)
    }
    return null
  }

  private generateRequestId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * OPTION 2: Redis Pub/Sub Implementation
 *
 * Alternative approach using Redis Pub/Sub for cross-server communication
 */

export class RedisPubSubCommunicationManager {
  private redisPublisher: any // Redis client for publishing
  private redisSubscriber: any // Redis client for subscribing
  private serverInstanceId: string
  private pendingActions: Map<string, any> = new Map()

  constructor(serverInstanceId: string) {
    this.serverInstanceId = serverInstanceId
    // Initialize Redis clients here
  }

  async initialize(): Promise<void> {
    // Set up Redis pub/sub
    // await this.redisSubscriber.subscribe(`mcp:cross_server:${this.serverInstanceId}`)
    // this.redisSubscriber.on('message', this.handleRedisMessage.bind(this))
  }

  // private handleRedisMessage(channel: string, message: string): void {
  //   try {
  //     const data = JSON.parse(message)
  //     // Handle cross-server messages
  //   } catch (error) {
  //     console.error('Error handling Redis message:', error)
  //   }
  // }

  // async publishCrossServerAction(
  //   targetServerId: string,
  //   targetClientId: string,
  //   action: string,
  //   params: any
  // ): Promise<any> {
  //   const requestId = this.generateRequestId()

  //   const actionRequest = {
  //     requestId,
  //     targetClientId,
  //     action,
  //     params,
  //     sourceServerId: this.serverInstanceId,
  //     timestamp: Date.now(),
  //   }

  //   // Publish to target server's channel
  //   // await this.redisPublisher.publish(`mcp:cross_server:${targetServerId}`, JSON.stringify(actionRequest))

  //   return new Promise((resolve, reject) => {
  //     const timeout = setTimeout(() => {
  //       this.pendingActions.delete(requestId)
  //       reject(new Error('Cross-server action timeout'))
  //     }, 30000)

  //     this.pendingActions.set(requestId, { resolve, reject, timeout })
  //   })
  // }

  // private generateRequestId(): string {
  //   return `redis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  // }
}

/**
 * OPTION 3: HTTP API Implementation
 *
 * Use HTTP calls between servers for cross-server communication
 */

export class HTTPCommunicationManager {
  private serverInstanceId: string
  private serverRegistry: Map<string, string> = new Map() // serverId -> serverUrl

  constructor(serverInstanceId: string) {
    this.serverInstanceId = serverInstanceId
  }

  async executeRemoteAction(targetServerId: string, targetClientId: string, action: string, params: any): Promise<any> {
    const serverUrl = this.serverRegistry.get(targetServerId)

    if (!serverUrl) {
      throw new Error(`Server ${targetServerId} not found in registry`)
    }

    const response = await fetch(`${serverUrl}/api/mcp/execute-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: targetClientId,
        action,
        params,
        sourceServerId: this.serverInstanceId,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP request failed: ${response.statusText}`)
    }

    return response.json()
  }

  registerServer(serverId: string, serverUrl: string): void {
    this.serverRegistry.set(serverId, serverUrl)
  }
}
