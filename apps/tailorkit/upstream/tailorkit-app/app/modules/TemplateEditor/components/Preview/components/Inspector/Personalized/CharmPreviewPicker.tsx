/**
 * CharmPreviewPicker — renders <tailorkit-charm-picker> web component in the
 * Preview tab inspector for CHARM_NODE layers.
 *
 * Fetches product data from Admin API (useLiveCharmProducts) and passes it as
 * pre-fetched data to the web component, bypassing the Storefront API fetch.
 *
 * Canvas sync: dispatches INCREMENT_CHARM_QUANTITY / DELETE_CHARM_INSTANCE and
 * creates/removes CHARM layer stores so canvas drag/selection works.
 * Relies on stable keys (layer ID) in renderLayers to prevent unmount/remount
 * when addExtractedLayerStores prepends new layers to the array.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useStore } from '~/libs/external-store'
import type { TLayerStore } from '~/stores/modules/layer'
import type { CharmNodeSettings, CharmProductRef } from '~/types/psd'
import type { LiveCharmProduct } from '~/routes/api.charm-products/route'
import {
  useLiveCharmProducts,
  getCharmDisplayData,
} from '~/modules/TemplateEditor/components/Outline/ToolSidebar/panels/hooks/useLiveCharmProducts'
import type {
  StorefrontCharmConfig,
  CharmProductFullData,
  CharmChangeDetail,
} from 'extensions/tailorkit-src/src/shared/components/CharmPicker/charm-picker-types'
import { CHARM_CHANGE_EVENT } from 'extensions/tailorkit-src/src/shared/components/CharmPicker/charm-picker-element'
import { SkeletonBodyText } from '@shopify/polaris'
import { getCharmLayerByInstanceId } from '~/stores/modules/charm-layer-index'

interface CharmPreviewPickerProps {
  layerStore: TLayerStore
}

/** In FIXED mode, effective max = min(maxCharms, totalSlotCapacity) to prevent overflow */
function getEffectiveMaxCharms(settings: CharmNodeSettings | undefined): number {
  const nodeCount = (settings?.nodes || []).length
  const maxCharms = settings?.maxCharms || nodeCount
  const displayStyle = settings?.displayStyle || 'FREE'
  if (displayStyle === 'FREE') return maxCharms
  const totalSlotCapacity = (settings?.nodes || []).reduce((sum, n) => sum + (n.slotLimit || 1), 0)
  // No nodes defined → maxCharms=0 so web component disables +/- buttons
  return totalSlotCapacity > 0 ? Math.min(maxCharms, totalSlotCapacity) : 0
}

/** Build StorefrontCharmConfig from CHARM_NODE layer settings */
function buildCharmConfig(layerId: string, settings: CharmNodeSettings | undefined): StorefrontCharmConfig {
  const linkedProducts = settings?.linkedProducts || []
  return {
    layerId,
    displayStyle: settings?.displayStyle || 'FREE',
    label: settings?.storefrontLabel || 'Add Charms',
    maxCharms: getEffectiveMaxCharms(settings),
    allowMultiple: settings?.allowMultipleAssignments || false,
    nodes: settings?.nodes?.map(n => ({
      _id: n._id,
      x: n.x,
      y: n.y,
      slotLimit: n.slotLimit,
      label: n.label,
    })),
    products: linkedProducts.map(p => ({
      _id: p._id,
      productId: p.shopifyProductId,
      variantId: p.selectedVariantId || '',
      defaultQuantity: p.defaultQuantity,
    })),
  }
}

/** Transform admin LiveCharmProduct data → CharmProductFullData[] for web component */
function buildPrefetchedProducts(
  linkedProducts: CharmProductRef[],
  liveProducts: Map<string, LiveCharmProduct>
): CharmProductFullData[] {
  return linkedProducts.map(p => {
    const display = getCharmDisplayData(p.shopifyProductId, p.selectedVariantId, liveProducts, p)
    return {
      _id: p._id,
      productId: p.shopifyProductId,
      variantId: p.selectedVariantId || '',
      title: display.title,
      price: display.price,
      currencyCode: display.currencyCode,
      thumbnailUrl: display.thumbnailUrl,
      availableForSale: display.available,
      defaultQuantity: p.defaultQuantity,
    }
  })
}

/**
 * Stable selector: only changes when product LIST identity changes
 * (products added/removed), NOT when transforms change (increment/decrement).
 */
function selectProductListKey(state: { settings?: unknown }): string {
  const settings = state.settings as CharmNodeSettings | undefined
  const products = settings?.linkedProducts
  if (!products?.length) return ''
  return products.map(p => `${p._id}:${p.shopifyProductId}:${p.selectedVariantId || ''}`).join(',')
}

/** Stable selector: only changes when config-level settings change */
function selectConfigKey(state: { settings?: unknown }): string {
  const s = state.settings as CharmNodeSettings | undefined
  // eslint-disable-next-line max-len
  return `${s?.storefrontLabel || ''}|${s?.maxCharms ?? s?.nodes?.length ?? 0}|${s?.displayStyle || 'FREE'}|${s?.allowMultipleAssignments || false}|${s?.nodes?.length || 0}`
}

/** Compute transform counts snapshot (non-reactive, called once on mount) */
function computeTransformCounts(settings: CharmNodeSettings | undefined): string {
  const products = settings?.linkedProducts
  if (!products?.length) return '{}'
  const counts: Record<string, number> = {}
  for (const p of products) {
    const count = p.transforms?.length || 0
    if (count > 0) counts[p._id] = count
  }
  return JSON.stringify(counts)
}

export function CharmPreviewPicker({ layerStore }: CharmPreviewPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const layerId = useStore(layerStore, s => s._id)

  // Stable selectors — only re-render when product list or config changes, not transforms
  const productListKey = useStore(layerStore, selectProductListKey)
  const configKey = useStore(layerStore, selectConfigKey)
  // Recompute selections when configKey changes (e.g., displayStyle FREE→FIXED).
  // Transforms are cleared by the design panel before dispatching displayStyle change,
  // so computeTransformCounts returns '{}' (zero quantities) after the switch.
  // configKey is referenced explicitly below so ESLint recognises it as used.
  const currentSelectionsJson = useMemo(() => {
    void configKey // intentional cache-buster: recompute when displayStyle/config changes
    return computeTransformCounts(layerStore.getState().settings as CharmNodeSettings | undefined)
  }, [layerStore, configKey])

  // Read settings snapshot only when product list or config changes
  const { linkedProducts, configJson, productIds, isFixedNoNodes, displayStyle } = useMemo(() => {
    const settings = layerStore.getState().settings as CharmNodeSettings | undefined
    const lps = settings?.linkedProducts || []
    return {
      linkedProducts: lps,
      configJson: JSON.stringify(buildCharmConfig(layerId, settings)),
      productIds: lps.map(p => p.shopifyProductId).filter(Boolean),
      // In FIXED mode with no slot nodes, charms have nowhere to go — block pointer events
      isFixedNoNodes: (settings?.displayStyle || 'FREE') === 'FIXED' && !settings?.nodes?.length,
      // Used as web component key — forces remount on displayStyle change so internal
      // selection state resets (web component only reads data-initial-selections on mount)
      displayStyle: settings?.displayStyle || 'FREE',
    }
    // Pass productListKey and configKey to avoid unnecessary re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerStore, layerId, productListKey, configKey])

  // Fetch live product data from Admin API
  const { liveProducts, isLoading } = useLiveCharmProducts(productIds)

  const prefetchedJson = useMemo(
    () => JSON.stringify(buildPrefetchedProducts(linkedProducts, liveProducts)),
    [linkedProducts, liveProducts]
  )

  /** Increment charm: update transforms only (Preview mode — no shadow CHARM layers).
   *  Canvas renders directly from CharmNodeCanvasRenderer reading settings.linkedProducts transforms.
   *  NOT creating CHARM layer stores avoids prepending to extractedLayerStores which would
   *  shift indices, cause React key mismatch, and unmount/remount this picker (resetting state).
   */
  const incrementCharm = useCallback(
    (internalProductId: string) => {
      layerStore.dispatch({
        type: 'INCREMENT_CHARM_QUANTITY',
        payload: { productId: internalProductId },
      })
    },
    [layerStore]
  )

  /** Decrement charm: remove last transform + mark CHARM layer deleted */
  const decrementCharm = useCallback(
    (internalProductId: string) => {
      const currentSettings = layerStore.getState().settings as CharmNodeSettings
      const product = currentSettings?.linkedProducts?.find(p => p._id === internalProductId)
      const lastTransform = product?.transforms?.[product.transforms.length - 1]
      if (!lastTransform?.instanceId) return

      layerStore.dispatch({
        type: 'DELETE_CHARM_INSTANCE',
        payload: {
          productId: internalProductId,
          instanceId: lastTransform.instanceId,
          deletedTransform: lastTransform,
          productRef: product,
        },
      })

      // Mark CHARM layer as deleted (for undo/redo support)
      const charmLayer = getCharmLayerByInstanceId(lastTransform.instanceId)
      if (charmLayer) {
        charmLayer.dispatch({
          type: 'UPDATE_LAYER',
          payload: { state: { isDeletedOnEditor: true } },
          skipTrace: true,
        })
      }
    },
    [layerStore]
  )

  /** Sync charm picker selections → layer store transforms for canvas rendering */
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleCharmChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as CharmChangeDetail
      if (!detail?.selections) return

      // Read fresh state directly from store (avoids stale closures)
      const currentSettings = layerStore.getState().settings as CharmNodeSettings
      const currentProducts = currentSettings?.linkedProducts || []

      for (const selection of detail.selections) {
        const linkedProduct = currentProducts.find(p => p.shopifyProductId === selection.productId)
        if (!linkedProduct) continue

        const currentCount = linkedProduct.transforms?.length || 0
        const targetCount = selection.quantity

        if (targetCount > currentCount) {
          for (let i = 0; i < targetCount - currentCount; i++) {
            incrementCharm(linkedProduct._id)
          }
        } else if (targetCount < currentCount) {
          for (let i = 0; i < currentCount - targetCount; i++) {
            decrementCharm(linkedProduct._id)
          }
        }
      }

      // Handle products deselected entirely (quantity → 0, absent from selections)
      for (const product of currentProducts) {
        const inSelection = detail.selections.some(s => s.productId === product.shopifyProductId)
        if (!inSelection && product.transforms && product.transforms.length > 0) {
          const count = product.transforms.length
          for (let i = 0; i < count; i++) {
            decrementCharm(product._id)
          }
        }
      }
    }

    container.addEventListener(CHARM_CHANGE_EVENT, handleCharmChange)
    return () => container.removeEventListener(CHARM_CHANGE_EVENT, handleCharmChange)
  }, [layerStore, incrementCharm, decrementCharm])

  if (isLoading && linkedProducts.length > 0) {
    return (
      <div className="emtlkit--option-set-container">
        <SkeletonBodyText lines={3} />
      </div>
    )
  }

  if (linkedProducts.length === 0) {
    return null
  }

  return (
    // FIXED mode with no slot positions: block pointer events so +/- buttons are unclickable
    // (the web component's canIncrement uses !maxCharms which treats 0 as unlimited,
    // so we can't disable via config — CSS pointer-events is the reliable approach)
    <div
      ref={containerRef}
      className="emtlkit--option-set-container"
      data-item-id={`${layerId}::charm_builder`}
      style={isFixedNoNodes ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
    >
      <tailorkit-charm-picker
        key={displayStyle}
        data-charm-config={configJson}
        data-prefetched-products={prefetchedJson}
        data-initial-selections={currentSelectionsJson}
      />
    </div>
  )
}

/** JSX type declaration for the custom element */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'tailorkit-charm-picker': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          'data-charm-config'?: string
          'data-prefetched-products'?: string
          'data-print-area-id'?: string
          'data-initial-selections'?: string
        },
        HTMLElement
      >
    }
  }
}
