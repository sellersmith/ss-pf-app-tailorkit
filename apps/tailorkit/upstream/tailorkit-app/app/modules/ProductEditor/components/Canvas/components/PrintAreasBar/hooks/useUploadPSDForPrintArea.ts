import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { showGenericErrorToast, showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import { uuid } from '~/utils/uuid'
import { DEFAULT_TEMPLATE_DIMENSION, TemplateEditorStoreActions } from '~/stores/modules/template'
import useCreateTemplateForPrintArea from './useCreateTemplateForPrintArea'
import { useEditorParams } from '~/modules/ProductEditor/hooks'
import { DEFAULT_PRINT_AREA, IntegrationStore } from '~/stores/modules/integration/integration'
import { ProgressStoreActions } from '~/stores/canvas/progress'
import { useExtractPSD } from '~/utils/extractPSD'
import { useStore } from '~/libs/external-store'
import { getSelectedViewId } from '~/modules/ProductEditor/utils/views'

/**
 * Hook to handle PSD file upload and create a new template + print area
 * This is specifically for the Product Editor context
 * Can work in two modes:
 * 1. Create new print area with PSD (existingPrintAreaId is undefined)
 * 2. Replace existing print area's template with PSD (existingPrintAreaId is provided)
 * Can work in two modes:
 * 1. Create new print area with PSD (existingPrintAreaId is undefined)
 * 2. Replace existing print area's template with PSD (existingPrintAreaId is provided)
 */
export function useUploadPSDForPrintArea() {
  const { t } = useTranslation()
  const [isUploading, setIsUploading] = useState(false)

  const { createTemplateForPrintArea } = useCreateTemplateForPrintArea()
  const { mockupId } = useEditorParams()
  const variants = useStore(IntegrationStore, state => state.variants)
  const activeVariant = variants.find(v => v.mockup._id === mockupId) || variants[0]

  // Use selectedViewId from store instead of URL
  const viewId = getSelectedViewId(activeVariant)

  const { processLayersForRenderingAfterUploadingPSDFile } = useExtractPSD()

  /**
   * Main function to handle PSD upload and template creation
   * Similar to Template Editor flow but creates a new template + print area instead
   */
  const uploadPSDAndCreateTemplate = useCallback(
    async (
      file: File,
      existingPrintAreaId?: string,
      existingPrintAreaDimensions?: { width: number; height: number },
      isPODProduct?: boolean
    ) => {
      if (!file) {
        showToast(t(TOAST.COMMON.PSD_REQUIRED), { isError: true })
        return { success: false }
      }

      setIsUploading(true)

      const existingPrintArea = existingPrintAreaId
        ? activeVariant?.printAreas?.find(printArea => printArea._id === existingPrintAreaId)
        : undefined
      const layerStores = activeVariant?.mockup?.layers || []
      const existingLayerStore = existingPrintArea
        ? layerStores.find((layerStore: any) => {
            if (typeof layerStore?.getState === 'function') {
              return layerStore.getState().printAreaId === existingPrintAreaId
            }

            return layerStore?.printAreaId === existingPrintAreaId
          })
        : undefined
      const existingLayerId
        = typeof existingLayerStore?.getState === 'function'
          ? existingLayerStore.getState()._id
          : (existingLayerStore as any)?._id

      try {
        // 1. Extract PSD data using existing utility (handles progress automatically)
        const { psd, layers, resolution }
          = (await processLayersForRenderingAfterUploadingPSDFile([file], [file], [], true)) || {}

        if (!psd || !layers || layers.length === 0) {
          throw new Error('Failed to extract PSD data or no layers found')
        }

        // 2. Prepare dimension from PSD
        // For POD products, we MUST respect the existing print area dimensions
        const finalWidth
          = isPODProduct && existingPrintAreaDimensions ? existingPrintAreaDimensions.width : psd.image.width
        const finalHeight
          = isPODProduct && existingPrintAreaDimensions ? existingPrintAreaDimensions.height : psd.image.height

        const dimension = {
          width: finalWidth,
          height: finalHeight,
          resolution,
          measurementUnit: DEFAULT_TEMPLATE_DIMENSION.measurementUnit,
        }

        // 3. Create template object locally (not saved to DB yet)
        // The template will be saved when createTemplateForPrintArea is called
        const newTemplateId = uuid()
        const templateData = {
          _id: newTemplateId,
          name: psd.name || 'Untitled Template',
          dimension,
          layers, // Include layers from PSD
          psds: [psd._id], // Reference to PSD
          type: 'template',
          isCreatingNew: !existingPrintArea, // Flag indicates whether template is newly created
        } as any

        // 4. Create or update print area with the new template
        // If existingPrintAreaId is provided, we're replacing an existing template
        // Otherwise, we're creating a new print area
        const printAreaResult = createTemplateForPrintArea({
          viewId,
          printArea: {
            ...(existingPrintArea
              ? {
                  ...existingPrintArea,
                  width: dimension.width,
                  height: dimension.height,
                }
              : {
                  ...DEFAULT_PRINT_AREA,
                  _id: existingPrintAreaId || uuid(),
                  width: dimension.width,
                  height: dimension.height,
                }),
          },
          templateData,
          layerId: existingLayerId,
        })

        if (printAreaResult.success) {
          showToast(t(existingPrintAreaId ? TOAST.COMMON.TEMPLATE_REPLACED : TOAST.COMMON.UPDATED))
          return {
            success: true,
            templateId: printAreaResult.templateId,
            printAreaId: printAreaResult.printAreaId,
          }
        }
      } catch (error) {
        console.error('Error uploading PSD and creating template:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to process PSD file'
        showGenericErrorToast()
        return { success: false, error: errorMessage }
      } finally {
        // CRITICAL: Clear both progress store and extracting state
        // This ensures ProgressProcessPSD doesn't remain visible when switching print areas
        ProgressStoreActions.clearProgress()
        TemplateEditorStoreActions.setLoading(false)
        setIsUploading(false)
      }
    },
    [
      activeVariant?.printAreas,
      activeVariant?.mockup?.layers,
      processLayersForRenderingAfterUploadingPSDFile,
      createTemplateForPrintArea,
      viewId,
      t,
    ]
  )

  return {
    uploadPSDAndCreateTemplate,
    isUploading,
  }
}
