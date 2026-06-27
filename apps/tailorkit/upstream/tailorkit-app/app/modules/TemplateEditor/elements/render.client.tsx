import type { TemplateElementProps } from './components/types'
import { ELayerType, type Layer, type LayerType } from '~/types/psd'
import TextElement from './components/Text'
import ImageElement from './components/Image'
import GroupElement from './components/Group'
import ImagelessElement from './components/Imageless'
import MultiLayoutElement from './components/MultiLayout'
import CharmNodeElement from './components/CharmNode'
import CharmElement from './components/Charm'
import { Fragment, memo, useMemo, useRef, useLayoutEffect } from 'react'
import { Group } from 'react-konva'
import type Konva from 'konva'
import { useStore } from '~/libs/external-store'
import { TemplateEditorStore } from '~/stores/modules/template'
import { useConditionalLogic } from '../hooks/useConditionalLogic'
import { ClipartsInspector } from '../components/Inspector/Cliparts/index.client'
import type { TLayerStore } from '~/stores/modules/layer'
import { EMPTY_OBJECT } from '~/constants'
import { checkLayerInsideMultiLayout } from './fns'
import { useLayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { BulkImageOptionSetCreator } from '../components/Inspector/BulkImageOptionSet/index.client'

/**
 * Wraps a conditionally-hidden layer at 0.15 opacity and ensures it floats above
 * all sibling Konva nodes after every reconciliation via moveToTop(). This fixes
 * the visual occlusion bug when two layers share the same X,Y position — without
 * this, the visible layer (rendered later in the array) would completely cover the
 * dimmed one.
 */
function ConditionallyHiddenGroup({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<Konva.Group>(null)
  useLayoutEffect(() => {
    groupRef.current?.moveToTop()
  })
  return (
    <Group ref={groupRef} opacity={0.15}>
      {children}
    </Group>
  )
}

const elements: Record<LayerType, React.ComponentType<TemplateElementProps>> = {
  text: TextElement,
  image: ImageElement,
  group: GroupElement,
  imageless: ImagelessElement,
  'multi-layout': MultiLayoutElement,
  'charm-node': CharmNodeElement,
  charm: CharmElement,
}

function RenderElement(props: TemplateElementProps) {
  const { previewMode, renderContext, layerStore, children, ...restProps } = props
  const { _id, type = ELayerType.IMAGE }: { _id: string; type: LayerType } = layerStore.getState()

  // Check layer visibility and conditional dim state
  const { isLayerVisible, isConditionallyHidden } = useConditionalLogic({ layerStore, previewMode })

  // Track selection to restore full opacity when a dimmed layer is clicked
  const { clickedLayerStore } = useLayerStoreSelection()
  const isSelected = clickedLayerStore === layerStore

  const Component = useMemo(() => elements[type] || elements[ELayerType.IMAGE], [type])

  // In preview mode: hide layers that are conditionally hidden (e.g. by imageless/conditional logic)
  if (!isLayerVisible) return false

  const element = (
    <Component key={_id} renderContext={renderContext} layerStore={layerStore} previewMode={previewMode} {...restProps}>
      {children}
    </Component>
  )

  // In design canvas: dim conditionally-hidden layers to 15% so editors can still see and click them.
  // ConditionallyHiddenGroup calls moveToTop() after every render so the dimmed layer always floats
  // above overlapping siblings (fixes occlusion when two layers share the same X,Y position).
  // When the layer is selected (clicked), restore full opacity so the inspector is usable.
  if (renderContext === 'canvas' && isConditionallyHidden && !isSelected) {
    return <ConditionallyHiddenGroup>{element}</ConditionallyHiddenGroup>
  }

  return element
}

export function RenderElementOutlineComponent(props: TemplateElementProps) {
  return <RenderElement {...props} renderContext="outline" />
}

export function RenderElementCanvasComponent(props: TemplateElementProps) {
  const { layerStore } = props

  const visible = useStore(layerStore as TLayerStore, state => state.visible)

  return visible ? <RenderElement {...props} renderContext="canvas" /> : <Fragment />
}

export function RenderElementInspectorComponent(props: TemplateElementProps) {
  return <RenderElement {...props} renderContext="inspector" />
}

export function RenderElementStylingToolbarComponent(props: TemplateElementProps) {
  return <RenderElement {...props} renderContext="styling-toolbar" />
}

// HOC that uses for passing pre-props and conditional rendering.
const enhanceRenderElement = (WrappedComponent: typeof RenderElement, additionalProps?: Record<string, unknown>) => {
  return function EnhancedComponent(props: TemplateElementProps) {
    const { layerStore } = props

    const layerStores = useStore(TemplateEditorStore, state => state.extractedLayerStores)

    // Check if this layer inside multi-layout
    let isInsideMultiLayout = false
    let multiLayoutLayerId = ''

    if (layerStore) {
      const { isLayerInsideMultiLayout, multiLayoutLayerId: mLayerId } = checkLayerInsideMultiLayout(
        layerStore.getState() as Layer,
        layerStores.map(layerStore => layerStore.getState()) as Layer[]
      )

      isInsideMultiLayout = isLayerInsideMultiLayout
      multiLayoutLayerId = mLayerId || ''
    }

    const _additionalProps = useMemo(() => {
      return {
        ...additionalProps,
        // Return null for rendering option set if layer inside multi-layout
        ...(isInsideMultiLayout
          ? {
              renderOptionSetInspector: function () {
                return null
              },
              isInsideMultiLayout,
              multiLayoutLayerId,
            }
          : {}),
      }
    }, [isInsideMultiLayout, multiLayoutLayerId])

    // Combine original props with additional props
    const combinedProps = useMemo(() => {
      return { ...props, ..._additionalProps }
    }, [props, _additionalProps])

    if (!layerStore) return null

    return <WrappedComponent {...combinedProps} />
  }
}

const RenderConfigLayersInspector = () => {
  const { checkedLayerStores, clickedLayerStore } = useLayerStoreSelection()

  /**
   * Do not show the bulk image option set creator if clicking a multi-layout element
   * Because image layer can inside the multi-layout element can cause some UX issues or bugs
   */
  // Safety check: Filter out undefined/null layer stores to prevent crashes
  const validCheckedLayerStores = checkedLayerStores.filter(ls => !!ls)
  const isNotClickingMultiLayout = !clickedLayerStore || clickedLayerStore.getState().type !== ELayerType.MULTI_LAYOUT
  const imageSelection = validCheckedLayerStores.filter(ls => ls.getState().type === ELayerType.IMAGE)
  const hasBulkImageSelection = imageSelection.length >= 2 && isNotClickingMultiLayout

  return (
    <Fragment>
      <ClipartsInspector />
      {hasBulkImageSelection && <BulkImageOptionSetCreator />}
    </Fragment>
  )
}

const RenderElementOutline = memo(enhanceRenderElement(RenderElementOutlineComponent, EMPTY_OBJECT))

const RenderElementCanvas = memo(enhanceRenderElement(RenderElementCanvasComponent, EMPTY_OBJECT))

const RenderElementInspector = memo(enhanceRenderElement(RenderElementInspectorComponent, EMPTY_OBJECT))

const RenderElementStylingToolbar = memo(enhanceRenderElement(RenderElementStylingToolbarComponent, EMPTY_OBJECT))

export {
  RenderElementOutline,
  RenderElementCanvas,
  RenderElementInspector,
  RenderConfigLayersInspector,
  RenderElementStylingToolbar,
}
