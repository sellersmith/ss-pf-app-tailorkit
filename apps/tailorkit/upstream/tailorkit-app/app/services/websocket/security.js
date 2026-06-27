/**
 * WebSocket Security Service
 * Provides security features for WebSocket connections
 */

import { RateLimiterMemory } from 'rate-limiter-flexible'

// Rate limiting configuration
const rateLimiters = {
  connection: new RateLimiterMemory({
    points: 5, // Number of connections allowed
    duration: 60, // Per 60 seconds
  }),
  message: new RateLimiterMemory({
    points: 50, // Number of messages allowed
    duration: 60, // Per 60 seconds
  }),
}

// Security configuration
const securityConfig = {
  enabled: process.env.ENABLE_WEBSOCKET_SECURITY === 'true',
  rateLimiting: process.env.ENABLE_WEBSOCKET_RATE_LIMITING === 'true',
  validateOrigin: process.env.VALIDATE_WEBSOCKET_ORIGIN === 'true',
  allowedOrigins: process.env.ALLOWED_WEBSOCKET_ORIGINS
    ? process.env.ALLOWED_WEBSOCKET_ORIGINS.split(',')
        .filter(origin => origin.trim())
        .map(origin => origin.trim())
    : [],
  maxPayloadSize: parseInt(process.env.MAX_WEBSOCKET_PAYLOAD_SIZE || '1048576', 10), // Default: 1MB
  requireAuth: process.env.REQUIRE_WEBSOCKET_AUTH === 'true',
}

/**
 * Initialize WebSocket security
 * @param {object} io - Socket.IO server instance
 * @param {object} options - Security configuration options
 */
export const initializeSecurity = (io, options = {}) => {
  if (!io) {
    console.error('Cannot initialize WebSocket security: Socket.IO server not provided')
    return
  }

  // Update security configuration
  Object.assign(securityConfig, options)

  if (!securityConfig.enabled) {
    console.info('WebSocket security is disabled')
    return
  }

  // Apply security middleware
  io.use(securityMiddleware)

  console.info('✅ WebSocket security initialized')
}

/**
 * Security middleware for Socket.IO
 */
const securityMiddleware = async (socket, next) => {
  try {
    // Apply rate limiting for connections
    if (securityConfig.rateLimiting) {
      try {
        await rateLimitConnection(socket)
      } catch (error) {
        return next(new Error('Too many connection attempts. Please try again later.'))
      }
    }

    // Validate origin
    if (securityConfig.validateOrigin) {
      const origin = socket.handshake.headers.origin
      if (!validateOrigin(origin)) {
        return next(new Error(`Origin not allowed: ${origin}`))
      }
    }

    // Set up message rate limiting
    if (securityConfig.rateLimiting) {
      setupMessageRateLimiting(socket)
    }

    // Validate authentication if required
    if (securityConfig.requireAuth) {
      const token = socket.handshake.auth.token || socket.handshake.query.token
      if (!token) {
        return next(new Error('Authentication required'))
      }
    }

    // Set up payload size validation
    setupPayloadSizeValidation(socket)

    next()
  } catch (error) {
    console.error('WebSocket security error:', error)
    next(new Error('Security check failed'))
  }
}

/**
 * Apply rate limiting for connections
 */
const rateLimitConnection = async socket => {
  const clientIP = getClientIP(socket)
  return rateLimiters.connection.consume(clientIP)
}

/**
 * Set up message rate limiting
 */
const setupMessageRateLimiting = socket => {
  const clientIP = getClientIP(socket)

  // Override socket.on to apply rate limiting to incoming messages
  const originalOn = socket.on
  socket.on = function (event, listener) {
    if (event !== 'error' && event !== 'disconnect' && event !== 'connection') {
      const wrappedListener = async (...args) => {
        try {
          // Apply rate limiting
          await rateLimiters.message.consume(clientIP)
          return listener.apply(this, args)
        } catch (error) {
          console.warn(`Rate limit exceeded for client ${clientIP} on event ${event}`)
          socket.emit('error', { message: 'Rate limit exceeded. Please slow down.' })
          return false
        }
      }
      return originalOn.call(this, event, wrappedListener)
    }
    return originalOn.call(this, event, listener)
  }
}

/**
 * Set up payload size validation
 */
const setupPayloadSizeValidation = socket => {
  const originalOn = socket.onevent
  socket.onevent = function (packet) {
    if (packet.data && packet.data.length > 1) {
      const payloadSize = estimatePayloadSize(packet.data[1])
      if (payloadSize > securityConfig.maxPayloadSize) {
        console.warn(`Payload size exceeded for client ${getClientIP(socket)}: ${payloadSize} bytes`)
        socket.emit('error', { message: 'Message too large' })
        return
      }
    }
    return originalOn.apply(this, arguments)
  }
}

/**
 * Validate origin against the allowed origins list
 */
const validateOrigin = origin => {
  if (!origin) return false

  // If no origins specified, allow all
  if (!securityConfig.allowedOrigins.length) {
    console.info('No allowed origins specified, allowing all origins')
    return true
  }

  // Check if origin is in the allowed list
  return securityConfig.allowedOrigins.some(allowedOrigin => {
    // Allow exact match
    if (allowedOrigin === origin) return true

    // Allow wildcard match (e.g., "*.example.com")
    if (allowedOrigin.startsWith('*.')) {
      const domain = allowedOrigin.substring(2)
      return origin.endsWith(domain) && origin.includes('://')
    }

    return false
  })
}

/**
 * Get client IP address
 */
const getClientIP = socket => {
  return socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || 'unknown'
}

/**
 * Estimate payload size in bytes
 */
const estimatePayloadSize = payload => {
  try {
    const json = JSON.stringify(payload)
    return new TextEncoder().encode(json).length
  } catch (e) {
    return 0
  }
}

/**
 * Create a token for WebSocket authentication
 * @param {string} userId - User ID
 * @param {object} data - Additional token data
 * @param {number} expiresIn - Token expiration time in seconds
 * @returns {string} Authentication token
 */
export const createAuthToken = (userId, data = {}, expiresIn = 3600) => {
  // Switch from basic base64 encoding to proper JWT
  try {
    const jwt = require('jsonwebtoken')

    // Use a proper environment variable for the secret
    const secretKey = process.env.JWT_SECRET || 'your-default-secret-key-should-be-changed-in-production'

    const token = jwt.sign(
      {
        userId,
        ...data,
        iat: Math.floor(Date.now() / 1000),
      },
      secretKey,
      {
        expiresIn,
        issuer: 'tailorkit-websocket',
        subject: userId.toString(),
      }
    )

    return token
  } catch (error) {
    console.error('Error creating auth token:', error)
    throw new Error('Failed to create authentication token')
  }
}

/**
 * Verify an authentication token
 * @param {string} token - Authentication token
 * @returns {object} Token data if valid, null otherwise
 */
export const verifyAuthToken = token => {
  try {
    const jwt = require('jsonwebtoken')

    // Use a proper environment variable for the secret
    const secretKey = process.env.JWT_SECRET || 'your-default-secret-key-should-be-changed-in-production'

    // Verify and decode the token
    const decoded = jwt.verify(token, secretKey, {
      issuer: 'tailorkit-websocket',
    })

    return decoded
  } catch (error) {
    console.error('Error verifying auth token:', error)
    return null
  }
}
