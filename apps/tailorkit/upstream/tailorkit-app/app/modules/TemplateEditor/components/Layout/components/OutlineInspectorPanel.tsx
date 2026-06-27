/**
 * Left panel for the desktop editor sidebar.
 * Switches between two modes based on whether a layer is selected:
 * - Outline mode (no layer selected): TemplateEditorOutline = LayerToolbar + ToolSidebar
 * - Inspector mode (layer selected): LayerToolbar + InspectorWithPreviewMode
 *
 * When the user clicks a toolbar icon while the inspector is open, the layer
 * selection is cleared and the toolbar navigates to the chosen tool.
 */
import { useState } from 'react'
import type { TLayerStore } from '~/stores/modules/layer'
import { clearAllSelectedLayerStores } from '~/stores/modules/layer-store-selection'
import { ELayerType } from '~/types/psd'
import { InspectorWithPreviewMode } from '../../Inspector'
import TemplateEditorOutline, { LAYER_TOOLS } from '../../Navigation'
import LayerToolbar, { type ILayerTool } from '../../Outline/LayerToolbar'
import { LAYER_TOOLBAR_WIDTH, LayerToolMap, type LayerToolType } from '../../Outline/LayerToolbar/constants'
import { InspectorContainerBackButton } from './InspectorContainer'
import CharmBuilderToolPanel from '../../Outline/ToolSidebar/panels/CharmBuilderToolPanel'

interface OutlineInspectorPanelProps {
  clickedLayerStore: TLayerStore | null
  onBackToOutline: () => void
  panelWidth: string
}

export default function OutlineInspectorPanel({
  clickedLayerStore,
  onBackToOutline,
  panelWidth,
}: OutlineInspectorPanelProps) {
  // Track which toolbar tool to restore when returning from inspector to outline
  const [pendingToolId, setPendingToolId] = useState<string>(LayerToolMap.LAYERS_LISTING)

  // Toolbar click while inspector is open: clear layer selection and switch tool.
  // When tool is null (e.g. Elva AI opens chatbot), keep inspector visible — don't clear selection.
  const handleToolSelectWhileInspecting = (tool: ILayerTool | LayerToolType | null) => {
    if (!tool) return
    clearAllSelectedLayerStores()
    setPendingToolId(typeof tool === 'string' ? tool : tool.id)
  }

  // Determine if a layer is selected and which mode to show
  const clickedType = clickedLayerStore?.getState()?.type
  const isCharmLayer = clickedType === ELayerType.CHARM_NODE || clickedType === ELayerType.CHARM

  // When a layer is selected, show inspector mode with toolbar + back button
  if (clickedLayerStore) {
    // Charm layers → show Charm Builder panel (with back button) instead of empty inspector.
    // Resolve the CHARM_NODE id: if the clicked layer is a CHARM (child), use its nodeId;
    // if the clicked layer is the CHARM_NODE itself, use its own _id.
    const clickedState = clickedLayerStore.getState()
    const charmNodeId
      = clickedType === ELayerType.CHARM_NODE
        ? clickedState._id
        : (clickedState.settings as { nodeId?: string } | undefined)?.nodeId

    const inspectorContent = isCharmLayer ? (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <InspectorContainerBackButton onBackToOutline={onBackToOutline} clickedLayerStore={clickedLayerStore} />
        <div style={{ flex: 1, overflow: 'auto' }}>
          <CharmBuilderToolPanel charmNodeId={charmNodeId} />
        </div>
      </div>
    ) : (
      <InspectorWithPreviewMode
        renderAction={
          <InspectorContainerBackButton onBackToOutline={onBackToOutline} clickedLayerStore={clickedLayerStore} />
        }
      />
    )

    return (
      // Use explicit width calc(panelWidth + toolbar) to match TemplateEditorOutline's root width.
      // Inspector content uses the same explicit panelWidth as ToolSidebar's --tool-sidebar-width,
      // with the same border-right for visual consistency (border-box sizing).
      <div
        className="template-inspector-container"
        style={{
          position: 'relative',
          display: 'flex',
          width: `calc(${panelWidth} + ${LAYER_TOOLBAR_WIDTH}px)`,
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <LayerToolbar
          tools={LAYER_TOOLS.filter(t => !t.hidden)}
          activeTool={null}
          onToolSelect={handleToolSelectWhileInspecting}
        />
        <div
          className="template-inspector-content"
          style={{
            position: 'relative',
            width: panelWidth,
            minWidth: panelWidth,
            maxWidth: panelWidth,
            overflow: 'hidden',
            height: '100%',
            borderRight: '1px solid var(--p-color-border)',
          }}
        >
          {inspectorContent}
        </div>
      </div>
    )
  }

  return <TemplateEditorOutline defaultToolId={pendingToolId} panelWidth={panelWidth} />
}
