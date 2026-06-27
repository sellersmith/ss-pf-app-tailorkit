import type { MCP_TOOLS, MCPToolNotificationMessage } from './constants'
import { MCP_TOOLS_NEED_SEND_NOTIFICATION } from './constants'
import type { Server } from 'socket.io'

/**
 * Checks if the tool needs to send a notification and sends it if necessary.
 * @param args - The arguments for the function.
 * @param args.tool - The tool to check.
 * @param args.io - The socket.io server instance.
 * @param args.shopDomain - The shop domain to send the notification to.
 * @param args.notificationData - The notification data to send.
 */
export const checkToolAndSendNotification = (args: {
  tool: (typeof MCP_TOOLS)[keyof typeof MCP_TOOLS]
  io: Server
  shopDomain: string
  notificationData: MCPToolNotificationMessage
}) => {
  const { tool, io, shopDomain, notificationData } = args

  if (MCP_TOOLS_NEED_SEND_NOTIFICATION.includes(tool)) {
    io.to(shopDomain).emit(tool, notificationData)
  }
}
