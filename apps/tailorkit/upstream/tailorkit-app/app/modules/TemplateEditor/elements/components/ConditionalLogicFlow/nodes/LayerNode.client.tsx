import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { Badge, InlineStack, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import type { LayerNodeData } from '../types'
import styles from '../styles.module.css'

/**
 * LayerNode — represents a target layer in the recursive graph.
 *
 * - Always read-only (no interactive editing)
 * - Color-coded border: green for "show", red/orange for "hide", gray for "unaffected"
 * - If `isController`: shows "CONTROLLER" badge + source Handle on right for its options
 * - If leaf: no source Handle
 *
 * Has a target Handle on the left for incoming edges from OptionNodes.
 */
function LayerNode({ data }: NodeProps) {
  const { t } = useTranslation()
  const { layerLabel, isController, visibility } = data as unknown as LayerNodeData

  const visibilityClass
    = visibility === 'show' ? styles.layerNodeShow : visibility === 'hide' ? styles.layerNodeHide : ''

  const controllerClass = isController ? styles.layerNodeController : ''

  return (
    <div className={`${styles.layerNode} ${visibilityClass} ${controllerClass}`}>
      <Handle type="target" position={Position.Left} />

      <InlineStack gap="200" blockAlign="center" wrap={false}>
        {/* Visibility dot */}
        <span
          className={
            visibility === 'show'
              ? styles.visibilityDotGreen
              : visibility === 'hide'
                ? styles.visibilityDotRed
                : styles.visibilityDotGray
          }
        />

        <Text variant="bodyMd" fontWeight="semibold" as="span" truncate>
          {layerLabel}
        </Text>

        {isController && (
          <Badge tone="magic" size="small">
            {t('controller')}
          </Badge>
        )}
      </InlineStack>

      {/* Source handle only if this layer is itself a controller */}
      {isController && <Handle type="source" position={Position.Right} />}
    </div>
  )
}

export default memo(LayerNode)
