import { createContext, useContext } from 'react'
import type { Socket } from 'socket.io-client'

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
})

export function SocketProvider({ children }: { children: React.ReactNode }) {
  // const [socket, setSocket] = useState<Socket | null>(null)
  // const [isConnected, setIsConnected] = useState(false)
  // const navigate = useNavigate()

  // useEffect(() => {
  //   const mcpManager = MCPClientManager.getInstance()

  //   const initializeMCP = async () => {
  //     try {
  //       await mcpManager.initialize(window.location.origin, window.location.pathname)

  //       const mcpClient = mcpManager.getMCPClient()
  //       if (mcpClient) {
  //         setSocket(mcpClient.getSocket())
  //         setIsConnected(true)
  //       }
  //     } catch (error) {
  //       console.error('Failed to initialize MCP:', error)
  //       // Redirect to error page or show error message
  //       navigate('/error')
  //     }
  //   }

  //   initializeMCP()

  //   return () => {
  //     mcpManager.cleanup()
  //   }
  // }, [navigate])

  const value = {
    socket: null,
    isConnected: false,
  }

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}
