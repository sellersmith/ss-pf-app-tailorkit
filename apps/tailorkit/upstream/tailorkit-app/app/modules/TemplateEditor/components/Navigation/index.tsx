import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ILayerTool } from '../Outline/LayerToolbar'
import LayerToolbar from '../Outline/LayerToolbar'
import ToolSidebar from '../Outline/ToolSidebar'
import {
  AlertCircleIcon,
  ImageIcon,
  LayoutSectionIcon,
  LightbulbIcon,
  MagicIcon,
  PaintBrushRoundIcon,
  PlusCircleIcon,
  ProductIcon,
  StatusActiveIcon,
  StoreIcon,
  TextIcon,
} from '@shopify/polaris-icons'
import { LAYER_TOOLBAR_WIDTH, LayerToolMap, type LayerToolType } from '../Outline/LayerToolbar/constants'
import { Icon } from '@shopify/polaris'
import { clearAllSelectedLayerStores } from '~/stores/modules/layer-store-selection'
import { useStore } from '~/libs/external-store'
import { TemplateEditorStore } from '~/stores/modules/template'
import { collectCustomizationItems, type CollectorLayer } from '~/shared/customization-items'
import { TemplateEditorContext } from '../../context'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { MUTATION_LAYER_FROM_INSPECTOR_EVENTS, TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '../../constants'
import { CharmBuilderIcon } from '~/assets/icons'
import { useRootLoaderData } from '~/root'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import type { SubscriptionDocument } from '~/models/Subscription'
import { isOrderBasedPlan } from '~/models/helpers/pricing-utils'

export const LAYER_TOOLS: ILayerTool[] = [
  {
    id: LayerToolMap.ELEMENTS,
    icon: <Icon source={PlusCircleIcon} tone="success" />,
    label: 'Elements',
    shortLabel: 'Elements',
    tooltip: 'Elements (Text, image)',
  },
  {
    id: LayerToolMap.LAYERS_LISTING,
    icon: LayoutSectionIcon,
    label: 'layers',
    shortLabel: 'Layers',
  },
  {
    id: LayerToolMap.CHARM_BUILDER,
    icon: CharmBuilderIcon,
    label: 'Charms',
    shortLabel: 'Charms',
  },
  {
    id: LayerToolMap.CLIPART,
    icon: PaintBrushRoundIcon,
    label: 'free-cliparts',
    shortLabel: 'Cliparts',
  },
  {
    id: LayerToolMap.STOREFRONT,
    icon: StoreIcon,
    label: 'Storefront',
    shortLabel: 'Storefront',
  },
  {
    id: LayerToolMap.CHANGE_VARIANT,
    icon: ProductIcon,
    label: 'change-variants',
    shortLabel: 'Variants',
  },
  {
    id: LayerToolMap.READY_TO_PUBLISH,
    icon: StatusActiveIcon,
    label: 'ready-to-publish',
    shortLabel: 'Publish',
    hidden: true,
  },
  {
    id: LayerToolMap.ELVA_AI,
    icon: MagicIcon,
    label: 'elva-ai',
    shortLabel: 'Elva AI',
    stickyBottom: true,
  },
  // {
  //   id: LayerToolMap.LIVE_CHAT,
  //   icon: ChatIcon,
  //   label: 'live-chat',
  // },
  {
    id: LayerToolMap.TUTORIALS,
    icon: LightbulbIcon,
    label: 'Tutorials',
    shortLabel: 'Tips',
    stickyBottom: true,
  },
  // Hidden tools — available for programmatic lookup (e.g. Elements panel → Image panel)
  // but not rendered in the toolbar UI.
  { id: LayerToolMap.TEXT, icon: TextIcon, label: 'text', hidden: true },
  { id: LayerToolMap.IMAGE, icon: ImageIcon, label: 'image', hidden: true },
  { id: LayerToolMap.AI_IMAGE, icon: ImageIcon, label: 'ai-image', hidden: true },
  { id: LayerToolMap.FONT_COMBINATION, icon: TextIcon, label: 'Font combination', hidden: true },
]

type Orientation = 'vertical' | 'horizontal'

interface TemplateEditorOutlineProps {
  orientation?: Orientation
  defaultToolId?: string
  activeTool?: ILayerTool | null
  onToolSelect?: (tool: ILayerTool | LayerToolType | null) => void
  /** Dynamic panel width from calculateInspectorWidth — sets --tool-sidebar-width CSS var */
  panelWidth?: string
}

export default function TemplateEditorOutline(props: TemplateEditorOutlineProps) {
  const { validationErrors } = useContext(TemplateEditorContext)
  const {
    orientation: propOrientation,
    defaultToolId,
    activeTool: propActiveTool,
    onToolSelect: propOnToolSelect,
    panelWidth,
  } = props

  // Gate charm builder behind Growth plan — panel opens but shows upgrade banner
  const rootData = useRootLoaderData()
  const plan = (rootData?.shopData?.subscription as SubscriptionDocument)?.plan as PricingPlanDocument | undefined
  const canUseCharmBuilder = !plan || !isOrderBasedPlan(plan) || plan.features?.charmBuilder === true

  // Show warning icon on Storefront button when wizard has unassigned items
  const wizardConfig = useStore(TemplateEditorStore, state => state.wizardConfig)
  const layerStores = useStore(TemplateEditorStore, state => state.extractedLayerStores)
  const wizardHasWarning = useMemo(() => {
    if (!wizardConfig?.enabled) return false
    const layers = layerStores.map(s => s.getState()) as CollectorLayer[]
    const allItems = collectCustomizationItems(layers)
    if (allItems.length === 0) return false
    const assignedIds = new Set(wizardConfig.steps.flatMap(s => s.items.map(i => i.itemId).filter(Boolean)))
    return allItems.some(item => !assignedIds.has(item.id))
  }, [wizardConfig, layerStores])

  // Compute tools with dynamic storefront icon
  const tools = useMemo(() => {
    if (!wizardHasWarning) return LAYER_TOOLS
    return LAYER_TOOLS.map(tool =>
      tool.id === LayerToolMap.STOREFRONT ? { ...tool, icon: <Icon source={AlertCircleIcon} tone="warning" /> } : tool
    )
  }, [wizardHasWarning])

  // Manage active tool state at Navigation level (fallback when props not provided)
  const defaultTool = defaultToolId ? tools.find(t => t.id === defaultToolId) : null
  const [internalActiveTool, setInternalActiveTool] = useState<ILayerTool | null>(defaultTool || null)
  const orientation: Orientation = propOrientation || 'vertical'

  // Use provided props or internal state
  const activeTool = propActiveTool !== undefined ? propActiveTool : internalActiveTool

  const findToolById = useCallback(
    (toolId: LayerToolType) => {
      return tools.find(t => t.id === toolId) || null
    },
    [tools]
  )

  const internalHandleSetActiveTool = useCallback(
    (tool: ILayerTool | LayerToolType | null) => {
      // When tool is null (e.g. Elva AI), keep current panel — don't clear selection or change tool
      if (!tool) return

      clearAllSelectedLayerStores()

      if (Object.keys(validationErrors).length > 0) {
        const layersListingTool = findToolById(LayerToolMap.LAYERS_LISTING)
        setInternalActiveTool(layersListingTool || null)
        // Trigger shake effect on error layers in the listing
        Transmitter.trigger(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.SHAKE_VALIDATION_ERROR_LAYERS, {})
        return
      }

      if (typeof tool === 'string') {
        setInternalActiveTool(tools.find(t => t.id === tool) || null)
      } else {
        setInternalActiveTool(tool)
      }
    },
    [findToolById, validationErrors, tools]
  )

  // Use provided handler or internal handler
  const handleSetActiveTool = propOnToolSelect || internalHandleSetActiveTool

  const isHorizontal = orientation === 'horizontal'
  const showToolbar = !isHorizontal || (propActiveTool === undefined && propOnToolSelect === undefined)

  useEffect(() => {
    // Only listen to events when using internal state
    if (propActiveTool !== undefined || propOnToolSelect !== undefined) {
      return
    }

    const onToggleLayerToolPanel = (event: any) => {
      const { toolId } = event?.data
      if (toolId) {
        const tool = findToolById(toolId)
        setInternalActiveTool(tool || null)
      }
    }
    Transmitter.listen(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.TOGGLE_LAYER_TOOL_PANEL, onToggleLayerToolPanel)

    return () => {
      Transmitter.remove(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.TOGGLE_LAYER_TOOL_PANEL, onToggleLayerToolPanel)
    }
  }, [findToolById, propActiveTool, propOnToolSelect])

  return (
    <div
      className="template-outline"
      style={{
        height: '100%',
        display: 'flex',
        overflow: 'hidden',
        // Vertical with panelWidth: root = panelWidth + toolbar rail.
        // ToolSidebar (--tool-sidebar-width) = panelWidth, matching the inspector width.
        // Horizontal: use panelWidth directly (no toolbar rail alongside).
        width: panelWidth
          ? isHorizontal
            ? panelWidth
            : `calc(${panelWidth} + ${LAYER_TOOLBAR_WIDTH}px)`
          : isHorizontal
            ? '100%'
            : 'fit-content',
        flexDirection: isHorizontal ? 'column' : 'row',
        ...(panelWidth ? ({ '--tool-sidebar-width': panelWidth } as React.CSSProperties) : {}),
      }}
    >
      {/* Layer Toolbar - only show when not horizontal or when using internal state */}
      {showToolbar && (
        <LayerToolbar
          tools={tools.filter(t => !t.hidden)}
          activeTool={activeTool}
          onToolSelect={handleSetActiveTool}
          orientation={orientation}
          disabled={Object.keys(validationErrors).length > 0}
        />
      )}

      {/* Tool Sidebar / Content area */}
      {isHorizontal ? (
        <div style={{ width: '100%', flex: '1 1 auto' }}>
          <ToolSidebar
            orientation="horizontal"
            activeTool={activeTool}
            setActiveTool={handleSetActiveTool}
            onClose={() => handleSetActiveTool(null)}
            canUseCharmBuilder={canUseCharmBuilder}
          />
        </div>
      ) : (
        activeTool && (
          <ToolSidebar
            activeTool={activeTool}
            setActiveTool={handleSetActiveTool}
            onClose={() => handleSetActiveTool(null)}
            canUseCharmBuilder={canUseCharmBuilder}
          />
        )
      )}
    </div>
  )
}
