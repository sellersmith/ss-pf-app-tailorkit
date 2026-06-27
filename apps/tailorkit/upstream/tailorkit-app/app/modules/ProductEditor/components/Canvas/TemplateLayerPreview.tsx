import type { RefObject } from 'react'
import { Fragment, useEffect, useMemo, useRef } from 'react'
import { Group, Rect } from 'react-konva'
import { ELayerType } from '~/types/psd'
import { useStore } from '~/libs/external-store'
import type { TLayerStore } from '~/stores/modules/layer'
import type { TLayerIntegrationStore } from '~/stores/modules/integration/layerIntegration'
import { RenderElementCanvas } from '~/modules/TemplateEditor/elements/render.client'
import { checkLayerInsideMultiLayout } from '~/modules/TemplateEditor/elements/fns'
import type { LayerDocument } from '~/models/Layer.server'
import { normalizeAngleToPositiveValue } from '~/utils/angle-fns'
import { normalizeLayerMetric } from '~/utils/canvas/normalizeLayerMetric'
import { lengthUnitToPixels } from '~/utils/lengthUnitToPixels'
import type { WithVariantsProps } from '../../withMockup'
import withMockup from '../../withMockup'
import type Konva from 'konva'
import { LAYER_MASK_NAME } from '~/constants/canvas'
import { TemplateEditorContext } from '~/modules/TemplateEditor/context'
import {
  getEnableClippingMaskForView,
  getViewLayerIntegrationStoreByIds,
} from '~/stores/modules/integration/viewLayerIntegration'
import type { Store } from '~/libs/external-store'
import type { LayerIntegration as LayerIntegrationType } from '~/types/integration'

interface ITemplateLayerPreviewProps extends WithVariantsProps {
  layerStore: TLayerIntegrationStore
  templateLayerStores: TLayerStore[]
  maskTrRef: RefObject<Konva.Transformer>
}

/**
 * Live template preview component that renders template layers dynamically
 * Mirrors the storefront rendering approach for instant option updates
 */
function TemplateLayerPreview(props: ITemplateLayerPreviewProps) {
  const { layerStore, templateLayerStores, variants, maskTrRef } = props
  const mockup = variants[0].mockup
  const selectedViewId: string | undefined = mockup.selectedViewId || mockup.views?.[0]?._id
  const enableClippingMask = selectedViewId ? getEnableClippingMaskForView(mockup._id, selectedViewId) : false
  const data = useStore(layerStore, state => state.data)
  const _id = useStore(layerStore, state => state._id)

  // Use per-view layer store for effective transforms
  const viewLayerStore = selectedViewId
    ? (getViewLayerIntegrationStoreByIds(mockup._id, selectedViewId, _id) as unknown as Store<
        LayerIntegrationType,
        any
      >)
    : (layerStore as unknown as Store<LayerIntegrationType, any>)

  const x = useStore(viewLayerStore, state => state.x)
  const y = useStore(viewLayerStore, state => state.y)
  const rotation = useStore(viewLayerStore, state => state.rotation)
  const widthIntegration = useStore(viewLayerStore, state => state.width)
  const heightIntegration = useStore(viewLayerStore, state => state.height)

  const mask = useStore(viewLayerStore, state => state.mask)
  const visibleEff = useStore(viewLayerStore, state => state.visible)

  // Get template data from layer integration (may only contain layer ids)
  const templateData = data?.template

  // Build map of layer stores by id for ordering
  const layerStoreMapById = useMemo(() => {
    const map = new Map<string, TLayerStore>()
    templateLayerStores.forEach(store => {
      const { _id } = store.getState()
      map.set(_id, store)
    })
    return map
  }, [templateLayerStores])

  // Determine ordered layer stores based on template.layers array (ids) if available
  const orderedLayerStores = useMemo(() => {
    const layerIds: string[] = Array.isArray(templateData?.layers) ? (templateData.layers as unknown as string[]) : []

    if (layerIds.length) {
      const stores: TLayerStore[] = []
      layerIds.forEach(id => {
        const s = layerStoreMapById.get(id)
        if (s) stores.push(s)
      })

      // Append any remaining stores not in ids list
      templateLayerStores.forEach(s => {
        if (!layerIds.includes(s.getState()._id)) stores.push(s)
      })

      return stores
    }

    return templateLayerStores
  }, [templateData, layerStoreMapById, templateLayerStores])

  // Compute layer states and filter multilayout
  const extractedLayerStores = useMemo(() => {
    const states = orderedLayerStores.map(s => s.getState() as LayerDocument)

    return orderedLayerStores.filter(store => {
      const state = store.getState() as LayerDocument
      const { isLayerInsideMultiLayout } = checkLayerInsideMultiLayout(state as any, states as any)
      return !isLayerInsideMultiLayout
    })
  }, [orderedLayerStores])

  // Compute scale based on template dimension vs layer integration size
  const { scaleX, scaleY } = useMemo(() => {
    if (!templateData) return { scaleX: 1, scaleY: 1 }

    const dim = templateData.dimension || { width: 1, height: 1, measurementUnit: 'px', resolution: 300 }
    const templatePixelWidth = lengthUnitToPixels(dim.width, dim.measurementUnit, dim.resolution) || 1
    const templatePixelHeight = lengthUnitToPixels(dim.height, dim.measurementUnit, dim.resolution) || 1

    const sx = widthIntegration && widthIntegration > 0 ? widthIntegration / templatePixelWidth : 1
    const sy = heightIntegration && heightIntegration > 0 ? heightIntegration / templatePixelHeight : 1

    return { scaleX: sx, scaleY: sy }
  }, [templateData, widthIntegration, heightIntegration])

  const scaledContent = (
    <Group scaleX={scaleX} scaleY={scaleY}>
      <TemplateLayersContent extractedLayerStores={extractedLayerStores} />
    </Group>
  )

  const rectRef = useRef<Konva.Rect | null>(null)

  // Rectangle describing the mask / layer bounds in local coords (0,0)
  const maskRect
    = enableClippingMask && mask
      ? {
          x: mask.x,
          y: mask.y,
          width: normalizeLayerMetric(mask.width),
          height: normalizeLayerMetric(mask.height),
        }
      : {
          x: 0,
          y: 0,
          width: widthIntegration,
          height: heightIntegration,
        }

  // Register rect with transformer
  useEffect(() => {
    if (!enableClippingMask) {
      if (maskTrRef.current) {
        maskTrRef.current.nodes([])
      }

      return
    }

    if (rectRef.current && maskTrRef.current) {
      const currentNodes = maskTrRef.current.getNodes()

      // Filter nodes that not being selected
      const nodes = currentNodes.filter(node => node !== rectRef.current)

      maskTrRef.current.nodes(nodes)

      const getLayer = maskTrRef.current.getLayer()

      if (getLayer) {
        getLayer.batchDraw() // Force the layer to re-render
      }
    }
  }, [maskTrRef, enableClippingMask])

  if (visibleEff === false || extractedLayerStores.length === 0) {
    return null
  }

  return enableClippingMask && mask ? (
    <Group
      name="tlk-template-mask-group"
      visible={visibleEff}
      clipFunc={ctx => {
        ctx.save()
        ctx.translate(maskRect.x, maskRect.y)
        ctx.rect(0, 0, maskRect.width, maskRect.height)
        ctx.restore()
      }}
    >
      {/* Template content at LayerIntegration position */}
      <Group x={normalizeLayerMetric(x)} y={normalizeLayerMetric(y)} rotation={normalizeAngleToPositiveValue(rotation)}>
        {scaledContent}
      </Group>

      {/* Invisible rect for transformer */}
      <Rect
        ref={rectRef}
        x={maskRect.x}
        y={maskRect.y}
        width={maskRect.width}
        height={maskRect.height}
        fill="rgba(0,0,0,0)"
        listening={false}
        name={LAYER_MASK_NAME}
        id={`mask-${_id}`}
      />
    </Group>
  ) : (
    <Group
      x={normalizeLayerMetric(x)}
      y={normalizeLayerMetric(y)}
      rotation={normalizeAngleToPositiveValue(rotation)}
      visible={visibleEff}
    >
      {scaledContent}
    </Group>
  )
}

export default withMockup(TemplateLayerPreview)

/**
 * Renders the actual template layers within the group
 */
function TemplateLayersContent(props: { extractedLayerStores: TLayerStore[] }) {
  const { extractedLayerStores } = props

  // Render layers in reverse order (bottom to top)
  const reversedStores = useMemo(() => [...extractedLayerStores].reverse(), [extractedLayerStores])

  return (
    <Fragment>
      <TemplateEditorContext.Provider
        value={{ validationErrors: {}, setValidationErrors: () => {}, layers: extractedLayerStores }}
      >
        {reversedStores.map(store => {
          const state = store.getState()
          const element = <RenderElementCanvas layerStore={store} type={state.type as any} previewMode={true} />

          // CHARM_NODE needs listening enabled so charms can be dragged in the Mockup canvas.
          // All other layers remain non-interactive so clicks pass through to SpriteLayerIntegration.
          if (state.type === ELayerType.CHARM_NODE) {
            return <Fragment key={state._id}>{element}</Fragment>
          }

          return (
            <Group key={state._id} listening={false}>
              {element}
            </Group>
          )
        })}
      </TemplateEditorContext.Provider>
    </Fragment>
  )
}
