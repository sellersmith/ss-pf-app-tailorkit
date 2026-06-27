import { createContext, useContext } from 'react'
import type { ControlCondition } from '~/models/Layer.server'

/**
 * Context shared between flow canvas and custom nodes.
 *
 * React Flow's useNodesState/setRfNodes CLONES node data, which loses
 * function references. Solution: callbacks and state getters live here,
 * node data only carries simple IDs and pre-computed arrays.
 */
export type FlowCallbacks = {
  /** Update a condition for a specific controller */
  onUpdateCondition: (controllerId: string, index: number, condition: ControlCondition) => void
  /** Toggle expand/collapse of an option node */
  onToggleExpand: (nodeId: string) => void
  /** Get the LATEST condition for a controller at a specific index */
  getCondition: (controllerId: string, index: number) => ControlCondition | undefined
  /** Get options for a specific controller */
  getOptions: (controllerId: string) => { _id: string; name: string }[]
}

const FlowCallbacksContext = createContext<FlowCallbacks | null>(null)

export const FlowCallbacksProvider = FlowCallbacksContext.Provider

export function useFlowCallbacks(): FlowCallbacks {
  const ctx = useContext(FlowCallbacksContext)
  if (!ctx) throw new Error('useFlowCallbacks must be used within FlowCallbacksProvider')
  return ctx
}
