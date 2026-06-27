import type { LoaderFunctionArgsWithContext } from '~/bootstrap/fns/fetch.server'
import { json } from '~/bootstrap/fns/fetch.server'
import { catchAsync } from '~/utils/catchAsync'
import { requireMcpAuth } from '~/services/mcp/auth.server'
import { rateLimitMiddleware } from '~/services/mcp/rate-limit.server'
import { mcpToolRegistry } from './handlers'
import type { MCPToolNotificationMessage } from './constants'
import { MCP_ERROR_CODES_MAP, MCP_TOOL_NOTIFICATION_MESSAGE, MCP_TOOL_STATUS } from './constants'
import { checkToolAndSendNotification } from './fns.server'
/**
 * Creates a standardized error response
 */
const createErrorResponse = (args: { code: string; message: string; status: number }) => {
  const { code, message, status } = args
  return json(
    {
      error: {
        code,
        message,
      },
    },
    { status }
  )
}

export const action = catchAsync(async ({ params, request, context }: LoaderFunctionArgsWithContext) => {
  // Authenticate the request using our MCP auth service
  const { shopDomain, body } = await requireMcpAuth(request)

  // Check if the request is rate limited
  const rateLimitResponse = rateLimitMiddleware(request, shopDomain)
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  const tool = params.tool

  if (!tool) {
    return createErrorResponse(MCP_ERROR_CODES_MAP.MISSING_TOOL)
  }

  const handler = mcpToolRegistry[tool]

  if (!handler) {
    return createErrorResponse(MCP_ERROR_CODES_MAP.INVALID_TOOL)
  }

  try {
    const data = await handler({ body, shopDomain })

    // Send notification via websocket after the tool is successfully executed
    try {
      const { io } = context
      const { conversationId, conversationTitle, prompt } = body

      // Create notification data
      const notificationData: MCPToolNotificationMessage = {
        _id: conversationId,
        tool,
        timestamp: new Date().toISOString(),
        shopDomain,
        promptRequest: prompt,
        conversationTitle,
        message: MCP_TOOL_NOTIFICATION_MESSAGE[tool][MCP_TOOL_STATUS.SUCCESS],
        data,
      }

      // Check if the tool needs to send a notification and send it if necessary
      checkToolAndSendNotification({ tool, io, shopDomain, notificationData })
    } catch (socketError) {
      console.error(`Error sending WebSocket notification for MCP tool [${tool}]:`, socketError)
      // We don't want to fail the request if the socket notification fails
    }
    return json(data)
  } catch (error) {
    console.error(`Error in MCP tool handler [${tool}]:`, error)
    return createErrorResponse(MCP_ERROR_CODES_MAP.HANDLER_ERROR)
  }
})
