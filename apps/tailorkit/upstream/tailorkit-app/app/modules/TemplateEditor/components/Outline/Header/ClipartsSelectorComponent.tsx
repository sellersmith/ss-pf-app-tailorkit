import { Fragment, useCallback } from 'react'
import { MODAL_ID } from '~/constants/modal'
import { useStore } from '~/libs/external-store'
import { ClipartsSelector } from '~/modules/modals/ClipartsSelector'
import { clearImageOptionSetTransforms, duplicateLayers, scaleLayersToFitCanvas } from '~/modules/TemplateEditor/fns'
import { TEMPLATE_TYPE } from '~/routes/api.templates/constants'
import type { TLayerStore } from '~/stores/modules/layer'
import { createLayerStore } from '~/stores/modules/layer'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { DEFAULT_TEMPLATE_DIMENSION, TemplateEditorStore } from '~/stores/modules/template'
import type { Layer, LayerType } from '~/types/psd'
import type { LayerDocument } from '~/models/Layer.server'
import { ELayerType } from '~/types/psd'
import type { IImageQuery } from '~/types/shopify-files'
import { useModal } from '~/utils/hooks/useModal'
import { uuid } from '~/utils/uuid'
import { getClipartsDetails } from '../../Inspector/Cliparts/fns'
import { EMPTY_ARRAY } from '~/constants'
import { evaluateStageViewPort } from '~/utils/canvas/evaluateScale'
import { TEMPLATE_EDITOR_CANVAS_CONTAINER } from '~/constants/canvas'
import type { TemplateDimension } from '~/types/template'
import { useTourStatus } from '~/utils/hooks/useTourStatus'
import { checkLayerInsideMultiLayout } from '~/modules/TemplateEditor/elements/fns'
import { lengthUnitToPixels } from '~/utils/lengthUnitToPixels'
import { ClickContext } from '~/models/ClipartClickEvent'

export default function ClipartsSelectorComponent(props: {
  togglePopoverActive: (state?: boolean) => void
  addElements: (type: LayerType, mediaFiles: IImageQuery[] | null) => void
}) {
  const { togglePopoverActive } = props
  const clipartsAdded = useStore(TemplateEditorStore, state => state.clipartsAdded) || EMPTY_ARRAY
  const shopDomain = useStore(TemplateEditorStore, state => state.shopDomain)
  const currentExtractedLayerStores = useStore(TemplateEditorStore, state => state.extractedLayerStores) || EMPTY_ARRAY

  const { state, openModal, closeModal } = useModal()
  const openClipartsDialog = state?.[MODAL_ID.CLIPART_SELECTOR_MODAL]?.active

  const { tourId, active: tourActive } = useTourStatus()
  const isInTour = !!tourId && tourActive

  const onAdjustTemplateDimensionsWhenAddingClipartInTour = useCallback(
    (dimensions: TemplateDimension[]) => {
      if (!isInTour) return

      // Get maximum width and height from dimensions
      const dimension: TemplateDimension = dimensions.reduce(
        (acc, curr) => {
          return {
            width: Math.max(acc?.width ?? 500, curr?.width ?? 500),
            height: Math.max(acc?.height ?? 500, curr?.height ?? 500),
            measurementUnit: DEFAULT_TEMPLATE_DIMENSION.measurementUnit,
            resolution: DEFAULT_TEMPLATE_DIMENSION.resolution,
          }
        },
        {
          width: 0,
          height: 0,
          measurementUnit: DEFAULT_TEMPLATE_DIMENSION.measurementUnit,
          resolution: DEFAULT_TEMPLATE_DIMENSION.resolution,
        }
      )

      // Calculate the viewport of the template when opening the template
      const viewport = evaluateStageViewPort(TEMPLATE_EDITOR_CANVAS_CONTAINER, dimension)
      TemplateEditorStore.dispatch({
        type: 'SET_VIEW_PORT_AND_DIMENSION',
        payload: {
          dimension,
          viewport,
        },
      })
    },
    [isInTour]
  )

  const addClipart = useCallback(
    async (clipartsSelected: { _id: string; type: TEMPLATE_TYPE }[]) => {
      const clipartsDetails = await getClipartsDetails({ clipartsSelected })

      if (clipartsDetails.length > 0) {
        let extractedLayerStores: TLayerStore[] = []
        const _clipartsAdded = new Set(clipartsAdded)

        for (const clipartDetails of clipartsDetails) {
          const layersClipart = clipartDetails.layers || []
          _clipartsAdded.add(clipartDetails)

          // Create a group to contain the clipart
          const newId = uuid()
          const isFromTailorkit = (clipartDetails as any).isFromTailorkit

          const container = createLayerStore({
            _id: newId,
            type: ELayerType.GROUP,
            label: clipartDetails.name,
            visible: true,
            open: true,
            parent: '',
            shopDomain,
          })

          // Generate new layers from the clipart
          let createdLayers = duplicateLayers({
            layers: layersClipart,
            shopDomain,
            shouldUploadImageToShopify: isFromTailorkit,
            newId,
          }) as Layer[]

          // Ensure the inserted clipart fits within the template canvas
          const dimension = TemplateEditorStore.getState().dimension
          const { width, height, measurementUnit, resolution } = dimension || DEFAULT_TEMPLATE_DIMENSION
          const canvasWidth = lengthUnitToPixels(width, measurementUnit, resolution)
          const canvasHeight = lengthUnitToPixels(height, measurementUnit, resolution)
          createdLayers = scaleLayersToFitCanvas(createdLayers as any, canvasWidth, canvasHeight, {
            centerAfterScale: true,
          }) as any

          // Normalize parent for top-level layers before clearing option-set transforms
          const normalizedLayers: LayerDocument[] = createdLayers.map((layer: any) => ({
            ...(layer as any),
            parent: layer.parent || newId,
          }))

          // Clear transform data in image option sets (width/height/left/top/rotate)
          const clearedLayers = clearImageOptionSetTransforms(normalizedLayers)
          createdLayers = clearedLayers as unknown as Layer[]

          const layerStores = createdLayers.map((layer: any) => createLayerStore(layer))

          // Find layers inside multi-layouts
          const layersInMultiLayouts = createdLayers
            .filter((l: Layer) => {
              const { isLayerInsideMultiLayout } = checkLayerInsideMultiLayout(l, createdLayers)

              return isLayerInsideMultiLayout
            })
            .map(l => l._id)

          // Update template layer stores
          extractedLayerStores = [
            container,
            ...layerStores.filter((ls: TLayerStore) => !layersInMultiLayouts.includes(ls.getState()._id)),
            ...extractedLayerStores,
          ]
        }

        onAdjustTemplateDimensionsWhenAddingClipartInTour(clipartsDetails.map((c: any) => c.dimension))

        TemplateEditorStore.dispatch({
          type: 'SET_CLIPARTS',
          payload: {
            extractedLayerStores: [...extractedLayerStores, ...currentExtractedLayerStores],
            clipartsAdded: Array.from(_clipartsAdded),
          },
        })

        setTimeout(() => {
          LayerStoreSelection.dispatch({
            type: 'SET_LAYER_STORE_SELECTION',
            payload: { checkedLayerStores: extractedLayerStores },
          })
          togglePopoverActive(false)
        }, 100)
      }
    },
    [
      clipartsAdded,
      currentExtractedLayerStores,
      shopDomain,
      onAdjustTemplateDimensionsWhenAddingClipartInTour,
      togglePopoverActive,
    ]
  )

  const toggleOpenClipartsDialog = useCallback(() => {
    if (openClipartsDialog) {
      closeModal(MODAL_ID.CLIPART_SELECTOR_MODAL)
    } else {
      openModal(MODAL_ID.CLIPART_SELECTOR_MODAL)
    }
  }, [closeModal, openModal, openClipartsDialog])

  return (
    <Fragment>
      {openClipartsDialog && (
        <ClipartsSelector
          active={true}
          allowMultiple={!isInTour}
          /**
           * There are some issues with the clipart selector when the user is in the tour.
           * In case the user already has a clipart (Your Cliparts type) and the layer in which have option set, this can cause an error.
           * So we need to set the defaultClipartSource to PREMADE_TEMPLATE when the user is in the tour to avoid this issue.
           */
          defaultClipartSource={isInTour ? TEMPLATE_TYPE.PREMADE_TEMPLATE : undefined}
          trackingContext={ClickContext.MODAL_TEMPLATE_SELECTOR_EDITOR}
          onSelect={addClipart}
          onClose={toggleOpenClipartsDialog}
        />
      )}
    </Fragment>
  )
}
