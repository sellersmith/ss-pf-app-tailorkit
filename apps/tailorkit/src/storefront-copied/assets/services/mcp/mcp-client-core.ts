import type { Socket } from 'socket.io-client'
import { io } from 'socket.io-client'
import { sleep } from '../../utils'

export interface MCPMessage {
  type: string
  requestId?: string
  clientId?: string
  [key: string]: any
}

export class MCPClientCore {
  private socket: Socket | null = null
  private clientId: string | null = null
  private isConnected = false
  private origin: string
  private path: string
  private sessionId: string | null = null

  constructor(origin: string, path: string, sessionId?: string) {
    this.origin = origin
    this.path = path
    this.sessionId = sessionId || null
  }

  // Connection management
  async connect(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        console.log(`🔌 Connecting to MCP via Socket.IO: ${this.origin}`)

        const response = await fetch(`${this.path}/app_proxy/storefront?check=mcp`)

        if (!response.ok) {
          throw new Error('MCP health check failed')
        }

        const data = await response.json()
        if (!data.success || !data.mcp.serverRunning) {
          throw new Error('MCP health check failed')
        }

        await sleep(100)
        // Use your exact Socket.IO pattern
        this.socket = io(this.origin, {
          path: '/ws',
          transports: ['websocket'],
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 20000,
        })

        this.setupEventHandlers(resolve, reject)
      } catch (error) {
        reject(error)
      }
    })
  }

  private setupEventHandlers(resolve: () => void, reject: (error: Error) => void): void {
    if (!this.socket) return

    // Socket.IO connection events
    this.socket.on('connect', () => {
      console.log('✅ MCP Socket.IO connected')
      this.isConnected = true

      // Send MCP identification
      this.emit('mcp:identify', {
        userAgent: 'TailorKit-MCP-Client',
        timestamp: new Date().toISOString(),
      })

      // Register session ID if available
      if (this.sessionId) {
        this.registerSession(this.sessionId)
      }

      resolve()
    })

    this.socket.on('disconnect', reason => {
      console.log(`🔌 MCP Socket.IO disconnected: ${reason}`)
      this.isConnected = false
    })

    this.socket.on('connect_error', error => {
      console.error('❌ MCP Socket.IO connection error:', error.message)
      this.isConnected = false
      reject(new Error(`MCP connection failed: ${error.message}`))
    })

    this.socket.on('reconnect', attemptNumber => {
      console.log(`🔄 MCP reconnected after ${attemptNumber} attempts`)
      this.isConnected = true
    })

    this.socket.on('reconnect_attempt', attemptNumber => {
      console.log(`🔄 MCP reconnection attempt ${attemptNumber}`)
    })

    this.socket.on('reconnect_failed', () => {
      console.error('❌ MCP reconnection failed')
      this.isConnected = false
    })

    // MCP-specific events
    this.socket.on('mcp:welcome', data => {
      this.clientId = data.clientId
      console.log(`🆔 MCP Client ID: ${this.clientId}`)

      // Register session ID if available
      if (this.sessionId) {
        this.registerSession(this.sessionId)
      }

      this.onConnected?.(this.clientId || '')
    })

    this.socket.on('mcp:connected', data => {
      this.clientId = data.clientId
      console.log(`🆔 MCP Client ID: ${this.clientId}`)

      this.onConnected?.(this.clientId || '')
    })

    this.socket.on('mcp:execute_action', data => {
      console.log('📨 MCP Action request:', data.action)
      this.onActionRequest?.(data)
    })

    this.socket.on('mcp:ping', () => {
      this.socket?.emit('mcp:pong')
    })

    this.socket.on('mcp:error', error => {
      console.error('❌ MCP Error:', error)
    })

    this.socket.on('mcp:pong', () => {
      this.socket?.emit('mcp:pong')
    })

    this.socket.on('mcp:session_associated', data => {
      console.log(`🔗 Client associated with session: ${data.sessionId}`)
      this.sessionId = data.sessionId
    })
  }

  // Message sending
  emit(event: string, data?: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data)
    } else {
      console.warn('⚠️ Cannot emit - MCP Socket.IO not connected')
    }
  }

  send(message: MCPMessage): void {
    this.emit('mcp:message', message)
  }

  sendActionResult(requestId: string, success: boolean, result?: any, error?: string): void {
    this.emit('mcp:action_result', {
      requestId,
      success,
      result,
      error,
      timestamp: new Date().toISOString(),
    })
  }

  sendStateUpdate(state: any): void {
    this.emit('mcp:state_update', {
      clientId: this.clientId,
      state,
      timestamp: new Date().toISOString(),
    })
  }

  // State
  getClientId(): string | null {
    return this.clientId
  }

  isClientConnected(): boolean {
    return this.isConnected && this.socket?.connected === true
  }

  getConnectionInfo(): any {
    return {
      connected: this.isConnected,
      socketConnected: this.socket?.connected,
      clientId: this.clientId,
      transport: this.socket?.io?.engine?.transport?.name,
      origin: this.origin,
      path: '/ws',
    }
  }

  // Cleanup
  disconnect(): void {
    if (this.socket) {
      console.log('🔌 Disconnecting MCP Socket.IO...')
      this.socket.disconnect()
      this.socket = null
    }

    this.isConnected = false
    this.clientId = null
  }

  // Event handlers
  public onConnected?: (clientId: string) => void
  public onActionRequest?: (message: MCPMessage) => void

  // Session management
  registerSession(sessionId: string): void {
    if (!this.socket || !this.isConnected) {
      console.warn('Cannot register session: socket not connected')
      return
    }

    this.sessionId = sessionId
    console.log(`🆔 Registering session: ${sessionId}`)

    this.socket.emit('mcp:register_session', {
      sessionId,
      timestamp: new Date().toISOString(),
    })
  }

  // Update session ID
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId

    // If already connected, register immediately
    if (this.isConnected) {
      this.registerSession(sessionId)
    }
  }
}
