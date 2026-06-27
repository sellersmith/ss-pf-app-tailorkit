import { AppProvider } from '@shopify/shopify-app-remix/react'
import { RemixQueryClientProvider } from '~/libs/remix-query/context-provider'
import type { RemixQueryClient } from '~/libs/remix-query/query-client'
import { SocketProvider } from '~/providers/SocketProvider'
import { ChatBotProvider } from '~/providers/ChatBotContext'

interface AppProvidersProps {
  children: React.ReactNode
  apiKey: string
  remixQueryClient: RemixQueryClient
}

/**
 * AppProviders component that wraps all global providers
 * This component should be used at the root level to provide all necessary contexts
 */
export function AppProviders({ children, apiKey, remixQueryClient }: AppProvidersProps) {
  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <SocketProvider>
        <RemixQueryClientProvider.Provider value={{ remixQueryClient }}>
          <ChatBotProvider>{children}</ChatBotProvider>
        </RemixQueryClientProvider.Provider>
      </SocketProvider>
    </AppProvider>
  )
}
