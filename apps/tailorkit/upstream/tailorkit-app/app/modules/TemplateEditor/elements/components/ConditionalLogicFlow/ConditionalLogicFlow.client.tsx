import '@xyflow/react/dist/style.css'

import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from '@xyflow/react'
import { Box, Button, InlineStack } from '@shopify/polaris'
import { PlusIcon } from '@shopify/polaris-icons'

import type { ConditionalLogicFlowProps } from './types'
import { useFlowState } from './hooks/useFlowState'
import { FlowCallbacksProvider } from './FlowCallbacksContext'
import OptionNode from './nodes/OptionNode.client'
import LayerNode from './nodes/LayerNode.client'
import styles from './styles.module.css'

/**
 * nodeTypes must be stable (defined outside render) so ReactFlow
 * does not re-register types on every render.
 */
const NODE_TYPES = {
  optionNode: OptionNode,
  layerNode: LayerNode,
}

/**
 * Inner canvas — requires ReactFlowProvider context.
 *
 * Uses useNodesState/useEdgesState to properly sync React Flow's internal state
 * with our computed nodes/edges from useFlowState. Direct prop passing doesn't
 * trigger re-renders in React Flow v12 for node data changes.
 */
function FlowCanvas({
  conditions,
  action,
  options,
  allLayers,
  controllerId,
  controllerMap,
  onSave,
  onClose,
}: ConditionalLogicFlowProps) {
  const { t } = useTranslation()
  const { fitView } = useReactFlow()

  const {
    nodes: computedNodes,
    edges: computedEdges,
    toggleExpand,
    updateCondition,
    getCondition,
    getOptions,
    addCondition,
    canAddCondition,
    serialize,
  } = useFlowState({
    conditions,
    action,
    options,
    allLayers,
    controllerId,
    controllerMap,
  })

  /**
   * React Flow managed state — synced with our computed nodes/edges.
   * This ensures React Flow properly re-renders when expand/collapse changes node data.
   */
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(computedNodes)
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(computedEdges)

  /** Sync computed nodes/edges → React Flow state whenever they change */
  useEffect(() => {
    setRfNodes(computedNodes)
  }, [computedNodes, setRfNodes])

  useEffect(() => {
    setRfEdges(computedEdges)
  }, [computedEdges, setRfEdges])

  const handleSave = useCallback(() => {
    onSave(serialize())
  }, [onSave, serialize])

  const handleFitView = useCallback(() => {
    fitView({ duration: 300, padding: 0.2 })
  }, [fitView])

  /** Expand/collapse option nodes on click */
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: { id: string; type?: string }) => {
      if (node.type === 'optionNode') {
        toggleExpand(node.id)
      }
    },
    [toggleExpand]
  )

  // No useMemo — new reference each render ensures context consumers re-render on state changes
  const flowCallbacks = {
    onUpdateCondition: updateCondition,
    onToggleExpand: toggleExpand,
    getCondition,
    getOptions,
  }

  return (
    <FlowCallbacksProvider value={flowCallbacks}>
      <div className={styles.flowContainer}>
        {/* Toolbar */}
        <Box
          padding="200"
          paddingInlineStart="400"
          paddingInlineEnd="400"
          background="bg-surface-secondary"
          borderBlockEndWidth="025"
          borderColor="border"
        >
          <InlineStack gap="200" align="end" blockAlign="center">
            <Button icon={PlusIcon} variant="plain" disabled={!canAddCondition} onClick={addCondition}>
              {t('add-condition')}
            </Button>
            <Button variant="plain" onClick={handleFitView}>
              {t('reset-view')}
            </Button>
          </InlineStack>
        </Box>

        {/* ReactFlow canvas */}
        <div className={styles.flowCanvas}>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            proOptions={{ hideAttribution: true }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            panOnDrag
            zoomOnScroll
            minZoom={0.15}
            maxZoom={2}
          >
            <Background gap={16} color="var(--p-color-border)" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        {/* Footer */}
        <Box
          padding="300"
          paddingInlineStart="500"
          paddingInlineEnd="500"
          borderBlockStartWidth="025"
          borderColor="border"
        >
          <InlineStack align="end" gap="200">
            <Button variant="plain" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button variant="primary" onClick={handleSave}>
              {t('save')}
            </Button>
          </InlineStack>
        </Box>
      </div>
    </FlowCallbacksProvider>
  )
}

/**
 * Main ReactFlow canvas for the Conditional Logic Graph.
 * Renders a recursive LR graph showing the full decision chain.
 * Wrapped in ReactFlowProvider so useReactFlow() works inside FlowCanvas.
 */
export default function ConditionalLogicFlow(props: ConditionalLogicFlowProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} />
    </ReactFlowProvider>
  )
}
