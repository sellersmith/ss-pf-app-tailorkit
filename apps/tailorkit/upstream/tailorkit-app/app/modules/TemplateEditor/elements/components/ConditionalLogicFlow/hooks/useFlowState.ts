import { useState, useCallback, useMemo, useRef } from 'react'
import type { Node, Edge } from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import type { ControlCondition } from '~/models/Layer.server'
import type { OptionNodeData, LayerNodeData, ControllerMap } from '../types'

/** Node dimensions used by dagre layout */
const OPTION_NODE_W = 320
const OPTION_NODE_H = 48
const OPTION_NODE_EXPANDED_H = 420
const LAYER_NODE_W = 220
const LAYER_NODE_H = 48
const DAGRE_RANKSEP = 80
const DAGRE_NODESEP = 32
const MAX_DEPTH = 3

type UseFlowStateProps = {
  conditions: ControlCondition[]
  action: 'show' | 'hide'
  options: { _id: string; name: string }[]
  allLayers: { _id: string; label: string }[]
  controllerId: string
  controllerMap: ControllerMap
}

/** Per-controller local state for conditions */
type ControllerState = {
  action: 'show' | 'hide'
  conditions: ControlCondition[]
  options: { _id: string; name: string }[]
}

type UseFlowStateReturn = {
  nodes: Node[]
  edges: Edge[]
  expandedNodeId: string | null
  toggleExpand: (nodeId: string) => void
  updateCondition: (controllerId: string, index: number, condition: ControlCondition) => void
  getCondition: (controllerId: string, index: number) => ControlCondition | undefined
  getOptions: (controllerId: string) => { _id: string; name: string }[]
  addCondition: () => void
  canAddCondition: boolean
  serialize: () => { controllerId: string; action: 'show' | 'hide'; conditions: ControlCondition[] }[]
}

/** Apply dagre LR layout */
function applyDagreLayout(rawNodes: Node[], rawEdges: Edge[], expandedNodeId: string | null): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', ranksep: DAGRE_RANKSEP, nodesep: DAGRE_NODESEP, marginx: 40, marginy: 40 })

  rawNodes.forEach(node => {
    const isExpanded = node.type === 'optionNode' && node.id === expandedNodeId
    const w = node.type === 'layerNode' ? LAYER_NODE_W : OPTION_NODE_W
    const h = isExpanded ? OPTION_NODE_EXPANDED_H : node.type === 'layerNode' ? LAYER_NODE_H : OPTION_NODE_H
    g.setNode(node.id, { width: w, height: h })
  })

  rawEdges.forEach(edge => g.setEdge(edge.source, edge.target))
  dagre.layout(g)

  return rawNodes.map(node => {
    const pos = g.node(node.id)
    if (!pos) return node
    const isExpanded = node.type === 'optionNode' && node.id === expandedNodeId
    const w = node.type === 'layerNode' ? LAYER_NODE_W : OPTION_NODE_W
    const h = isExpanded ? OPTION_NODE_EXPANDED_H : node.type === 'layerNode' ? LAYER_NODE_H : OPTION_NODE_H
    return { ...node, position: { x: pos.x - w / 2, y: pos.y - h / 2 } }
  })
}

/**
 * Recursively builds graph nodes and edges. ALL option nodes are editable.
 */
function buildGraph(params: {
  controllerId: string
  conditions: ControlCondition[]
  action: 'show' | 'hide'
  options: { _id: string; name: string }[]
  allLayers: { _id: string; label: string }[]
  controllerMap: ControllerMap
  expandedNodeId: string | null
  visitedControllers: Set<string>
  depth: number
  nodeIdPrefix: string
  globalUsedLayerIds: Set<string>
}): { nodes: Node[]; edges: Edge[] } {
  const {
    controllerId,
    conditions,
    action,
    allLayers,
    controllerMap,
    expandedNodeId,
    visitedControllers,
    depth,
    nodeIdPrefix,
    globalUsedLayerIds,
  } = params
  const nodes: Node[] = []
  const edges: Edge[] = []

  if (depth > MAX_DEPTH) return { nodes, edges }

  conditions.forEach((condition, condIndex) => {
    const optNodeId = `${nodeIdPrefix}opt-${condIndex}`
    const isExpanded = expandedNodeId === optNodeId

    // Cross-controller dedup: exclude layers used by ANY condition in ANY controller
    const conditionLayers = condition.thenShowOrHideLayers ?? []
    const availableLayers = allLayers.filter(l => conditionLayers.includes(l._id) || !globalUsedLayerIds.has(l._id))

    const optionData: OptionNodeData = {
      type: 'option',
      controllerId,
      action,
      conditionIndex: condIndex,
      availableLayers,
      expanded: isExpanded,
    }

    nodes.push({
      id: optNodeId,
      type: 'optionNode',
      position: { x: 0, y: 0 },
      data: optionData as unknown as Record<string, unknown>,
      draggable: false,
    })

    // Target layers
    conditionLayers.forEach((targetLayerId, layerIdx) => {
      const layerInfo = allLayers.find(l => l._id === targetLayerId)
      const layerLabel = layerInfo?.label ?? targetLayerId
      const isLayerController = Boolean(controllerMap[targetLayerId])
      const layNodeId = `${nodeIdPrefix}lay-${condIndex}-${layerIdx}`

      const layerData: LayerNodeData = {
        type: 'layer',
        layerId: targetLayerId,
        layerLabel,
        isController: isLayerController,
        visibility: action,
      }

      nodes.push({
        id: layNodeId,
        type: 'layerNode',
        position: { x: 0, y: 0 },
        data: layerData as unknown as Record<string, unknown>,
        draggable: false,
      })

      const edgeColor = action === 'show' ? 'var(--p-color-border-success)' : 'var(--p-color-border-caution)'
      edges.push({
        id: `${optNodeId}-to-${layNodeId}`,
        source: optNodeId,
        target: layNodeId,
        type: 'smoothstep',
        label: action === 'show' ? 'show' : 'hide',
        style: { stroke: edgeColor },
        labelStyle: { fill: edgeColor, fontWeight: 600, fontSize: 10 },
        labelBgStyle: { fill: 'var(--p-color-bg-surface)', fillOpacity: 0.85 },
      })

      // Recurse into downstream controllers
      if (isLayerController && !visitedControllers.has(targetLayerId) && depth < MAX_DEPTH) {
        const downstream = controllerMap[targetLayerId]
        const newVisited = new Set(visitedControllers)
        newVisited.add(targetLayerId)
        newVisited.add(controllerId)

        const childPrefix = `${nodeIdPrefix}d${depth + 1}-${targetLayerId.slice(-6)}-`
        const childResult = buildGraph({
          controllerId: targetLayerId,
          conditions: downstream.conditions,
          action: downstream.action,
          options: downstream.options,
          allLayers,
          controllerMap,
          expandedNodeId,
          visitedControllers: newVisited,
          depth: depth + 1,
          nodeIdPrefix: childPrefix,
          globalUsedLayerIds,
        })

        nodes.push(...childResult.nodes)
        edges.push(...childResult.edges)

        // Connect layer → downstream option nodes
        childResult.nodes
          .filter(n => n.type === 'optionNode' && n.id.startsWith(childPrefix))
          .forEach(childOptNode => {
            edges.push({
              id: `${layNodeId}-to-${childOptNode.id}`,
              source: layNodeId,
              target: childOptNode.id,
              type: 'smoothstep',
              style: { stroke: 'var(--p-color-border-magic)', strokeDasharray: '4 3' },
            })
          })
      }
    })
  })

  return { nodes, edges }
}

/**
 * Manages ReactFlow nodes/edges for the Conditional Logic Graph.
 * ALL option nodes are editable — tracks state per controller.
 */
export function useFlowState({
  conditions: initialConditions,
  action: initialAction,
  options,
  allLayers,
  controllerId,
  controllerMap,
}: UseFlowStateProps): UseFlowStateReturn {
  /**
   * Per-controller state. Keyed by controllerId.
   * Root controller initialized from props, downstream initialized from controllerMap.
   */
  const [controllerStates, setControllerStates] = useState<Record<string, ControllerState>>(() => {
    const initial: Record<string, ControllerState> = {}

    // Root controller
    initial[controllerId] = {
      action: initialAction,
      conditions:
        initialConditions.length > 0
          ? initialConditions
          : [{ ifOptionSelected: options[0]?._id || '', thenShowOrHideLayers: [] }],
      options,
    }

    // Downstream controllers from controllerMap
    Object.entries(controllerMap).forEach(([id, data]) => {
      initial[id] = {
        action: data.action,
        conditions: data.conditions,
        options: data.options,
      }
    })

    return initial
  })

  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null)

  const rootState = controllerStates[controllerId]

  /** Ref holds LATEST state — context getters read from this, bypassing React Flow data pipeline */
  const controllerStatesRef = useRef(controllerStates)
  controllerStatesRef.current = controllerStates

  const toggleExpand = useCallback((nodeId: string) => {
    setExpandedNodeId(prev => (prev === nodeId ? null : nodeId))
  }, [])

  /** Get a single condition — latest state via ref */
  const getCondition = useCallback((targetControllerId: string, index: number): ControlCondition | undefined => {
    return controllerStatesRef.current[targetControllerId]?.conditions[index]
  }, [])

  /** Get options for a controller — latest via ref */
  const getOptions = useCallback((targetControllerId: string): { _id: string; name: string }[] => {
    return controllerStatesRef.current[targetControllerId]?.options ?? []
  }, [])

  /** Update a condition for any controller */
  const updateCondition = useCallback((targetControllerId: string, index: number, condition: ControlCondition) => {
    setControllerStates(prev => {
      const controllerState = prev[targetControllerId]
      if (!controllerState) return prev
      const newConditions = [...controllerState.conditions]
      newConditions[index] = condition
      return { ...prev, [targetControllerId]: { ...controllerState, conditions: newConditions } }
    })
  }, [])

  const usedIds = useMemo(
    () => new Set(rootState.conditions.map(c => c.ifOptionSelected).filter(Boolean)),
    [rootState.conditions]
  )

  const canAddCondition = useMemo(
    () => rootState.conditions.length < options.length && options.some(o => !usedIds.has(o._id)),
    [rootState.conditions.length, options, usedIds]
  )

  const addCondition = useCallback(() => {
    const nextOption = options.find(o => !usedIds.has(o._id))
    const newIndex = rootState.conditions.length
    setControllerStates(prev => {
      const current = prev[controllerId]
      const newConditions = [
        ...current.conditions,
        { ifOptionSelected: nextOption?._id || '', thenShowOrHideLayers: [] },
      ]
      return { ...prev, [controllerId]: { ...current, conditions: newConditions } }
    })
    setExpandedNodeId(`opt-${newIndex}`)
  }, [controllerId, options, usedIds, rootState.conditions.length])

  /** Build the graph using current local state for ALL controllers */
  const { nodes, edges } = useMemo<{ nodes: Node[]; edges: Edge[] }>(() => {
    const visitedControllers = new Set<string>([controllerId])

    // Build a live controllerMap that uses local state
    const liveControllerMap: ControllerMap = {}
    Object.entries(controllerStates).forEach(([id, state]) => {
      if (id !== controllerId) {
        const controlledIds = new Set<string>()
        state.conditions.forEach(c => c.thenShowOrHideLayers?.forEach(lid => controlledIds.add(lid)))
        liveControllerMap[id] = {
          conditionCount: state.conditions.length,
          controlledLayerIds: Array.from(controlledIds),
          options: state.options,
          conditions: state.conditions,
          action: state.action,
        }
      }
    })

    // Collect ALL layer IDs used by ANY condition in ANY controller (cross-controller dedup)
    const globalUsedLayerIds = new Set<string>()
    Object.values(controllerStates).forEach(state => {
      state.conditions.forEach(c => {
        c.thenShowOrHideLayers?.forEach(id => globalUsedLayerIds.add(id))
      })
    })

    const { nodes: rawNodes, edges: rawEdges } = buildGraph({
      controllerId,
      conditions: rootState.conditions,
      action: rootState.action,
      options: rootState.options,
      allLayers,
      controllerMap: liveControllerMap,
      expandedNodeId,
      visitedControllers,
      depth: 0,
      nodeIdPrefix: '',
      globalUsedLayerIds,
    })

    return { nodes: applyDagreLayout(rawNodes, rawEdges, expandedNodeId), edges: rawEdges }
  }, [controllerId, controllerStates, rootState, allLayers, expandedNodeId])

  /** Serialize ALL controllers — preserves all conditions including empty ones for data integrity */
  const serialize = useCallback(() => {
    return Object.entries(controllerStates).map(([id, state]) => ({
      controllerId: id,
      action: state.action,
      conditions: state.conditions.filter(c => c.ifOptionSelected),
    }))
  }, [controllerStates])

  return {
    nodes,
    edges,
    expandedNodeId,
    toggleExpand,
    updateCondition,
    getCondition,
    getOptions,
    addCondition,
    canAddCondition,
    serialize,
  }
}
