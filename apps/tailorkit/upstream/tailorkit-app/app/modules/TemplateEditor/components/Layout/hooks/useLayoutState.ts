/**
 * Custom hook to manage layout state and calculations
 */

import { useMemo, useCallback } from 'react'
import { useStore } from '~/libs/external-store'
import { useChatBot } from '~/providers/ChatBotContext'
import { TemplateEditorStore } from '~/stores/modules/template'
import { LayerStoreSelection, useLayerStoreSelection } from '~/stores/modules/layer-store-selection'
import useDevices from '~/utils/hooks/useDevice'
import useWindowSize from '~/utils/hooks/useWindowSize'
import { calculateLayoutDimensions } from '../utils/layoutCalculations'
import { getGridConfig } from '../utils/gridConfig'
import { useEditorParams } from '~/modules/ProductEditor/hooks'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '../../../constants'
import { LayerToolMap } from '../../Outline/LayerToolbar/constants'
import { SubInspectorStore } from '~/stores/canvas/subInspector'

/**
 * Hook that provides all layout state and calculations for the template editor
 */
export function useLayoutState() {
  const { isMobileView, isDesktopView, isSmallDesktopView, isSmallMobileView } = useDevices()
  const { isOpen: isChatBotOpen = false } = useChatBot() || {}
  const { width: viewportWidth } = useWindowSize()

  // Get state from stores
  const { previewMode } = useEditorParams()
  const sidebarActive = useStore(TemplateEditorStore, state => state.sidebarActive)
  const { clickedLayerStore } = useLayerStoreSelection()
  const subInspectorKey = useStore(SubInspectorStore, state => state.key)

  // Derived states
  const isTabletView = useMemo(() => isMobileView && !isSmallMobileView, [isMobileView, isSmallMobileView])
  // Special tablet range (785-1055px): keep desktop grid but move toolbar into inspector
  const isTabletInspectorMode = useMemo(() => viewportWidth > 784 && viewportWidth < 1056, [viewportWidth])
  // In the new 3-column layout, the left sidebar is always visible on desktop.
  // Don't let chatbot state affect sidebar width — only the preview panel closes.
  const isSidebarOpen = Boolean(sidebarActive)
  // Standalone AI panels (Elva AI chatbot, AI image inspector)
  const isStandaloneAIPanel = subInspectorKey === 'ai-image-inspector'
  const isAIPanelOpen = isChatBotOpen || isStandaloneAIPanel
  // Left panel stays visible when AI opens — only the preview panel closes
  const showOutlinePanel = true
  const showInspectorSidebar = true // Temporary enable the inspector sidebar
  const isCompactRightPane = isSmallDesktopView || isChatBotOpen
  const showInspectorOnCompact = isCompactRightPane && Boolean(clickedLayerStore)
  const showInspectorOnTablet = isTabletView && Boolean(clickedLayerStore)
  // DesktopSidebar is hidden for tablet-inspector (785-1055px) and small desktop ranges
  const showDesktopSidebar = Boolean(isDesktopView) && !isTabletView && !isSmallDesktopView && !isTabletInspectorMode

  // Show the preview panel column on full desktop only; hide for tablet-inspector range (785-1055px),
  // small desktop, AI panels, and preview mode (mobile/tablet use the old Preview tab flow).
  const showPreviewPanel = Boolean(
    isDesktopView && !isTabletView && !isTabletInspectorMode && !isSmallDesktopView && !previewMode && !isAIPanelOpen
  )

  // Calculate layout dimensions
  const layoutDimensions = useMemo(() => {
    return calculateLayoutDimensions({
      previewMode: previewMode ?? false,
      isSidebarOpen: isSidebarOpen ?? false,
      isSmallDesktopView,
      isChatBotOpen,
      isTabletView,
      isDesktopView: Boolean(isDesktopView),
      showInspectorSidebar,
      viewportWidth,
      isAIPanelOpen,
    })
  }, [
    previewMode,
    isSidebarOpen,
    isSmallDesktopView,
    isChatBotOpen,
    isTabletView,
    isDesktopView,
    showInspectorSidebar,
    viewportWidth,
    isAIPanelOpen,
  ])

  // Calculate grid configuration
  const gridConfig = useMemo(() => {
    return getGridConfig({
      isTabletView,
      isSmallMobileView,
      previewMode: previewMode ?? false,
      templateEditorOutlineWidth: layoutDimensions.templateEditorOutlineWidth,
      templateEditorInspectorWidth: layoutDimensions.templateEditorInspectorWidth,
      previewPanelWidth: layoutDimensions.previewPanelWidth,
      showDesktopSidebar,
    })
  }, [
    isTabletView,
    isSmallMobileView,
    previewMode,
    layoutDimensions.templateEditorOutlineWidth,
    layoutDimensions.templateEditorInspectorWidth,
    layoutDimensions.previewPanelWidth,
    showDesktopSidebar,
  ])

  // Callback to reset layer selection (back to outline) and reopen layers panel
  const onBackToOutline = useCallback(() => {
    LayerStoreSelection.dispatch({
      type: 'SET_LAYER_STORE_SELECTION',
      payload: { clickedLayerStore: null, checkedLayerStores: [] },
    })
    Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.TOGGLE_LAYER_TOOL_PANEL, {
      data: { toolId: LayerToolMap.LAYERS_LISTING },
    })
  }, [])

  return {
    // Device states
    isMobileView,
    isDesktopView,
    isSmallDesktopView,
    isSmallMobileView,
    isTabletView,
    isTabletInspectorMode,

    // Layout states
    previewMode,
    isChatBotOpen,
    isAIPanelOpen,
    showOutlinePanel,
    showInspectorSidebar,
    isCompactRightPane,
    showInspectorOnCompact,
    showInspectorOnTablet,
    showPreviewPanel,
    showDesktopSidebar,
    clickedLayerStore,

    // Calculated values
    ...layoutDimensions,
    ...gridConfig,

    // Callbacks
    onBackToOutline,
  }
}
