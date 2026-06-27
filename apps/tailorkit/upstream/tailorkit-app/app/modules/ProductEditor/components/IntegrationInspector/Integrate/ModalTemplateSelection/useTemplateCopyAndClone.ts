import { useCallback } from 'react'
import type { Template } from '~/types/psd'
import { TemplatesService } from '~/api/services/templates'
import { openIDBDatabase, storeJSONFileToIDB } from '~/bootstrap/db/index-db'
import { IDB_DATABASE_NAME, IDB_STORE_NAME } from '~/constants/index-db'
import { DEFAULT_TEMPLATE_DIMENSION } from '~/stores/modules/template'
import { clearImageOptionSetTransforms, duplicateLayers, scaleLayersToFitCanvas } from '~/modules/TemplateEditor/fns'
import { showToast } from '~/utils/toastEvents'
import type { LayerDocument } from '~/models/Layer.server'
import { uuid } from '~/utils/uuid'
import { getLayerIntegrationStoresByMockupId } from '~/stores/modules/integration/integration'
import { computePreviewProductImageFromLayer } from './previewPlacement'
import { TEMPLATE_TYPE } from '~/routes/api.templates/constants'
import { lengthUnitToPixels } from '~/utils/lengthUnitToPixels'
import type { TViewLayerIntegrationStore } from '~/stores/modules/integration/viewLayerIntegration'
import { TOAST } from '~/constants/toasts'

type UseTemplateCopyAndCloneArgs = {
  modalTemplateSelected: Template | null | undefined
  templateConfig: { width?: number; height?: number; name?: string }
  printAreaId: string
  selectedViewId: string
  params: any
  searchParams: URLSearchParams
  t: (k: string, opts?: any) => string
  saveTemporaryIntegration: (mockupId: string) => Promise<void>
  setActive: (b: boolean) => void
  updateState: (updates: Partial<any>) => void
  previewSeed?: { src: string; altText?: string } | null
  isImportedProduct?: boolean
  productImageDimension?: { width?: number; height?: number } | null
}

export function useTemplateCopyAndClone(args: UseTemplateCopyAndCloneArgs) {
  const {
    modalTemplateSelected,
    templateConfig,
    printAreaId,
    selectedViewId,
    searchParams,
    t,
    saveTemporaryIntegration,
    setActive,
    updateState,
    previewSeed,
    productImageDimension,
  } = args

  const buildDimension = useCallback(() => {
    return {
      ...DEFAULT_TEMPLATE_DIMENSION,
      width: Math.round(templateConfig.width || 500),
      height: Math.round(templateConfig.height || 500),
    }
  }, [templateConfig.height, templateConfig.width])

  const onUseCopy = useCallback(async () => {
    try {
      if (!modalTemplateSelected || typeof modalTemplateSelected === 'string') return

      const templateId = modalTemplateSelected._id
      if (!templateId) return

      const mockupId = searchParams.get('mockup') || ''
      if (!mockupId) {
        throw new Error('Mockup ID is required')
      }

      updateState({ isCloning: true })
      await saveTemporaryIntegration(mockupId)

      const templateFull = await TemplatesService.getById(templateId)
      if (!templateFull) {
        throw new Error('Template not found')
      }
      const dimension = templateFull.dimension || buildDimension()
      const layers = Array.isArray(templateFull?.layers) ? templateFull.layers : []

      // Convert dimensions to pixels for proper scaling
      const { width, height, measurementUnit, resolution } = dimension
      const canvasWidth = lengthUnitToPixels(width!, measurementUnit!, resolution!)
      const canvasHeight = lengthUnitToPixels(height!, measurementUnit!, resolution!)

      // Scale layers to fit the target canvas size
      let scaledLayers = layers.length
        ? scaleLayersToFitCanvas(layers, canvasWidth, canvasHeight, {
            centerAfterScale: true,
          })
        : []

      // Clear transform data in image option sets (width/height/left/top/rotate)
      const clearedLayers = clearImageOptionSetTransforms(scaledLayers) as LayerDocument[]
      // Force new option set IDs so the copy's OptionSet documents are independent from the original.
      // Without this, both templates share the same OptionSet records and saving the copy overwrites the original's data.
      const duplicatedLayers = duplicateLayers({
        layers: clearedLayers,
        shopDomain: shopify.config.shop!,
        forceNewOptionSetIds: true,
      })
      scaledLayers = duplicatedLayers as unknown as LayerDocument[]

      const newTemplateId = uuid()
      const db = await openIDBDatabase(IDB_DATABASE_NAME.TEMPLATE_DIMENSION, IDB_STORE_NAME.TEMPLATE_DIMENSION)
      const defaultTitle = `${modalTemplateSelected.name || t('untitled')} (Copy)`
      const formData: any = {
        _id: newTemplateId,
        title: defaultTitle,
        name: defaultTitle,
        ...dimension,
        dimension,
        layers: scaledLayers,
        // Seed preview product image into template init payload; editor will read it via INIT_DATA
      }

      if (previewSeed) {
        const mockupIdFromSearch = searchParams.get('mockup') || ''
        const layerStores = mockupIdFromSearch
          ? getLayerIntegrationStoresByMockupId(mockupIdFromSearch, selectedViewId)
          : []
        const layerStore = layerStores.find(
          ls => ls.getState().printAreaId === printAreaId
        ) as TViewLayerIntegrationStore

        formData.previewProductImage = computePreviewProductImageFromLayer({
          previewSeed,
          layerStore,
          productImageDimension,
          canvas: { width: dimension.width || 0, height: dimension.height || 0 },
          skipLayerStoreCalculations: true, // Skip because we're creating a NEW template with its own dimensions
        })
      }
      await storeJSONFileToIDB(db, IDB_STORE_NAME.TEMPLATE_DIMENSION, formData, newTemplateId)

      // navigateToTemplateMaxModal(searchParams, params, newTemplateId, printAreaId, false, undefined, false)
      setActive(false)
      return formData
    } catch (error) {
      console.error('Failed to use copy of template:', error)
      showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
    } finally {
      updateState({ isCloning: false })
    }
  }, [
    modalTemplateSelected,
    searchParams,
    updateState,
    saveTemporaryIntegration,
    buildDimension,
    t,
    previewSeed,
    printAreaId,
    setActive,
    selectedViewId,
    productImageDimension,
  ])

  const onCloneTailorKit = useCallback(
    async (templateId: string, templateName?: string) => {
      try {
        const mockupId = searchParams.get('mockup') || ''
        if (!mockupId) {
          throw new Error('Mockup ID is required')
        }

        await saveTemporaryIntegration(mockupId)

        // Fetch the original TailorKit clipart template with full layers
        // Use getClipartsDetails to properly fetch cliparts from store asset domain
        const [templateFull] = await TemplatesService.getClipartsDetails([
          { _id: templateId, type: TEMPLATE_TYPE.TEMPLATE },
        ])

        if (!templateFull) {
          throw new Error('Template not found')
        }
        const dimension = buildDimension()
        const layers = Array.isArray(templateFull?.layers) ? templateFull.layers : []

        // Convert dimensions to pixels for proper scaling
        const { width, height, measurementUnit, resolution } = dimension
        const canvasWidth = lengthUnitToPixels(width!, measurementUnit!, resolution!)
        const canvasHeight = lengthUnitToPixels(height!, measurementUnit!, resolution!)

        // Scale layers to fit the target canvas size
        const scaledLayers = layers.length
          ? scaleLayersToFitCanvas(layers, canvasWidth, canvasHeight, {
              centerAfterScale: true,
            })
          : []

        // Clear transform data in image option sets (width/height/left/top/rotate)
        const clearedLayers = clearImageOptionSetTransforms(scaledLayers)
        // Force new option set IDs so the cloned template has independent OptionSet documents.
        const duplicatedLayers = duplicateLayers({
          layers: clearedLayers,
          shopDomain: shopify.config.shop!,
          forceNewOptionSetIds: true,
        })

        // Create a new temporary ID for IDB storage - template will only be saved to DB when user hits save in editor
        const id = uuid()
        const defaultTitle = templateConfig?.name || templateName || t('untitled')

        const formData: any = {
          _id: id,
          title: defaultTitle,
          name: defaultTitle,
          ...dimension,
          dimension,
          layers: duplicatedLayers,
          // NOTE: previewProductImage is NOT included - it will be resolved from PrintArea/product when template loads
        }

        const db = await openIDBDatabase(IDB_DATABASE_NAME.TEMPLATE_DIMENSION, IDB_STORE_NAME.TEMPLATE_DIMENSION)
        await storeJSONFileToIDB(db, IDB_STORE_NAME.TEMPLATE_DIMENSION, formData, id)

        // navigateToTemplateMaxModal(searchParams, params, id, printAreaId, false, undefined, false)
        setActive(false)
        return formData
      } catch (error) {
        console.error('Failed to process cloned template:', error)
        showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
      } finally {
        updateState({ isCloning: false })
      }
    },
    [searchParams, saveTemporaryIntegration, buildDimension, templateConfig?.name, t, setActive, updateState]
  )

  return { onUseCopy, onCloneTailorKit }
}
