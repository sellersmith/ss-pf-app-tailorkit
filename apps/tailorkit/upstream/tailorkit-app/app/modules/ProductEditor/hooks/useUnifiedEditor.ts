import { useSuccessMessage } from '~/hooks/useSuccessMessage'
import { useIntegrationInitialization } from './useIntegrationInitialization'
import { useUnifiedEditorCleanup } from './useUnifiedEditorCleanup'
import { useUnifiedInspectorWidth } from './useUnifiedInspectorWidth'
import type useInitIntegration from './useInitIntegration'
import useUnifiedEditorEventTracking from './useUnifiedEditorEventTracking'
import { usePrefetchOnEditorLoad } from './usePrefetchOnEditorLoad'

interface UseUnifiedEditorParams {
  integration: any
  initIntegration: ReturnType<typeof useInitIntegration>['initIntegration']
  setValidationErrors: (id: string, dataKey: string, error: Error | string | null) => void
}

/**
 * Unified hook for Product + Template Editor
 *
 * Composes all unified editor hooks needed for the main editor:
 * - Integration initialization
 * - Comprehensive cleanup on unmount
 * - Inspector width management (with chatbot awareness)
 * - Success message display
 *
 * This keeps the main ProductEditor component clean with a single hook call.
 */
export function useUnifiedEditor(params: UseUnifiedEditorParams) {
  const { integration, initIntegration, setValidationErrors } = params

  // Initialize integration data
  useIntegrationInitialization({
    integration,
    initIntegration,
    setValidationErrors,
  })

  // Clean up all stores on unmount
  useUnifiedEditorCleanup()

  // Manage inspector width
  const { inspectorWidth, onResizeInspector } = useUnifiedInspectorWidth()

  // Handle success message display
  useSuccessMessage()

  // Track event when the unified editor
  useUnifiedEditorEventTracking()

  // Prefetch data in background when editor loads
  usePrefetchOnEditorLoad()

  return {
    inspectorWidth,
    onResizeInspector,
  }
}
