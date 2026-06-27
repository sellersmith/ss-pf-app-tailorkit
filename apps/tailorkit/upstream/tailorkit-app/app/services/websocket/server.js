import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'redis'
import { MongoClient } from 'mongodb'
import { createAdapter as createMongoAdapter } from '@socket.io/mongo-adapter'
// import jwt from 'jsonwebtoken'

let io

/**
 * Initializes the WebSocket server
 * @param {object} server - The HTTP/HTTPS server instance
 * @param {object} options - Configuration options
 * @returns {object} The Socket.IO server instance
 */
export const initializeWebSocketServer = async (server, options = {}) => {
  const {
    enableRedis = process.env.ENABLE_WEBSOCKET_REDIS === 'true',
    redisUrl = process.env.REDIS_URL || 'redis://localhost:6379',
    enableMongo = process.env.ENABLE_WEBSOCKET_MONGO === 'true',
    mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tailorkit',
    mongoCollection = process.env.MONGO_COLLECTION || 'socket-io-events',
    corsOrigin = process.env.CORS_ORIGIN || '*',
    path = '/ws',
    maxHttpBufferSize = 5e6, // 5MB
    pingTimeout = 30000,
    pingInterval = 25000,
    transports = ['websocket', 'polling'],
  } = options

  // Create Socket.IO server
  io = new Server(server, {
    path,
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    maxHttpBufferSize,
    pingTimeout,
    pingInterval,
    transports,
  })

  // Set up Redis adapter for scaling
  if (enableRedis) {
    try {
      const pubClient = createClient({ url: redisUrl })
      const subClient = pubClient.duplicate()

      await Promise.all([pubClient.connect(), subClient.connect()])

      io.adapter(createAdapter(pubClient, subClient))

      console.info('✅ WebSocket Redis adapter initialized')

      // Handle Redis errors
      pubClient.on('error', error => {
        console.error('Redis Pub Client Error:', error)
      })

      subClient.on('error', error => {
        console.error('Redis Sub Client Error:', error)
      })
    } catch (error) {
      console.error('Failed to initialize Redis adapter:', error)
    }
  }
  // Set up MongoDB adapter for scaling
  else if (enableMongo) {
    try {
      const mongoClient = new MongoClient(mongoUri)
      await mongoClient.connect()

      const db = mongoClient.db()

      // Create capped collection if it doesn't exist
      try {
        await db.createCollection(mongoCollection)
      } catch (e) {
        // Collection might already exist, which is fine
      }

      const collection = db.collection(mongoCollection)

      // Apply the MongoDB adapter
      io.adapter(createMongoAdapter(collection))

      console.info('✅ WebSocket MongoDB adapter initialized')

      // Handle MongoDB errors
      mongoClient.on('error', error => {
        console.error('MongoDB Client Error:', error)
      })
    } catch (error) {
      console.error('Failed to initialize MongoDB adapter:', error)
    }
  }

  // Setup authentication middleware
  io.use(authMiddleware)

  // Setup connection handling
  io.on('connection', onConnection)

  console.info('✅ WebSocket server initialized')

  return io
}

/**
 * Middleware to authenticate WebSocket connections
 */
const authMiddleware = (socket, next) => {
  next()
  // TODO: Implement authentication middleware later
  // try {
  //   // Get the token from either auth object or query params
  //   const token = socket.handshake.auth.token || socket.handshake.query.token

  //   if (!token) {
  //     return next(new Error('Authentication error: Token required'))
  //   }

  //   // Verify the token
  //   const secretKey = process.env.JWT_SECRET || 'your-default-secret-key-should-be-changed-in-production'

  //   jwt.verify(token, secretKey, { issuer: 'tailorkit-websocket' }, (err, decoded) => {
  //     if (err) {
  //       console.error('JWT verification error:', err)
  //       return next(new Error('Authentication error: Invalid token'))
  //     }

  //     // Store the decoded user information in the socket object
  //     socket.user = {
  //       id: decoded.userId || decoded.sub,
  //       ...decoded,
  //     }

  //     next()
  //   })
  // } catch (error) {
  //   console.error('Authentication middleware error:', error)
  //   next(new Error('Authentication error: Failed to process token'))
  // }
}

/**
 * Handle new WebSocket connections
 */
const onConnection = socket => {
  const userId = socket.user?.id

  console.info(`New client connected: ${socket.id}, User: ${userId}`)

  // Join user-specific room for targeted messages
  if (userId) {
    socket.join(`user:${userId}`)
  }

  /**
   * Listen for join/leave room events from client (for shopDomain)
   */
  socket.on('join', room => {
    if (typeof room === 'string' && room) {
      socket.join(room)
      console.info(`Socket ${socket.id} joined room: ${room}`)
    }
  })
  socket.on('leave', room => {
    if (typeof room === 'string' && room) {
      socket.leave(room)
      console.info(`Socket ${socket.id} left room: ${room}`)
    }
  })

  // Handle client events
  socket.on('message', data => handleMessage(socket, data))

  // Handle disconnection
  socket.on('disconnect', () => {
    console.info(`Client disconnected: ${socket.id}`)
  })

  // Handle errors
  socket.on('error', error => {
    console.error(`Socket error for ${socket.id}:`, error)
  })

  // Send welcome message
  socket.emit('welcome', { message: 'Connected to TailorKit WebSocket server' })
}

/**
 * Handle incoming messages
 */
const handleMessage = (socket, data) => {
  try {
    // TODO: Implement message validation
    console.info(`Message from ${socket.id}:`, data)

    // Echo message back to sender
    socket.emit('message:received', {
      id: Date.now(),
      data,
      status: 'received',
    })
  } catch (error) {
    console.error('Error handling message:', error)
    socket.emit('error', { message: 'Error processing message' })
  }
}

/**
 * Get the Socket.IO server instance
 */
export const getIO = () => {
  if (!io) {
    throw new Error('WebSocket server not initialized')
  }
  return io
}

/**
 * Emit event to all connected clients
 */
export const emitToAll = (event, data) => {
  if (!io) return
  io.emit(event, data)
}

/**
 * Emit event to a specific room
 */
export const emitToRoom = (room, event, data) => {
  if (!io) return
  io.to(room).emit(event, data)
}

/**
 * Emit event to a specific user
 */
export const emitToUser = (userId, event, data) => {
  if (!io) return
  io.to(`user:${userId}`).emit(event, data)
}

/**
 * Shutdown the WebSocket server and free resources
 */
export const shutdownWebSocketServer = () => {
  if (io) {
    io.disconnectSockets()
    io.close()
    console.info('WebSocket server has been shut down')
    io = null
  }
}
