import type { LayerIntegration, PrintArea, VariantIntegration } from '~/types/integration'
import type { TLayerIntegrationStore } from './layerIntegration'
import { deleteLayerIntegrationStoreById } from './layerIntegration'
import { closeSaveBar, openSaveBar } from '~/utils/shopify'
import type { SAVE_BAR_ID } from '~/constants/save-bar'
import { stage } from '~/libs/steps.client'
import { getTemplateEnvAdapter } from '~/stores/modules/template/env-adapter'
import { getExtractedCompositeLayerStores, TemplateEditorStore } from '../template'
import { IntegrationStore, isLayerStore } from './integration'
import isEmpty from 'lodash/isEmpty'
import isString from 'lodash/isString'
import isObject from 'lodash/isObject'
import { markEditedTemplate, storeTemplateSnapshot } from '~/modules/ProductEditor/hooks/editedTemplatesTracker'

/**
 * Get variants updated after selecting template
 * @param mockupId - The ID of the mockup
 * @param printAreaId - The ID of the print area
 * @param variants - The variants to update
 * @param template - The template to update
 * @returns The updated variants
 */
export function getVariantsUpdatedAfterSelectingTemplate(
  mockupId: string,
  printAreaId: string,
  variants: VariantIntegration[],
  template: PrintArea['template']
): VariantIntegration[] {
  const _variants = variants.map(variant => {
    if (variant.mockup._id === mockupId) {
      // Update layer stores directly if they exist
      variant.mockup.layers.forEach(layer => {
        if (typeof (layer as TLayerIntegrationStore).getState === 'function') {
          const layerStore = layer as TLayerIntegrationStore
          const layerState = layerStore.getState()
          if (layerState.printAreaId === printAreaId) {
            layerStore.dispatch({
              type: 'UPDATE_DATA',
              payload: {
                data: {
                  ...layerState.data,
                  template: template as any,
                },
              },
              skipTrace: true,
            })
          }
        }
      })

      return {
        ...variant,
        mockup: {
          ...variant.mockup,
          layers: variant.mockup.layers.map(layer => {
            if (typeof (layer as TLayerIntegrationStore).getState === 'function') {
              return layer
            }

            const layerIntegration = layer as unknown as LayerIntegration
            if (layerIntegration.printAreaId === printAreaId) {
              return {
                ...layerIntegration,
                data: {
                  ...layerIntegration.data,
                  template,
                },
              }
            }

            return layerIntegration
          }),
        },
        printAreas: variant.printAreas.map(printArea => {
          if (printArea._id === printAreaId) {
            // Only update template reference, preserve printArea's own width/height
            // Each printArea maintains its own dimensions independently from template
            return {
              ...printArea,
              template,
            }
          }

          return printArea
        }),
      }
    }

    return variant
  })

  return _variants
}

/**
 * Step callback for saving the integration
 * @param target - The target object
 * @param props - The properties of the target
 * @param value - The value of the target
 * @param saveBarId - The ID of the save bar
 */
export function stepCallback(target: any, props: string | symbol, value: any, saveBarId: SAVE_BAR_ID) {
  if (stage.savedStep === value) {
    closeSaveBar(saveBarId)
  } else {
    // TEMPORARY SET TIMEOUT FOR SHOWING SAVE BAR FOR DEBUGGING THE LOST OF IFRAME
    setTimeout(() => {
      openSaveBar(saveBarId)
    }, 500)
  }

  // CRITICAL: Sync TemplateEditorStore to IntegrationStore when in unified editor
  // Use adapter (explicit context) instead of pathname or save-bar detection
  try {
    const env = getTemplateEnvAdapter()
    if (env?.getMode() === 'unified') {
      const params = env.getUnifiedParams()
      if (params?.mockupId && params?.printAreaId) {
        syncTemplateEditorToIntegration(params)
      }
    }
  } catch (e) {
    console.warn('[stepCallback] Adapter check failed:', e)
  }
}

/**
 * Sync TemplateEditorStore to IntegrationStore immediately
 * Accepts explicit params (from adapter) or falls back to URL
 */
export function syncTemplateEditorToIntegration(params?: { mockupId: string; printAreaId: string }) {
  if (typeof window === 'undefined') return

  try {
    // Prefer explicit params (adapter), fallback to URL for standalone
    const mockupId = params?.mockupId || new URLSearchParams(window.location.search).get('mockup')
    const printAreaId = params?.printAreaId || new URLSearchParams(window.location.search).get('printAreaId')

    if (!mockupId || !printAreaId) return

    const templateState = TemplateEditorStore.getState()
    if (!templateState._id) return

    // CRITICAL GUARDS: Prevent resurrection of deleted templates
    const integrationState = IntegrationStore.getState()
    const currentVariant = integrationState.variants.find(v => v.mockup._id === mockupId)
    const currentPrintArea = currentVariant?.printAreas?.find(pa => pa._id === printAreaId)

    // Guard 1: If the current print area has no template, avoid resurrecting it unless we're creating a new one
    if (currentPrintArea && isEmpty(currentPrintArea.template) && !templateState.isCreatingNew) {
      return
    }

    // Guard 2: If the current print area has a different template, don't overwrite it
    const currentTemplateId = isObject(currentPrintArea?.template) ? currentPrintArea.template?._id : null
    if (currentTemplateId && currentTemplateId !== templateState._id) {
      return
    }

    // Serialize template
    const { extractedLayerStores, previewProductImage, previewUrl, ...baseTemplate } = templateState

    // CRITICAL: Use getExtractedCompositeLayerStores() to include multi-layout child elements
    // If empty, fallback to IntegrationStore layers to prevent losing data when user hasn't opened template in editor
    const compositeLayerStores = getExtractedCompositeLayerStores()
    let layersToUse = compositeLayerStores.map(s => s.getState())
    if (layersToUse.length === 0) {
      // Fallback: get layers from IntegrationStore template
      const templateFromIntegration = currentPrintArea?.template
      if (templateFromIntegration && typeof templateFromIntegration === 'object') {
        const integrationLayers = Array.isArray(templateFromIntegration.layers) ? templateFromIntegration.layers : []
        if (integrationLayers.length > 0) {
          layersToUse = integrationLayers
        }
      }
    }

    // Resolve final template name to avoid saving as "Untitled" during new-template creation
    const existingTemplate = currentPrintArea?.template
    const existingTemplateName = isObject(existingTemplate) ? (existingTemplate as any).name : undefined
    const isNameUnset = !baseTemplate.name || baseTemplate.name.trim() === '' || baseTemplate.name === 'Untitled'
    const shouldPreferExistingName = Boolean(
      templateState.isCreatingNew && isNameUnset && existingTemplateName && String(existingTemplateName).trim()
    )
    const finalTemplateName = shouldPreferExistingName ? String(existingTemplateName).trim() : baseTemplate.name

    // Preserve existing blob URL from template if present (prevents losing captured preview when switching tabs)
    // After refactoring, blob URLs are stored in template.previewUrl (not printArea.previewUrl)
    const existingPreviewUrl = isObject(existingTemplate) ? existingTemplate?.previewUrl : undefined
    const hasBlobPreview = isString(existingPreviewUrl) && existingPreviewUrl.startsWith('blob:')

    // Get previewProductImage from TemplateEditorStore or existing PrintArea
    // Store it in PrintArea, not template object
    const existingPreviewProductImage = currentPrintArea?.previewProductImage || null
    const previewImageToUse = previewProductImage || existingPreviewProductImage

    // Check if previewProductImage is valid (has src which is required, _id and altText are optional)
    const shouldPreservePreviewImage = previewImageToUse && isObject(previewImageToUse) && previewImageToUse.src

    const updatedTemplate: PrintArea['template'] = {
      ...baseTemplate,
      name: finalTemplateName,
      shopDomain: baseTemplate.shopDomain || '',
      previewUrl: hasBlobPreview ? existingPreviewUrl : previewUrl || '',
      layers: layersToUse, // Use layers from TemplateEditorStore or fallback to IntegrationStore
      psds: [],
      // NOTE: previewProductImage is NOT stored in template anymore - it's stored in PrintArea
    }

    // Mark this template as edited in the current session with its context
    markEditedTemplate(templateState._id, mockupId as string, printAreaId as string)

    // Store complete template snapshot for saving later without switching
    // This allows useUnifiedSave to save templates without switching to them
    const snapshotTemplateEditor = { ...(templateState as any), name: finalTemplateName }

    storeTemplateSnapshot(
      templateState._id,
      updatedTemplate.layers, // Serialized layer states
      snapshotTemplateEditor, // Full template editor state with resolved name
      updatedTemplate.previewUrl || '' // Blob URL or empty string
    )

    // Sync template to IntegrationStore
    IntegrationStore.dispatch({
      type: 'UPDATE_TEMPLATE_SELECTED_FOR_PRINT_AREA',
      payload: {
        mockupId,
        printAreaId,
        template: updatedTemplate,
      },
      skipTrace: true,
    })

    // Sync previewProductImage to PrintArea (separate from template)
    if (shouldPreservePreviewImage) {
      IntegrationStore.dispatch({
        type: 'UPDATE_PRINT_AREA_PREVIEW_PRODUCT_IMAGE',
        payload: {
          mockupId,
          printAreaId,
          previewProductImage: previewImageToUse as any,
        },
        skipTrace: true,
      })
    }
  } catch (error) {
    console.error('[syncTemplateEditorToIntegration] Failed:', error)
  }
}

/**
 * Variant with serialized layers (plain LayerIntegration data instead of stores)
 */
type VariantWithSerializedLayers = {
  mockup?: {
    layers?: LayerIntegration[]
  }
}

/**
 * Clear stale layer stores that exist in current state but not in snapshot.
 * This handles layers that were added during editing and should be removed on discard.
 *
 * @param currentVariants - Current variants from state (with layer stores)
 * @param snapshotVariants - Variants from the saved snapshot (with plain layer data)
 */
export function clearStaleLayerStores(
  currentVariants: VariantIntegration[],
  snapshotVariants: VariantWithSerializedLayers[]
): void {
  // Collect layer IDs from snapshot (these are the valid ones to keep)
  const snapshotLayerIds = new Set<string>()
  snapshotVariants.forEach(variant => {
    variant.mockup?.layers?.forEach((layer: LayerIntegration) => {
      if (layer._id) snapshotLayerIds.add(layer._id)
    })
  })

  // Delete stores that exist in current state but not in snapshot
  currentVariants.forEach(variant => {
    if (!variant.mockup) return
    const layers = variant.mockup.layers || []
    layers.forEach((layer: TLayerIntegrationStore) => {
      if (isLayerStore(layer)) {
        const layerId = layer.getState()._id
        if (layerId && !snapshotLayerIds.has(layerId)) {
          deleteLayerIntegrationStoreById(layerId)
        }
      }
    })
  })
}
