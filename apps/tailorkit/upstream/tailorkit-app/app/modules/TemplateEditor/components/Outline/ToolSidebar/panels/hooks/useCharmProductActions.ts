import { useCallback, useState } from 'react'
import type { CharmNodeSettings, CharmProductRef } from '~/types/psd'
import type { IVariant } from '~/types/shopify-product'
import type { TLayerStore } from '~/stores/modules/layer'
import { TemplateEditorStoreActions } from '~/stores/modules/template'
import { createCharmElement, type ElementCreationContext } from '../../../../Editor/utils/elementCreators'
import { getCharmLayerByInstanceId } from '~/stores/modules/charm-layer-index'
import { uuid } from '~/utils/uuid'

interface UseCharmProductActionsParams {
  getOrCreateCharmStore: () => TLayerStore | undefined
  elementContext: ElementCreationContext
  linkedProducts: CharmProductRef[]
  handleIncrementQuantity: (productId: string) => void
  handleDecrementQuantity: (productId: string) => void
}

export function useCharmProductActions({
  getOrCreateCharmStore,
  elementContext,
  linkedProducts,
  handleIncrementQuantity,
  handleDecrementQuantity,
}: UseCharmProductActionsParams) {
  const [swapModalActive, setSwapModalActive] = useState(false)
  const [swappingProductId, setSwappingProductId] = useState<string | null>(null)

  /** Open swap modal for a specific product */
  const handleOpenSwapModal = useCallback((productId: string) => {
    setSwappingProductId(productId)
    setSwapModalActive(true)
  }, [])

  /** Close swap modal */
  const handleCloseSwapModal = useCallback(() => {
    setSwapModalActive(false)
    setSwappingProductId(null)
  }, [])

  /** Handle swap product — replaces old product with new variant, preserving transforms */
  const handleSwapProduct = useCallback(
    (productId: string, newVariant: IVariant) => {
      const store = getOrCreateCharmStore()
      if (!store) return

      const currentSettings = store.getState().settings as CharmNodeSettings
      const oldProduct = currentSettings?.linkedProducts?.find(p => p._id === productId)
      if (!oldProduct) return

      // Extract price from new variant
      const productData = newVariant.product as any
      const rangePrice = productData?.priceRangeV2?.minVariantPrice
      const price = newVariant.price || rangePrice?.amount || '0.00'
      const newCurrencyCode = rangePrice?.currencyCode || 'USD'

      const newProduct: CharmProductRef = {
        _id: uuid(),
        shopifyProductId: newVariant.product?.id || '',
        selectedVariantId: newVariant.id,
        title: newVariant.displayName || newVariant.title,
        price,
        currencyCode: newCurrencyCode,
        thumbnailUrl: newVariant.image?.url || newVariant.product?.featuredImage?.url || '',
        transforms: oldProduct.transforms?.map(t => ({ ...t, instanceId: uuid() })) || [],
      }

      // Mark old CHARM layers as deleted
      if (oldProduct.transforms) {
        for (const transform of oldProduct.transforms) {
          const layer = getCharmLayerByInstanceId(transform.instanceId)
          if (layer) {
            layer.dispatch({
              type: 'UPDATE_LAYER',
              payload: { state: { isDeletedOnEditor: true } },
              skipTrace: true,
            })
          }
        }
      }

      // Remove old product and add new one
      store.dispatch({ type: 'REMOVE_LINKED_PRODUCT', payload: { productId } })
      store.dispatch({ type: 'ADD_LINKED_PRODUCT', payload: { product: newProduct } })

      // Create new CHARM layers for each transform
      for (const transform of newProduct.transforms || []) {
        const charmLayer = createCharmElement(elementContext, store.getState()._id, newProduct, transform)
        TemplateEditorStoreActions.addExtractedLayerStores([charmLayer])
      }
    },
    [getOrCreateCharmStore, elementContext]
  )

  /** Handle swap variant selection from swap modal */
  const handleSwapSelect = useCallback(
    (variants: IVariant[]) => {
      if (swappingProductId && variants.length > 0) {
        handleSwapProduct(swappingProductId, variants[0])
      }
      setSwapModalActive(false)
      setSwappingProductId(null)
    },
    [swappingProductId, handleSwapProduct]
  )

  /** Handle save defaults — persist intent AND reconcile canvas preview.
   * defaultQuantity is declarative metadata for storefront pre-fill.
   * Canvas transforms are synced to give merchant a visual preview. */
  const handleSaveDefaults = useCallback(
    (productId: string, isDefault: boolean, defaultQuantity: number) => {
      const store = getOrCreateCharmStore()
      if (!store) return

      store.dispatch({
        type: 'UPDATE_CHARM_PRODUCT_DEFAULTS',
        payload: { productId, isDefault, defaultQuantity },
      })

      // Reconcile canvas: add/remove charm instances to match defaultQuantity
      const settings = store.getState().settings as CharmNodeSettings
      const product = settings?.linkedProducts?.find(p => p._id === productId)
      const currentQty = product?.transforms?.length || 0
      const targetQty = isDefault ? defaultQuantity : 0
      const diff = targetQty - currentQty

      if (diff > 0) {
        for (let i = 0; i < diff; i++) handleIncrementQuantity(productId)
      } else if (diff < 0) {
        for (let i = 0; i < Math.abs(diff); i++) handleDecrementQuantity(productId)
      }

      // Clamp defaultQuantity to actual transforms placed (reducer may block if no empty nodes)
      if (isDefault && diff > 0) {
        const afterSettings = store.getState().settings as CharmNodeSettings
        const afterProduct = afterSettings?.linkedProducts?.find(p => p._id === productId)
        const actualQty = afterProduct?.transforms?.length || 0
        if (actualQty < defaultQuantity) {
          store.dispatch({
            type: 'UPDATE_CHARM_PRODUCT_DEFAULTS',
            payload: { productId, isDefault, defaultQuantity: actualQty || 1 },
          })
        }
      }
    },
    [getOrCreateCharmStore, handleIncrementQuantity, handleDecrementQuantity]
  )

  return {
    // Swap modal
    swapModalActive,
    swappingProductId,
    handleOpenSwapModal,
    handleCloseSwapModal,
    handleSwapSelect,
    // Actions
    handleSaveDefaults,
  }
}
