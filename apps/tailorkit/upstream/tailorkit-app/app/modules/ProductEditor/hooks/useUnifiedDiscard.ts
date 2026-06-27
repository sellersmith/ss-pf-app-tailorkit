import { useCallback, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { clearViewLayerIntegrationStores } from '~/stores/modules/integration/viewLayerIntegration'
import { resetTemplateEditorStates, closeTemplateEditorSaveBarAndUpdateSavedStep } from '~/modules/TemplateEditor/fns'
import { clearTemplateEnvAdapter } from '~/stores/modules/template/env-adapter'
import { closeSaveBar } from '~/utils/shopify'
import { SAVE_BAR_ID } from '~/constants/save-bar'
import { showGenericErrorToast, showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { FILE_UPLOAD_EVENTS, MUTATION_LAYER_FROM_INSPECTOR_EVENTS } from '~/modules/TemplateEditor/constants'
import { TemplateEditorContext } from '~/modules/TemplateEditor/context'
import { useEditorParams } from './useEditorParams'
import { EDITOR_TABS } from '../constants'
import isObject from 'lodash/isObject'
import isString from 'lodash/isString'
import { clearEditedTemplates } from './editedTemplatesTracker'
import { deleteTemporaryProduct } from '~/utils/integration/temporaryProduct'

/**
 * Clean up all transient blob URLs from templates to prevent memory leaks
 * After refactoring, blob URLs are stored in template.previewUrl (not printArea.previewUrl)
 */
export function cleanupTransientPreviewUrls() {
  const state = IntegrationStore.getState()
  state.variants.forEach(variant => {
    variant.printAreas?.forEach(printArea => {
      const template = printArea?.template
      if (template && typeof template === 'object') {
        const previewUrl = template.previewUrl
        if (previewUrl && typeof previewUrl === 'string' && previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrl)
        }
      }
    })
  })
}

/**
 * Check if a template ID still exists in the integration store
 * @param templateId - The template ID to check
 * @param mockupId - The mockup ID to search within
 * @param storeState - The current integration store state
 * @returns true if template exists, false otherwise
 */
function checkTemplateExists(
  templateId: string,
  mockupId: string,
  storeState: ReturnType<typeof IntegrationStore.getState>
): boolean {
  if (!templateId || !mockupId) return false

  const currentVariant = storeState.variants.find(v => v.mockup._id === mockupId)
  if (!currentVariant) return false

  return (
    currentVariant.printAreas?.some(printArea => {
      const template = printArea.template
      if (!template) return false

      // Template can be string ID or Template object
      if (isString(template)) {
        return template === templateId
      }

      // Template is an object, check its _id
      if (isObject(template) && template._id) {
        return template._id === templateId
      }

      return false
    }) ?? false
  )
}

/**
 * Navigate to first available print area if current template no longer exists
 * @param templateId - The current template ID from URL
 * @param mockupId - The current mockup ID from URL
 * @param storeState - The current integration store state
 * @param updateParams - Callback to update URL parameters
 */
function navigateToFirstPrintAreaIfNeeded(
  templateId: string,
  mockupId: string,
  storeState: ReturnType<typeof IntegrationStore.getState>,
  updateParams: (params: { printAreaId?: string; templateId?: string }) => void
): void {
  if (!mockupId) return

  const templateStillExists = checkTemplateExists(templateId, mockupId, storeState)
  if (templateStillExists) return

  const currentVariant = storeState.variants.find(v => v.mockup._id === mockupId)
  if (!currentVariant) return

  const firstPrintArea = currentVariant.printAreas?.[0]
  if (firstPrintArea) {
    // Extract template ID from first print area
    const newTemplateId
      = isObject(firstPrintArea.template) && firstPrintArea.template?._id
        ? firstPrintArea.template._id
        : isString(firstPrintArea.template)
          ? firstPrintArea.template
          : ''

    updateParams({
      printAreaId: firstPrintArea._id,
      templateId: newTemplateId,
    })
  } else {
    // No print areas exist, clear params
    updateParams({ printAreaId: '', templateId: '' })
  }
}

export default function useUnifiedDiscard() {
  const { t } = useTranslation()
  const { setTab, templateId, mockupId, updateParams } = useEditorParams()
  // Try to get resetValidationErrors from context (may be undefined if not in TemplateEditorContext)
  const templateEditorContext = useContext(TemplateEditorContext)

  const discardAll = useCallback(async () => {
    try {
      const resetValidationErrors = templateEditorContext?.resetValidationErrors

      // 0) Clear all validation errors first (if available)
      if (resetValidationErrors) {
        resetValidationErrors(null)
      }

      const layers = templateEditorContext?.layers || []
      // Also trigger CLEAR_VALIDATION_ERRORS event for components that listen to it
      if (layers.length > 0) {
        Transmitter.trigger(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.CLEAR_VALIDATION_ERRORS, {
          layerIds: layers.map(layer => layer.getState()._id),
        })
      }

      // 1) Reset template editor state (active template and all layer stores)
      resetTemplateEditorStates()

      // 2) Close template editor save bar and reset undo/redo
      closeTemplateEditorSaveBarAndUpdateSavedStep(true)

      // 3) Trigger file upload reset event
      Transmitter.trigger(FILE_UPLOAD_EVENTS.RESET)

      // 4) Clear template environment adapter (unified context)
      clearTemplateEnvAdapter()

      // 5) Clear cached ViewLayerIntegrationStores to ensure fresh stores on next Mockup view
      // Must be done BEFORE RESET_STATE so old stores with stale previewUrl are removed
      clearViewLayerIntegrationStores()

      // 6) Reset integration store to initial loader data
      IntegrationStore.dispatch({
        type: 'RESET_STATE',
        payload: {},
        skipTrace: true,
      })

      // 6.3) Clean up temporary product if this is a temporary variant
      const integrationState = IntegrationStore.getState()
      const integrationId = integrationState._id
      const firstVariant = integrationState.variants?.[0]
      const isTemporary = firstVariant?.id?.startsWith('temp-variant-')

      if (isTemporary) {
        await deleteTemporaryProduct(integrationId)
      }

      // 6.5) Clear edited templates tracker to prevent orphaned templates from being saved
      // This ensures discarded changes don't persist in the tracker across product sessions
      clearEditedTemplates()

      // 7) Check if current template still exists after reset, navigate if needed
      const freshState = IntegrationStore.getState()
      navigateToFirstPrintAreaIfNeeded(templateId, mockupId, freshState, updateParams)

      // 8) Clean up transient blob URLs to prevent memory leaks
      cleanupTransientPreviewUrls()

      // 9) Close integration editor save bar
      closeSaveBar(SAVE_BAR_ID.PERSONALIZED_PRODUCTS_SAVE_BAR)

      // 10) Set tab to design
      setTab(EDITOR_TABS.DESIGN)

      // 11) Broadcast discard completion so DesignTabContent can re-initialize
      Transmitter.trigger('UNIFIED_EDITOR_DISCARDED')

      showToast(t(TOAST.COMMON.CHANGES_DISCARDED))
    } catch (e) {
      // Surface any error consistently
      showGenericErrorToast()
      console.error('[useUnifiedDiscard] Error:', e)
    }
  }, [
    templateEditorContext?.resetValidationErrors,
    templateEditorContext?.layers,
    templateId,
    mockupId,
    updateParams,
    setTab,
    t,
  ])

  return {
    discardAll,
  }
}
