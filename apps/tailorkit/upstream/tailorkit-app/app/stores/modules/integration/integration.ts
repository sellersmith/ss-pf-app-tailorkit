/* eslint-disable max-lines */
/* eslint-disable max-len */
import unionBy from 'lodash/unionBy'
import flatten from 'lodash/flatten'
import { useMemo } from 'react'
import { createStore, useStore } from '~/libs/external-store'
import type { Step } from '~/libs/steps.client'
import { addSteps } from '~/libs/steps.client'
import getProductsListFromVariants from '~/modules/modals/ProductNVariantSelector/utilities/getProductListFromVariants'
import type {
  BaseImage,
  Integration as IntegrationType,
  LayerIntegration,
  MockUp,
  PrintArea,
  VariantIntegration,
} from '~/types/integration'
import type { IVariant } from '~/types/shopify-product'
import { EProductStatus } from '~/types/shopify-product'
import type { ViewPort } from '~/types/template'
import { uuid } from '~/utils/uuid'
import type { TLayerIntegrationStore } from './layerIntegration'
import {
  createLayerIntegrationStore,
  deleteLayerIntegrationStoreById,
  getLayerIntegrationStoreById,
} from './layerIntegration'
import { type IImageQuery } from '~/types/shopify-files'
import { duplicateLabel } from '~/utils/duplicateLabel'
import { SAVE_BAR_ID } from '~/constants/save-bar'
import { clearStaleLayerStores, getVariantsUpdatedAfterSelectingTemplate, stepCallback } from './fns'
import { getViewLayerIntegrationStoreByIds } from './viewLayerIntegration'
import cloneDeep from 'lodash/cloneDeep'

type Trace = {
  skipTrace?: boolean
}

type Action =
  | { type: 'INIT_DATA'; payload: { state: any } }
  | { type: 'RESET_STATE'; payload: any }
  | { type: 'UPDATE_INTEGRATION_TITLE'; payload: { title: string } }
  | {
      type: 'CREATE_PRINT_AREA'
      payload: { mockupId: string; printArea: PrintArea; layerStore: TLayerIntegrationStore }
    }
  | {
      type: 'UPDATE_PRINT_AREA_NAME'
      payload: { mockupId: string; printAreaId: string; name: PrintArea['name'] }
    }
  | {
      type: 'UPDATE_SORTABLE_PRINT_AREA'
      payload: { mockupId: string; printAreas: PrintArea[] }
    }
  | {
      type: 'UPDATE_TEMPLATE_SELECTED_FOR_PRINT_AREA'
      payload: { mockupId: string; printAreaId: string; template: PrintArea['template'] }
    }
  | {
      type: 'UPDATE_PRINT_AREA_PREVIEW_PRODUCT_IMAGE'
      payload: {
        mockupId: string
        printAreaId: string
        previewProductImage: PrintArea['previewProductImage']
      }
    }
  | { type: 'CREATE_MASK_LAYER'; payload: { mockupId: string; layer: LayerIntegration } }
  | {
      type: 'UPDATE_MOCKUP_ENABLE_CLIPPING_MASK'
      payload: { mockupId: string; enableClippingMask: MockUp['enableClippingMask'] }
    }
  | {
      type: 'UPDATE_SORTABLE_LAYER_ITEM'
      payload: { mockupId: string; layers: TLayerIntegrationStore[] }
    }
  | {
      type: 'SHOW_HIDE_LAYER_ITEM'
      payload: { mockupId: string; layer: TLayerIntegrationStore }
    }
  | {
      type: 'DUPLICATE_LAYER_ITEM'
      payload: { mockupId: string; layer: TLayerIntegrationStore }
    }
  | {
      type: 'DELETE_LAYER_ITEM'
      payload: { mockupId: string; layer: TLayerIntegrationStore; keepPrintArea?: boolean }
    }
  | {
      type: 'UPDATE_VIEW_PORT'
      payload: { viewport: ViewPort }
    }
  | {
      type: 'UPDATE_SELECTED_TAB'
      payload: { selectedTab: IntegrationType['selectedTab'] }
    }
  | { type: 'SET_SELECTED_VIEW'; payload: { mockupId: string; viewId?: string } }
  | {
      type: 'CREATE_VIEW'
      payload: {
        mockupId: string
        view: { _id: string; title: string; layers: string[]; overrides?: any; enableClippingMask?: boolean }
      }
    }
  | { type: 'DELETE_VIEW'; payload: { mockupId: string; viewId: string } }
  | { type: 'UPDATE_VIEW_TITLE'; payload: { mockupId: string; viewId: string; title: string } }
  | {
      type: 'UPDATE_VIEW_ASSETS'
      payload: {
        mockupId: string
        viewId: string
        baseImage?: any | null
        backgroundImage?: any | null
        maskImage?: any | null
        enableClippingMask?: boolean
      }
    }
  | { type: 'UPDATE_VIEW_LAYERS'; payload: { mockupId: string; viewId: string; layers: string[] } }
  | { type: 'ADD_LAYER_TO_VIEW'; payload: { mockupId: string; viewId: string; layerId: string | string[] } }
  | { type: 'REMOVE_LAYER_FROM_VIEW'; payload: { mockupId: string; viewId: string; layerId: string } }
  | { type: 'TOGGLE_VIEW_LAYER_VISIBILITY'; payload: { mockupId: string; viewId: string; layerId: string } }
  | { type: 'DUPLICATE_VIEW_LAYER'; payload: { mockupId: string; viewId: string; layerId: string } }
  | { type: 'DUPLICATE_LAYER_IN_VIEW'; payload: { mockupId: string; viewId: string; layerId: string } }
  | {
      type: 'PRODUCTS_VARIANTS_ADDED'
      payload: { variantsSelectedWithMockup: any[] }
    }
  | {
      type: 'UPDATED_PRODUCT_VARIANTS_SELECTED'
      payload: { mockup: MockUp; printAreas: PrintArea[]; newProductVariants: any[] }
    }
  | {
      type: 'DELETE_PRODUCT_SELECTED'
      payload: { variants: VariantIntegration[] }
    }
  | {
      type: 'UPDATE_BASE_IMAGE'
      payload: { mockupId: string; baseImage: BaseImage | null }
    }
  | {
      type: 'UPDATE_BACKGROUND_IMAGE'
      payload: { mockupId: string; backgroundImage: BaseImage | null }
    }
  | {
      type: 'UPDATE_SHOULD_NOT_SHOW_MODAL_AGAIN'
      payload: Partial<IntegrationType['config']>
    }
  | {
      type: 'UPDATE_MOCKUP_ADDED_LAYER_IMAGES'
      payload: { mockupId: string; imagesSelected: IImageQuery[] }
    }
  | {
      type: 'UPDATE_MOCKUP_VARIANT_LABEL'
      payload: { mockupId: string; variantLabel: string }
    }
  | {
      type: 'UPDATE_MOCKUP_STOREFRONT_LABEL'
      payload: { mockupId: string; storefrontLabel: string }
    }
  | {
      type: 'UPDATE_VIEW_OVERRIDES'
      payload: {
        mockupId: string
        viewId: string
        layerId: string
        patch: Partial<Pick<LayerIntegration, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'visible'>> & {
          mask?: LayerIntegration['mask']
        }
      }
    }
  | {
      type: 'UPDATE_PUBLISHED_AT'
      payload: { publishedAt: IntegrationType['publishedAt'] }
    }
  | {
      type: 'UPDATE_MOCKUPS_AFTER_SAVING_INTEGRATION'
    }
  | {
      type: 'REPLACE_TEMPORARY_WITH_SHOPIFY_VARIANTS'
      payload: { variants: IVariant[] }
    }
  | {
      type: 'UPDATE_ALL_VARIANTS_SELECTED'
      payload: { allSelectedVariants: any[] }
    }
  | {
      type: 'UPDATE_PRODUCT_AS_ACTIVE'
      payload: {
        productId: string
        productActivated: boolean
      }
    }
  | {
      type: 'FORCE_UPDATE_PRODUCT_STATUS_TO_ACTIVE_IF_SETTING_PRODUCT_ACTIVE'
    }

/** Set default to front because it's formal */
export const DEFAULT_PRINT_AREA_NAME = 'front'

export const DEFAULT_LAYER_INTEGRATION: LayerIntegration = {
  _id: '',
  printAreaId: '',
  layerId: '',
  x: 0,
  y: 0,
  width: 500,
  height: 500,
  rotation: 0,
  type: 'template',
  data: undefined,
  name: '',
  visible: true,
}

export const DEFAULT_PRINT_AREA: PrintArea = {
  _id: '',
  name: DEFAULT_PRINT_AREA_NAME,
  template: null,
  width: 500,
  height: 500,
  previewProductImage: null,
}

export const DEFAULT_INTEGRATION_STORE: IntegrationType = {
  _id: '',
  title: 'Untitled',
  variants: [],
  publishedAt: null,
  hasUnpublishedChanges: false,
  dimensionAlert: null,
  lastSavedAt: null,
  viewport: {
    left: 0,
    top: 0,
    scale: 1,
  },
  selectedTab: 0,
  config: {
    shouldNotShowModalConfirmPublishAgain: false,
    shouldNotShowModalConfirmRePublishAgain: false,
  },
  allVariantsIntegrated: [],
  variantIdsPublished: [],
}

export const IntegrationStore = createStore(proxyIntegrationReducer, DEFAULT_INTEGRATION_STORE)

/**
 * Serialized version of MockUp where layers are plain data instead of stores
 */
type SerializedMockUp = Omit<MockUp, 'layers'> & {
  layers: LayerIntegration[]
}

/**
 * Serialized version of VariantIntegration where mockup.layers are plain data
 */
type SerializedVariantIntegration = Omit<VariantIntegration, 'mockup'> & {
  mockup: SerializedMockUp
}

/**
 * Serialized integration state for snapshot storage
 */
type SerializedIntegrationState = Omit<IntegrationType, 'variants' | 'allVariantsIntegrated'> & {
  variants: SerializedVariantIntegration[]
  allVariantsIntegrated: SerializedVariantIntegration[]
}

// Store initial state snapshot for reset functionality (serialized data, not store references)
let initialIntegrationStateData: SerializedIntegrationState | null = null

/**
 * Type guard to check if a layer is a TLayerIntegrationStore (has getState method)
 * @param layer - Layer to check
 * @returns true if layer is a store with getState method
 */
export function isLayerStore(layer: unknown): layer is TLayerIntegrationStore {
  return typeof (layer as TLayerIntegrationStore)?.getState === 'function'
}

/**
 * Serialize layer stores to plain data for snapshotting.
 * This extracts the state from TLayerIntegrationStore objects so we can restore them later.
 *
 * IMPORTANT: We use cloneDeep to prevent mutations from affecting the snapshot.
 * Without deep cloning, changes to nested objects (like layer data) would mutate
 * the snapshot, breaking the discard functionality.
 *
 * @param variants - Array of variant integrations to serialize
 * @returns Serialized variants with plain layer data instead of store references
 */
function serializeVariantsForSnapshot(variants: VariantIntegration[]): SerializedVariantIntegration[] {
  return variants.map(variant => {
    // Handle case where mockup might be null/undefined
    if (!variant.mockup) {
      return cloneDeep(variant) as unknown as SerializedVariantIntegration
    }

    const layers = variant.mockup.layers || []
    const serializedLayers: LayerIntegration[] = layers.map((layer: TLayerIntegrationStore | LayerIntegration) => {
      // If it's a store, extract its state
      if (isLayerStore(layer)) {
        return layer.getState()
      }
      // Already plain data
      return layer as LayerIntegration
    })

    // Clone once at the end to avoid redundant deep cloning
    return cloneDeep({
      ...variant,
      mockup: {
        ...variant.mockup,
        layers: serializedLayers,
      },
    }) as SerializedVariantIntegration
  })
}

/**
 * Deserialize plain data back to layer stores.
 * Instead of deleting and recreating stores, reset existing stores' state.
 * This keeps store references stable so subscribers (like ViewLayerIntegrationStores) auto-update.
 *
 * @param serializedVariants - Array of serialized variants to deserialize
 * @returns Variants with layer stores reset to snapshot data
 */
function deserializeVariantsFromSnapshot(serializedVariants: SerializedVariantIntegration[]): VariantIntegration[] {
  return serializedVariants.map(variant => {
    // Handle case where mockup might be null/undefined
    if (!variant.mockup) {
      return variant as unknown as VariantIntegration
    }

    const layers = variant.mockup.layers || []
    const deserializedLayers: TLayerIntegrationStore[] = layers.map((layerData: LayerIntegration) => {
      const existingStore = layerData._id ? getLayerIntegrationStoreById(layerData._id) : null

      if (existingStore) {
        // Reset existing store to snapshot data (keeps references stable)
        existingStore.dispatch({
          type: 'UPDATE_LAYER',
          payload: { state: cloneDeep(layerData) },
          skipTrace: true,
        })
        return existingStore
      }

      // Create new store only if doesn't exist
      return createLayerIntegrationStore(cloneDeep(layerData))
    })

    return {
      ...variant,
      mockup: {
        ...variant.mockup,
        layers: deserializedLayers,
      },
    } as VariantIntegration
  })
}

// TODO: Chunk the code in this file more.
function integrationReducer(state: IntegrationType, action: Action & Trace) {
  switch (action.type) {
    case 'INIT_DATA': {
      const payload = action.payload

      const incomingState = payload.state as any

      const publishedAtTimestamp = incomingState?.publishedAt
        ? new Date(incomingState.publishedAt).getTime()
        : undefined
      const updatedAtTimestamp = incomingState?.updatedAt ? new Date(incomingState.updatedAt).getTime() : undefined

      const integrationUpdatedAfterPublish
        = Number.isFinite(publishedAtTimestamp) && Number.isFinite(updatedAtTimestamp)
          ? (updatedAtTimestamp as number) > (publishedAtTimestamp as number)
          : false

      const normalizedHasUnpublishedChanges
        = typeof incomingState?.hasUnpublishedChanges === 'boolean'
          ? incomingState.hasUnpublishedChanges
          : Boolean(
              incomingState?.publishedAt && (incomingState?.isAnyTemplateUpdated || integrationUpdatedAfterPublish)
            )

      const normalizedLastSavedAt
        = typeof incomingState?.lastSavedAt === 'number'
          ? incomingState.lastSavedAt
          : incomingState?.lastSavedAt === null
            ? null
            : Number.isFinite(updatedAtTimestamp)
              ? (updatedAtTimestamp as number)
              : (state.lastSavedAt ?? null)

      const newState = {
        ...state,
        ...incomingState,
        hasUnpublishedChanges: normalizedHasUnpublishedChanges,
        lastSavedAt: normalizedLastSavedAt,
      }

      // Snapshot initial state for discard functionality (serialize to avoid store reference issues)
      // We serialize variants to extract layer store data, so reset can recreate fresh stores
      initialIntegrationStateData = {
        ...newState,
        variants: serializeVariantsForSnapshot(newState.variants || []),
        allVariantsIntegrated: serializeVariantsForSnapshot(newState.allVariantsIntegrated || []),
      }

      return newState
    }

    case 'UPDATE_INTEGRATION_TITLE': {
      const { title } = action.payload

      return {
        ...state,
        title,
      }
    }

    case 'SET_SELECTED_VIEW': {
      const { mockupId, viewId } = action.payload
      const variants = state.variants.map(variant => {
        if (variant.mockup._id === mockupId) {
          variant.mockup.selectedViewId = viewId
        }
        return variant
      })
      return { ...state, variants }
    }

    case 'CREATE_VIEW': {
      const { mockupId, view } = action.payload
      const variants = state.variants.map(variant => {
        if (variant.mockup._id === mockupId) {
          const views = Array.isArray(variant.mockup.views) ? variant.mockup.views : []
          variant.mockup.views = [...views, { ...view } as any]
          variant.mockup.selectedViewId = view._id
        }
        return variant
      })
      return { ...state, variants }
    }

    case 'DELETE_VIEW': {
      const { mockupId, viewId } = action.payload
      const variants = state.variants.map(variant => {
        if (variant.mockup._id === mockupId) {
          const views = Array.isArray(variant.mockup.views) ? variant.mockup.views : []
          variant.mockup.views = views.filter((v: any) => v._id !== viewId)
          if (variant.mockup.selectedViewId === viewId) {
            variant.mockup.selectedViewId = variant.mockup.views?.[0]?._id
          }
        }
        return variant
      })
      return { ...state, variants }
    }

    case 'UPDATE_VIEW_TITLE': {
      const { mockupId, viewId, title } = action.payload
      const variants = state.variants.map(variant => {
        if (variant.mockup._id === mockupId && Array.isArray(variant.mockup.views)) {
          variant.mockup.views = variant.mockup.views.map((v: any) => (v._id === viewId ? { ...v, title } : v))
        }
        return variant
      })
      return { ...state, variants }
    }

    case 'UPDATE_VIEW_ASSETS': {
      const { mockupId, viewId, ...assets } = action.payload
      const variants = state.variants.map(variant => {
        if (variant.mockup._id === mockupId && Array.isArray(variant.mockup.views)) {
          variant.mockup.views = variant.mockup.views.map((v: any) => {
            if (v._id !== viewId) return v

            return { ...v, ...assets }
          })
        }
        return variant
      })
      return { ...state, variants }
    }

    case 'UPDATE_VIEW_LAYERS': {
      const { mockupId, viewId, layers } = action.payload
      const variants = state.variants.map(variant => {
        if (variant.mockup._id === mockupId && Array.isArray(variant.mockup.views)) {
          // Normalize to string ids if mixed objects are passed in
          const normalized = (layers || []).map((it: any) => (typeof it === 'string' ? it : it?._id)).filter(Boolean)
          variant.mockup.views = variant.mockup.views.map((v: any) => {
            if (v._id !== viewId) return v

            // Filter overrides to only those that still exist in the view's layer list
            const currentOverrides = { ...(v.overrides || {}) }
            const filteredOverrides = Object.fromEntries(
              Object.entries(currentOverrides).filter(([lid]) => normalized.includes(String(lid)))
            )

            // If the view has no layers left, clear overrides entirely
            const nextOverrides = normalized.length === 0 ? {} : filteredOverrides

            return { ...v, layers: normalized, overrides: nextOverrides }
          })
        }
        return variant
      })
      return { ...state, variants }
    }

    case 'ADD_LAYER_TO_VIEW': {
      const { mockupId, viewId, layerId } = action.payload
      const variants = state.variants.map(variant => {
        if (variant.mockup._id === mockupId && Array.isArray(variant.mockup.views)) {
          const layerIds = Array.isArray(layerId) ? layerId : [layerId]
          const globalLayers = variant.mockup.layers || []

          variant.mockup.views = variant.mockup.views.map((v: any) => {
            if (v._id !== viewId) return v

            const nextLayerList = Array.from(
              new Set([
                ...layerIds,
                ...(v.layers || []).map((it: any) => (typeof it === 'string' ? it : it?._id)).filter(Boolean),
              ])
            )

            // Initialize overrides for newly added mask layer with its current geometry
            const overrides = { ...(v.overrides || {}) }
            layerIds.forEach(id => {
              const store = globalLayers.find((ls: any) => ls.getState()._id === id)
              const st = store?.getState()
              if (!st) return
              if (st.type === 'mask') {
                const basePatch: any = {
                  x: st.x,
                  y: st.y,
                  width: st.width,
                  height: st.height,
                  rotation: st.rotation,
                }
                overrides[id] = { ...(overrides[id] || {}), ...basePatch }
              }
            })

            return { ...v, layers: nextLayerList, overrides }
          })
        }
        return variant
      })
      return { ...state, variants }
    }

    case 'REMOVE_LAYER_FROM_VIEW': {
      const { mockupId, viewId, layerId } = action.payload
      const variants = state.variants.map(variant => {
        if (variant.mockup._id === mockupId && Array.isArray(variant.mockup.views)) {
          variant.mockup.views = variant.mockup.views.map((v: any) => {
            if (v._id !== viewId) return v
            const currentIds = (v.layers || [])
              .map((it: any) => (typeof it === 'string' ? it : it?._id))
              .filter(Boolean)
            const next = currentIds.filter((id: string) => id !== layerId)

            // If the removed layer is the mask geometry layer, also clear maskImage for this view
            const removedLayer = (variant.mockup.layers || []).find((ls: any) => ls.getState()._id === layerId)
            const isMaskGeometryLayer = removedLayer?.getState()?.type === 'mask'

            // Prune overrides for removed layer; clear all if view becomes empty
            const currentOverrides = { ...(v.overrides || {}) }
            if (currentOverrides && Object.prototype.hasOwnProperty.call(currentOverrides, layerId)) {
              delete (currentOverrides as any)[layerId]
            }
            const nextOverrides = next.length === 0 ? {} : currentOverrides

            return {
              ...v,
              layers: next,
              overrides: nextOverrides,
              ...(isMaskGeometryLayer ? { maskImage: null } : {}),
            }
          })
        }
        return variant
      })
      return { ...state, variants }
    }

    case 'TOGGLE_VIEW_LAYER_VISIBILITY': {
      const { mockupId, viewId, layerId } = action.payload
      const variants = state.variants.map(variant => {
        if (variant.mockup._id === mockupId && Array.isArray(variant.mockup.views)) {
          variant.mockup.views = variant.mockup.views.map((v: any) => {
            if (v._id !== viewId) return v
            const overrides = { ...(v.overrides || {}) }
            const current = overrides[layerId] || {}
            const nextVisible = !(current.visible ?? true)
            overrides[layerId] = { ...current, visible: nextVisible }
            return { ...v, overrides }
          })
        }
        return variant
      })
      return { ...state, variants }
    }

    case 'DUPLICATE_VIEW_LAYER': {
      const { mockupId, viewId, layerId } = action.payload
      const variants = state.variants.map(variant => {
        if (variant.mockup._id === mockupId && Array.isArray(variant.mockup.views)) {
          variant.mockup.views = variant.mockup.views.map((v: any) => {
            if (v._id !== viewId) return v
            const list = Array.isArray(v.layers) ? [...v.layers] : []
            const idx = list.indexOf(layerId)
            if (idx >= 0) {
              list.splice(idx + 1, 0, layerId)
            }
            return { ...v, layers: list }
          })
        }
        return variant
      })
      return { ...state, variants }
    }

    case 'DUPLICATE_LAYER_IN_VIEW': {
      const { mockupId, viewId, layerId } = action.payload
      const variants = state.variants.map(variant => {
        if (variant.mockup._id === mockupId && Array.isArray(variant.mockup.views)) {
          const sourceStore = (variant.mockup.layers || []).find((ls: any) => ls.getState()._id === layerId)
          if (!sourceStore) return variant
          const newId = uuid()
          const duplicatedStore = createLayerIntegrationStore({
            ...sourceStore.getState(),
            _id: newId,
            layerId: newId,
          })
          // push new store globally so canvas can resolve it
          variant.mockup.layers = [...variant.mockup.layers, duplicatedStore]

          // add only to this view after the original
          variant.mockup.views = variant.mockup.views.map((v: any) => {
            if (v._id !== viewId) return v
            const list = Array.isArray(v.layers) ? [...v.layers] : []
            const idx = list.indexOf(layerId)
            if (idx >= 0) {
              list.splice(idx + 1, 0, newId)
            } else {
              list.push(newId)
            }
            return { ...v, layers: list }
          })
        }
        return variant
      })
      return { ...state, variants }
    }

    case 'CREATE_MASK_LAYER': {
      const { layer, mockupId } = action.payload

      let pushed = false

      const _variants = state.variants.map(variant => {
        if (variant.mockup._id === mockupId && !pushed) {
          const _id = uuid()
          const layerIntegrationStore = createLayerIntegrationStore({ ...layer, _id })

          variant.mockup.layers.push(layerIntegrationStore)

          pushed = true

          return variant
        }

        return variant
      })

      const _state = {
        ...state,
        variants: _variants,
      }

      return _state
    }

    case 'CREATE_PRINT_AREA': {
      const { mockupId, printArea, layerStore } = action.payload

      const variants = state.variants.map(variant => {
        if (variant.mockup._id === mockupId) {
          return {
            ...variant,
            mockup: {
              ...variant.mockup,
              layers: [layerStore, ...variant.mockup.layers],
            },
            printAreas: [
              {
                ...printArea,
                name: duplicateLabel(
                  printArea.name,
                  variant.printAreas.map(printArea => ({ label: printArea.name }))
                ),
              },
              ...variant.printAreas,
            ],
          }
        }

        return variant
      })

      return { ...state, variants }
    }

    case 'UPDATE_PRINT_AREA_NAME': {
      const { mockupId, printAreaId, name } = action.payload

      const variants = state.variants.map(variant => {
        if (variant.mockup._id === mockupId) {
          return {
            ...variant,
            printAreas: variant.printAreas.map(printArea => {
              if (printArea._id === printAreaId) {
                return {
                  ...printArea,
                  name,
                }
              }

              return printArea
            }),
          }
        }

        return variant
      })

      return { ...state, variants }
    }

    case 'UPDATE_PRINT_AREA_PREVIEW_PRODUCT_IMAGE': {
      const { mockupId, printAreaId, previewProductImage } = action.payload

      const variants = state.variants.map(variant => {
        if (variant.mockup._id === mockupId) {
          return {
            ...variant,
            printAreas: variant.printAreas.map(printArea => {
              if (printArea._id === printAreaId) {
                return {
                  ...printArea,
                  previewProductImage,
                }
              }

              return printArea
            }),
          }
        }

        return variant
      })

      return { ...state, variants }
    }

    case 'UPDATE_SORTABLE_PRINT_AREA': {
      const { mockupId, printAreas } = action.payload

      const variants = state.variants.map(variant => {
        if (variant.mockup._id === mockupId) {
          variant.printAreas = printAreas

          return variant
        }

        return variant
      })

      return { ...state, variants }
    }

    case 'UPDATE_TEMPLATE_SELECTED_FOR_PRINT_AREA': {
      const { mockupId, printAreaId, template } = action.payload

      const variants = getVariantsUpdatedAfterSelectingTemplate(mockupId, printAreaId, state.variants, template)

      return { ...state, variants }
    }

    case 'UPDATE_MOCKUP_ENABLE_CLIPPING_MASK': {
      const { mockupId, enableClippingMask } = action.payload

      const _variants = state.variants.map(variant => {
        if (variant.mockup._id === mockupId) {
          variant.mockup.enableClippingMask = enableClippingMask

          return variant
        }

        return variant
      })

      const _state = {
        ...state,
        variants: _variants,
      }

      return _state
    }

    case 'UPDATE_SORTABLE_LAYER_ITEM': {
      const { mockupId, layers } = action.payload

      const _variants = state.variants.map(variant => {
        if (variant.mockup._id === mockupId) {
          variant.mockup.layers = layers

          return variant
        }

        return variant
      })

      const _state = {
        ...state,
        variants: _variants,
      }

      return _state
    }

    case 'SHOW_HIDE_LAYER_ITEM': {
      const { mockupId, layer } = action.payload
      const layerState = layer.getState()

      const _variants = state.variants.map(variant => {
        if (variant.mockup._id === mockupId) {
          const layers = variant.mockup.layers

          const _layers = layers.map(layer => {
            if (layer.getState()._id === layerState._id) {
              layer.dispatch({
                type: 'UPDATE_LAYER',
                payload: {
                  state: {
                    ...layerState,
                    visible: !layerState.visible,
                  },
                },
              })
            }

            return layer
          })

          return { ...variant, mockup: { ...variant.mockup, layers: _layers } }
        }

        return variant
      })

      return {
        ...state,
        variants: _variants,
      }
    }

    case 'DUPLICATE_LAYER_ITEM': {
      const { mockupId, layer } = action.payload

      let duplicated = false
      const _variants = state.variants.map(variant => {
        if (variant.mockup._id === mockupId && !duplicated) {
          const layers = variant.mockup.layers
          const layerIndex = layers.indexOf(layer)
          const layerId = uuid()
          const duplicatedLayer = createLayerIntegrationStore({
            ...layer.getState(),
            _id: layerId,
            layerId,
            data: {
              ...layer.getState().data,
              metadata: {
                ...layer.getState().data?.metadata,
                duplicatedFrom: layer.getState()._id,
              },
            },
          })

          layers.splice(layerIndex + 1, 0, duplicatedLayer)

          duplicated = true

          return variant
        }

        return variant
      })

      const _state = {
        ...state,
        variants: _variants,
      }

      return _state
    }

    case 'DELETE_LAYER_ITEM': {
      const { mockupId, layer, keepPrintArea } = action.payload

      const _variants = state.variants.map(variant => {
        if (variant.mockup._id === mockupId) {
          const layers = variant.mockup.layers

          const layerState = layer.getState()

          const { _id, printAreaId } = layerState

          const newLayers = layers.filter(_layer => _layer.getState()._id !== _id)

          variant.mockup.layers = newLayers

          // Delete print areas if there is no layers created by print area anymore
          const notExistPrintAreaAnymore = !newLayers.filter(_layer => _layer.getState().printAreaId === printAreaId)
            .length

          if (keepPrintArea) {
            variant.printAreas = variant.printAreas.map(printArea => {
              const template = printArea._id === printAreaId ? null : printArea.template

              return { ...printArea, template }
            })
          } else if (notExistPrintAreaAnymore) {
            variant.printAreas = variant.printAreas.filter(printArea => printArea._id !== printAreaId)
          }

          // Delete layer integration store also
          deleteLayerIntegrationStoreById(_id)

          return variant
        }

        return variant
      })

      const _state = {
        ...state,
        variants: _variants,
      }

      return _state
    }

    case 'UPDATE_VIEW_PORT': {
      const { viewport } = action.payload

      const _state = {
        ...state,
        viewport,
      }

      return _state
    }

    case 'UPDATE_SELECTED_TAB': {
      const { selectedTab } = action.payload

      const _state = {
        ...state,
        selectedTab,
      }

      return _state
    }

    case 'PRODUCTS_VARIANTS_ADDED': {
      const { variants, allVariantsIntegrated = [] } = state
      const { variantsSelectedWithMockup } = action.payload

      const mergedVariants = (variants: any[], newVariants: any) => {
        return unionBy([...variants, ...newVariants], 'id')
      }

      return {
        ...state,
        variants: mergedVariants(variants, variantsSelectedWithMockup),
        allVariantsIntegrated: mergedVariants(allVariantsIntegrated, variantsSelectedWithMockup),
      }
    }

    case 'UPDATED_PRODUCT_VARIANTS_SELECTED': {
      const variants = state.variants
      const { mockup, printAreas, newProductVariants } = action.payload

      const newVariantsSelectedWithMockup = generateVariantsWithMockup(newProductVariants, printAreas, mockup)

      const getGroupMockup = (variants: any[]) => {
        const group: any = {}
        variants.forEach(variant => {
          if (!variant) return

          const mockupRef = variant.mockup
          if (!mockupRef) return

          const mockupId = typeof mockupRef === 'string' ? mockupRef : mockupRef._id
          if (!mockupId) return

          group[mockupId] = [...(group[mockupId] ?? []), variant]
        })

        return group
      }

      const getNewVariants = (groupVariants: any, newVariants: any[]) => {
        const mockupId = typeof mockup === 'string' ? mockup : mockup?._id
        if (mockupId) {
          groupVariants[mockupId] = newVariants
        }

        return flatten(Object.values(groupVariants))
      }

      const groupVariants = getGroupMockup(variants)
      const _groupAllVariants = getGroupMockup(state.allVariantsIntegrated || [])

      return {
        ...state,
        variants: getNewVariants(groupVariants, newVariantsSelectedWithMockup),
        allVariantsIntegrated: getNewVariants(_groupAllVariants, newVariantsSelectedWithMockup),
      }
    }

    case 'DELETE_PRODUCT_SELECTED': {
      const { variants: _variants, allVariantsIntegrated = [] } = state
      const { variants } = action.payload

      const filteredVariants = (_variants: any[]) => {
        return _variants.filter(_v => !variants.find((v: any) => v.id === _v.id))
      }

      const newVariants = filteredVariants(_variants)
      const _allVariantsIntegrated = filteredVariants(allVariantsIntegrated)

      return {
        ...state,
        variants: newVariants,
        allVariantsIntegrated: _allVariantsIntegrated,
      }
    }

    case 'UPDATE_BASE_IMAGE': {
      const { mockupId, baseImage } = action.payload

      const _variants = state.variants.map(variant => {
        if (variant.mockup._id === mockupId) {
          variant.mockup.baseImage = baseImage

          return variant
        }

        return variant
      })
      return {
        ...state,
        variants: _variants,
      }
    }

    case 'UPDATE_BACKGROUND_IMAGE': {
      const { mockupId, backgroundImage } = action.payload

      const _variants = state.variants.map(variant => {
        if (variant.mockup._id === mockupId) {
          variant.mockup.backgroundImage = backgroundImage

          return variant
        }

        return variant
      })
      return {
        ...state,
        variants: _variants,
      }
    }

    case 'UPDATE_SHOULD_NOT_SHOW_MODAL_AGAIN': {
      const { ...keys } = action.payload

      return {
        ...state,
        config: {
          ...state.config,
          ...keys,
        },
      }
    }

    case 'UPDATE_MOCKUP_ADDED_LAYER_IMAGES': {
      const { mockupId, imagesSelected } = action.payload
      const _variants = state.variants.map(variant => {
        if (variant.mockup._id === mockupId) {
          const { layers } = variant.mockup
          const currentLayerImages: any[] = []
          const currentLayerNonImages: any[] = []

          // Separate image and non-image layers in a single pass
          layers.forEach(layer => {
            const { type } = layer.getState()
            if (type === 'image') {
              currentLayerImages.push(layer)
            } else {
              currentLayerNonImages.push(layer)
            }
          })

          const createdLayerStores: any[] = []

          imagesSelected.forEach(media => {
            let { width, height } = media.image

            const {
              alt,
              image: { originalSrc, metadata },
            } = media

            const existed = currentLayerImages.find(layer => {
              const { type, data: { src = '' } = {} } = layer.getState()
              return type === 'image' && originalSrc === src
            })

            if (existed) {
              // Already have this image layer globally; nothing to create
              return
            }

            // Fit to base image bounds if larger
            const productFeaturedImage = state.variants[0].product?.featuredImage
            const mockupProductVariantImage = state.variants.find(v => !!v.image)
            const mockupBaseImage = state.variants.find(v => !!v.mockup.baseImage?.url)

            const productBaseImage = mockupBaseImage
              ? mockupBaseImage?.mockup?.baseImage
              : mockupProductVariantImage?.image

            const { width: baseImageWidth = 0, height: baseImageHeight = 0 }
              = productBaseImage || productFeaturedImage || {}

            if (width > baseImageWidth || height > baseImageHeight) {
              const maskLayerRatio = width / height
              const baseImageRatio = baseImageWidth / baseImageHeight

              if (maskLayerRatio < baseImageRatio) {
                height = baseImageHeight
                width = height * maskLayerRatio
              } else {
                width = baseImageWidth
                height = width / maskLayerRatio
              }
            }

            const _id = uuid()
            const store = createLayerIntegrationStore({
              ...DEFAULT_LAYER_INTEGRATION,
              _id,
              layerId: _id,
              type: 'image',
              width,
              height,
              data: { src: originalSrc, alt, metadata },
            })
            createdLayerStores.push(store)
          })

          // Non-destructive: keep all existing layers, append newly created image layers (if any)
          if (createdLayerStores.length > 0) {
            variant.mockup.layers = [...layers, ...createdLayerStores]
          }

          return variant
        }

        return variant
      })

      return {
        ...state,
        variants: _variants,
      }
    }

    case 'UPDATE_MOCKUP_VARIANT_LABEL': {
      const { mockupId, variantLabel } = action.payload
      const variants = state.variants

      const _variants = variants.map(variant => {
        if (variant.mockup._id === mockupId) {
          variant.mockup = {
            ...variant.mockup,
            variantLabel,
          }
        }

        return variant
      })

      return {
        ...state,
        variants: _variants,
      }
    }

    case 'UPDATE_MOCKUP_STOREFRONT_LABEL': {
      const { mockupId, storefrontLabel } = action.payload
      const variants = state.variants

      const _variants = variants.map(variant => {
        if (variant.mockup._id === mockupId) {
          variant.mockup = {
            ...variant.mockup,
            storefrontLabel,
          }
        }

        return variant
      })

      return {
        ...state,
        variants: _variants,
      }
    }

    case 'UPDATE_VIEW_OVERRIDES': {
      const { mockupId, viewId, layerId, patch } = action.payload
      const variants = state.variants

      const _variants = variants.map(variant => {
        if (variant.mockup._id === mockupId) {
          const views = (variant.mockup.views || []).map(v => {
            if (v._id !== viewId) return v
            const overrides = { ...(v.overrides || {}) }
            overrides[layerId] = { ...(overrides[layerId] || {}), ...patch }
            return { ...v, overrides }
          })
          variant.mockup = { ...variant.mockup, views }
        }
        return variant
      })

      return { ...state, variants: _variants }
    }

    case 'UPDATE_PUBLISHED_AT': {
      const { publishedAt } = action.payload

      return {
        ...state,
        publishedAt,
        hasUnpublishedChanges: false,
        lastSavedAt: publishedAt ? (state.lastSavedAt ?? Date.now()) : (state.lastSavedAt ?? null),
      }
    }

    case 'UPDATE_MOCKUPS_AFTER_SAVING_INTEGRATION': {
      const variants = state.variants
      const _variants = variants.map(variant => {
        const mockup = variant.mockup

        return {
          ...variant,
          mockup: {
            ...mockup,
          },
        }
      })

      const savedAt = Date.now()
      const newState = {
        ...state,
        variants: _variants,
        hasUnpublishedChanges: Boolean(state.publishedAt),
        lastSavedAt: savedAt,
      }

      // Update snapshot after successful save (serialize to avoid store reference issues)
      // This ensures discard resets to last saved state, not page load state
      initialIntegrationStateData = {
        ...newState,
        variants: serializeVariantsForSnapshot(newState.variants || []),
        allVariantsIntegrated: serializeVariantsForSnapshot(newState.allVariantsIntegrated || []),
      }

      return newState
    }

    case 'REPLACE_TEMPORARY_WITH_SHOPIFY_VARIANTS': {
      const { variants: shopifyVariants } = action.payload

      const newState = {
        ...state,
        variants: state.variants.map((tempVariant, index) => {
          // Only replace temporary variants
          if (!tempVariant.id.startsWith('temp-variant-')) {
            return tempVariant
          }

          // Get corresponding Shopify variant
          const shopifyVariant = shopifyVariants[index]

          if (!shopifyVariant) {
            console.warn(`[TempProductFlow] REDUCER: No Shopify variant found for index ${index}`)
            return tempVariant
          }

          // Merge: Keep editor data (mockup, printAreas), replace IDs and product
          return {
            ...shopifyVariant,
            mockup: tempVariant.mockup,
            printAreas: tempVariant.printAreas,
          }
        }),
      }

      return newState
    }

    case 'UPDATE_ALL_VARIANTS_SELECTED': {
      const allVariantsIntegrated = state.allVariantsIntegrated || []
      const { allSelectedVariants } = action.payload

      return {
        ...state,
        allVariantsIntegrated: unionBy([...allVariantsIntegrated, ...allSelectedVariants], 'id'),
      }
    }

    case 'UPDATE_PRODUCT_AS_ACTIVE': {
      const { productActivated, productId } = action.payload

      return {
        ...state,
        variants: state.variants.map(variant => {
          if (variant.productId === productId) {
            return {
              ...variant,
              productActivated,
            }
          }

          return variant
        }),
      }
    }

    case 'FORCE_UPDATE_PRODUCT_STATUS_TO_ACTIVE_IF_SETTING_PRODUCT_ACTIVE': {
      const newState = {
        ...state,
        variants: state.variants.map(variant => {
          let product = variant.product

          if (variant.productActivated && product) {
            product = { ...product, status: EProductStatus.ACTIVE }

            // Remove product activated property
            delete variant['productActivated']
          }

          return {
            ...variant,
            product,
          }
        }),
      }

      return newState
    }

    case 'RESET_STATE': {
      if (!initialIntegrationStateData) {
        return state
      }

      // Clear stale stores (layers added during editing that don't exist in snapshot)
      const allSnapshotVariants = [
        ...(initialIntegrationStateData.variants || []),
        ...(initialIntegrationStateData.allVariantsIntegrated || []),
      ]
      clearStaleLayerStores([...(state.variants || []), ...(state.allVariantsIntegrated || [])], allSnapshotVariants)

      // Reset existing stores / create missing ones from snapshot data
      const restoredVariants = deserializeVariantsFromSnapshot(initialIntegrationStateData.variants || [])
      const restoredAllVariantsIntegrated = deserializeVariantsFromSnapshot(
        initialIntegrationStateData.allVariantsIntegrated || []
      )

      return {
        ...initialIntegrationStateData,
        variants: restoredVariants,
        allVariantsIntegrated: restoredAllVariantsIntegrated,
      }
    }

    default:
      return state
  }
}

function proxyIntegrationReducer(state: IntegrationType, action: Action & Trace) {
  const updatedState = integrationReducer(state, action)

  const skipTrace = action.skipTrace

  if (!skipTrace) {
    const step: Step = {
      type: 'UPDATE_INTEGRATION_STORE',
      fromData: state,
      toData: updatedState,
      callback: (target: any, props: string | symbol, value: any) =>
        stepCallback(target, props, value, SAVE_BAR_ID.PERSONALIZED_PRODUCTS_SAVE_BAR),
    }

    addSteps(step)
  }

  return updatedState
}

export function getLayerIntegrationStoresByMockupId(mockupId: string, viewId?: string) {
  const integrationState = IntegrationStore.getState()

  const variants = integrationState.variants.filter(variant => variant.mockup._id === mockupId)
  const firstVariant = variants[0]

  const layerStores = firstVariant?.mockup?.layers || []
  const layerStoresByViewId = viewId
    ? layerStores.map(layerStore => getViewLayerIntegrationStoreByIds(mockupId, viewId, layerStore.getState()._id))
    : layerStores

  return layerStoresByViewId
}

/**
 * Groups product variants by their mockup ID.
 * If variants are not provided, falls back to variants from the IntegrationStore.
 * Returns a memoized object mapping mockup IDs to arrays of variants.
 *
 * @param variants - Optional array of variants to group. If not provided, uses variants from the store.
 * @returns An object where keys are mockup IDs (strings) and values are arrays of VariantIntegration.
 */
export function useGroupProductBase(variants?: VariantIntegration[]) {
  const variantsIntegrated = useStore(IntegrationStore, state => state.variants)
  const _variants = variants || variantsIntegrated

  // Compute grouped variants directly (no intermediate state = always fresh!)
  return useMemo(() => {
    const _group: { [key: string]: VariantIntegration[] } = {}

    _variants.forEach(variant => {
      if (!variant) return

      if (variant.mockup) {
        const mockupId = typeof variant.mockup === 'string' ? variant.mockup : variant.mockup._id
        _group[mockupId] = [...(_group[mockupId] ?? []), variant]
      }
    })

    return _group
  }, [_variants])
}

const generateVariantsWithMockup = (variants: IVariant[], printAreas: PrintArea[], mockup: MockUp) => {
  const productsList = getProductsListFromVariants(variants)

  const variantsSelectedWithMockup = productsList.map(product => {
    const variantFormatted = product.variants.map(variant => ({
      ...variant,
      printAreas,
      mockup,
    }))

    return variantFormatted
  })

  return variantsSelectedWithMockup.flat()
}
