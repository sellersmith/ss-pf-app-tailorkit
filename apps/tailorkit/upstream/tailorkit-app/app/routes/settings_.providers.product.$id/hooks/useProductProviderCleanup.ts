import { useEffect } from 'react'
import { ProductProviderStore } from '../stores/productProviderStore'
import { clearObject } from '~/utils/clear-object'
import { BLUE_PRINTS_INFOR } from '../components/VariantsConfig/hooks/usePrintifyVariants'

/**
 * Hook to handle comprehensive cleanup when navigating away from Provider Product page
 *
 * Destroys ProductProviderStore to prevent state contamination between products.
 * Follows the same pattern as useUnifiedEditorCleanup.
 *
 * @see useUnifiedEditorCleanup for similar pattern in ProductEditor
 */
export function useProductProviderCleanup() {
  useEffect(() => {
    return () => {
      try {
        // Completely destroy store (state + listeners + history)
        ProductProviderStore.destroy()
      } catch (e) {
        console.error('[ProductProvider] Error destroying store:', e)
      }

      try {
        // Clear blueprint cache
        clearObject(BLUE_PRINTS_INFOR)
      } catch (e) {
        console.error('[ProductProvider] Error clearing blueprints:', e)
      }
    }
  }, [])
}
