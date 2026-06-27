import { BlockStack, Box, InlineStack } from '@shopify/polaris'
import type { ComponentType } from 'react'
import { Fragment, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { AccordionList } from '~/components/Accordion'
import { useStore } from '~/libs/external-store'
import { HeightTransformation } from '~/modules/TemplateEditor/components/Inspector/Transformation/HeightTransformation'
import { RotationTransformation } from '~/modules/TemplateEditor/components/Inspector/Transformation/RotationTransformation'
import { WidthTransformation } from '~/modules/TemplateEditor/components/Inspector/Transformation/WidthTransformation'
import { XTransformation } from '~/modules/TemplateEditor/components/Inspector/Transformation/XTransformation'
import { YTransformation } from '~/modules/TemplateEditor/components/Inspector/Transformation/YTransformation'
import { LayerIntegrationStoreSelection } from '~/stores/modules/integration/layer-integration-selection'
import type { TLayerIntegrationStore } from '~/stores/modules/integration/layerIntegration'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { getViewLayerIntegrationStoreByIds } from '~/stores/modules/integration/viewLayerIntegration'
import type { Store } from '~/libs/external-store'
import type { LayerIntegration as LayerIntegrationType } from '~/types/integration'
import {
  convertDegreesToRadians,
  getCenterPivotPoint,
  getCorner,
  getOriginalPoint,
  normalizeAngleToPositiveValue,
} from '~/utils/angle-fns'

interface WithVariantsProps {
  layerStore: TLayerIntegrationStore
}

const withLayerStoreSelection = <P extends WithVariantsProps>(Component: ComponentType<P>) => {
  const WithLayerStoreSelectionComponent = (props: Omit<P, keyof WithVariantsProps>) => {
    const layerStore = useStore(LayerIntegrationStoreSelection, state => state.clickedLayerStore)

    if (!layerStore) {
      return <Fragment />
    }

    return <Component {...(props as P)} layerStore={layerStore} />
  }

  WithLayerStoreSelectionComponent.displayName = `withLayerStoreSelection(${
    Component.displayName || Component.name || 'Component'
  })`

  return WithLayerStoreSelectionComponent
}

interface IStylingIntegrationInspectorProps extends WithVariantsProps {}

function StylingIntegrationInspector(props: IStylingIntegrationInspectorProps) {
  const { layerStore } = props
  const { t } = useTranslation()

  const layerId = useStore(layerStore, state => state._id)

  // Resolve current mockup/view selection that contains this layer
  const { mockupId, viewId } = ((): { mockupId?: string; viewId?: string } => {
    const state = IntegrationStore.getState()
    for (const v of state.variants) {
      const hasLayer = (v.mockup.layers || []).some((ls: any) => ls.getState()._id === layerId)
      if (hasLayer) {
        const _mockupId = v.mockup._id
        const _viewId = v.mockup.selectedViewId || v.mockup.views?.[0]?._id
        return { mockupId: _mockupId, viewId: _viewId }
      }
    }
    return {}
  })()

  // Use per-view store when a view is active for effective values
  const effectiveStore
    = mockupId && viewId
      ? (getViewLayerIntegrationStoreByIds(mockupId, viewId, layerId) as unknown as Store<LayerIntegrationType, any>)
      : (layerStore as unknown as Store<LayerIntegrationType, any>)

  const width = useStore(effectiveStore, state => state.width)
  const height = useStore(effectiveStore, state => state.height)
  const left = useStore(effectiveStore, state => state.x)
  const top = useStore(effectiveStore, state => state.y)
  const rotate = useStore(effectiveStore, state => state.rotation)

  const onWidthChangeHandler = useCallback(
    (value: any) => {
      if (mockupId && viewId) {
        IntegrationStore.dispatch({
          type: 'UPDATE_VIEW_OVERRIDES',
          payload: { mockupId, viewId, layerId, patch: { width: +value } },
        })
        return
      }
      layerStore.dispatch({ type: 'UPDATE_DIMENSION', payload: { width: +value } })
    },
    [layerStore, layerId, mockupId, viewId]
  )

  const onHeightChangeHandler = useCallback(
    (value: any) => {
      if (mockupId && viewId) {
        IntegrationStore.dispatch({
          type: 'UPDATE_VIEW_OVERRIDES',
          payload: { mockupId, viewId, layerId, patch: { height: +value } },
        })
        return
      }
      layerStore.dispatch({ type: 'UPDATE_DIMENSION', payload: { height: +value } })
    },
    [layerStore, layerId, mockupId, viewId]
  )

  const onXChangeHandler = useCallback(
    (value: any) => {
      if (mockupId && viewId) {
        IntegrationStore.dispatch({
          type: 'UPDATE_VIEW_OVERRIDES',
          payload: { mockupId, viewId, layerId, patch: { x: +value } },
        })
        return
      }
      layerStore.dispatch({ type: 'UPDATE_TRANSFORMATION', payload: { x: +value } })
    },
    [layerStore, layerId, mockupId, viewId]
  )

  const onYChangeHandler = useCallback(
    (value: any) => {
      if (mockupId && viewId) {
        IntegrationStore.dispatch({
          type: 'UPDATE_VIEW_OVERRIDES',
          payload: { mockupId, viewId, layerId, patch: { y: +value } },
        })
        return
      }
      layerStore.dispatch({ type: 'UPDATE_TRANSFORMATION', payload: { y: +value } })
    },
    [layerStore, layerId, mockupId, viewId]
  )

  const onRotationChangeHandler = useCallback(
    (value: any) => {
      const _rotation = normalizeAngleToPositiveValue(+(value as string))

      const pivotPoint = getCenterPivotPoint(
        {
          x: left,
          y: top,
        },
        { width, height },
        rotate || 0
      )

      const originalPoint = getOriginalPoint(pivotPoint, { width, height })

      const topLeftCorner = getCorner(
        pivotPoint,
        { x: originalPoint.x, y: originalPoint.y },
        convertDegreesToRadians(_rotation || 0)
      )

      const updatedLeft = +topLeftCorner.x.toFixed(2)
      const updatedTop = +topLeftCorner.y.toFixed(2)

      if (mockupId && viewId) {
        IntegrationStore.dispatch({
          type: 'UPDATE_VIEW_OVERRIDES',
          payload: { mockupId, viewId, layerId, patch: { rotation: Number(value), x: updatedTop, y: updatedLeft } },
        })
      } else {
        layerStore.dispatch({
          type: 'UPDATE_TRANSFORMATION',
          payload: { rotation: Number(value), x: updatedTop, y: updatedLeft },
        })
      }
    },
    [height, layerStore, left, rotate, top, width, mockupId, viewId, layerId]
  )

  return (
    <Box>
      <AccordionList
        items={[
          {
            open: true,
            label: t('layer-transformation'),
            id: 'transformation-inspector-controls',
            content: (
              <InlineStack gap={'200'} wrap={false} align="center">
                <InlineStack gap={'200'} wrap={false}>
                  <BlockStack gap={'200'}>
                    <WidthTransformation value={width} onChange={onWidthChangeHandler} />
                    <XTransformation value={left} onChange={onXChangeHandler} />
                    <RotationTransformation value={rotate} onChange={onRotationChangeHandler} />
                  </BlockStack>

                  <BlockStack gap={'200'}>
                    <HeightTransformation value={height} onChange={onHeightChangeHandler} />

                    <YTransformation value={top} onChange={onYChangeHandler} />
                  </BlockStack>
                </InlineStack>
              </InlineStack>
            ),
          },
        ]}
      />
    </Box>
  )
}

export default withLayerStoreSelection(StylingIntegrationInspector)
