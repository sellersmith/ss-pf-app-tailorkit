import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { Server as SocketIOServer } from 'socket.io'
import { z } from 'zod'
import { getTailorKitSocketIOMCPServer } from './tailorkit-mcp.server.js'

// TODO: Call this function when we want to expose the MCP tools to the storefront
export function initTailorkitStorefrontMCP(io: SocketIOServer) {
  const tailorKit = getTailorKitSocketIOMCPServer(io)

  const server = new McpServer({
    name: 'TailorKit Storefront MCP',
    version: '1.0.0',
  })

  // Expose get_personalizer_dom as an MCP tool
  server.tool('get_personalizer_dom', { clientId: z.string() }, async ({ clientId }, _extra) => {
    const dom = await tailorKit.getPersonalizerDom(clientId)
    return {
      content: [{ type: 'text', text: JSON.stringify(dom) }],
    }
  })

  // Expose execute_personalizer_dom_options as an MCP tool
  server.tool(
    'execute_personalizer_dom_options',
    { clientId: z.string(), script: z.string(), recallGetPersonalizerDom: z.boolean() },
    async ({ clientId, script, recallGetPersonalizerDom }, _extra) => {
      const result = await tailorKit.executePersonalizerDomOptions(clientId, script, recallGetPersonalizerDom)
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      }
    }
  )

  // Start the MCP server using stdio transport
  const transport = new StdioServerTransport()
  server.connect(transport)
}
