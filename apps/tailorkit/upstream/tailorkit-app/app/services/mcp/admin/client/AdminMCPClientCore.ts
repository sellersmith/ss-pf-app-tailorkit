import type { Socket } from 'socket.io-client'
import { io } from 'socket.io-client'
import { ConnectionState } from './types'
import type { MCPMessage } from './types'

export class AdminMCPClientCore {
  private socket: Socket | null = null
  private clientId: string | null = null
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED
  private sessionId: string | null = null
  private origin: string
  private path: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectBackoffMultiplier = 1.5
  private reconnectTimeout?: NodeJS.Timeout
  private connectPromise?: Promise<void>

  constructor(origin: string, path: string, sessionId?: string) {
    this.origin = origin
    this.path = path
    this.sessionId = sessionId || null
  }

  // Getters for properties
  getSessionId(): string | null {
    return this.sessionId
  }

  getOrigin(): string {
    return this.origin
  }

  getPath(): string {
    return this.path
  }

  getSocket(): Socket | null {
    return this.socket
  }

  getClientId(): string | null {
    return this.clientId
  }

  getConnectionState(): ConnectionState {
    return this.connectionState
  }

  setSessionId(sessionId: string): void {
    this.sessionId = sessionId
    // If already connected, register immediately
    if (this.isClientConnected()) {
      this.registerSession(sessionId)
    }
  }

  isClientConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED && !!this.socket?.connected
  }

  // Session management
  registerSession(sessionId: string): void {
    if (!this.socket || !this.isClientConnected()) {
      console.warn('Cannot register session: socket not connected')
      return
    }

    this.sessionId = sessionId
    console.log(`🆔 Registering session: ${sessionId}`)

    this.socket.emit('adminMcp:register_session', {
      sessionId,
      timestamp: new Date().toISOString(),
    })
  }

  async connect(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        console.log(`🔌 Connecting to MCP via Socket.IO: ${this.origin}`)
        // Use your exact Socket.IO pattern
        this.socket = io(this.origin, {
          path: '/ws',
          transports: ['websocket'],
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 20000,
        })

        this.setupSocketEventHandlers(resolve, reject)
      } catch (error) {
        reject(error)
      }
    })
  }

  private setupSocketEventHandlers(resolve: () => void, reject: (error: Error) => void): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('Socket connected')
      this.connectionState = ConnectionState.CONNECTED
      this.reconnectAttempts = 0

      // Send MCP identification
      this.socket?.emit('adminMcp:identify', {
        userAgent: 'TailorKit-Admin-MCP-Client',
        timestamp: new Date().toISOString(),
      })

      // Register session ID if available
      if (this.sessionId) {
        this.registerSession(this.sessionId)
      }

      resolve()
    })

    this.socket.on('connect_error', error => {
      console.error('Socket connection error:', error)
      this.handleConnectionError(error)
      reject(error)
    })

    this.socket.on('disconnect', reason => {
      console.log('Socket disconnected:', reason)
      this.connectionState = ConnectionState.DISCONNECTED
      if (reason === 'io server disconnect') {
        this.socket?.connect()
      }
    })

    // MCP specific events
    this.socket.on('adminMcp:welcome', data => {
      this.clientId = data.clientId
      console.log(`🆔 MCP Client ID: ${this.clientId}`)

      // Register session ID if available
      if (this.sessionId) {
        this.registerSession(this.sessionId)
      }

      this.onConnected?.(this.clientId || '')
    })

    this.socket.on('adminMcp:connected', data => {
      this.clientId = data.clientId
      console.log(`🆔 MCP Client ID: ${this.clientId}`)
      this.onConnected?.(this.clientId || '')
    })

    this.socket.on('adminMcp:execute_action', data => {
      console.log('📨 MCP Action request:', data.action)
      this.onActionRequest?.(data)
    })

    this.socket.on('adminMcp:ping', () => {
      this.socket?.emit('adminMcp:pong')
    })

    this.socket.on('adminMcp:error', error => {
      console.error('❌ MCP Error:', error)
    })

    this.socket.on('adminMcp:session_associated', data => {
      console.log(`🔗 Client associated with session: ${data.sessionId}`)
      this.sessionId = data.sessionId
    })
  }

  private handleConnectionError(error: Error): void {
    this.connectionState = ConnectionState.ERROR
    this.reconnectAttempts++

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(this.reconnectBackoffMultiplier, this.reconnectAttempts), 30000)
      this.reconnectTimeout = setTimeout(() => {
        console.log(`Attempting reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
        this.connect()
      }, delay) as any
    }
  }

  private handleActionRequest(message: MCPMessage): void {
    // Implementation for handling action requests
    console.log('Received action request:', message)
  }

  sendActionResult(requestId: string, success: boolean, result?: any, error?: string): void {
    if (!this.socket?.connected) {
      console.warn('Cannot send action result: socket not connected')
      return
    }

    this.socket.emit('adminMcp:action_result', {
      requestId,
      success,
      result,
      error,
    })
  }

  sendStateUpdate(state: any): void {
    if (!this.socket?.connected) {
      console.warn('Cannot send state update: socket not connected')
      return
    }

    this.socket.emit('adminMcp:state_update', state)
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = undefined
    }

    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
    }

    this.connectionState = ConnectionState.DISCONNECTED
    this.clientId = null
    this.connectPromise = undefined
  }

  // Event callbacks
  onConnected?: (clientId: string) => void
  onActionRequest?: (message: MCPMessage) => void
}
