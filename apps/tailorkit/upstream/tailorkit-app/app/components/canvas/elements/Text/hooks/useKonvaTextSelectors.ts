import { useStore } from '~/libs/external-store'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { TemplateEditorStore } from '~/stores/modules/template'
import { useEditorParams } from '~/modules/ProductEditor/hooks'

interface KonvaTextSelectorsOptions {
  componentId: string
}

/**
 * Custom hook for optimized store subscriptions
 * Centralizes all store selector logic with performance optimizations
 */
export function useKonvaTextSelectors({ componentId }: KonvaTextSelectorsOptions) {
  // Optimized selection state - only re-renders when selection actually changes for this component
  const { previewMode } = useEditorParams()
  const isHavingLayerSelected = useStore(LayerStoreSelection, state => {
    const clickedStore = state.clickedLayerStore
    return clickedStore?.getState()?._id === componentId
  })
  const isSelected = isHavingLayerSelected && !previewMode

  // Viewport scale for rendering calculations
  const scale = useStore(TemplateEditorStore, state => state.viewport.scale)

  // Anchor dragging state for interaction management
  const isAnchorDragging = useStore(TemplateEditorStore, state => state.isAnchorDragging || false)

  return {
    isSelected,
    scale,
    isAnchorDragging,
  }
}
