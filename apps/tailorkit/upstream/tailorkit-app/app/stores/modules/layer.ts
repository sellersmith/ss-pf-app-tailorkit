/* eslint-disable max-lines */
import type { LayerDocument } from '~/models/Layer.server'
import type { Reducer, Store } from '~/libs/external-store'
import { createStore } from '~/libs/external-store'
import {
  type OptionSet,
  type ImageOptionSet,
  type Layer,
  type TextOptionSet,
  optionSetDataKeys,
  type ColorOptionSet,
  EOptionSet,
  ELayerType,
  MULTI_LAYOUT_OPTION_TYPE,
  MASK_OPTION_TYPE,
  type CharmSlotNode,
  type CharmProductRef,
  type CharmTransformInstance,
  type CharmNodeSettings,
} from '~/types/psd'
import type { Shape } from 'extensions/tailorkit-src/src/assets/constants/shape'
import { uuid } from '~/utils/uuid'
import { getKeyError, OptionSetErrorKeys } from '~/modules/TemplateEditor/utilities/optionSet-fns'
import type { Step } from '~/libs/steps.client'
import { addSteps } from '~/libs/steps.client'
import cloneDeep from 'lodash/cloneDeep'
import {
  CHARM_THUMB_OFFSET,
  CHARM_THUMB_SIZE,
  getAnchorYOffset,
} from '~/modules/TemplateEditor/elements/components/CharmNode/charm-node-utils'
import { registerCharmLayer } from '~/stores/modules/charm-layer-index'
import { stepCallback } from './integration/fns'
import { getSaveBarId } from './template/get-save-bar-id'
import isEqual from 'lodash/isEqual'
// import { getControllersOfLayer } from '~/modules/TemplateEditor/fns'
import { LayerVisibilityStore, TemplateEditorStore } from '~/stores/modules/template'
import { getDefaultStorefrontLabel } from '~/modules/TemplateEditor/elements/fns'
import { t } from 'i18next'
import { UncommonError } from '~/constants/errors'
import { wrapCharmNodeDispatch } from './charm-store-wrapper'

/** Type-safe accessor for charm node settings from a layer's generic settings field */
function getCharmSettings(settings: unknown): CharmNodeSettings | undefined {
  if (settings && typeof settings === 'object' && 'displayStyle' in settings) {
    return settings as CharmNodeSettings
  }
  return undefined
}

type Trace = {
  skipTrace?: boolean
}

type Action =
  | { type: 'CREATE_LAYER'; payload: { _id: number; layer: Layer } }
  | { type: 'UPDATE_LAYER'; payload: { state: Layer | LayerDocument | Partial<Layer | LayerDocument> } }
  | {
      type: 'UPDATE_TEXT_CUSTOMER_TEMPORARY'
      payload: { tempValue: string }
    }
  | {
      type: 'UPDATE_TEXT_SHAPE_TEMPORARY'
      payload: { tempShape: Shape }
    }
  | { type: 'UPDATE_OPTIONS_SORTABLE'; payload: { optionSet: OptionSet; data: any } }
  | { type: 'UPDATE_OPTION_ITEM_TITLE'; payload: { optionSet: OptionSet; _id: string; name: string } }
  | { type: 'UPDATE_COLOR_OPTION_VALUE'; payload: { optionSet: OptionSet; _id: string; value: string } }
  | {
      type: 'UPDATE_IMAGELESS_OPTION_THUMB'
      payload: { optionSet: OptionSet; _id: string; thumbnail: string }
    }
  | {
      type: 'UPDATE_IMAGE_OPTION_SOURCE'
      payload: { optionSet: OptionSet; oldImageSourceId: string; imageOption: ImageOptionSet }
    }
  | { type: 'DELETE_OPTION_ITEM'; payload: { optionSet: OptionSet; _id: string; context?: any } }
  | { type: 'DELETE_OPTION_SET'; payload: { optionSet: OptionSet; context?: any } }
  | { type: 'UPDATE_OPTION_SELECTING'; payload: { optionSet: OptionSet; _id: string } }
  | { type: 'UPDATE_OPTION_SET'; payload: { optionSet: OptionSet; fromOption?: OptionSet } }
  | {
      type: 'UPDATE_OPTION_SET_EDITING_STATE'
      payload: {
        optionSetType: string
        editingState: {
          newOptionSetPressed?: boolean
          existOptionSetPressed?: boolean
          editMode?: boolean
        }
      }
    }
  | { type: 'TOGGLE_OPTION_SELECTING'; payload: { optionSet: OptionSet; _id: string } }
  | { type: 'RESET_OPTION_SET_EDITING_STATE' }
  | {
      type: 'UPDATE_LAYER_SETTINGS_STOREFRONT_OPTION_SET_LABEL'
      payload: {
        optionSetType: string
        label: string
      }
    }
  // Charm Builder Actions
  | { type: 'ADD_CHARM_SLOT_NODE'; payload: { node: CharmSlotNode } }
  | { type: 'UPDATE_CHARM_SLOT_NODE'; payload: { nodeId: string; updates: Partial<CharmSlotNode> } }
  | { type: 'DELETE_CHARM_SLOT_NODE'; payload: { nodeId: string } }
  | { type: 'REORDER_CHARM_SLOT_NODES'; payload: { nodes: CharmSlotNode[] } }
  | { type: 'ASSIGN_DEFAULT_CHARM'; payload: { nodeId: string; charm: CharmProductRef } }
  | { type: 'UNASSIGN_DEFAULT_CHARM'; payload: { nodeId: string } }
  | {
      type: 'UPDATE_CHARM_PRODUCT_DEFAULTS'
      payload: { productId: string; isDefault: boolean; defaultQuantity: number }
    }
  | { type: 'ADD_LINKED_PRODUCT'; payload: { product: CharmProductRef } }
  | { type: 'REMOVE_LINKED_PRODUCT'; payload: { productId: string } }
  | { type: 'REMOVE_ALL_LINKED_PRODUCTS' }
  | { type: 'INCREMENT_CHARM_QUANTITY'; payload: { productId: string } }
  | { type: 'DECREMENT_CHARM_QUANTITY'; payload: { productId: string; instanceId?: string } }
  | { type: 'UPDATE_CHARM_STOREFRONT_LABEL'; payload: { label: string } }
  | { type: 'UPDATE_CHARM_MAX'; payload: { maxCharms: number } }
  | { type: 'UPDATE_CHARM_DEFAULT_SIZE'; payload: { sizePx: number } }
  | { type: 'UPDATE_CHARM_DISPLAY_STYLE'; payload: { displayStyle: 'FIXED' | 'FREE' } }
  | { type: 'UPDATE_CHARM_ANCHOR_POSITION'; payload: { anchorPosition: 'top' | 'center' | 'bottom' } }
  | { type: 'UPDATE_CHARM_SNAP_STEP'; payload: { snapStep: number } }
  | { type: 'TOGGLE_ADDING_NODE_MODE' }
  | {
      type: 'UPDATE_CHARM_PRODUCT_TRANSFORM'
      payload: {
        productId: string
        instanceId: string
        transform: { x: number; y: number; rotation: number; scale: number }
      }
    }
  | {
      type: 'DELETE_CHARM_INSTANCE'
      payload: {
        productId: string
        instanceId: string
        /** Store the deleted transform for undo/redo reconstruction */
        deletedTransform?: CharmTransformInstance
        /** Store the product ref for undo/redo reconstruction */
        productRef?: CharmProductRef
      }
    }

const DEFAULT_OPTION_SET_EDITING_STATE = {
  newOptionSetPressed: false,
  existOptionSetPressed: false,
  editMode: false,
}

const DEFAULT_OPTION_SET_STATE = {
  _id: uuid(),
  data: null,
  label: '',
}

export const LayerStores = new Map()

export type TLayerStore = Store<LayerDocument, Action & Trace>

type OptionSetData = ImageOptionSet[] | TextOptionSet[] | ColorOptionSet[]

export const getNewOptionSetList = (
  allOptionSetsOfLayer: OptionSet[],
  newOptionSet: OptionSet,
  fromOption?: OptionSet
) => {
  if (allOptionSetsOfLayer.length > 0) {
    return allOptionSetsOfLayer.map(baseOption =>
      baseOption.type === (fromOption || newOptionSet).type ? newOptionSet : baseOption
    )
  }

  return [newOptionSet]
}

// @ts-ignore
const layerReducer: Reducer<LayerDocument, Action> = (state, action) => {
  switch (action.type) {
    case 'CREATE_LAYER': {
      const payload = action.payload

      return {
        ...state,
        [payload._id]: action.payload.layer,
      }
    }

    case 'UPDATE_LAYER': {
      const payload = action.payload

      return {
        ...state,
        ...payload.state,
      }
    }

    case 'UPDATE_TEXT_CUSTOMER_TEMPORARY': {
      const { tempValue } = action.payload

      return {
        ...state,
        settings: {
          ...state.settings,
          tempContent: tempValue,
        },
      }
    }

    case 'UPDATE_TEXT_SHAPE_TEMPORARY': {
      const { tempShape } = action.payload

      return {
        ...state,
        shapeSettings: {
          ...state.shapeSettings,
          tempShape,
        },
      }
    }

    case 'UPDATE_OPTIONS_SORTABLE': {
      const payload = action.payload
      const allOptionSetsOfLayer = state.optionSet || []
      const {
        optionSet,
        optionSet: { type },
        data: newData,
      } = payload

      const optDataKey = optionSetDataKeys[type as keyof typeof optionSetDataKeys]
      let mask = state.mask

      if (optDataKey === MASK_OPTION_TYPE) {
        mask = newData[0]
      }

      // Clean up conditional logic conditions that reference removed options
      const logicEligible = [EOptionSet.TEXT_OPTION, EOptionSet.IMAGE_OPTION, EOptionSet.IMAGELESS_OPTION]
      const shouldCleanLogic = logicEligible.includes(type as EOptionSet)
      const currentConditionalLogic = state.conditionalLogic || {}
      const currentControls = (currentConditionalLogic as any).controls || {}
      let nextControls = currentControls

      if (shouldCleanLogic) {
        const validIds = (newData || []).map((item: any) => item._id)
        const filteredConditions = (currentControls.conditions || []).filter((c: any) =>
          validIds.includes(c.ifOptionSelected)
        )
        nextControls = { ...currentControls, conditions: filteredConditions }
      }

      return {
        ...state,
        mask,
        optionSet: getNewOptionSetList(allOptionSetsOfLayer, {
          ...optionSet,
          data: {
            ...optionSet.data,
            [optDataKey]: newData,
          } as any,
        }),
        ...(shouldCleanLogic
          ? {
              conditionalLogic: {
                ...(currentConditionalLogic as any),
                controls: nextControls,
              },
            }
          : {}),
      }
    }

    case 'UPDATE_OPTION_SET': {
      const { optionSet, fromOption } = action.payload
      const allOptionSetsOfLayer = state.optionSet || []

      // If replacing/updating an option set that participates in conditional logic,
      // prune conditions whose ifOptionSelected no longer exists.
      const logicEligible = [EOptionSet.TEXT_OPTION, EOptionSet.IMAGE_OPTION, EOptionSet.IMAGELESS_OPTION]
      const shouldCleanLogic = logicEligible.includes(optionSet.type as EOptionSet)
      const currentConditionalLogic = state.conditionalLogic || {}
      const currentControls = (currentConditionalLogic as any).controls || {}
      let nextControls = currentControls

      if (shouldCleanLogic) {
        const optDataKey = optionSetDataKeys[optionSet.type as keyof typeof optionSetDataKeys]
        const newList: any[] = Array.isArray((optionSet.data as any)?.[optDataKey])
          ? ((optionSet.data as any)[optDataKey] as any[])
          : []
        const validIds = newList.map(item => item._id)
        const filteredConditions = validIds.length
          ? (currentControls.conditions || []).filter((c: any) => validIds.includes(c.ifOptionSelected))
          : []
        nextControls = { ...currentControls, conditions: filteredConditions }
      }

      const newOptionSetList = getNewOptionSetList(allOptionSetsOfLayer, optionSet, fromOption)
      return {
        ...state,
        optionSet: newOptionSetList,
        ...(shouldCleanLogic
          ? {
              conditionalLogic: {
                ...(currentConditionalLogic as any),
                controls: nextControls,
              },
            }
          : {}),
      }
    }

    case 'UPDATE_OPTION_ITEM_TITLE': {
      const payload = action.payload
      const {
        optionSet,
        optionSet: { type, data = {} },
        _id,
        name,
      } = payload

      const allOptionSetsOfLayer = state.optionSet || []
      const optDataKey = optionSetDataKeys[type as keyof typeof optionSetDataKeys]
      const baseData: OptionSetData = (data as any)?.[optDataKey] ? (data as any)?.[optDataKey] : [{ _id, name }]

      return {
        ...state,
        optionSet: getNewOptionSetList(allOptionSetsOfLayer, {
          ...optionSet,
          data: {
            ...optionSet.data,
            [optDataKey]: baseData.map(item => (item._id === _id ? { ...item, name } : item)),
          } as any,
        }),
      }
    }

    case 'UPDATE_COLOR_OPTION_VALUE': {
      const payload = action.payload
      const { optionSet, _id, value } = payload

      const data = optionSet?.data || {}

      const allOptionSetsOfLayer = state.optionSet || []
      const baseData: ColorOptionSet[] = (data as any)?.colors ? (data as any)?.colors : [{ _id, value }]

      return {
        ...state,
        optionSet: getNewOptionSetList(allOptionSetsOfLayer, {
          ...optionSet,
          data: {
            ...optionSet.data,
            colors: baseData.map(item => (item._id === _id ? { ...item, value } : item)),
          } as any,
        }),
      }
    }

    case 'UPDATE_IMAGELESS_OPTION_THUMB': {
      const payload = action.payload
      const {
        optionSet,
        optionSet: { type, data = {} },
        _id,
        thumbnail,
      } = payload

      const allOptionSetsOfLayer = state.optionSet || []
      const optDataKey = optionSetDataKeys[type as keyof typeof optionSetDataKeys]
      const baseData: ColorOptionSet[] = (data as any)?.[optDataKey]
        ? (data as any)?.[optDataKey]
        : [{ _id, thumbnail }]

      return {
        ...state,
        optionSet: getNewOptionSetList(allOptionSetsOfLayer, {
          ...optionSet,
          data: {
            ...optionSet.data,
            [optDataKey]: baseData.map(item => (item._id === _id ? { ...item, thumbnail } : item)),
          } as any,
        }),
      }
    }

    case 'UPDATE_IMAGE_OPTION_SOURCE': {
      const payload = action.payload
      const { optionSet, oldImageSourceId, imageOption } = payload

      const allOptionSetsOfLayer = state.optionSet || []
      const files: ImageOptionSet[] = (optionSet as any)?.data?.files || []

      return {
        ...state,
        optionSet: getNewOptionSetList(allOptionSetsOfLayer, {
          ...optionSet,
          data: {
            ...optionSet.data,
            files: files.map((file: ImageOptionSet) =>
              file._id === oldImageSourceId
                ? {
                    ...imageOption,
                    selecting: file.selecting,
                    name: file.name,
                    _id: oldImageSourceId,
                  }
                : file
            ),
          } as any,
        }),
      }
    }

    case 'DELETE_OPTION_ITEM': {
      const payload = action.payload
      const {
        optionSet,
        optionSet: { type, data },
        _id: itemId,
        context,
      } = payload
      const allOptionSetsOfLayer = state.optionSet || []
      const optDataKey = optionSetDataKeys[type as keyof typeof optionSetDataKeys]

      const optData: OptionSetData = (data as any)?.[optDataKey] || []

      if (typeof context?.setValidationErrors === 'function') {
        const errorItemKey = getKeyError(optionSet, OptionSetErrorKeys.OPTION_SET_ITEM_NAME, itemId)
        context.setValidationErrors(state._id, errorItemKey, null)
      }

      const nextList = (optData as any[]).filter(option => option._id !== itemId)

      // Clean up conditional logic conditions that reference removed option
      const logicEligible = [EOptionSet.TEXT_OPTION, EOptionSet.IMAGE_OPTION, EOptionSet.IMAGELESS_OPTION]
      const shouldCleanLogic = logicEligible.includes(type as EOptionSet)
      const currentConditionalLogic = state.conditionalLogic || {}
      const currentControls = (currentConditionalLogic as any).controls || {}
      const validIds = nextList.map(item => item._id)
      const filteredConditions = (currentControls.conditions || []).filter((c: any) =>
        validIds.includes(c.ifOptionSelected)
      )

      return {
        ...state,
        optionSet: getNewOptionSetList(allOptionSetsOfLayer, {
          ...optionSet,
          data: {
            ...optionSet.data,
            [optDataKey]: nextList,
          } as any,
        }),
        ...(shouldCleanLogic
          ? {
              conditionalLogic: {
                ...(currentConditionalLogic as any),
                controls: { ...currentControls, conditions: filteredConditions },
              },
            }
          : {}),
      }
    }

    case 'DELETE_OPTION_SET': {
      const { optionSet } = action.payload
      const allOptionSetsOfLayer = state.optionSet || []

      // If deleting option set that participates in conditional logic, clear conditions
      const logicEligible = [EOptionSet.TEXT_OPTION, EOptionSet.IMAGE_OPTION, EOptionSet.IMAGELESS_OPTION]
      const shouldCleanLogic = logicEligible.includes(optionSet.type as EOptionSet)
      const currentConditionalLogic = state.conditionalLogic || {}
      const currentControls = (currentConditionalLogic as any).controls || {}

      return {
        ...state,
        optionSet: allOptionSetsOfLayer.map(os =>
          os._id === optionSet._id
            ? {
                ...os,
                ...DEFAULT_OPTION_SET_STATE,
              }
            : os
        ),
        optionSetEditingState: {
          ...state.optionSetEditingState,
          [optionSet.type]: DEFAULT_OPTION_SET_EDITING_STATE,
        },
        ...(shouldCleanLogic
          ? {
              conditionalLogic: {
                ...(currentConditionalLogic as any),
                controls: { ...currentControls, conditions: [] },
              },
            }
          : {}),
      }
    }

    case 'UPDATE_OPTION_SELECTING': {
      const payload = action.payload
      const {
        optionSet,
        optionSet: { type, data = {} },
        _id: fieldId,
      } = payload
      const optDataKey = optionSetDataKeys[type as keyof typeof optionSetDataKeys]

      const optData: OptionSetData = (data as any)?.[optDataKey] || []
      const allOptionSetsOfLayer = state.optionSet || []

      // For image options in individual mode, use originalBaseState for baseSnapshot
      // This ensures consistent baseline across option switches
      const originalBaseState = (optionSet as any)?.originalBaseState
      const baseForSnapshot = originalBaseState || {
        width: state.width || 0,
        height: state.height || 0,
        left: state.left || 0,
        top: state.top || 0,
        rotate: state.rotate || 0,
      }

      return {
        ...state,
        optionSet: getNewOptionSetList(allOptionSetsOfLayer, {
          ...optionSet,
          data: {
            ...optionSet.data,
            [optDataKey]: optData.map(item => {
              const becomingSelected = item._id === fieldId
              if (becomingSelected && type === EOptionSet.IMAGE_OPTION) {
                // Use originalBaseState (if in individual mode) or current layer state
                return {
                  ...(item as ImageOptionSet),
                  selecting: true,
                  baseSnapshot: baseForSnapshot,
                }
              }
              return {
                ...item,
                selecting: becomingSelected,
              }
            }),
          } as any,
        }),
      }
    }

    case 'TOGGLE_OPTION_SELECTING': {
      const {
        optionSet,
        optionSet: { type, data = {} },
        _id: fieldId,
      } = action.payload

      const optDataKey = optionSetDataKeys[type as keyof typeof optionSetDataKeys]
      const optData: OptionSetData = (data as any)?.[optDataKey] || []
      const allOptionSetsOfLayer = state.optionSet || []

      // For image options in individual mode, use originalBaseState for baseSnapshot
      const originalBaseState = (optionSet as any)?.originalBaseState
      const baseForSnapshot = originalBaseState || {
        width: state.width || 0,
        height: state.height || 0,
        left: state.left || 0,
        top: state.top || 0,
        rotate: state.rotate || 0,
      }

      return {
        ...state,
        optionSet: getNewOptionSetList(allOptionSetsOfLayer, {
          ...optionSet,
          data: {
            ...optionSet.data,
            [optDataKey]: optData.map(item => {
              if (item._id !== fieldId) return item
              const nextSelecting = !item.selecting
              if (nextSelecting && type === EOptionSet.IMAGE_OPTION) {
                return {
                  ...(item as ImageOptionSet),
                  selecting: true,
                  baseSnapshot: baseForSnapshot,
                }
              }
              return { ...item, selecting: nextSelecting }
            }),
          } as any,
        }),
      }
    }

    case 'UPDATE_OPTION_SET_EDITING_STATE': {
      const { optionSetType, editingState } = action.payload
      const { optionSetEditingState } = state || {}

      return {
        ...state,
        optionSetEditingState: {
          ...optionSetEditingState,
          [optionSetType]: editingState,
        },
      }
    }

    case 'RESET_OPTION_SET_EDITING_STATE': {
      const { optionSet = [] } = state

      return {
        ...state,
        optionSetEditingState: getOptionSetEditingDefaultState(optionSet),
      }
    }

    case 'UPDATE_LAYER_SETTINGS_STOREFRONT_OPTION_SET_LABEL': {
      const { optionSetType, label } = action.payload

      return {
        ...state,
        settings: {
          ...state.settings,
          storefrontOptionSetLabels: {
            ...state.settings?.storefrontOptionSetLabels,
            [optionSetType]: label,
          },
        },
      }
    }

    // --- Charm Builder Reducer Cases ---

    case 'ADD_CHARM_SLOT_NODE': {
      const { node } = action.payload
      const currentNodes = (getCharmSettings(state.settings)?.nodes || []) as CharmSlotNode[]
      // Cap node count by maxCharms — each node is a charm slot, so total nodes
      // should not exceed the maximum charms allowed
      const maxAllowed = getCharmSettings(state.settings)?.maxCharms
      if (maxAllowed && currentNodes.length >= maxAllowed) return state
      return {
        ...state,
        settings: {
          ...state.settings,
          nodes: [...currentNodes, node],
        },
      }
    }

    case 'UPDATE_CHARM_SLOT_NODE': {
      const { nodeId, updates } = action.payload
      const nodes = (getCharmSettings(state.settings)?.nodes || []) as CharmSlotNode[]
      return {
        ...state,
        settings: {
          ...state.settings,
          nodes: nodes.map(n => (n._id === nodeId ? { ...n, ...updates } : n)),
        },
      }
    }

    case 'DELETE_CHARM_SLOT_NODE': {
      const { nodeId } = action.payload
      const existingNodes = (getCharmSettings(state.settings)?.nodes || []) as CharmSlotNode[]
      const deletedNode = existingNodes.find(n => n._id === nodeId)
      const remainingNodes = existingNodes.filter(n => n._id !== nodeId)

      // Remove charm instances assigned to the deleted node
      // Use node.defaultCharm._id to identify the product, then x proximity for the specific transform
      const nodeProducts = (getCharmSettings(state.settings)?.linkedProducts || []) as CharmProductRef[]
      const assignedProductId = deletedNode?.defaultCharm?._id
      const cleanedProducts = deletedNode
        ? nodeProducts.map(p => {
            // Only clean transforms from the product assigned to this node
            if (assignedProductId && p._id !== assignedProductId) return p
            // Fallback to x proximity if no defaultCharm set (legacy data)
            const cleaned = (p.transforms || []).filter(t => Math.abs(t.x - deletedNode.x) >= 1)
            const clampedDefault
              = cleaned.length === 0 && p.isDefault
                ? { isDefault: false, defaultQuantity: 1 }
                : p.isDefault && (p.defaultQuantity || 0) > cleaned.length
                  ? { defaultQuantity: Math.max(1, cleaned.length) }
                  : {}
            return { ...p, transforms: cleaned, ...clampedDefault }
          })
        : nodeProducts

      return {
        ...state,
        settings: {
          ...state.settings,
          nodes: remainingNodes,
          linkedProducts: cleanedProducts,
        },
      }
    }

    case 'REORDER_CHARM_SLOT_NODES': {
      const { nodes } = action.payload
      return {
        ...state,
        settings: {
          ...state.settings,
          nodes,
        },
      }
    }

    case 'ASSIGN_DEFAULT_CHARM': {
      const { nodeId, charm } = action.payload
      const charmNodes = (getCharmSettings(state.settings)?.nodes || []) as CharmSlotNode[]
      const allowMultiple = getCharmSettings(state.settings)?.allowMultipleAssignments ?? false
      return {
        ...state,
        settings: {
          ...state.settings,
          nodes: charmNodes.map(n => {
            if (n._id === nodeId) return { ...n, defaultCharm: charm }
            // One-to-one: auto-unassign this charm from other nodes
            if (!allowMultiple && n.defaultCharm?._id === charm._id) {
              return { ...n, defaultCharm: undefined }
            }
            return n
          }),
        },
      }
    }

    case 'UNASSIGN_DEFAULT_CHARM': {
      const { nodeId } = action.payload
      const unassignNodes = (getCharmSettings(state.settings)?.nodes || []) as CharmSlotNode[]
      return {
        ...state,
        settings: {
          ...state.settings,
          nodes: unassignNodes.map(n => (n._id === nodeId ? { ...n, defaultCharm: null } : n)),
        },
      }
    }

    case 'ADD_LINKED_PRODUCT': {
      const { product } = action.payload
      const currentProducts = (getCharmSettings(state.settings)?.linkedProducts || []) as CharmProductRef[]
      // Prevent duplicate products (charm identity = product, not variant)
      const alreadyExists = currentProducts.some(p => p.shopifyProductId === product.shopifyProductId)
      if (alreadyExists) return state

      // No auto-place: charms only appear on canvas when merchant enables "Default on storefront"
      return {
        ...state,
        settings: {
          ...state.settings,
          linkedProducts: [...currentProducts, product],
        },
      }
    }

    case 'REMOVE_LINKED_PRODUCT': {
      const { productId } = action.payload
      const linkedProducts = (getCharmSettings(state.settings)?.linkedProducts || []) as CharmProductRef[]
      const rmNodes = (getCharmSettings(state.settings)?.nodes || []) as CharmSlotNode[]
      // Clear defaultCharm from nodes that reference the removed product
      const cleanedRmNodes = rmNodes.map(n => (n.defaultCharm?._id === productId ? { ...n, defaultCharm: null } : n))
      return {
        ...state,
        settings: {
          ...state.settings,
          nodes: cleanedRmNodes,
          linkedProducts: linkedProducts.filter((p: any) => p._id !== productId),
        },
      }
    }

    case 'UPDATE_CHARM_PRODUCT_DEFAULTS': {
      const { productId, isDefault, defaultQuantity } = action.payload
      const products = (getCharmSettings(state.settings)?.linkedProducts || []) as CharmProductRef[]
      return {
        ...state,
        settings: {
          ...state.settings,
          linkedProducts: products.map(p =>
            p._id === productId ? { ...p, isDefault, defaultQuantity: isDefault ? defaultQuantity : 0 } : p
          ),
        },
      }
    }

    case 'REMOVE_ALL_LINKED_PRODUCTS': {
      return {
        ...state,
        settings: {
          ...state.settings,
          linkedProducts: [],
        },
      }
    }

    case 'INCREMENT_CHARM_QUANTITY': {
      const { productId } = action.payload
      const incCharmSettings = getCharmSettings(state.settings)
      const incProducts = (incCharmSettings?.linkedProducts || []) as CharmProductRef[]
      const charmNodes = (incCharmSettings?.nodes || []) as CharmSlotNode[]
      // Max charms = total node count (each node is a placement point)
      const maxAllowed = incCharmSettings?.maxCharms ?? charmNodes.length

      // Check total instances across all products
      const totalOnCanvas = incProducts.reduce((sum, p) => sum + (p.transforms?.length || 0), 0)
      if (maxAllowed > 0 && totalOnCanvas >= maxAllowed) return state

      const target = incProducts.find(p => p._id === productId)
      if (!target) return state

      const displayStyle = incCharmSettings?.displayStyle || 'FIXED'
      const newInstanceId = uuid()
      // Inherit scale from any existing charm instance (all charms share uniform size)
      const allTransforms = incProducts.flatMap(p => p.transforms || [])
      const existingScale = allTransforms.find(t => typeof t.scale === 'number' && t.scale > 0)?.scale || 1
      let newTransform: { instanceId: string; x: number; y: number; rotation: number; scale: number }

      if (displayStyle === 'FREE') {
        const dim = TemplateEditorStore.getState().dimension
        const cx = (dim?.width || 500) / 2
        const cy = (dim?.height || 500) / 2
        newTransform = { instanceId: newInstanceId, x: cx, y: cy, rotation: 0, scale: existingScale }
      } else {
        // FIXED mode: find first node with available slot capacity
        const allOccupied = incProducts.flatMap(p => (p.transforms || []).map(t => ({ x: t.x, y: t.y })))
        const emptyNode = charmNodes.find(node => {
          const occupancy = allOccupied.filter(pos => Math.abs(pos.x - node.x) < 1).length
          return occupancy < (node.slotLimit || 1)
        })

        // No empty node → block increment (don't auto-create nodes in FIXED mode)
        if (!emptyNode) return state

        newTransform = {
          instanceId: newInstanceId,
          x: emptyNode.x,
          y:
            emptyNode.y
            + getAnchorYOffset(getCharmSettings(state.settings)?.anchorPosition, CHARM_THUMB_OFFSET, existingScale),
          rotation: 0,
          scale: existingScale,
        }

        // Set defaultCharm on the node to track node↔charm assignment
        const updatedNodes = charmNodes.map(n => (n._id === emptyNode._id ? { ...n, defaultCharm: target } : n))

        return {
          ...state,
          settings: {
            ...state.settings,
            nodes: updatedNodes,
            linkedProducts: incProducts.map(p =>
              p._id === productId ? { ...p, transforms: [...(p.transforms || []), newTransform] } : p
            ),
          },
        }
      }

      return {
        ...state,
        settings: {
          ...state.settings,
          linkedProducts: incProducts.map(p =>
            p._id === productId ? { ...p, transforms: [...(p.transforms || []), newTransform] } : p
          ),
        },
      }
    }

    case 'DECREMENT_CHARM_QUANTITY': {
      const { productId, instanceId } = action.payload
      const decProducts = (getCharmSettings(state.settings)?.linkedProducts || []) as CharmProductRef[]
      const decNodes = (getCharmSettings(state.settings)?.nodes || []) as CharmSlotNode[]
      const target = decProducts.find(p => p._id === productId)
      if (!target || !target.transforms?.length) return state

      let removedTransform: CharmTransformInstance | undefined
      let updatedTransforms: CharmProductRef['transforms']
      if (instanceId) {
        removedTransform = target.transforms.find(t => t.instanceId === instanceId)
        updatedTransforms = target.transforms.filter(t => t.instanceId !== instanceId)
      } else {
        // Remove last instance (LIFO)
        removedTransform = target.transforms[target.transforms.length - 1]
        updatedTransforms = target.transforms.slice(0, -1)
      }

      // Unassign defaultCharm from the node that held this charm (FIXED mode)
      const updatedDecNodes = removedTransform
        ? decNodes.map(n =>
            n.defaultCharm?._id === productId && Math.abs(n.x - removedTransform!.x) < 1
              ? { ...n, defaultCharm: null }
              : n
          )
        : decNodes

      return {
        ...state,
        settings: {
          ...state.settings,
          nodes: updatedDecNodes,
          linkedProducts: decProducts.map(p => (p._id === productId ? { ...p, transforms: updatedTransforms } : p)),
        },
      }
    }

    case 'UPDATE_CHARM_STOREFRONT_LABEL': {
      const { label } = action.payload
      return {
        ...state,
        settings: {
          ...state.settings,
          storefrontLabel: label,
        },
      }
    }

    case 'UPDATE_CHARM_MAX': {
      const { maxCharms } = action.payload
      const maxProducts = (getCharmSettings(state.settings)?.linkedProducts || []) as CharmProductRef[]
      const totalOnCanvas = maxProducts.reduce((sum, p) => sum + (p.transforms?.length || 0), 0)

      // If reducing below current total, trim excess instances (LIFO per product, from end)
      let trimmedProducts = maxProducts
      if (totalOnCanvas > maxCharms) {
        let excess = totalOnCanvas - maxCharms
        trimmedProducts = [...maxProducts]
          .reverse()
          .map(p => {
            if (excess <= 0 || !p.transforms?.length) return p
            const removeCount = Math.min(excess, p.transforms.length)
            excess -= removeCount
            const newTransforms = p.transforms.slice(0, p.transforms.length - removeCount)
            return {
              ...p,
              transforms: newTransforms,
              // Sync defaultQuantity with actual transforms count after trim
              ...(p.isDefault ? { defaultQuantity: newTransforms.length } : {}),
            }
          })
          .reverse()
      }

      return {
        ...state,
        settings: {
          ...state.settings,
          maxCharms,
          linkedProducts: trimmedProducts,
        },
      }
    }

    case 'UPDATE_CHARM_DISPLAY_STYLE': {
      const { displayStyle } = action.payload
      return {
        ...state,
        settings: {
          ...state.settings,
          displayStyle,
        },
      }
    }

    case 'UPDATE_CHARM_ANCHOR_POSITION': {
      const { anchorPosition } = action.payload
      const charmSettings = getCharmSettings(state.settings)
      const anchorNodes = (charmSettings?.nodes || []) as CharmSlotNode[]
      const anchorProducts = (charmSettings?.linkedProducts || []) as CharmProductRef[]
      // Re-snap all charm instances to reflect new anchor position
      const reSnappedProducts = anchorProducts.map(p => ({
        ...p,
        transforms: (p.transforms || []).map(t => {
          const node = anchorNodes.find(n => Math.abs(n.x - t.x) < 1)
          if (node) {
            return { ...t, y: node.y + getAnchorYOffset(anchorPosition, CHARM_THUMB_OFFSET, t.scale) }
          }
          return t
        }),
      }))
      return {
        ...state,
        settings: {
          ...state.settings,
          anchorPosition,
          linkedProducts: reSnappedProducts,
        },
      }
    }

    case 'TOGGLE_ADDING_NODE_MODE': {
      const currentMode = getCharmSettings(state.settings)?.isAddingNodeMode || false
      return {
        ...state,
        settings: {
          ...state.settings,
          isAddingNodeMode: !currentMode,
        },
      }
    }

    case 'UPDATE_CHARM_SNAP_STEP': {
      const { snapStep } = action.payload
      const snapSettings = getCharmSettings(state.settings)
      const snapNodes = (snapSettings?.nodes || []) as CharmSlotNode[]
      // When admin picks a non-zero snap, round every existing slot rotation to the
      // new cadence so the canvas + storefront immediately reflect the chosen step.
      // Snap=0 leaves stored rotations untouched (admin opts out of snapping).
      const snappedNodes
        = snapStep > 0
          ? snapNodes.map(n => ({
              ...n,
              rotation: (((Math.round((n.rotation ?? 0) / snapStep) * snapStep) % 360) + 360) % 360,
            }))
          : snapNodes
      return {
        ...state,
        settings: {
          ...state.settings,
          snapStep,
          nodes: snappedNodes,
        },
      }
    }

    case 'UPDATE_CHARM_DEFAULT_SIZE': {
      const { sizePx } = action.payload
      const scale = sizePx / CHARM_THUMB_SIZE
      const sizeCharmSettings = getCharmSettings(state.settings)
      const sizeProducts = (sizeCharmSettings?.linkedProducts || []) as CharmProductRef[]
      const sizeNodes = (sizeCharmSettings?.nodes || []) as CharmSlotNode[]
      const sizeDisplayStyle = sizeCharmSettings?.displayStyle || 'FIXED'
      return {
        ...state,
        settings: {
          ...state.settings,
          defaultCharmSize: sizePx,
          // Sync scale (and re-snap positions in FIXED mode) to all charm instances
          linkedProducts: sizeProducts.map(p => ({
            ...p,
            transforms: (p.transforms || []).map(t => {
              if (sizeDisplayStyle === 'FIXED' && sizeNodes.length > 0) {
                // Re-snap: find assigned node by x proximity, recalculate y offset
                const node = sizeNodes.find(n => Math.abs(n.x - t.x) < 1)
                if (node) {
                  return {
                    ...t,
                    scale,
                    y:
                      node.y
                      + getAnchorYOffset(getCharmSettings(state.settings)?.anchorPosition, CHARM_THUMB_OFFSET, scale),
                  }
                }
              }
              return { ...t, scale }
            }),
          })),
        },
      }
    }

    case 'UPDATE_CHARM_PRODUCT_TRANSFORM': {
      const { instanceId, transform } = action.payload
      const transformProducts = (getCharmSettings(state.settings)?.linkedProducts || []) as CharmProductRef[]
      return {
        ...state,
        settings: {
          ...state.settings,
          // Keep defaultCharmSize in sync when user resizes on canvas
          defaultCharmSize: Math.round(CHARM_THUMB_SIZE * transform.scale),
          // Sync scale to ALL charm instances across ALL products
          // (storefront renders all charms at uniform size — admin must match for WYSIWYG)
          linkedProducts: transformProducts.map(p => ({
            ...p,
            transforms: (p.transforms || []).map(t =>
              t.instanceId === instanceId ? { ...t, ...transform } : { ...t, scale: transform.scale }
            ),
          })),
        },
      }
    }

    case 'DELETE_CHARM_INSTANCE': {
      const { productId, instanceId } = action.payload
      const deleteProducts = (getCharmSettings(state.settings)?.linkedProducts || []) as CharmProductRef[]
      const delNodes = (getCharmSettings(state.settings)?.nodes || []) as CharmSlotNode[]
      const targetProduct = deleteProducts.find(p => p._id === productId)
      if (!targetProduct || !targetProduct.transforms?.length) return state

      // Find the transform being deleted to unassign its node
      const deletedT = targetProduct.transforms.find(t => t.instanceId === instanceId)

      // Unassign defaultCharm from the node that held this charm
      const updatedDelNodes = deletedT
        ? delNodes.map(n =>
            n.defaultCharm?._id === productId && Math.abs(n.x - deletedT.x) < 1 ? { ...n, defaultCharm: null } : n
          )
        : delNodes

      return {
        ...state,
        settings: {
          ...state.settings,
          nodes: updatedDelNodes,
          linkedProducts: deleteProducts.map(p => {
            if (p._id !== productId) return p
            const remainingTransforms = (p.transforms || []).filter(t => t.instanceId !== instanceId)
            const remainingCount = remainingTransforms.length
            const clampedDefault
              = remainingCount === 0
                ? { isDefault: false, defaultQuantity: 1 }
                : p.isDefault && (p.defaultQuantity || 0) > remainingCount
                  ? { defaultQuantity: remainingCount }
                  : {}
            return {
              ...p,
              transforms: remainingTransforms,
              ...clampedDefault,
            }
          }),
        },
      }
    }

    default:
      return state
  }
}

function proxyLayerReducer(state: LayerDocument, action: Action & Trace) {
  const updatedState = layerReducer(state, action)

  const skipTrace = action.skipTrace

  // We separate image from the rest of the state because image is a complex object and we don't want to clone it
  const { image, ...restState } = state
  const { image: updatedImage, ...restUpdatedState } = updatedState

  const deepCloneRestState = cloneDeep(restState)
  const deepCloneRestUpdatedState = cloneDeep(restUpdatedState)

  if (!skipTrace) {
    const step: Step = {
      type: action.type,
      fromData: { ...deepCloneRestState, image },
      toData: { ...deepCloneRestUpdatedState, image: updatedImage },
      callback: (target: any, props: string | symbol, value: any) => stepCallback(target, props, value, getSaveBarId()),
    }

    addSteps(step, false)
  }

  // After option mutations that can change controllers/targets,
  // recompute isControlledBy for all layers and reset visibility.
  if (
    action.type === 'UPDATE_OPTIONS_SORTABLE'
    || action.type === 'UPDATE_OPTION_SET'
    || action.type === 'DELETE_OPTION_ITEM'
    || action.type === 'DELETE_OPTION_SET'
  ) {
    try {
      const allStores = getAllLayerStore()
      const rawLayers = allStores.map(ls => ls.getState())
      const layersWithUpdated = rawLayers.map(l => (l._id === updatedState._id ? updatedState : l))

      allStores.forEach(ls => {
        const target = ls.getState()
        import('~/modules/TemplateEditor/fns').then(({ getControllersOfLayer }) => {
          const nextControlledBy = getControllersOfLayer(target._id, layersWithUpdated)
          const currentControlledBy = target.conditionalLogic?.isControlledBy || []

          if (!isEqual(currentControlledBy, nextControlledBy)) {
            ls.dispatch({
              type: 'UPDATE_LAYER',
              payload: {
                state: {
                  conditionalLogic: {
                    ...(target.conditionalLogic || ({} as any)),
                    isControlledBy: nextControlledBy,
                  },
                },
              },
              skipTrace: true,
            })
          }
        })
      })

      LayerVisibilityStore.dispatch({ type: 'RESET_LAYER_VISIBILITY' })
    } catch (e) {
      // no-op
    }
  }

  return updatedState
}

function layerStoreInitializeMiddleware(layer: LayerDocument) {
  const { constrainProportions, type, optionSet = [] } = layer

  // Charm layers don't use the traditional option set system
  const isCharmLayer = type === ELayerType.CHARM_NODE || type === ELayerType.CHARM
  if (isCharmLayer) {
    return {
      locked: false,
      ...layer,
      optionSet: undefined,
      constrainProportions: constrainProportions ?? true,
      proportions: layer.width && layer.height ? layer.width / layer.height : null,
    } as LayerDocument
  }

  const optionSetMap = new Map(optionSet.map(optSet => [optSet.type as EOptionSet, optSet]))

  const allOptionSetsOfLayer: any[] = Object.values(EOptionSet).map(optionSetType => {
    if (optionSetMap.has(optionSetType)) {
      return optionSetMap.get(optionSetType)
    }

    const defaultOptionSet = {
      ...DEFAULT_OPTION_SET_STATE,
      _id: uuid(),
      type: optionSetType,
      shopDomain: layer.shopDomain,
      labelOnStoreFront: getDefaultStorefrontLabel({ t, type: optionSetType || 'custom' }),
    }

    return defaultOptionSet
  })

  const mutationData: LayerDocument = {
    // Default locked state
    locked: false,
    ...layer,
    optionSet: type !== 'group' ? allOptionSetsOfLayer : undefined,
    ...(constrainProportions === undefined || constrainProportions === null
      ? {
          // Auto sync proportions by default
          constrainProportions: true,
        }
      : { constrainProportions }),
    optionSetEditingState: layer.optionSetEditingState || getOptionSetEditingDefaultState(allOptionSetsOfLayer),
    proportions: layer.width && layer.height ? layer.width / layer.height : null,
  }

  return mutationData
}

const getOptionSetEditingDefaultState = (optionSet: any[]) => {
  const optionSetEditingState = (optionSet || []).reduce((arr: any, opt: any) => {
    if (opt.type) {
      arr[opt.type] = DEFAULT_OPTION_SET_EDITING_STATE
    }

    return arr
  }, {})

  return optionSetEditingState
}

export function createLayerStore(layer: LayerDocument): TLayerStore {
  const layerStoreById = getLayerStoreById(layer._id)

  // Return layer store if existing
  if (layerStoreById) {
    return layerStoreById
  }

  const layerStore = createStore(
    proxyLayerReducer,
    layerStoreInitializeMiddleware({ ...layer, parent: layer.parent || '' })
  )

  // Wrap CHARM_NODE stores with charm-specific dispatch handling
  // Reset ephemeral editing state that should not persist across sessions
  if (layer.type === ELayerType.CHARM_NODE) {
    wrapCharmNodeDispatch(layerStore)
    if ((layer.settings as any)?.isAddingNodeMode) {
      layerStore.dispatch({ type: 'TOGGLE_ADDING_NODE_MODE' })
    }
  }

  // Register CHARM layers in the index for O(1) lookup after save→load
  if (layer.type === ELayerType.CHARM) {
    const instanceId = (layer.settings as any)?.productRef?.instanceId
    if (instanceId) {
      registerCharmLayer(instanceId, layerStore)
    }
  }

  LayerStores.set(layer._id, layerStore)

  return layerStore
}

export function getAllLayerStore(): TLayerStore[] {
  const mapping = []
  for (const value of LayerStores.values()) {
    mapping.push(value)
  }

  return mapping
}

export function getLayerStoreId(layerStore: TLayerStore) {
  return layerStore.getState()._id
}

export function getLayerStoreIds(layerStores: TLayerStore[]) {
  return layerStores.map(layerStore => getLayerStoreId(layerStore))
}

export function getLayerStoreById(_id: string): TLayerStore {
  return LayerStores.get(_id)
}

export function deleteLayerStoreById(_id: string) {
  return LayerStores.delete(_id)
}

export function deleteLayerStores(_ids: string[]) {
  _ids.forEach(_id => deleteLayerStoreById(_id))
}

/**
 * Mark layer store as deleted on editor
 * @param _id - Layer store id
 * @param isDeletedOnEditor - Whether to mark layer store as deleted on editor
 * @param skipTrace - Whether to skip trace
 */
export function markLayerStoreAsDeleted(_id: string, isDeletedOnEditor = false, skipTrace?: boolean) {
  const layerStore = getLayerStoreById(_id)

  if (!layerStore) {
    console.warn(UncommonError)

    return
  }

  layerStore.dispatch({
    type: 'UPDATE_LAYER',
    payload: {
      state: {
        isDeletedOnEditor,
      },
    },
    skipTrace: !!skipTrace,
  })
}

export function duplicateLayerStoreById(_id: string) {
  const newId = uuid()

  const originLayer = getLayerStoreById(_id)
  const originalLayerState = originLayer.getState()

  const { type } = originalLayerState

  if (type === 'multi-layout') {
    // Clone multi-layout option set
    const optionSet = originalLayerState.optionSet?.find(ot => ot.type === EOptionSet.MULTI_LAYOUT_OPTION)

    if (!optionSet) return createLayerStore({ ...originalLayerState, _id: newId })

    // @ts-ignore
    let _layouts = optionSet.data[MULTI_LAYOUT_OPTION_TYPE].layouts.map(layout => ({ ...layout, _id: uuid() }))

    // Clone layers inside layouts
    _layouts = _layouts.map(_layout => {
      const _layerIds = _layout.layerIds.map(layerId => {
        const layerStore = getLayerStoreById(layerId)

        const newLayerId = uuid()

        createLayerStore({ ...layerStore.getState(), _id: newLayerId })

        return newLayerId
      })

      return {
        ..._layout,
        layerIds: _layerIds,
      }
    })

    // Create clone layer store
    const layerStore = createLayerStore({
      ...originalLayerState,
      _id: newId,
      // @ts-ignore
      optionSet: originalLayerState.optionSet!.map(ot => {
        if (ot === optionSet) {
          return {
            ...ot,
            data: {
              [MULTI_LAYOUT_OPTION_TYPE]: {
                _id: uuid(),
                layoutNumber: _layouts.length,
                layoutSelected: _layouts[0]._id,
                layouts: _layouts,
              },
            },
          }
        }

        return ot
      }),
    })

    return layerStore
  }

  // Create clone layer store
  const clonedLayer = createLayerStore({ ...originalLayerState, _id: newId })

  return clonedLayer
}

function removeAllLayerStore() {
  LayerStores.clear()
}

export const LayerStoreActions = {
  createLayerStore,
  getLayerStoreById,
  removeAllLayerStore,
}
