import type Konva from 'konva'
import type { RefObject } from 'react'
import { Fragment, useMemo, useContext } from 'react'

import { useStore } from '~/libs/external-store'
import { getViewLayerIntegrationStoreByIds } from '~/stores/modules/integration/viewLayerIntegration'
import type { Store } from '~/libs/external-store'
import type { LayerIntegration, MockupView } from '~/types/integration'
import SpriteLayerIntegration from './SpriteLayerIntegration'
import TemplateLayerPreview from './TemplateLayerPreview'
import { TemplateLayerStoresContext } from '../Preview/contexts/TemplateLayerStoresContext'
import { buildViewRenderLayers } from '~/modules/ProductEditor/utils/views'
import type { WithVariantsProps } from '../../withMockup'
import withMockup from '../../withMockup'
import { useEditorParams } from '../../hooks'

interface ILayersIntegrationProps extends WithVariantsProps {
  maskTrRef: RefObject<Konva.Transformer>
}

function LayersIntegration(props: ILayersIntegrationProps) {
  const { variants, maskTrRef } = props
  const mockup = variants[0].mockup as any
  const viewId: string | undefined = mockup.selectedViewId || mockup.views?.[0]?._id
  const currentView = Array.isArray(mockup.views) ? mockup.views.find((v: any) => v._id === viewId) : undefined

  const layerStores = useMemo(() => (mockup.layers || []) as any[], [mockup.layers])
  const orderedLayers = useMemo(() => {
    if (!currentView) return [...layerStores].map((ls: any) => ls.getState()).reverse()
    const merged = buildViewRenderLayers({ view: currentView, layerStores: layerStores as any[] })
    return [...merged].reverse()
  }, [currentView, layerStores])

  return (
    <Fragment>
      {orderedLayers.map(layerState => (
        <LayerIntegrationComponent
          maskTrRef={maskTrRef}
          key={layerState._id}
          currentView={currentView}
          layerStore={getViewLayerIntegrationStoreByIds(mockup._id, viewId!, layerState._id)}
        />
      ))}
    </Fragment>
  )
}

function LayerIntegrationComponent(props: {
  layerStore: Store<LayerIntegration, any>
  maskTrRef: RefObject<Konva.Transformer>
  currentView: MockupView
}) {
  const { layerStore, maskTrRef, currentView } = props

  const data = useStore(layerStore, state => state.data)
  const type = useStore(layerStore, state => state.type)
  const printAreaId = useStore(layerStore, state => state.printAreaId) || ''
  const { previewMode } = useEditorParams()
  const context = useContext(TemplateLayerStoresContext)

  if (type === 'template' && previewMode) {
    // Preview tab (mobile/tablet): live-only rendering, no drag/resize needed
    const templateId = data?.template?._id
    if (templateId && context?.getTemplateLayerStores) {
      const templateLayerStores = context.getTemplateLayerStores(templateId, printAreaId)
      return (
        <TemplateLayerPreview layerStore={layerStore} templateLayerStores={templateLayerStores} maskTrRef={maskTrRef} />
      )
    }
  }

  if (type === 'template' && !previewMode && context) {
    // Mockup tab with context: dual rendering for live option sets + full mockup interactions.
    // 1) SpriteLayerIntegration (invisible, opacity=0): handles drag, resize, select, transformer
    // 2) TemplateLayerPreview (visible, listening=false): shows live option set state on top
    // Clicks pass through the non-listening overlay to the sprite underneath.
    //
    // When no preview blob exists (default/empty template), skip dual rendering and fall through
    // to normal SpriteLayerIntegration at full opacity so the placeholder is visible and interactive.
    const templateId = data?.template?._id
    const src = (!data?.template?.deletedAt && data?.template?.previewUrl) || ''
    if (templateId && context.getTemplateLayerStores && src) {
      const templateLayerStores = context.getTemplateLayerStores(templateId, printAreaId)

      return (
        <Fragment>
          <SpriteLayerIntegration maskTrRef={maskTrRef} src={src} layerStore={layerStore} opacity={0} />
          <TemplateLayerPreview
            layerStore={layerStore}
            templateLayerStores={templateLayerStores}
            maskTrRef={maskTrRef}
          />
        </Fragment>
      )
    }
  }

  // Handle image layers with static rendering
  let src = ''

  switch (type) {
    case 'template': {
      src = (!data?.template?.deletedAt && data?.template?.previewUrl) || ''
      break
    }

    case 'image': {
      src = data?.src || ''
      break
    }

    case 'mask': {
      // For mask layer, src must be per-view maskImage
      src = currentView?.maskImage?.url || ''
      break
    }
  }

  return <SpriteLayerIntegration maskTrRef={maskTrRef} src={src} layerStore={layerStore} />
}

export default withMockup(LayersIntegration)
