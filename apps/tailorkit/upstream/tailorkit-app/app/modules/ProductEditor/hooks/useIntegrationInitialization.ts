import { useEffect, useRef } from 'react'
import { showGenericErrorToast } from '~/utils/toastEvents'
import type useInitIntegration from './useInitIntegration'

interface UseIntegrationInitializationParams {
  integration: any
  initIntegration: ReturnType<typeof useInitIntegration>['initIntegration']
  setValidationErrors: (id: string, dataKey: string, error: Error | string | null) => void
}

/**
 * Hook to initialize integration data on mount
 * Runs once per integration ID change
 * NOTE: Only triggers when integration._id changes, NOT when initIntegration callback changes
 */
export function useIntegrationInitialization(params: UseIntegrationInitializationParams) {
  const { integration, initIntegration, setValidationErrors } = params
  const initializedIntegrationIdRef = useRef<string | null>(null)
  const initIntegrationRef = useRef(initIntegration)
  const setValidationErrorsRef = useRef(setValidationErrors)

  // Keep refs updated without triggering re-run
  initIntegrationRef.current = initIntegration
  setValidationErrorsRef.current = setValidationErrors

  useEffect(() => {
    const integrationId = integration?._id || null

    // Skip if same integration ID already initialized
    if (initializedIntegrationIdRef.current === integrationId && integrationId !== null) {
      return
    }

    // Mark as initialized before async call
    initializedIntegrationIdRef.current = integrationId
    ;(async () => {
      try {
        await initIntegrationRef.current(integration, { setValidationErrors: setValidationErrorsRef.current })
      } catch (error) {
        console.error('[ProductEditor] Failed to initialize integration:', error)
        showGenericErrorToast()
        // Reset ref on error so it can retry
        initializedIntegrationIdRef.current = null
      }
    })()
  }, [integration]) // Only depend on integration._id, not the callback
}
