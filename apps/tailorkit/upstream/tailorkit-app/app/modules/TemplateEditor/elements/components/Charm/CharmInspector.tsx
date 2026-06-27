import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BlockStack, Box, Button, InlineStack, Text, Thumbnail } from '@shopify/polaris'
import { ImageIcon, RefreshIcon, DeleteIcon } from '@shopify/polaris-icons'
import { useStore } from '~/libs/external-store'
import type { TLayerStore } from '~/stores/modules/layer'
import { getLayerStoreById } from '~/stores/modules/layer'
import { registerCharmLayer, unregisterCharmLayer } from '~/stores/modules/charm-layer-index'
import type { CharmNodeSettings, CharmProductRef, CharmSettings, CharmTransformInstance } from '~/types/psd'
import ProductNVariantSelector from '~/modules/modals/ProductNVariantSelector'
import type { IVariant } from '~/types/shopify-product'
import { uuid } from '~/utils/uuid'

/**
 * Get transform data from parent CHARM_NODE (single source of truth)
 * instead of from stale productRef.transforms copy
 */
function getTransformFromParent(
  nodeId: string,
  productId: string,
  instanceId: string
): CharmTransformInstance | undefined {
  const parentStore = getLayerStoreById(nodeId)
  if (!parentStore) return undefined

  const parentSettings = parentStore.getState().settings as CharmNodeSettings | undefined
  const products = parentSettings?.linkedProducts || []
  const product = products.find((p: CharmProductRef) => p._id === productId)
  return product?.transforms?.find((t: CharmTransformInstance) => t.instanceId === instanceId)
}

interface CharmInspectorProps {
  layerStore: TLayerStore
}

export function CharmInspector({ layerStore }: CharmInspectorProps) {
  const { t } = useTranslation()
  const settings = useStore(layerStore, state => state.settings) as CharmSettings | undefined
  const [swapModalActive, setSwapModalActive] = useState(false)

  const handleRemoveCharm = useCallback(() => {
    if (!settings?.nodeId || !settings?.productRef) return

    const parentStore = getLayerStoreById(settings.nodeId)
    const instanceId = settings.productRef.instanceId
    const productId = settings.productRef._id

    if (!parentStore || !instanceId || !productId) return

    // Get transform from parent (source of truth) for undo metadata
    const transform = getTransformFromParent(settings.nodeId, productId, instanceId)

    // Use atomic DELETE_CHARM_INSTANCE for proper undo/redo support
    parentStore.dispatch({
      type: 'DELETE_CHARM_INSTANCE',
      payload: {
        productId,
        instanceId,
        deletedTransform: transform,
        productRef: settings.productRef,
      },
    })

    // Mark this CHARM layer as deleted (for undo/redo support)
    layerStore.dispatch({
      type: 'UPDATE_LAYER',
      payload: { state: { isDeletedOnEditor: true } },
      skipTrace: true,
    })
  }, [settings, layerStore])

  const handleSwapCharm = useCallback(() => {
    setSwapModalActive(true)
  }, [])

  const handleSwapProductSelect = useCallback(
    (variants: IVariant[]) => {
      if (!variants.length || !settings?.nodeId || !settings?.productRef) {
        setSwapModalActive(false)
        return
      }

      const parentStore = getLayerStoreById(settings.nodeId)
      const currentInstanceId = settings.productRef.instanceId
      const currentProductId = settings.productRef._id

      if (!parentStore || !currentInstanceId || !currentProductId) {
        setSwapModalActive(false)
        return
      }

      const variant = variants[0]
      const productData = variant.product as any
      const rangePrice = productData?.priceRangeV2?.minVariantPrice
      const price = variant.price || rangePrice?.amount || '0.00'
      const currencyCode = rangePrice?.currencyCode || 'USD'

      // Get current transform from parent (source of truth) to preserve position
      const currentTransform = getTransformFromParent(settings.nodeId, currentProductId, currentInstanceId)
      const newInstanceId = uuid()

      // Create new product reference with preserved transform
      // Charm identity = Product (not variant). Variant is optional pre-selection for add-to-cart.
      const newProduct: CharmProductRef = {
        _id: uuid(),
        shopifyProductId: variant.product?.id || '',
        selectedVariantId: variant.id, // Pre-select the variant merchant chose
        title: variant.displayName || variant.title,
        price,
        currencyCode,
        thumbnailUrl: variant.image?.url || variant.product?.featuredImage?.url || '',
        transforms: currentTransform ? [{ ...currentTransform, instanceId: newInstanceId }] : [],
      }

      // Remove old product transform
      parentStore.dispatch({
        type: 'DECREMENT_CHARM_QUANTITY',
        payload: { productId: currentProductId, instanceId: currentInstanceId },
      })

      // Add new product with the transform
      parentStore.dispatch({
        type: 'ADD_LINKED_PRODUCT',
        payload: { product: newProduct },
      })

      // Update this CHARM layer's productRef - only store reference (instanceId), not position data
      // Position is always read from parent CHARM_NODE (source of truth)
      layerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            settings: {
              ...settings,
              productRef: {
                _id: newProduct._id,
                shopifyProductId: newProduct.shopifyProductId,
                selectedVariantId: newProduct.selectedVariantId,
                title: newProduct.title,
                price: newProduct.price,
                currencyCode: newProduct.currencyCode,
                thumbnailUrl: newProduct.thumbnailUrl,
                instanceId: newInstanceId, // Reference to look up transform in parent
              },
            },
          },
        },
      })

      // Update charmLayerIndex: unregister old instanceId, register new one
      unregisterCharmLayer(currentInstanceId)
      registerCharmLayer(newInstanceId, layerStore)

      setSwapModalActive(false)
    },
    [settings, layerStore]
  )

  if (!settings?.productRef) {
    return (
      <Box padding="400">
        <BlockStack gap="200" align="center">
          <Thumbnail source={ImageIcon} alt="No charm" size="small" />
          <Text as="p" variant="bodySm" tone="subdued" alignment="center">
            {t('no-charm-product-assigned')}
          </Text>
        </BlockStack>
      </Box>
    )
  }

  const { productRef, nodeId } = settings

  return (
    <Box padding="400">
      <BlockStack gap="400">
        <InlineStack gap="300" blockAlign="center">
          <Thumbnail source={productRef.thumbnailUrl || ImageIcon} alt={productRef.title} size="small" />
          <BlockStack gap="100">
            <Text as="p" variant="bodyMd" fontWeight="semibold">
              {productRef.title}
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              {productRef.price} {productRef.currencyCode}
            </Text>
            {nodeId && (
              <Text as="p" variant="bodySm" tone="subdued">
                {t('assigned-to-node')}: {nodeId.slice(0, 8)}...
              </Text>
            )}
          </BlockStack>
        </InlineStack>

        <InlineStack gap="200">
          <Button icon={RefreshIcon} size="slim" onClick={handleSwapCharm}>
            {t('swap-charm')}
          </Button>
          <Button icon={DeleteIcon} size="slim" tone="critical" variant="plain" onClick={handleRemoveCharm}>
            {t('remove')}
          </Button>
        </InlineStack>
      </BlockStack>

      <ProductNVariantSelector
        active={swapModalActive}
        title={t('select-product-to-swap')}
        onClose={() => setSwapModalActive(false)}
        onSelect={handleSwapProductSelect}
        showVariants={false}
        displayAs="modal"
        allowMultiple={false}
      />
    </Box>
  )
}
