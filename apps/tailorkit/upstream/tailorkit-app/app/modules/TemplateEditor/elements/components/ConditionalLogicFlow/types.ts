import type { ControlCondition } from '~/models/Layer.server'
import type { TLayerStore } from '~/stores/modules/layer'

/**
 * Map of layerId → controller info for downstream indicators.
 * Used to build the recursive graph and show "CONTROLLER" badges on layer nodes.
 */
export type ControllerMap = Record<
  string,
  {
    conditionCount: number
    controlledLayerIds: string[]
    options: { _id: string; name: string }[]
    conditions: ControlCondition[]
    action: 'show' | 'hide'
  }
>

/** Data for option nodes (left side of graph) */
export type OptionNodeData = {
  type: 'option'
  /** The layer this option belongs to */
  controllerId: string
  /** The action of the controller */
  action: 'show' | 'hide'
  /** Index into the controller's conditions array */
  conditionIndex?: number
  /** Pre-filtered layers: excludes layers already used by other conditions across all controllers */
  availableLayers?: { _id: string; label: string; type?: string }[]
  /** Whether this node is currently expanded for editing */
  expanded?: boolean
}

/** Data for layer nodes (right side of graph) */
export type LayerNodeData = {
  type: 'layer'
  layerId: string
  layerLabel: string
  /** Whether this layer is a controller */
  isController: boolean
  /** The visibility state from the parent condition */
  visibility: 'show' | 'hide' | 'unaffected'
}

/** Union of all flow node data types */
export type FlowNodeData = OptionNodeData | LayerNodeData

/** Props for the ConditionalLogicFlow canvas component */
export type ConditionalLogicFlowProps = {
  conditions: ControlCondition[]
  action: 'show' | 'hide'
  options: { _id: string; name: string }[]
  allLayers: { _id: string; label: string; type?: string }[]
  /** The layer ID of the current controller — used as root of the recursive graph */
  controllerId: string
  controllerMap: ControllerMap
  onSave: (results: { controllerId: string; action: 'show' | 'hide'; conditions: ControlCondition[] }[]) => void
  onClose: () => void
}

/** Props for the modal wrapper */
export type ConditionalLogicFlowModalProps = {
  layerStore: TLayerStore
  allLayers: { _id: string; label: string; type?: string }[]
  options: { _id: string; name: string }[]
  action: 'show' | 'hide'
  conditions: ControlCondition[]
  controllerMap: ControllerMap
  onSave: (results: { controllerId: string; action: 'show' | 'hide'; conditions: ControlCondition[] }[]) => void
}
