import { useCallback } from 'react'
import { useStore } from '~/libs/external-store'
// eslint-disable-next-line max-len
import { computePreviewProductImageFromLayer } from '~/modules/ProductEditor/components/IntegrationInspector/Integrate/ModalTemplateSelection/previewPlacement'
import { useEditorParams } from '~/modules/ProductEditor/hooks'
import { evaluatePlaceholderDimensionPositionOnFeaturedImage } from '~/modules/ProductEditor/utilities/evaluatePlaceholderOnFeaturedImage'
import { DEFAULT_LAYER_INTEGRATION, IntegrationStore } from '~/stores/modules/integration/integration'
import { LayerIntegrationStoreSelection } from '~/stores/modules/integration/layer-integration-selection'
import type { TLayerIntegrationStore } from '~/stores/modules/integration/layerIntegration'
import {
  createLayerIntegrationStore,
  getLayerIntegrationStoreById,
} from '~/stores/modules/integration/layerIntegration'
import type { PrintArea } from '~/types/integration'
import type { Template } from '~/types/psd'
import { showGenericErrorToast } from '~/utils/toastEvents'
import { uuid } from '~/utils/uuid'

export default function useCreateTemplateForPrintArea() {
  const { mockupId } = useEditorParams()
  const variants = useStore(IntegrationStore, state => state.variants)
  const activeVariant = variants.find(v => v.mockup._id === mockupId) || variants[0]
  const productFeaturedImage = activeVariant?.product?.featuredImage
  const productFeaturedImageWidth = productFeaturedImage?.width || DEFAULT_LAYER_INTEGRATION.width
  const productFeaturedImageHeight = productFeaturedImage?.height || DEFAULT_LAYER_INTEGRATION.height

  const createTemplateForPrintArea = useCallback(
    (args: { printArea: PrintArea; templateData: Template | null; viewId: string; layerId?: string }) => {
      try {
        const { printArea, templateData, viewId, layerId } = args

        if (!templateData) {
          return { success: false, printAreaId: '', templateId: '', error: 'Template data is required' }
        }

        // Read fresh state from store to avoid stale data
        const currentState = IntegrationStore.getState()
        const currentVariant = currentState.variants.find(v => v.mockup._id === mockupId)
        const existingPrintArea = currentVariant?.printAreas?.find(pa => pa._id === printArea._id) || null

        // 1. Create layer integration store
        const evaluatedLayerDimensionPosition = evaluatePlaceholderDimensionPositionOnFeaturedImage(
          {
            width: templateData.dimension?.width || DEFAULT_LAYER_INTEGRATION.width,
            height: templateData.dimension?.height || DEFAULT_LAYER_INTEGRATION.height,
          },
          {
            width: productFeaturedImageWidth,
            height: productFeaturedImageHeight,
          }
        )

        // Always seed template preview with the CURRENT product's featured image (not the template's existing preview)
        const previewSeed = productFeaturedImage?.url
          ? {
              _id: uuid(),
              src: productFeaturedImage.url,
              altText: productFeaturedImage.altText || 'Product preview',
              left: 0,
              top: 0,
              width: productFeaturedImage.width || DEFAULT_LAYER_INTEGRATION.width,
              height: productFeaturedImage.height || DEFAULT_LAYER_INTEGRATION.height,
              rotation: 0,
              naturalWidth: productFeaturedImage.width || DEFAULT_LAYER_INTEGRATION.width,
              naturalHeight: productFeaturedImage.height || DEFAULT_LAYER_INTEGRATION.height,
            }
          : null

        const previewProductImage = computePreviewProductImageFromLayer({
          previewSeed,
          productImageDimension: { width: productFeaturedImageWidth, height: productFeaturedImageHeight },
          canvas: { width: templateData.dimension?.width || 0, height: templateData.dimension?.height || 0 },
          skipLayerStoreCalculations: true, // Skip because we're creating a NEW template with its own dimensions
        })

        const templateDataAny = templateData as any

        /** Temporarily disable default text layer creation */

        // // Add default text layer only if template data is empty (no existing layers/extractedLayerStores)
        // // This means template is truly empty (null/undefined), not just being created new
        // const isTemplateEmpty =
        //   !templateDataAny.extractedLayerStores?.length &&
        //   !templateDataAny.layers?.length &&
        //   (!hasTemplate(templateData) || templateDataAny.isCreatingNew)

        // let layers: any[] = []
        // if (isTemplateEmpty) {
        //   const shopDomain = shopifyGlobal?.config?.shop || ''
        //   if (shopDomain) {
        //     const textLayerStore = createDefaultTextLayerForTemplate(
        //       templateData.dimension?.width || DEFAULT_LAYER_INTEGRATION.width,
        //       templateData.dimension?.height || DEFAULT_LAYER_INTEGRATION.height,
        //       shopDomain
        //     )
        //     // Convert layer store to layer document for serialization
        //     const textLayerDocument = textLayerStore.getState() as any
        //     layers = [textLayerDocument]
        //   }
        // }

        const templateWithPreview: any = {
          ...templateDataAny,
          // Force preview image to be current product image; if none, clear it
          previewProductImage,
          // Add default text layer if template is empty (as layers array for serialization)
          // ...(layers.length > 0 ? { layers } : {}),
        }

        let layerIntegrationStore: TLayerIntegrationStore | undefined
        if (layerId) {
          layerIntegrationStore = getLayerIntegrationStoreById(layerId)
        }

        if (!layerIntegrationStore && existingPrintArea) {
          // Use currentVariant from fresh store state
          const existingLayer = currentVariant?.mockup?.layers?.find((layer: any) => {
            if (typeof layer?.getState === 'function') {
              return layer.getState().printAreaId === existingPrintArea._id
            }

            return layer?.printAreaId === existingPrintArea._id
          }) as TLayerIntegrationStore | undefined

          if (existingLayer && typeof existingLayer.getState === 'function') {
            layerIntegrationStore = existingLayer
          }
        }

        if (!layerIntegrationStore) {
          const newLayerId = uuid()

          layerIntegrationStore = createLayerIntegrationStore({
            ...DEFAULT_LAYER_INTEGRATION,
            printAreaId: printArea._id,
            _id: newLayerId,
            layerId: newLayerId,
            data: {
              ...DEFAULT_LAYER_INTEGRATION.data,
              template: templateWithPreview,
            },
          })
        }

        // 2. Update layer store with correct type and data
        const current = layerIntegrationStore.getState()
        layerIntegrationStore.dispatch({
          type: 'UPDATE_LAYER',
          payload: {
            state: {
              type: 'template',
              visible: true,
              ...evaluatedLayerDimensionPosition,
              data: { ...(current?.data || {}), template: templateWithPreview },
            },
          },
        })

        if (existingPrintArea) {
          // Use already-fetched currentPrintAreas from above
          const currentPrintAreas = currentVariant?.printAreas || []

          const updatedPrintAreas = currentPrintAreas.map(pa => {
            if (pa._id === printArea._id) {
              return {
                ...pa,
                ...printArea,
                template: templateWithPreview,
              }
            }

            return pa
          })

          if (updatedPrintAreas.length > 0) {
            IntegrationStore.dispatch({
              type: 'UPDATE_SORTABLE_PRINT_AREA',
              payload: { mockupId, printAreas: updatedPrintAreas },
            })
          }

          IntegrationStore.dispatch({
            type: 'UPDATE_TEMPLATE_SELECTED_FOR_PRINT_AREA',
            payload: { mockupId, printAreaId: printArea._id, template: templateWithPreview },
          })
        } else {
          const printAreaPayload = {
            ...printArea,
            template: templateWithPreview,
          }

          IntegrationStore.dispatch({
            type: 'CREATE_PRINT_AREA',
            payload: {
              mockupId,
              layerStore: layerIntegrationStore,
              printArea: printAreaPayload,
            },
          })
        }

        // 4. Add layer to current view when necessary (new layer or missing association)
        // Use currentVariant from fresh store state
        if (currentVariant?.mockup?.selectedViewId) {
          const layerState = layerIntegrationStore.getState()
          const isLayerAlreadyInView = existingPrintArea
            ? Boolean(
                currentVariant.mockup.views
                  ?.find(view => view._id === viewId)
                  ?.layers?.some((layer: any) => {
                    return typeof layer?.getState === 'function'
                      ? layer.getState()._id === layerState._id
                      : layer === layerState._id
                  })
              )
            : false

          if (!isLayerAlreadyInView) {
            IntegrationStore.dispatch({
              type: 'ADD_LAYER_TO_VIEW',
              payload: { mockupId, viewId, layerId: layerState._id },
            })
          }
        }

        // 5. Select the newly created layer
        LayerIntegrationStoreSelection.dispatch({
          type: 'SET_LAYER_STORE_SELECTION',
          payload: { clickedLayerStore: layerIntegrationStore },
        })

        return {
          success: true,
          printAreaId: printArea._id,
          templateId: templateData?._id,
        }
      } catch (error) {
        console.error('[CreateTemplate] Failed to create template:', error)
        showGenericErrorToast()
        return { success: false, printAreaId: '', templateId: '', error: 'Failed to create template' }
      }
    },
    [
      productFeaturedImageWidth,
      productFeaturedImageHeight,
      productFeaturedImage?.url,
      productFeaturedImage?.altText,
      productFeaturedImage?.width,
      productFeaturedImage?.height,
      mockupId,
    ]
  )

  return {
    createTemplateForPrintArea,
  }
}
