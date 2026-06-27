export interface MCPMessage {
  type: string
  requestId?: string
  clientId?: string
  [key: string]: any
}

export interface SocketNotification {
  eventName: string
  timestamp: string
  [key: string]: any
}

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
  RECONNECTING = 'reconnecting',
}

export interface ConnectionInfo {
  state: ConnectionState
  connected: boolean
  socketConnected: boolean
  clientId: string | null
  reconnectAttempts: number
  transport?: string
}

export interface MCPClientConfig {
  maxReconnectAttempts?: number
  reconnectBackoffMultiplier?: number
  maxReconnectDelay?: number
}
