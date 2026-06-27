import { useEffect } from 'react'
import { resetProxyUndoRedo } from '~/libs/steps.client'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { TemplateEditorStore, LayerVisibilityStore } from '~/stores/modules/template'
import { clearTemplateEnvAdapter } from '~/stores/modules/template/env-adapter'
import { LayerStoreActions } from '~/stores/modules/layer'
import { OptionSetActions } from '~/stores/modules/option-set'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { ProgressStore } from '~/stores/canvas/progress'
import { PSDsStore } from '~/stores/modules/psd'
import { clearEditedTemplates } from './editedTemplatesTracker'

/**
 * Hook to handle comprehensive cleanup when navigating away from Unified Editor
 *
 * Destroys all global stores to prevent state contamination between products:
 * - Template editor stores (singleton + map-based)
 * - Layer stores
 * - Option set stores
 * - Progress, PSD stores
 * - Undo/redo proxy
 * - Environment adapter
 * - Transient blob URLs
 *
 * This ensures a clean slate when navigating between different products.
 */
export function useUnifiedEditorCleanup() {
  useEffect(() => {
    return () => {
      try {
        // Clean up undo/redo proxy
        resetProxyUndoRedo()
      } catch (e) {
        console.warn('[ProductEditor] Error cleaning up undo/redo:', e)
      }

      try {
        // Completely destroy ALL stores to prevent state contamination between products
        const templateState = TemplateEditorStore.getState()

        if (templateState._id) {
          // 1. Destroy all singleton stores (state + listeners + history)
          TemplateEditorStore.destroy()
          LayerStoreSelection.destroy()
          ProgressStore.destroy()
          PSDsStore.destroy()
          LayerVisibilityStore.destroy()

          // 2. Clear all Map-based stores (Layer and OptionSet instances)
          LayerStoreActions.removeAllLayerStore()
          OptionSetActions.removeAllOptionSetStore()
        }
      } catch (e) {
        console.warn('[ProductEditor] Error destroying template editor stores:', e)
      }

      try {
        // Clear template environment adapter
        clearTemplateEnvAdapter()
      } catch (e) {
        console.warn('[ProductEditor] Error clearing template env adapter:', e)
      }

      try {
        // Clean up transient blob URLs to prevent memory leaks
        const state = IntegrationStore.getState()
        state.variants?.forEach((variant: any) => {
          variant.printAreas?.forEach((printArea: any) => {
            const previewUrl = printArea?.previewUrl
            if (previewUrl && typeof previewUrl === 'string' && previewUrl.startsWith('blob:')) {
              URL.revokeObjectURL(previewUrl)
            }
          })
        })
      } catch (e) {
        console.warn('[ProductEditor] Error cleaning up blob URLs:', e)
      }

      try {
        // Clear edited templates tracker to prevent orphaned templates from being saved
        // This ensures clean state when navigating between different products
        clearEditedTemplates()
      } catch (e) {
        console.warn('[ProductEditor] Error clearing edited templates tracker:', e)
      }
    }
  }, [])
}
