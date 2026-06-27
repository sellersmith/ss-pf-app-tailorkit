import { Banner, BlockStack, Box, Button, Divider, Icon, InlineStack, Text } from '@shopify/polaris'
import { XIcon, PlusIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import TextToolPanel from './panels/TextToolPanel'
import ImageToolPanel from './panels/ImageToolPanel'
import ClipartToolPanel from './panels/ClipartToolPanel'
import AIImageToolPanel from './panels/AIImageToolPanel'
import ReadyToPublishPanel from './panels/ReadyToPublishPanel'
import StorefrontToolPanel from './panels/StorefrontToolPanel'
import styles from './styles.module.css'
import type { ILayerTool } from '../LayerToolbar'
import LayersListingToolPanel from './panels/LayersListingToolPanel'
import MoreToolsPanel from './panels/MoreToolsPanel'
import type { LayerToolType } from '../LayerToolbar/constants'
import { LayerToolMap } from '../LayerToolbar/constants'
import TutorialsToolPanel from './panels/TutorialsToolPanel'
import useDevices from '~/utils/hooks/useDevice'
import VariantsSelectorToolPanel from './panels/VariantsSelectorToolPanel'
import CharmBuilderToolPanel from './panels/CharmBuilderToolPanel'
import { useNavigateAppBridge } from '~/bootstrap/hooks/useNavigateAppBridge'
import ElementsToolPanel from './panels/ElementsToolPanel'
import FontCombinationToolPanel from './panels/FontCombinationToolPanel'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'
import { useStore } from '~/libs/external-store'
import { TemplateEditorStore } from '~/stores/modules/template'
import { ELayerType } from '~/types/psd'
import type { TLayerStore } from '~/stores/modules/layer'
import { useElementActions } from '../../Editor/hooks/useElementActions'

interface IToolSidebarProps {
  activeTool: ILayerTool | null
  setActiveTool: (tool: ILayerTool | LayerToolType | null) => void
  onClose: () => void
  /** Orientation: vertical (left rail) or horizontal (mdDown). Default vertical. */
  orientation?: 'vertical' | 'horizontal'
  /** Whether the current shop can use the Charm Builder feature (plan-gated) */
  canUseCharmBuilder?: boolean
}

interface IPanelContent {
  content: ReactNode
  footer?: ReactNode
}

/** Deduplicates upgrade wall tracking per session (module-level, survives remounts) */
let sessionUpgradeWallTracked = false

/** Tracks upgrade wall impression once per session when charm builder panel opens for non-eligible plans */
function CharmUpgradeWall({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation()
  const { trackAction } = useFeatureTracking('charm_builder')

  useEffect(() => {
    if (!sessionUpgradeWallTracked) {
      sessionUpgradeWallTracked = true
      trackAction('upgrade_wall_shown')
    }
  }, [trackAction])

  return (
    <Box padding="400">
      <BlockStack gap="400">
        <Banner tone="warning">
          <BlockStack gap="200">
            <Text as="p" variant="bodyMd">
              {t('charm-builder-is-available-on-growth-plan-and-above')}
            </Text>
            <Button variant="primary" onClick={onNavigate}>
              {t('view-plans')}
            </Button>
          </BlockStack>
        </Banner>
      </BlockStack>
    </Box>
  )
}

/**
 * Toolbar-tab content for the Charm Builder tool.
 * - 0 nodes: CharmBuilderToolPanel auto-creates one on first interaction.
 * - 1 node: Shows CharmBuilderToolPanel for that single node (no charmNodeId needed — panel finds it).
 * - 2+ nodes: Shows a node-picker list so merchant can choose which node to edit.
 */
function CharmBuilderTabContent() {
  const { t } = useTranslation()
  const extractedLayerStores = useStore(TemplateEditorStore, s => s.extractedLayerStores)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const { addElements } = useElementActions()

  const charmNodeStores = extractedLayerStores.filter((s: TLayerStore) => s.getState().type === ELayerType.CHARM_NODE)

  const handleAddCharmBuilder = () => {
    addElements(ELayerType.CHARM_NODE)
  }

  // 0 or 1 node: single-panel mode with "Add" button
  if (charmNodeStores.length <= 1) {
    return (
      <BlockStack gap="0">
        <CharmBuilderToolPanel />
        <Box padding="400">
          <Button icon={PlusIcon} variant="plain" onClick={handleAddCharmBuilder}>
            {t('add-charm-builder')}
          </Button>
        </Box>
      </BlockStack>
    )
  }

  // 2+ nodes: if user selected one, show its panel with a "back" button
  if (selectedNodeId) {
    return (
      <BlockStack gap="0">
        <Box paddingInline="400" paddingBlock="300" borderBlockEndWidth="025" borderColor="border">
          <Button variant="plain" onClick={() => setSelectedNodeId(null)}>
            {t('all-charm-builders')}
          </Button>
        </Box>
        <CharmBuilderToolPanel charmNodeId={selectedNodeId} />
      </BlockStack>
    )
  }

  // Show the list of charm nodes to pick from
  return (
    <Box padding="400">
      <BlockStack gap="300">
        <Text as="p" variant="bodyMd" tone="subdued">
          {t('select-a-charm-builder-to-edit')}
        </Text>
        <Divider />
        {charmNodeStores.map((store: TLayerStore) => {
          const state = store.getState()
          return (
            <Button key={state._id} variant="plain" textAlign="left" onClick={() => setSelectedNodeId(state._id)}>
              {state.label || t('charm-builder')}
            </Button>
          )
        })}
        <Divider />
        <Button icon={PlusIcon} variant="plain" onClick={handleAddCharmBuilder}>
          {t('add-charm-builder')}
        </Button>
      </BlockStack>
    </Box>
  )
}

export default function ToolSidebar(props: IToolSidebarProps) {
  const { activeTool, setActiveTool, onClose, orientation = 'vertical', canUseCharmBuilder = true } = props
  const { t } = useTranslation()
  const contentRef = useRef<HTMLDivElement>(null)
  const { isMobileView } = useDevices()
  const navigate = useNavigateAppBridge()

  if (!activeTool) {
    return (
      <Box padding="400">
        <Text as="p" variant="bodyMd" tone="subdued">
          {t('start-by-adding-an-element')}
        </Text>
      </Box>
    )
  }

  const getToolTitle = (): string => {
    return activeTool?.label ? t(activeTool?.label) : ''
  }

  const renderToolPanel = (): IPanelContent => {
    switch (activeTool?.id) {
      case LayerToolMap.ELEMENTS:
        return { content: <ElementsToolPanel setActiveTool={setActiveTool} /> }
      case LayerToolMap.TEXT:
        return { content: <TextToolPanel /> }
      case LayerToolMap.FONT_COMBINATION:
        return { content: <FontCombinationToolPanel /> }
      case LayerToolMap.IMAGE:
        return { content: <ImageToolPanel onClose={onClose} /> }
      case LayerToolMap.CLIPART:
        return { content: <ClipartToolPanel /> }
      case LayerToolMap.AI_IMAGE:
        return { content: <AIImageToolPanel /> }
      case LayerToolMap.LAYERS_LISTING:
        return { content: <LayersListingToolPanel /> }
      case LayerToolMap.MORE_ELEMENTS:
        return { content: <MoreToolsPanel setActiveTool={setActiveTool} /> }
      case LayerToolMap.READY_TO_PUBLISH:
        return { content: <ReadyToPublishPanel /> }
      case LayerToolMap.STOREFRONT:
        return { content: <StorefrontToolPanel /> }
      case LayerToolMap.TUTORIALS:
        return { content: <TutorialsToolPanel /> }
      case LayerToolMap.CHANGE_VARIANT:
        return { content: <VariantsSelectorToolPanel /> }
      case LayerToolMap.CHARM_BUILDER:
        if (!canUseCharmBuilder) {
          return {
            content: <CharmUpgradeWall onNavigate={() => navigate('/pricing')} />,
          }
        }
        return { content: <CharmBuilderTabContent /> }
      default:
        return {
          content: (
            <Box padding="400">
              <Text as="p" variant="bodyMd" tone="subdued">
                {t('start-by-adding-an-element')}
              </Text>
            </Box>
          ),
        }
    }
  }

  const panelContent = renderToolPanel()

  const isHorizontal = orientation === 'horizontal'

  const containerClassName = isHorizontal
    ? `${styles.toolSidebar} ${styles.horizontal}${isMobileView ? ` ${styles.mobileNoSticky}` : ''}`
    : styles.toolSidebar

  return (
    <div id="tool-sidebar" className={containerClassName}>
      {/* Header */}
      {!isMobileView && (
        <div className={isHorizontal ? `${styles.header} ${styles.headerHorizontal}` : styles.header}>
          <Box paddingBlock="300" paddingInline="400" borderBlockEndWidth="025" borderColor="border">
            {/* Desktop (vertical): no close button — left panel always visible.
                Mobile/tablet (horizontal): keep close button to dismiss bottom sheet panel. */}
            {isHorizontal ? (
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h3" variant="bodyMd" fontWeight="semibold">
                  {getToolTitle()}
                </Text>
                <Button variant="tertiary" icon={<Icon source={XIcon} />} onClick={onClose} size="slim" />
              </InlineStack>
            ) : (
              <Text as="h3" variant="bodyMd" fontWeight="semibold">
                {getToolTitle()}
              </Text>
            )}
          </Box>
        </div>
      )}

      {/* Content */}
      <div
        ref={contentRef}
        className={
          panelContent.footer
            ? `${isHorizontal ? styles.contentHorizontal : styles.content} ${styles.contentWithFooter}`
            : isHorizontal
              ? styles.contentHorizontal
              : styles.content
        }
      >
        {panelContent.content}
      </div>

      {/* Footer (if provided) */}
      {panelContent.footer && (
        <div className={isHorizontal ? `${styles.footer} ${styles.footerHorizontal}` : styles.footer}>
          <Box paddingBlock="300" paddingInline="400" borderBlockStartWidth="025" borderColor="border">
            {panelContent.footer}
          </Box>
        </div>
      )}
    </div>
  )
}
