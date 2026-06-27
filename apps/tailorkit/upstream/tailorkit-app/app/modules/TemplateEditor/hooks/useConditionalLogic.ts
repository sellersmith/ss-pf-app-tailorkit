import type { OptionSet } from '~/types/psd'
import type { TLayerStore } from '~/stores/modules/layer'
import { useLayoutEffect, useMemo } from 'react'
import { useStore } from '~/libs/external-store'
import { EOptionSet, optionSetDataKeys } from '~/types/psd'
import { LayerVisibilityStore } from '~/stores/modules/template'

/**
 * Dispatch SET_LAYER_VISIBILITY only when the value actually changes.
 * This guard breaks infinite loops: effect writes → store changes → effect re-fires → same value → skip.
 */
export function dispatchIfChanged(layerId: string, controllerId: string, visible: boolean) {
  const current = LayerVisibilityStore.getState().layerVisibility?.[layerId]?.[controllerId]
  if (current === visible) return
  LayerVisibilityStore.dispatch({
    type: 'SET_LAYER_VISIBILITY',
    payload: { layerId, visible: { [controllerId]: visible } },
  })
}

/**
 * Compute whether this layer is visible by reading the current store state synchronously.
 * Used inside the effect to get fresh values without adding isLayerVisible as a dep.
 */
export function resolveOwnVisibility(layerId: string, isControlledBy: string[] | undefined): boolean {
  if (!isControlledBy?.length) return true
  const entries = LayerVisibilityStore.getState().layerVisibility?.[layerId]
  let visible: boolean | undefined
  isControlledBy.forEach(cId => {
    const v = entries?.[cId]
    if (v !== undefined) visible = v
  })
  return visible ?? true
}

export function useConditionalLogic(props: { layerStore: TLayerStore; previewMode?: boolean }) {
  const { layerStore, previewMode } = props

  const os = useStore(layerStore, state => state.optionSet)
  const _id = useStore(layerStore, state => state._id)
  const conditionalLogic = useStore(layerStore, state => state.conditionalLogic)

  const action = conditionalLogic?.controls?.action
  const conditions = conditionalLogic?.controls?.conditions
  const isControlledBy = conditionalLogic?.isControlledBy

  // Use the layer visibility store
  const layerVisibility = useStore(LayerVisibilityStore, state => state.layerVisibility)

  // Check if the layer is visible (preview-mode aware — gates option set display in preview panel)
  const isLayerVisible = useMemo(() => {
    if (!previewMode || !isControlledBy?.length) {
      return true
    }

    // Use the visibility set by the last controller layer.
    // Default to true when layerVisibility hasn't been seeded yet (first render).
    let visible: boolean | undefined
    isControlledBy.forEach(cId => (visible = layerVisibility?.[_id]?.[cId]))
    return visible ?? true
  }, [_id, isControlledBy, layerVisibility, previewMode])

  // Whether this layer is explicitly hidden by conditional logic (previewMode-independent).
  // Used to dim layers on the design canvas so editors can still click and edit them.
  const isConditionallyHidden = useMemo(() => {
    if (!isControlledBy?.length) return false
    let visible: boolean | undefined
    isControlledBy.forEach(cId => (visible = layerVisibility?.[_id]?.[cId]))
    // Only true when explicitly set to false — undefined means no selection made yet
    return visible === false
  }, [_id, isControlledBy, layerVisibility])

  // Stable token derived from this layer's own visibility entries.
  // Changes when an upstream controller writes to layerVisibility[_id],
  // causing the effect to re-fire and cascade visibility to downstream layers.
  const ownVisibilityEntries = layerVisibility?.[_id]
  const ownVisibilityToken = useMemo(
    () => (ownVisibilityEntries ? JSON.stringify(ownVisibilityEntries) : ''),
    [ownVisibilityEntries]
  )

  // Derive a reset token from the store: true when LayerVisibilityStore was explicitly reset to null
  // (fired by UPDATE_OPTION_SET, UPDATE_OPTIONS_SORTABLE, etc. in layer.ts).
  // Adding this to deps ensures the effect immediately re-seeds the store after any reset,
  // without waiting for user interaction to change one of the other deps.
  const isVisibilityReset = layerVisibility === null

  useLayoutEffect(() => {
    // Process conditional logic
    const osCanHaveConditionalLogic
      = os?.filter((set: OptionSet) =>
        [EOptionSet.TEXT_OPTION, EOptionSet.IMAGE_OPTION, EOptionSet.IMAGELESS_OPTION].includes(set.type)
      ) || []

    osCanHaveConditionalLogic.forEach((set: OptionSet) => {
      const { type, data } = set || {}
      if (data) {
        const optDataKey = optionSetDataKeys[type as keyof typeof optionSetDataKeys]

        if (conditions?.length) {
          const allControlledLayers = conditions
            .filter(c => c.ifOptionSelected)
            .reduce(
              (layerIds: string[], condition) => Array.from(new Set(layerIds.concat(condition.thenShowOrHideLayers))),
              []
            )

          // Reset visibility for all controlled layers to their default state
          allControlledLayers.forEach(layerId => {
            dispatchIfChanged(layerId, _id, action === 'hide')
          })

          // Find the option that is currently selected
          const dataRecord = data as Record<string, Array<{ _id: string; selecting: boolean }>>
          const selectedOption = optDataKey ? dataRecord[optDataKey]?.find(o => o.selecting) : undefined

          // Find a condition matching the current option
          const condition = selectedOption && conditions.find(c => c.ifOptionSelected === selectedOption._id)

          // Override visibility for layers matched by the selected condition
          // Read own visibility synchronously from store to get fresh value (no stale ref)
          const isVisible = resolveOwnVisibility(_id, isControlledBy)
          condition?.thenShowOrHideLayers?.forEach((layerId: string) => {
            dispatchIfChanged(layerId, _id, isVisible && action === 'show')
          })
        }
      }
    })
    // ownVisibilityToken triggers re-fire when upstream controller changes this layer's visibility,
    // enabling multi-level cascade (L1→L2→L3). dispatchIfChanged guards against infinite loops.
    // isVisibilityReset re-triggers the effect whenever the store is reset to null.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_id, action, conditions, isControlledBy, isVisibilityReset, os, ownVisibilityToken])

  return { isLayerVisible, isConditionallyHidden }
}
