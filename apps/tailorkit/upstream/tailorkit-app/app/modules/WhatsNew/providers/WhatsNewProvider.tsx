import { createContext, useContext, type ReactNode } from 'react'
import { useWhatsNew } from '../hooks/useWhatsNew'
import type { WhatsNewResponse } from '../types'

interface WhatsNewContextValue extends ReturnType<typeof useWhatsNew> {}

const WhatsNewContext = createContext<WhatsNewContextValue | null>(null)

interface WhatsNewProviderProps {
  children: ReactNode
  initialData?: WhatsNewResponse | null
}

/**
 * Provider that shares What's New state between WhatsNewModal and WhatsNewAlertIcon
 * This ensures that marking notifications as read updates the badge count
 */
export function WhatsNewProvider({ children, initialData }: WhatsNewProviderProps) {
  const whatsNewState = useWhatsNew(initialData)

  return <WhatsNewContext.Provider value={whatsNewState}>{children}</WhatsNewContext.Provider>
}

/**
 * Hook to access shared What's New state
 * Must be used within WhatsNewProvider
 */
export function useWhatsNewContext() {
  const context = useContext(WhatsNewContext)
  if (!context) {
    throw new Error('useWhatsNewContext must be used within WhatsNewProvider')
  }
  return context
}
