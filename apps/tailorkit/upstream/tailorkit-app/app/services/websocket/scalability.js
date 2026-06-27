/**
 * WebSocket Scalability Service
 * Provides utilities to scale WebSocket connections across multiple servers
 */

import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'redis'

// Scalability configuration
const config = {
  enabled: process.env.ENABLE_WEBSOCKET_SCALABILITY === 'true',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  redisPrefix: process.env.REDIS_PREFIX || 'socket.io',
  redisRetryAttempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '10', 10),
  redisRetryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '1000', 10),
  enableCluster: process.env.ENABLE_WEBSOCKET_CLUSTER === 'true',
  nodeId: process.env.NODE_ID || `node-${Math.floor(Math.random() * 1000000)}`, // Unique ID for this server
}

// Redis clients
let pubClient = null
let subClient = null

/**
 * Initialize WebSocket scalability features
 * @param {object} io - Socket.IO server instance
 * @param {object} options - Configuration options
 */
export const initializeScalability = async (io, options = {}) => {
  if (!io) {
    console.error('Cannot initialize WebSocket scalability: Socket.IO server not provided')
    return false
  }

  // Update configuration
  Object.assign(config, options)

  if (!config.enabled) {
    console.info('WebSocket scalability is disabled')
    return false
  }

  try {
    // Initialize Redis adapter
    await setupRedisAdapter(io)

    // Set up message distribution
    setupMessageDistribution(io)

    console.info('✅ WebSocket scalability initialized')
    return true
  } catch (error) {
    console.error('Failed to initialize WebSocket scalability:', error)
    return false
  }
}

/**
 * Set up Redis adapter for Socket.IO
 */
const setupRedisAdapter = async io => {
  try {
    // Create Redis clients
    pubClient = createClient({
      url: config.redisUrl,
      socket: {
        reconnectStrategy: retries => {
          if (retries > config.redisRetryAttempts) {
            return new Error('Redis connection retries exhausted')
          }
          return Math.min(retries * config.redisRetryDelay, 10000)
        },
      },
    })

    subClient = pubClient.duplicate()

    // Handle connection errors
    pubClient.on('error', error => {
      console.error('Redis Pub Client Error:', error)
    })

    subClient.on('error', error => {
      console.error('Redis Sub Client Error:', error)
    })

    // Connect to Redis
    await Promise.all([pubClient.connect(), subClient.connect()])

    // Create and set up the adapter
    io.adapter(
      createAdapter(pubClient, subClient, {
        key: config.redisPrefix,
      })
    )

    console.info('Connected to Redis for WebSocket scaling')
    return true
  } catch (error) {
    console.error('Failed to set up Redis adapter:', error)
    throw error
  }
}

/**
 * Set up message distribution across server instances
 */
const setupMessageDistribution = io => {
  if (!pubClient) return

  // Custom channel for server-to-server communication
  const serverChannel = `${config.redisPrefix}#server-messages`

  // Listen for messages from other servers
  subClient.subscribe(serverChannel, message => {
    try {
      const { sourceNodeId, event, data, room, userId } = JSON.parse(message)

      // Ignore messages from this server
      if (sourceNodeId === config.nodeId) return

      if (room) {
        // Send to a specific room
        io.to(room).emit(event, data)
      } else if (userId) {
        // Send to a specific user
        io.to(`user:${userId}`).emit(event, data)
      } else {
        // Broadcast to all clients
        io.emit(event, data)
      }
    } catch (error) {
      console.error('Error processing server message:', error)
    }
  })
}

/**
 * Send a message to all connected clients across all server instances
 * @param {string} event - Event name
 * @param {any} data - Message data
 */
export const broadcastToAll = async (event, data) => {
  if (!pubClient || !config.enabled) return false

  try {
    const message = JSON.stringify({
      sourceNodeId: config.nodeId,
      event,
      data,
    })

    await pubClient.publish(`${config.redisPrefix}#server-messages`, message)
    return true
  } catch (error) {
    console.error('Error broadcasting message:', error)
    return false
  }
}

/**
 * Send a message to a specific room across all server instances
 * @param {string} room - Room name
 * @param {string} event - Event name
 * @param {any} data - Message data
 */
export const broadcastToRoom = async (room, event, data) => {
  if (!pubClient || !config.enabled) return false

  try {
    const message = JSON.stringify({
      sourceNodeId: config.nodeId,
      room,
      event,
      data,
    })

    await pubClient.publish(`${config.redisPrefix}#server-messages`, message)
    return true
  } catch (error) {
    console.error('Error broadcasting message to room:', error)
    return false
  }
}

/**
 * Send a message to a specific user across all server instances
 * @param {string} userId - User ID
 * @param {string} event - Event name
 * @param {any} data - Message data
 */
export const broadcastToUser = async (userId, event, data) => {
  if (!pubClient || !config.enabled) return false

  try {
    const message = JSON.stringify({
      sourceNodeId: config.nodeId,
      userId,
      event,
      data,
    })

    await pubClient.publish(`${config.redisPrefix}#server-messages`, message)
    return true
  } catch (error) {
    console.error('Error broadcasting message to user:', error)
    return false
  }
}

/**
 * Close Redis connections
 * @returns {Promise} A promise that resolves when connections are closed
 */
export const closeConnections = async () => {
  const tasks = []

  if (pubClient) {
    tasks.push(pubClient.quit())
  }

  if (subClient) {
    tasks.push(subClient.quit())
  }

  if (tasks.length === 0) {
    return Promise.resolve() // Return resolved promise if no connections to close
  }

  await Promise.all(tasks)

  pubClient = null
  subClient = null

  return Promise.resolve() // Explicitly return a resolved promise
}

/**
 * Get Redis connection status
 */
export const getStatus = () => {
  return {
    enabled: config.enabled,
    nodeId: config.nodeId,
    pubClientConnected: pubClient ? pubClient.isReady : false,
    subClientConnected: subClient ? subClient.isReady : false,
  }
}
