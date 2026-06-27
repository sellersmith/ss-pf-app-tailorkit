/**
 * WebSocket Monitoring Service
 * Provides utilities to monitor WebSocket connections and performance
 */

// Metrics storage
const metrics = {
  connections: {
    current: 0,
    total: 0,
    peak: 0,
    disconnects: 0,
  },
  messages: {
    sent: 0,
    received: 0,
    errors: 0,
  },
  performance: {
    messageSize: {
      sent: {
        total: 0,
        count: 0,
        max: 0,
      },
      received: {
        total: 0,
        count: 0,
        max: 0,
      },
    },
    latency: {
      values: [],
      total: 0,
      count: 0,
      max: 0,
      min: Number.MAX_SAFE_INTEGER,
    },
  },
  errors: {
    connection: 0,
    message: 0,
  },
  rooms: new Map(),
  // Track timestamps for rate calculations
  timestamps: {
    messages: {
      sent: [],
      received: [],
    },
    connections: [],
    disconnections: [],
  },
}

// Configuration
const config = {
  windowSize: 60, // Time window for rate calculations (seconds)
  samplingRate: 0.1, // Fraction of messages to sample for detailed metrics
  isEnabled: process.env.ENABLE_WEBSOCKET_MONITORING === 'true',
  maxArraySize: parseInt(process.env.WEBSOCKET_MAX_ARRAY_SIZE || '10000', 10), // Maximum size for timestamp arrays
}

// Store the cleanup interval ID
let cleanupIntervalId = null

/**
 * Initialize WebSocket monitoring
 * @param {object} io - Socket.IO server instance
 * @param {object} options - Configuration options
 */
export const initializeMonitoring = (io, options = {}) => {
  if (!io) {
    console.error('Cannot initialize WebSocket monitoring: Socket.IO server not provided')
    return
  }

  // Clear any existing interval to prevent duplicates
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId)
    cleanupIntervalId = null
  }

  // Update configuration
  Object.assign(config, options)

  if (!config.isEnabled) {
    console.info('WebSocket monitoring is disabled')
    return
  }

  // Set up Socket.IO middleware for monitoring
  io.use((socket, next) => {
    // Track connection
    trackConnection(socket)

    // Track disconnection
    socket.on('disconnect', () => {
      trackDisconnection(socket)
    })

    // Track messages
    const originalEmit = socket.emit
    socket.emit = function (event, ...args) {
      if (event !== 'disconnect' && event !== 'error') {
        trackMessageSent(args[0])
      }
      return originalEmit.apply(this, [event, ...args])
    }

    // Track incoming messages
    socket.onAny((event, data) => {
      if (event !== 'disconnect' && event !== 'error' && event !== 'connection') {
        trackMessageReceived(data)
      }
    })

    // Track errors
    socket.on('error', () => {
      metrics.errors.connection++
    })

    next()
  })

  // Set up interval for cleaning old timestamps
  cleanupIntervalId = setInterval(cleanupTimestamps, 10000) // Clean every 10 seconds

  console.info('✅ WebSocket monitoring initialized')
}

/**
 * Shutdown monitoring and cleanup resources
 */
export const shutdownMonitoring = () => {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId)
    cleanupIntervalId = null
    console.info('WebSocket monitoring shutdown: cleaned up resources')
  }
}

/**
 * Add a timestamp to an array with size control
 * @param {Array} array - The array to add the timestamp to
 * @param {number} timestamp - The timestamp to add
 */
const addTimestampWithLimit = (array, timestamp) => {
  array.push(timestamp)
  // If array exceeds max size, remove oldest entries
  if (array.length > config.maxArraySize) {
    // Remove 20% of the oldest entries
    const removeCount = Math.ceil(config.maxArraySize * 0.2)
    array.splice(0, removeCount)
  }
}

/**
 * Track a new connection
 */
const trackConnection = socket => {
  metrics.connections.current++
  metrics.connections.total++
  if (metrics.connections.current > metrics.connections.peak) {
    metrics.connections.peak = metrics.connections.current
  }

  addTimestampWithLimit(metrics.timestamps.connections, Date.now())

  // Track room joins
  const originalJoin = socket.join
  socket.join = function (room) {
    if (!metrics.rooms.has(room)) {
      metrics.rooms.set(room, 0)
    }
    metrics.rooms.set(room, metrics.rooms.get(room) + 1)
    return originalJoin.apply(this, arguments)
  }

  // Track room leaves
  const originalLeave = socket.leave
  socket.leave = function (room) {
    if (metrics.rooms.has(room)) {
      metrics.rooms.set(room, Math.max(0, metrics.rooms.get(room) - 1))
    }
    return originalLeave.apply(this, arguments)
  }
}

/**
 * Track a disconnection
 */
const trackDisconnection = () => {
  metrics.connections.current = Math.max(0, metrics.connections.current - 1)
  metrics.connections.disconnects++
  addTimestampWithLimit(metrics.timestamps.disconnections, Date.now())
}

/**
 * Track a message sent to clients
 */
const trackMessageSent = message => {
  metrics.messages.sent++
  addTimestampWithLimit(metrics.timestamps.messages.sent, Date.now())

  // Sample message sizes
  if (Math.random() < config.samplingRate) {
    const size = estimateMessageSize(message)
    metrics.performance.messageSize.sent.total += size
    metrics.performance.messageSize.sent.count++
    metrics.performance.messageSize.sent.max = Math.max(metrics.performance.messageSize.sent.max, size)
  }
}

/**
 * Track a message received from clients
 */
const trackMessageReceived = message => {
  metrics.messages.received++
  addTimestampWithLimit(metrics.timestamps.messages.received, Date.now())

  // Sample message sizes
  if (Math.random() < config.samplingRate) {
    const size = estimateMessageSize(message)
    metrics.performance.messageSize.received.total += size
    metrics.performance.messageSize.received.count++
    metrics.performance.messageSize.received.max = Math.max(metrics.performance.messageSize.received.max, size)
  }
}

/**
 * Track round-trip message latency
 */
export const trackLatency = latency => {
  metrics.performance.latency.values.push(latency)
  metrics.performance.latency.total += latency
  metrics.performance.latency.count++
  metrics.performance.latency.max = Math.max(metrics.performance.latency.max, latency)
  metrics.performance.latency.min = Math.min(metrics.performance.latency.min, latency)

  // Keep only the last 100 latency values
  if (metrics.performance.latency.values.length > 100) {
    const removed = metrics.performance.latency.values.shift()
    metrics.performance.latency.total -= removed
  }
}

/**
 * Estimate the size of a message in bytes
 */
const estimateMessageSize = message => {
  try {
    const json = JSON.stringify(message)
    return new TextEncoder().encode(json).length
  } catch (e) {
    return 0
  }
}

/**
 * Clean up old timestamps
 */
const cleanupTimestamps = () => {
  const now = Date.now()
  const windowMs = config.windowSize * 1000

  // Clean up connection timestamps
  metrics.timestamps.connections = metrics.timestamps.connections.filter(ts => now - ts < windowMs)
  metrics.timestamps.disconnections = metrics.timestamps.disconnections.filter(ts => now - ts < windowMs)
  metrics.timestamps.messages.sent = metrics.timestamps.messages.sent.filter(ts => now - ts < windowMs)
  metrics.timestamps.messages.received = metrics.timestamps.messages.received.filter(ts => now - ts < windowMs)
}

/**
 * Get current WebSocket metrics
 */
export const getMetrics = () => {
  const now = Date.now()
  const windowMs = config.windowSize * 1000

  // Calculate rates
  const messagesSentRate = metrics.timestamps.messages.sent.filter(ts => now - ts < windowMs).length / config.windowSize
  const messagesReceivedRate
    = metrics.timestamps.messages.received.filter(ts => now - ts < windowMs).length / config.windowSize
  const connectionsRate = metrics.timestamps.connections.filter(ts => now - ts < windowMs).length / config.windowSize
  const disconnectionsRate
    = metrics.timestamps.disconnections.filter(ts => now - ts < windowMs).length / config.windowSize

  // Calculate average message sizes
  const avgSentSize
    = metrics.performance.messageSize.sent.count > 0
      ? Math.round(metrics.performance.messageSize.sent.total / metrics.performance.messageSize.sent.count)
      : 0

  const avgReceivedSize
    = metrics.performance.messageSize.received.count > 0
      ? Math.round(metrics.performance.messageSize.received.total / metrics.performance.messageSize.received.count)
      : 0

  // Calculate average latency
  const avgLatency
    = metrics.performance.latency.count > 0
      ? Math.round(metrics.performance.latency.total / metrics.performance.latency.count)
      : 0

  // Room statistics
  const roomStats = []
  metrics.rooms.forEach((count, room) => {
    if (count > 0) {
      roomStats.push({ room, count })
    }
  })

  return {
    timestamp: now,
    connections: {
      current: metrics.connections.current,
      total: metrics.connections.total,
      peak: metrics.connections.peak,
      rate: {
        connect: connectionsRate,
        disconnect: disconnectionsRate,
      },
    },
    messages: {
      sent: {
        total: metrics.messages.sent,
        rate: messagesSentRate,
        avgSize: avgSentSize,
        maxSize: metrics.performance.messageSize.sent.max,
      },
      received: {
        total: metrics.messages.received,
        rate: messagesReceivedRate,
        avgSize: avgReceivedSize,
        maxSize: metrics.performance.messageSize.received.max,
      },
    },
    performance: {
      latency: {
        avg: avgLatency,
        min: metrics.performance.latency.min === Number.MAX_SAFE_INTEGER ? 0 : metrics.performance.latency.min,
        max: metrics.performance.latency.max,
      },
    },
    errors: {
      connection: metrics.errors.connection,
      message: metrics.errors.message,
    },
    rooms: roomStats.sort((a, b) => b.count - a.count),
  }
}

/**
 * Reset all metrics
 */
export const resetMetrics = () => {
  metrics.connections.current = 0
  metrics.connections.total = 0
  metrics.connections.peak = 0
  metrics.connections.disconnects = 0

  metrics.messages.sent = 0
  metrics.messages.received = 0
  metrics.messages.errors = 0

  metrics.performance.messageSize.sent.total = 0
  metrics.performance.messageSize.sent.count = 0
  metrics.performance.messageSize.sent.max = 0

  metrics.performance.messageSize.received.total = 0
  metrics.performance.messageSize.received.count = 0
  metrics.performance.messageSize.received.max = 0

  metrics.performance.latency.values = []
  metrics.performance.latency.total = 0
  metrics.performance.latency.count = 0
  metrics.performance.latency.max = 0
  metrics.performance.latency.min = Number.MAX_SAFE_INTEGER

  metrics.errors.connection = 0
  metrics.errors.message = 0

  metrics.rooms.clear()

  metrics.timestamps.messages.sent = []
  metrics.timestamps.messages.received = []
  metrics.timestamps.connections = []
  metrics.timestamps.disconnections = []
}
