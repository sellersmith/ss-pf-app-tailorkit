import { Handle, Position, useNodeId } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { Badge, Banner, BlockStack, Button, Checkbox, Divider, Icon, InlineStack, Text } from '@shopify/polaris'
import type { IconSource } from '@shopify/polaris'
import { TextIcon, ImageIcon, HashtagIcon, LayoutBlockIcon, SkeletonIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import type { OptionNodeData } from '../types'
import type { ControlCondition } from '~/models/Layer.server'
import { useFlowCallbacks } from '../FlowCallbacksContext'
import styles from '../styles.module.css'

/** Map layer type to its Polaris icon */
const LAYER_TYPE_ICONS: Record<string, IconSource> = {
  text: TextIcon,
  image: ImageIcon,
  charm: HashtagIcon,
  'charm-node': HashtagIcon,
  'multi-layout': LayoutBlockIcon,
  imageless: SkeletonIcon,
}

/**
 * Collapsed option node — shows option name + target count badge.
 * Used for both read-only downstream nodes and clickable editable nodes.
 */
function CollapsedView({
  optionName,
  action,
  targetCount,
  isClickable,
}: {
  optionName: string
  action: 'show' | 'hide'
  targetCount: number
  isClickable: boolean
}) {
  const { t } = useTranslation()
  return (
    <div
      className={`${styles.optionNode} ${isClickable ? styles.optionNodeClickable : ''}`}
      title={isClickable ? t('click-to-edit-condition') : undefined}
    >
      <Handle type="target" position={Position.Left} />
      <InlineStack gap="200" align="start" blockAlign="center" wrap={false}>
        <Badge tone="info" size="small">
          {t('when')}
        </Badge>
        <Text variant="bodyMd" fontWeight="semibold" as="span" truncate>
          {optionName}
        </Text>
        <Badge tone={action === 'show' ? 'success' : 'warning'}>
          {`${targetCount} ${action === 'show' ? t('visible') : t('hidden')}`}
        </Badge>
      </InlineStack>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

/**
 * OptionNode — represents a single option (e.g. "Small", "Large") in the graph.
 *
 * Dedup filtering (availableLayers) is pre-computed in buildGraph and passed via node data.
 * Condition state is read from FlowCallbacksContext (via refs for latest state).
 */
function OptionNode({ data }: NodeProps) {
  const { t } = useTranslation()
  const nodeId = useNodeId() ?? 'option'
  const { onUpdateCondition, onToggleExpand, getCondition, getOptions } = useFlowCallbacks()

  const { controllerId, conditionIndex, action, expanded, availableLayers } = data as unknown as OptionNodeData

  // Read condition and options from context (via refs — always latest state)
  const condition = getCondition(controllerId, conditionIndex ?? 0)
  const controllerOptions = getOptions(controllerId)
  const optionInfo = controllerOptions.find(o => o._id === condition?.ifOptionSelected)
  const optionName = optionInfo?.name ?? condition?.ifOptionSelected ?? '?'
  const targetCount = condition?.thenShowOrHideLayers?.length ?? 0

  // ── Collapsed view (clickable to expand) ──────────────────────────────────
  if (!expanded) {
    return <CollapsedView optionName={optionName} action={action} targetCount={targetCount} isClickable />
  }

  // ── Expanded editable view ──────────────────────────────────────────────────
  if (!condition || conditionIndex === undefined) {
    return null
  }

  function handleToggleLayer(layerId: string, checked: boolean) {
    if (conditionIndex === undefined) return
    // Read LATEST condition from ref to avoid stale closure when toggling rapidly
    const latest = getCondition(controllerId, conditionIndex)
    if (!latest) return
    const currentLayers = latest.thenShowOrHideLayers ?? []
    const updated: ControlCondition = {
      ...latest,
      thenShowOrHideLayers: checked ? [...currentLayers, layerId] : currentLayers.filter(id => id !== layerId),
    }
    onUpdateCondition(controllerId, conditionIndex, updated)
  }

  // Use pre-filtered layers from node data (computed in buildGraph with cross-controller dedup)
  const visibleLayers = availableLayers ?? []

  const dividerLabel = action === 'show' ? t('these-layers-become-visible') : t('these-layers-become-hidden')

  const bannerText = action === 'show' ? t('unchecked-layers-will-be-hidden') : t('unchecked-layers-will-stay-visible')

  return (
    <div className={styles.optionNodeExpanded} onClick={e => e.stopPropagation()}>
      <Handle type="target" position={Position.Left} />

      <div className="nodrag nowheel" onClick={e => e.stopPropagation()}>
        <Text variant="bodyMd" fontWeight="semibold" as="p">
          {t('when-optionname-is-selected', { optionName })}
        </Text>
      </div>

      <Divider />

      <Text variant="bodySm" fontWeight="bold" as="p">
        {dividerLabel}
      </Text>

      {/* Scrollable checkbox list — pre-filtered to exclude layers used by other conditions */}
      <div className={`nodrag nowheel ${styles.checkboxListScrollable}`} onClick={e => e.stopPropagation()}>
        <BlockStack gap="200">
          {visibleLayers.map(layer => (
            <Checkbox
              key={layer._id}
              label={
                <InlineStack gap="100" blockAlign="center" wrap={false}>
                  <Icon source={LAYER_TYPE_ICONS[layer.type ?? ''] ?? ImageIcon} tone="subdued" />
                  <Text variant="bodySm" as="span">
                    {layer.label}
                  </Text>
                </InlineStack>
              }
              checked={condition.thenShowOrHideLayers?.includes(layer._id) ?? false}
              onChange={checked => handleToggleLayer(layer._id, checked)}
            />
          ))}
        </BlockStack>
      </div>

      <div className="nodrag nowheel" onClick={e => e.stopPropagation()}>
        <Banner tone="info">
          <Text variant="bodySm" as="p">
            {bannerText}
          </Text>
        </Banner>
      </div>

      <div
        className="nodrag nowheel"
        onClick={e => e.stopPropagation()}
        style={{ display: 'flex', justifyContent: 'flex-end' }}
      >
        <Button variant="plain" onClick={() => onToggleExpand(nodeId)}>
          {t('done')}
        </Button>
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  )
}

export default OptionNode
