import { BlockStack, Box, Button, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { useCallback, useMemo, Fragment } from 'react'
import { LayerToolMap, type LayerToolType } from './constants'
import styles from './styles.module.css'
import { useChatBot } from '~/providers/ChatBotContext'
import { useLiveChat } from '~/utils/hooks/useLiveChat'
import { getTemplateEnvAdapter } from '~/stores/modules/template/env-adapter'
import { useVariantSelectionModal } from '~/modules/ProductEditor/hooks'
import { useLayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { IndicatorIcon } from '~/assets/icons'
import { useStore } from '~/libs/external-store'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { TemplateEditorStore } from '~/stores/modules/template'
import type { Template } from '~/types/psd'
import type { VariantIntegration, PrintArea } from '~/types/integration'
import { isTemporaryVariant } from '~/utils/integration/temporaryProduct'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'

/** Module-level set persists across component remounts — deduplicates charm discovery per session */
const sessionDiscoveredFeatures = new Set<string>()

export interface ILayerTool {
  id: LayerToolType
  icon: any
  label: string
  /** Short noun label (max 2 words) shown below icon on desktop toolbar */
  shortLabel?: string
  tooltip?: string
  dividerAfter?: boolean
  group?: string
  /** Hidden tools are available for programmatic lookup but not rendered in the toolbar */
  hidden?: boolean
  /** Stick tool to the bottom of the vertical toolbar (desktop only) */
  stickyBottom?: boolean
}

interface ILayerToolbarProps {
  tools: ILayerTool[]
  activeTool: ILayerTool | null
  onToolSelect: (tool: ILayerTool | LayerToolType | null) => void
  /** Orientation of the toolbar. Vertical (left rail) for desktop, horizontal for mdDown */
  orientation?: 'vertical' | 'horizontal'
  scrollable?: boolean
  groupable?: boolean
  /** Disable all toolbar interactions (e.g., during multilayout creation) */
  disabled?: boolean
}

export default function LayerToolbar(props: ILayerToolbarProps) {
  const {
    tools,
    activeTool,
    onToolSelect,
    orientation = 'vertical',
    scrollable = true,
    groupable = true,
    disabled = false,
  } = props
  const { clickedLayerStore, checkedLayerStores } = useLayerStoreSelection()
  const { toggleChatBot } = useChatBot()
  const { openChatBox } = useLiveChat()
  const { t } = useTranslation()
  const { openVariantSelector } = useVariantSelectionModal()
  const { trackDiscovered } = useFeatureTracking('charm_builder')

  // Check if any template in the integration has layers
  // Combine both current template (real-time) and other templates
  const variants = useStore(IntegrationStore, state => state.variants)
  const extractedLayerStores = useStore(TemplateEditorStore, state => state.extractedLayerStores)
  const currentTemplateId = useStore(TemplateEditorStore, state => state._id)

  /**
   * Check if any template in the integration has layers.
   * - Current template: checked via extractedLayerStores (real-time)
   * - Other templates: checked via template.layers (persistent state)
   * - Excludes current template from variants check to avoid stale data
   */
  const hasLayers = useMemo(() => {
    // Check current template being edited (real-time updates)
    const currentTemplateHasLayers = extractedLayerStores && extractedLayerStores.length > 0

    // Check other templates in integration (excluding current template)
    if (!variants || variants.length === 0) return currentTemplateHasLayers

    const otherTemplatesHaveLayers = variants.some((variant: VariantIntegration) =>
      variant.printAreas?.some((printArea: PrintArea) => {
        const template = printArea.template as Template | null | undefined

        // Skip if no template or template is just an ID string
        if (!template || typeof template !== 'object') return false

        // Skip current template being edited (already checked via extractedLayerStores)
        if (template._id === currentTemplateId) return false

        // Check if this other template has layers
        return template.layers && template.layers.length > 0
      })
    )

    return currentTemplateHasLayers || otherTemplatesHaveLayers
  }, [variants, extractedLayerStores, currentTemplateId])

  // Detect temporary products
  const isTemporaryProduct = useMemo(() => {
    if (!variants || variants.length === 0) return false
    const firstVariant = variants[0]
    return isTemporaryVariant(firstVariant?.id ?? '')
  }, [variants])

  const handleToolClick = useCallback(
    (toolId: LayerToolType) => {
      const realTool: ILayerTool | undefined = typeof toolId !== 'string' ? toolId : tools.find(t => t.id === toolId)

      if (!realTool) {
        onToolSelect(null)
        return
      }

      switch (realTool.id) {
        case LayerToolMap.ELVA_AI: {
          onToolSelect(null)
          toggleChatBot(true)
          break
        }
        case LayerToolMap.LIVE_CHAT: {
          openChatBox()
          break
        }
        case LayerToolMap.CHANGE_VARIANT: {
          // Block if product is temporary
          if (isTemporaryProduct) {
            return
          }
          // Only available in unified editor
          const env = getTemplateEnvAdapter()
          if (env) {
            onToolSelect(realTool)
            openVariantSelector()
          }
          break
        }
        default: {
          onToolSelect(realTool)
          toggleChatBot(false)
          if (realTool.id === LayerToolMap.CHARM_BUILDER && !sessionDiscoveredFeatures.has('charm_builder')) {
            sessionDiscoveredFeatures.add('charm_builder')
            trackDiscovered('charm_builder_tool_panel')
          }
          break
        }
      }
    },
    [onToolSelect, openChatBox, toggleChatBot, tools, openVariantSelector, isTemporaryProduct, trackDiscovered]
  )

  // Group consecutive tools with the same group value
  const buildGroupedTools = useCallback((toolList: ILayerTool[]) => {
    const groups: Array<{ group: string | null; tools: ILayerTool[] }> = []
    let currentGroup: { group: string; tools: ILayerTool[] } | null = null

    for (const tool of toolList) {
      if (tool.group) {
        if (currentGroup && currentGroup.group === tool.group) {
          currentGroup.tools.push(tool)
        } else {
          currentGroup = { group: tool.group, tools: [tool] }
          groups.push(currentGroup)
        }
      } else {
        if (currentGroup) {
          currentGroup = null
        }
        groups.push({ group: null, tools: [tool] })
      }
    }

    return groups
  }, [])

  const isVertical = orientation !== 'horizontal'

  // Split tools into main (top) and stickyBottom (bottom) for vertical desktop layout
  const mainTools = useMemo(() => tools.filter(t => !t.stickyBottom), [tools])
  const bottomTools = useMemo(() => tools.filter(t => t.stickyBottom), [tools])

  // For horizontal (mobile): all tools together. For vertical (desktop): split main/bottom.
  const groupedTools = useMemo(
    () => buildGroupedTools(isVertical ? mainTools : tools),
    [buildGroupedTools, isVertical, mainTools, tools]
  )
  const groupedBottomTools = useMemo(
    () => (isVertical && bottomTools.length > 0 ? buildGroupedTools(bottomTools) : []),
    [buildGroupedTools, isVertical, bottomTools]
  )

  const renderTool = (tool: ILayerTool) => {
    // Check if this is the Change Variant tool and product is temporary
    const isChangeVariantTool = tool.id === LayerToolMap.CHANGE_VARIANT
    const shouldDisable = isChangeVariantTool && isTemporaryProduct
    const isActive = (!clickedLayerStore || checkedLayerStores.length > 0) && activeTool?.id === tool.id

    return (
      <BlockStack gap="050" key={tool.id} inlineAlign="center">
        {/* Entire area (icon + label) is clickable */}
        <div
          onClick={shouldDisable ? undefined : () => handleToolClick(tool.id)}
          style={{ cursor: shouldDisable ? 'not-allowed' : 'pointer', width: '100%', textAlign: 'center' }}
        >
          <div className={tool.id === LayerToolMap.READY_TO_PUBLISH ? styles.toolButtonWithIndicator : undefined}>
            <Button
              id={tool.id === LayerToolMap.ELEMENTS ? 'elements-button' : `add-${tool.id}-button`}
              variant="tertiary"
              icon={tool.icon}
              pressed={isActive}
              size="micro"
              aria-selected={isActive}
              disabled={shouldDisable}
            />
            {tool.id === LayerToolMap.READY_TO_PUBLISH && hasLayers && (
              <div className={styles.indicatorBadge}>
                <IndicatorIcon width={8} height={8} fill="#00A947" stroke="white" />
              </div>
            )}
          </div>
          {isVertical && tool.shortLabel && (
            <Text
              as="span"
              variant="bodySm"
              alignment="center"
              tone={isActive ? undefined : 'subdued'}
              fontWeight={isActive ? 'semibold' : 'regular'}
              truncate
            >
              {t(tool.shortLabel)}
            </Text>
          )}
        </div>
        {tool.dividerAfter && isVertical && (
          <Box borderBlockStartWidth="025" borderColor="border" width="calc(100% + 16px)" />
        )}
      </BlockStack>
    )
  }

  return (
    <div
      id="layer-toolbar-container"
      className={[
        styles.layerToolbar,
        orientation === 'horizontal' ? styles.horizontal : '',
        disabled ? styles.disabled : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        ...(!scrollable ? { border: 'unset' } : {}),
      }}
    >
      <div
        className={
          orientation === 'horizontal'
            ? `${styles.toolbarContent} ${styles.toolbarContentHorizontal}`
            : styles.toolbarContent
        }
        style={{
          ...(!scrollable
            ? {
                overflowX: 'unset',
                overflowY: 'unset',
                scrollSnapType: 'unset',
                scrollbarWidth: 'unset',
                justifyContent: 'space-between',
              }
            : {}),
        }}
      >
        {groupedTools.map((group, groupIndex) => {
          if (group.group && groupable) {
            // Render grouped tools wrapped in a container
            return (
              <div
                className={
                  orientation === 'horizontal'
                    ? `${styles.toolbarContent} ${styles.toolbarContentHorizontal}`
                    : styles.toolbarContent
                }
                style={{
                  ...(orientation === 'vertical'
                    ? { height: 'fit-content', padding: 0 }
                    : {
                        overflowX: 'unset',
                        overflowY: 'unset',
                        scrollSnapType: 'unset',
                        scrollbarWidth: 'unset',
                        padding: '0',
                        gap: '12px',
                      }),
                }}
                key={`group-${group.group}-${groupIndex}`}
                id={`layer-tools-${group.group}`}
              >
                {group.tools.map(tool => renderTool(tool))}
              </div>
            )
          }
          // Render standalone tools
          return <Fragment key={`standalone-${groupIndex}`}>{group.tools.map(tool => renderTool(tool))}</Fragment>
        })}
      </div>

      {/* Bottom-pinned tools (desktop vertical only) */}
      {groupedBottomTools.length > 0 && (
        <div className={styles.toolbarBottomSection}>
          {groupedBottomTools.map((group, groupIndex) => group.tools.map(tool => renderTool(tool)))}
        </div>
      )}
    </div>
  )
}
