import type { LoaderFunctionArgs } from '@remix-run/node'
import { catchAsync } from '~/utils/catchAsync'
import { CONNECTION_ACTION } from './constant'
import type { Server as SocketIOServer } from 'socket.io'
import { json } from '~/bootstrap/fns/fetch.server'
import { getTailorKitAdminMcpWithSocketServer } from '~/services/mcp/admin/tailorkit-admin-mcp.server'
import { authenticate } from '~/shopify/app.server'

export const loader = catchAsync(async ({ request, context }: LoaderFunctionArgs) => {
  const {
    session: { shop, id: sessionId },
  } = await authenticate.admin(request)
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const { io } = context

  switch (action) {
    case CONNECTION_ACTION.CHECK_ADMIN_MCP_CONNECTION:
      try {
        if (!io) {
          throw new Error('Socket.IO server not available')
        }

        const ioServer = io as SocketIOServer

        // Validate MCP server instance before using it
        const mcpServer = getTailorKitAdminMcpWithSocketServer(ioServer, shop)
        const connectedClients = await mcpServer.getGlobalConnectedClientIds()

        return json({
          success: true,
          mcp: {
            serverRunning: true,
            connectedClients: connectedClients.length,
            clientIds: connectedClients,
            sessionId,
            serverStats: mcpServer.getServerStats(),
            timestamp: new Date().toISOString(),
          },
        })
      } catch (error: any) {
        return json(
          {
            success: false,
            mcp: {
              serverRunning: false,
              error: error.message,
            },
          },
          { status: 500 }
        )
      }

    default:
      return json({ error: 'Invalid action' }, { status: 400 })
  }
})
