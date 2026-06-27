import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { authenticatedFetch } from '~/shopify/fns.client'

interface StoreContextValue {
  shopData: any | null
  loading: boolean
  error: string | null
  /**
   * Re-fetch shop data from the server. Useful when changes are made that
   * should be reflected immediately in the UI.
   */
  refresh: () => Promise<void>
}

const StoreContext = createContext<StoreContextValue>({
  shopData: null,
  loading: true,
  error: null,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  refresh: async () => {},
})

export function StoreProvider({ children }: { children: ReactNode }) {
  const [shopData, setShopData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchShopData = useCallback(async () => {
    try {
      setLoading(true)

      const res = await authenticatedFetch('/api/preferences?themeConfig=true', {
        preferCache: true,
      })

      if (res?.success === false) {
        throw new Error(res?.message || 'Failed to fetch shop data')
      }

      setShopData(res)
      setError(null)
    } catch (err: any) {
      // Capture error – display friendly error message to the UI if needed
      console.error('Failed to fetch shop data', err)
      setError(err?.message || String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initial fetch
    fetchShopData().catch(console.error)
  }, [fetchShopData])

  const value: StoreContextValue = {
    shopData,
    loading,
    error,
    refresh: fetchShopData,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStoreContext() {
  return useContext(StoreContext)
}
