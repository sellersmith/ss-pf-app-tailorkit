import crypto from 'crypto'
import { json } from '~/bootstrap/fns/fetch.server'
import Shop from '~/models/Shop.server'
import type { McpAuthResult, McpRequestContext } from './types'
import { MCP_ERROR_AUTH_ERRORS_MAP } from './constants'

/**
 * Creates a constant-time comparison for two strings to prevent timing attacks
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns True if strings are equal, false otherwise
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  // Use crypto timingSafeEqual if available (Node.js environment)
  if (typeof crypto.timingSafeEqual === 'function') {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  }

  // Fallback implementation for environments without timingSafeEqual
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/**
 * Verifies an MCP authentication request
 * @param request - The HTTP request
 * @param body - The parsed request body
 * @returns Result of the authentication verification
 */
async function verifyMcpAuth(request: Request, body: any): Promise<McpAuthResult> {
  // Extract bearer token from Authorization header
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return MCP_ERROR_AUTH_ERRORS_MAP.MISSING_TOKEN
  }

  const accessToken = authHeader.split(' ')[1]
  if (!accessToken) {
    return MCP_ERROR_AUTH_ERRORS_MAP.MISSING_TOKEN
  }

  // Extract shopDomain from request body
  const { shopDomain } = body
  if (!shopDomain) {
    return MCP_ERROR_AUTH_ERRORS_MAP.MISSING_SHOP_DOMAIN
  }

  // Find shop by access token
  const shop = await Shop.findOne({ 'appConfig.mcp.accessToken': accessToken })

  // Check if shop exists and token is valid
  if (!shop) {
    return MCP_ERROR_AUTH_ERRORS_MAP.INVALID_TOKEN
  }

  // Double-check token with constant-time comparison to prevent timing attacks
  if (!constantTimeCompare(accessToken, shop.appConfig?.mcp?.accessToken || '')) {
    return MCP_ERROR_AUTH_ERRORS_MAP.INVALID_TOKEN
  }

  // Check if shop domain matches
  if (shop.shopDomain !== shopDomain) {
    return MCP_ERROR_AUTH_ERRORS_MAP.MISMATCHED_SHOP
  }

  // Check if token is expired
  const mcp = shop.appConfig?.mcp
  const isTokenExpired
    = mcp?.expiresAt !== null && mcp?.expiresAt !== undefined && new Date(mcp.expiresAt).getTime() < Date.now()

  if (isTokenExpired) {
    return MCP_ERROR_AUTH_ERRORS_MAP.EXPIRED_TOKEN
  }

  // Authentication successful
  return {
    shop,
    shopDomain,
  }
}

/**
 * Logs MCP authentication errors for monitoring and debugging
 * @param error - The authentication error that occurred
 * @param request - The original request
 */
function logMcpAuthError(error: any, request: Request): void {
  const requestInfo = {
    method: request.method,
    url: request.url,
    headers: {
      contentType: request.headers.get('content-type'),
      authorization: request.headers.has('authorization') ? '******' : 'none',
    },
  }

  console.error(`MCP Auth Error: [${error.code}] ${error.message}`, {
    timestamp: new Date().toISOString(),
    requestInfo,
  })
}

/**
 * Middleware to verify MCP authentication and handle errors
 * @param request - The HTTP request
 * @returns Context with authenticated shop and body, or throws a Response error
 */
export async function requireMcpAuth(request: Request): Promise<McpRequestContext> {
  // Parse request body
  let body: any
  try {
    body = await request.json()
  } catch (error) {
    const { code, message, status } = MCP_ERROR_AUTH_ERRORS_MAP.INVALID_REQUEST_BODY
    logMcpAuthError(error, request)
    throw json(
      {
        error: {
          code,
          message,
        },
      },
      { status }
    )
  }

  // Verify authentication
  const authResult = await verifyMcpAuth(request, body)

  // If authentication failed, throw an appropriate error response
  if ('code' in authResult) {
    const { code, message, status } = authResult
    logMcpAuthError(authResult, request)
    throw json(
      {
        error: {
          code,
          message,
        },
      },
      { status }
    )
  }

  // Return authenticated context
  return {
    shop: authResult.shop,
    shopDomain: authResult.shopDomain,
    body,
  }
}
