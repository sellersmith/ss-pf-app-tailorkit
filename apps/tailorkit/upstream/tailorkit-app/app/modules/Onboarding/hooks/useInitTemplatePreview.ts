import { useCallback } from 'react'
import { DEFAULT_TEMPLATE_DIMENSION, TemplateEditorStore, TemplateEditorStoreActions } from '~/stores/modules/template'
import { createLayerStore } from '~/stores/modules/layer'
import { PSDsStoreActions } from '~/stores/modules/psd'
import { evaluateStageViewPort } from '~/utils/canvas/evaluateScale'
import { calculateEffectiveDimension } from '~/utils/canvas/calculateEffectiveDimension'
import { TEMPLATE_EDITOR_CANVAS_CONTAINER } from '~/constants/canvas'
import type { Layer, Template } from '~/types/psd'
import type { Dimension } from '~/types/template'
import { checkLayerInsideMultiLayout } from '../../TemplateEditor/elements/fns'
import { dummyOnboardingData } from '../constant'

const { setExtractedLayerStores } = TemplateEditorStoreActions

export function useInitTemplatePreview() {
  /**
   * Evaluates the viewport dimensions for the template preview
   * @param dimension The dimensions of the template
   * @returns The calculated viewport dimensions
   */
  const evaluateTemplateViewPort = useCallback((dimension: Dimension, scaleUpStageViewPort: boolean = false) => {
    const preview = TemplateEditorStore.getState().previewProductImage
    const { effectiveDimension, contentOffset } = calculateEffectiveDimension(dimension, preview)

    return evaluateStageViewPort(
      TEMPLATE_EDITOR_CANVAS_CONTAINER,
      effectiveDimension,
      scaleUpStageViewPort,
      contentOffset
    )
  }, [])

  /**
   * Initializes the template preview with either provided template data or dummy data
   * @param template Optional template data to initialize with
   */
  const initTemplatePreview = useCallback(
    (templateData?: Template) => {
      const data = (templateData as any) || dummyOnboardingData

      // Calculate the viewport based on template dimensions
      const viewport = evaluateTemplateViewPort(data.dimension || DEFAULT_TEMPLATE_DIMENSION, true)

      // Initialize the template editor store with preview data
      TemplateEditorStore.dispatch({
        type: 'INIT_DATA',
        payload: {
          state: {
            _id: data._id,
            name: data.name || 'Preview Template',
            dimension: data.dimension || DEFAULT_TEMPLATE_DIMENSION,
            viewport,
            interactive: false, // Set to false for preview mode
            previewMode: true,
            shopDomain: (data as any).shopDomain || '',
            category: (data as any).category,
            clipartsAdded: [],
          },
        },
        skipTrace: true, // Skip trace for preview
      })

      // Initialize PSDs if they exist
      if (data.psds) {
        ;(data.psds as any).forEach((psd: any) => {
          PSDsStoreActions.addPSD({
            _id: psd._id,
            psdData: psd,
          })
        })
      }

      // Initialize layers
      const layerStores = ((data as any).layers || [])
        .filter((l: any) => !l.isGroupLayer)
        .map((layer: any) => createLayerStore(layer))

      const layersState = layerStores.map((layerStore: any) => layerStore.getState()) as Layer[]

      // Filter out layers inside multi-layout
      const extractedLayerStores = layerStores.filter((layerStore: any) => {
        const { isLayerInsideMultiLayout } = checkLayerInsideMultiLayout(layerStore.getState() as Layer, layersState)
        return !isLayerInsideMultiLayout
      })

      setExtractedLayerStores(extractedLayerStores, true)
    },
    [evaluateTemplateViewPort]
  )

  /**
   * Clears the template preview state
   */
  const clearTemplatePreviewState = useCallback(() => {
    TemplateEditorStore.dispatch({
      type: 'RESET_STATE',
    })
  }, [])

  return {
    initTemplatePreview,
    clearTemplatePreviewState,
    evaluateTemplateViewPort,
  }
}
