import { CANVAS_PREVIEW_PROPERTY_KEY, PROPERTY_PREFIX } from '../constants'
import { OPTION_PRICING_PRODUCT_HANDLE, OPTION_PRICING_PROPERTY_PREFIX } from '../constants/option-pricing'
import { getCachedHiddenPricingProduct } from '../utils/hidden-pricing-cache'
import { claimPricingFire, findAtcFormForVariant } from '../utils/pricing-claim'
import { TOTAL_ADDITIONAL_COST_PROPERTY } from '../components/pricing-manager'
import { CanvasPreviewManager } from '../components/canvas-preview-manager'
import { StorefrontLayerState } from '../stores/storefront-layer-state'
import { StorefrontUndoStack } from '../stores/storefront-undo-stack'
import { FEATURE_FLAGS } from '../constants/feature-flags'

/**
 * Layer transform Shopify property key prefix.
 * Format: `properties[_TLK_Layer_<layerId>]` = JSON transform.
 * Prefixed with _ so it is hidden from the Shopify order UI.
 */
const LAYER_TRANSFORM_PROPERTY_PREFIX = `${PROPERTY_PREFIX}_Layer_`

/**
 * Inject interactive layer transforms into the Add to Cart form data.
 *
 * Only layers with a meaningful delta from merchant default are serialized
 * to minimize Shopify property size. Deleted layers are represented as `deleted: true`.
 *
 * Clears the undo stack after injection — each cart submission starts fresh.
 */
function injectLayerTransforms(formData: FormData): void {
  // Gate by actual buyer interaction (state has changed layers) rather than feature flag.
  // Layer-renderer.ts now registers layers as interactive whenever the merchant explicitly
  // enables Buyer Interaction toggles (ss.movable/resizable/rotatable === true), even when
  // FEATURE_FLAGS.LAYER_INTERACTION is false. Gating injection by flag would silently drop
  // those buyers' position deltas from the cart payload.
  const changedLayers = StorefrontLayerState.getChangedLayers()
  if (!changedLayers.length) return

  for (const { layerId, transform, deleted } of changedLayers) {
    const key = `properties[${LAYER_TRANSFORM_PROPERTY_PREFIX}${layerId}]`

    // Convert zone-local storefront canvas coords → absolute template coords for print.
    // Movement zone layers track position relative to zone top-left (zone-local).
    // We must: (1) add zone origin to get absolute storefront coords, (2) un-scale to template coords.
    const flags = StorefrontLayerState.getFlags(layerId)
    const sx = flags?.originalScaleX || 1
    const sy = flags?.originalScaleY || 1
    const mb = flags?.movementBounds

    if (mb && (!flags?.originalScaleX || !flags?.originalScaleY)) {
      console.warn(`[TailorKit] Movement zone layer ${layerId} missing scale factors, defaulting to 1x`)
    }

    // Zone-local → absolute storefront canvas px (add zone origin offset)
    const absX = mb ? transform.x + mb.x : transform.x
    const absY = mb ? transform.y + mb.y : transform.y

    const transformData = deleted
      ? { deleted: true }
      : {
          x: absX / sx,
          y: absY / sy,
          w: transform.width / sx,
          h: transform.height / sy,
          r: transform.rotation,
        }

    const value = JSON.stringify(transformData)
    formData.set(key, value)
  }

  // Clear undo stack after Add to Cart — each order starts with a fresh interaction slate
  StorefrontUndoStack.clear()

  console.log(`[TailorKit] Injected ${changedLayers.length} layer transform(s) into cart properties`)
}

interface ShopifyProduct {
  id: number
  handle: string
  title: string
  variants: Array<{
    id: number
    title: string
    price: number
    available: boolean
    inventory_quantity: number
  }>
}

/**
 * Calculate base quantity needed for hidden pricing product (for 1 unit of main product)
 * This needs to be multiplied by the main product quantity for the final total
 */
export const calculatePricingQuantity = (additionalCost: number, hiddenProductPrice: number): number => {
  if (additionalCost <= 0 || hiddenProductPrice <= 0) {
    return 0
  }

  // Round to nearest integer to avoid floating-point overcharge (e.g. 29.0001 → 30).
  // Maximum under/overcharge is half a unit price — negligible for a low-priced hidden product.
  return Math.round(additionalCost / hiddenProductPrice)
}

/** A single item payload for Shopify /cart/add.js */
type CartItemPayload = {
  id: number | string
  quantity: number
  properties: Record<string, string>
}

/**
 * Build hidden pricing product cart item (does NOT send to Shopify).
 * Returns null if no available variant or quantity is 0.
 */
export const buildHiddenPricingItem = (
  refId: string,
  hiddenProduct: ShopifyProduct,
  quantity: number,
  productName: string,
  additionalCost: number
): CartItemPayload | null => {
  if (quantity <= 0) return null

  const firstAvailableVariant = hiddenProduct.variants.find(variant => variant.available)
  if (!firstAvailableVariant) {
    console.error('[TailorKit] No available variants for hidden pricing product')
    return null
  }

  return {
    id: firstAvailableVariant.id,
    quantity,
    properties: {
      [`For Product`]: productName,
      [PROPERTY_PREFIX]: PROPERTY_PREFIX,
      [`_${OPTION_PRICING_PROPERTY_PREFIX} - Amount`]: additionalCost.toFixed(2),
      [`${PROPERTY_PREFIX}_ref_id`]: refId,
      [`${PROPERTY_PREFIX}_hidden`]: 'true',
    },
  }
}

/**
 * Build charm product cart items (does NOT send to Shopify).
 */
export const buildCharmItems = (
  charmItems: CharmCartItem[],
  mainProductQuantity: number,
  refId: string,
  productName: string
): CartItemPayload[] => {
  return charmItems.map(item => {
    const raw = String(item.variantId)
    const numericId = raw.includes('/') ? raw.split('/').pop() || raw : raw
    return {
      id: parseInt(numericId, 10) || numericId,
      quantity: item.quantity * mainProductQuantity,
      properties: {
        [`For Product`]: productName,
        [PROPERTY_PREFIX]: PROPERTY_PREFIX,
        [`${PROPERTY_PREFIX}_ref_id`]: refId,
        [`${PROPERTY_PREFIX}_charm`]: 'true',
        [`${PROPERTY_PREFIX}_hidden`]: 'true',
      },
    }
  })
}

/**
 * Add all additional products (hidden pricing + charms) to cart in a SINGLE
 * /cart/add.js call. Batching avoids Shopify race conditions that can occur
 * when multiple sequential cart-add requests fire in quick succession.
 *
 * Retries once on explicit 429/503 to recover from Shopify throttling.
 * Themes that submit the main product via XHR (e.g. throwingdoubles) bypass
 * our fetch interceptor, so our hidden-pricing call fires in parallel with
 * the theme's call and occasionally loses the throttle race. Without retry,
 * the pricing line is silently dropped and the buyer underpays. Network
 * errors and other non-2xx responses are NOT retried to avoid double-add
 * when Shopify processed the request but the client missed the ack.
 */
const addAdditionalItemsToCart = async (items: CartItemPayload[]): Promise<boolean> => {
  if (!items.length) return true

  const postOnce = (): Promise<Response> =>
    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TailorKit-Internal': '1' },
      body: JSON.stringify({ items }),
    })

  try {
    console.log(`[TailorKit] Adding ${items.length} additional item(s) to cart in single batch`)

    let response = await postOnce()

    if (response.status === 429 || response.status === 503) {
      console.warn(`[TailorKit] Cart add throttled (${response.status}), retrying once after 300ms`)
      await new Promise(resolve => setTimeout(resolve, 300))
      response = await postOnce()
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[TailorKit] Failed to add additional items to cart:', errorText)
      return false
    }

    const result = await response.json()
    console.log(`[TailorKit] Batch add result: ${result?.items?.length ?? 0} item(s) added`)

    return true
  } catch (error) {
    console.error('[TailorKit] Error adding additional items to cart:', error)
    return false
  }
}

/**
 * Extract additional cost from form data
 */
export const extractAdditionalCostFromFormData = (formData: FormData): number => {
  let totalAdditionalCost = 0

  // Try multiple possible key formats for additional cost
  const possibleKeys = [
    TOTAL_ADDITIONAL_COST_PROPERTY,
    `properties[${TOTAL_ADDITIONAL_COST_PROPERTY}]`,
    `properties[TLK_Total_Additional_Cost]`,
    'properties[TLK_Total_Additional_Cost]',
  ]

  for (const key of possibleKeys) {
    const value = formData.get(key) as string
    if (value && !isNaN(parseFloat(value))) {
      totalAdditionalCost = parseFloat(value)
      break
    }
  }

  return totalAdditionalCost
}

/**
 * Extract main product name from form data
 */
export const extractMainProductName = (formData: FormData): string => {
  const refIdKey = `${PROPERTY_PREFIX}_product_name`

  // Log all form data entries
  const allEntries: Array<[string, FormDataEntryValue]> = []
  for (const [key, value] of formData.entries()) {
    allEntries.push([key, value])
  }

  for (const [key, value] of allEntries) {
    if (key.includes(refIdKey)) {
      return value as string
    }
  }

  console.warn('[TailorKit] Could not extract ref ID from form data')
  return ''
}

/**
 * Extract main product quantity from form data
 */
export const extractMainProductQuantity = (formData: FormData): number => {
  // Try multiple possible keys for quantity
  const possibleKeys = ['quantity', 'qty', 'items[0][quantity]']

  // Log all form data entries for debugging
  const allEntries: Array<[string, FormDataEntryValue]> = []
  for (const [key, value] of formData.entries()) {
    allEntries.push([key, value])
  }

  for (const key of possibleKeys) {
    const value = formData.get(key) as string
    if (value) {
      const quantity = parseInt(value, 10)
      if (!isNaN(quantity) && quantity > 0) {
        console.log(`[TailorKit] Found quantity: ${quantity} from key: ${key}`)
        return quantity
      }
    }
  }

  // Look for any key that might contain quantity information
  const quantityEntries = allEntries.filter(
    ([key]) => key.toLowerCase().includes('quantity') || key.toLowerCase().includes('qty')
  )

  if (quantityEntries.length > 0) {
    console.log('[TailorKit] Found potential quantity keys:', quantityEntries)
  }

  console.warn('[TailorKit] Could not extract main product quantity from form data, defaulting to 1')
  return 1 // Default to 1 if no quantity found
}

/**
 * Charm selection extracted from form tracking inputs
 */
interface CharmCartItem {
  variantId: string
  quantity: number
}

/** A group of charm items sharing the same refId/productName (one per product context) */
interface CharmGroup {
  charms: CharmCartItem[]
  refId: string
  productName: string
}

/**
 * Extract charm product selections from form data, grouped by product context.
 *
 * NEW format: reads `properties[_PF_charms]` — a single consolidated JSON property
 * containing selections for ALL charm builders, keyed by layerId:
 * ```
 * { [layerId]: { products: { [productId]: { variantId, qty, ... } }, slots?, positions? } }
 * ```
 * This avoids Shopify's 25-property limit and prevents key collisions when the same
 * product appears in multiple charm builders.
 *
 * LEGACY fallback: if consolidated property is absent, falls back to reading individual
 * `_PF_charm_gid:` keys (old single-builder format) for backward compat.
 *
 * Supports both top-level (main product) and nested (cross-product upsell) properties.
 */
export const extractCharmGroups = (formData: FormData): CharmGroup[] => {
  const consolidatedKey = `${PROPERTY_PREFIX}_charms`
  const refIdKey = `${PROPERTY_PREFIX}_ref_id`
  const productNameKey = `${PROPERTY_PREFIX}_product_name`

  // --- NEW FORMAT: read consolidated _TLK_charms JSON ---
  const consolidatedValue
    = (formData.get(`properties[${consolidatedKey}]`) as string) || (formData.get(consolidatedKey) as string)

  if (consolidatedValue) {
    try {
      const consolidated = JSON.parse(consolidatedValue) as Record<
        string,
        { products: Record<string, { variantId: string; qty: number }> }
      >

      // Flatten all layers → one CharmGroup for the main product context
      // (multi-builder charms all belong to the same line item)
      const charms: CharmCartItem[] = []
      for (const layerEntry of Object.values(consolidated)) {
        if (!layerEntry?.products) continue
        for (const product of Object.values(layerEntry.products)) {
          if (product.variantId && product.qty > 0) {
            charms.push({ variantId: product.variantId, quantity: product.qty })
          }
        }
      }

      if (!charms.length) return []

      // Extract shared context from form data
      let refId = ''
      let productName = ''
      for (const [key, value] of formData.entries()) {
        if (key.includes(refIdKey) && !refId) refId = value as string
        if (key.includes(productNameKey) && !productName) productName = value as string
      }

      return [{ charms, refId, productName }]
    } catch {
      console.warn('[TailorKit] Failed to parse consolidated _TLK_charms property, falling back to legacy format')
    }
  }

  // --- LEGACY FORMAT: individual _PF_charm_gid: keys (single-builder, backward compat) ---
  const charmGidMarker = `${PROPERTY_PREFIX}_charm_gid:`
  const groupMap = new Map<string, CharmGroup>()

  // Pass 1: collect charm items grouped by context
  for (const [key, value] of formData.entries()) {
    if (!key.includes(charmGidMarker)) continue

    const nestedMatch = key.match(/^items\[([^\]]+)\]/)
    const groupKey = nestedMatch ? nestedMatch[1] : 'main'

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, { charms: [], refId: '', productName: '' })
    }

    try {
      const parsed = JSON.parse(value as string)
      if (parsed.variantId && parsed.qty > 0) {
        groupMap.get(groupKey)!.charms.push({ variantId: parsed.variantId, quantity: parsed.qty })
      }
    } catch {
      console.warn('[TailorKit] Failed to parse charm tracking data for key:', key)
    }
  }

  // Pass 2: fill refId + productName per group
  for (const [key, value] of formData.entries()) {
    const nestedMatch = key.match(/^items\[([^\]]+)\]/)
    const groupKey = nestedMatch ? nestedMatch[1] : 'main'
    if (!groupMap.has(groupKey)) continue

    if (key.includes(refIdKey)) groupMap.get(groupKey)!.refId = value as string
    if (key.includes(productNameKey)) groupMap.get(groupKey)!.productName = value as string
  }

  return Array.from(groupMap.values()).filter(g => g.charms.length > 0)
}

/**
 * Extract ref ID from form data
 * This ref ID is the unique ID of personalizer item in the cart
 */
export const extractRefId = (formData: FormData): string => {
  const refIdKey = `${PROPERTY_PREFIX}_ref_id`

  // Log all form data entries
  const allEntries: Array<[string, FormDataEntryValue]> = []
  for (const [key, value] of formData.entries()) {
    allEntries.push([key, value])
  }

  for (const [key, value] of allEntries) {
    if (key.includes(refIdKey)) {
      return value as string
    }
  }

  console.warn('[TailorKit] Could not extract ref ID from form data')
  return ''
}

/**
 * Handle add product to cart by FormData
 * @description
 * - Calculates additional pricing from form properties
 * - Uses cached hidden pricing product if additional cost exists
 * - Adds hidden pricing product to cart before main product
 * - Handles canvas preview upload (commented out for now)
 *
 * NOTE: This middleware also handles Buy It Now buttons indirectly.
 * The buyItNowHandler.ts intercepts Buy It Now clicks for customized products,
 * prevents the default behavior, and calls this middleware via /cart/add,
 * then redirects to checkout - providing the same user experience.
 *
 * @param formData - The FormData object
 * @returns The FormData object, potentially modified
 */

/**
 * Extract OneTick addon items from FormData and remove them.
 * Addon items use pattern: items[checkboxId][id], items[checkboxId][quantity], items[checkboxId][properties][...]
 * Returns cart-add payloads for each addon. FormData is mutated (addon keys removed).
 */
export function extractAndRemoveAddonItems(formData: FormData): CartItemPayload[] {
  const addonMap = new Map<string, { id: string; quantity: number; properties: Record<string, string> }>()
  const keysToRemove: string[] = []

  for (const [key, value] of formData.entries()) {
    const match = key.match(/^items\[([^\]]+)\]\[(.+)\]$/)
    if (!match) continue

    const itemKey = match[1]
    const rest = match[2]

    if (!addonMap.has(itemKey)) {
      addonMap.set(itemKey, { id: '', quantity: 1, properties: {} })
    }
    const addon = addonMap.get(itemKey)!

    if (rest === 'id') {
      addon.id = value as string
    } else if (rest === 'quantity') {
      addon.quantity = parseInt(value as string, 10) || 1
    } else if (rest.startsWith('properties][')) {
      const propName = rest.replace('properties][', '').replace(']', '')
      addon.properties[propName] = value as string
    }

    keysToRemove.push(key)
  }

  // Remove addon keys from FormData
  for (const key of keysToRemove) {
    formData.delete(key)
  }

  // Build cart payloads
  return Array.from(addonMap.values())
    .filter(addon => addon.id)
    .map(addon => ({
      id: parseInt(addon.id, 10) || addon.id,
      quantity: addon.quantity,
      properties: addon.properties,
    }))
}

/**
 * Inject the canvas preview File from CanvasPreviewManager's in-memory cache
 * into the outgoing cart FormData.
 *
 * Why this exists: adding `<input type="file">` to the ATC form causes some
 * themes' AJAX cart scripts to bail out — notably Modular 3.2.0, whose
 * delegated click handler does `if (form.querySelector('[type="file"]')) return`,
 * leaving the ATC button disabled forever without dispatching a cart request.
 * Keeping the File in memory (not DOM) side-steps that bailout while still
 * attaching the preview to the cart item via the interceptor path.
 *
 * Safe no-op when no cached file exists or when the caller already injected
 * a preview (legacy DOM file input from older builds).
 */
function injectCanvasPreviewFromCache(formData: FormData): void {
  const propertyKey = `properties[${CANVAS_PREVIEW_PROPERTY_KEY}]`
  // Respect a preview already attached by the caller (e.g. buyer's own submit
  // path on a theme that handles file inputs fine — no need to override).
  if (formData.has(propertyKey)) return

  const variantId = (formData.get('id') as string | null) ?? ''
  const file = CanvasPreviewManager.getCachedFile(variantId)
  if (!file) return

  formData.set(propertyKey, file, file.name)
}

/**
 */
export const handleAddProductToCartByFormData = async (formData: FormData) => {
  try {
    // Check if FormData is empty before proceeding
    const formDataSize = Array.from(formData.entries()).length

    // If FormData is empty or very small, it might be a timing issue
    if (formDataSize === 0) {
      console.error('[TailorKit] CRITICAL: FormData is completely empty!')
      console.error(
        '[TailorKit] This usually means the middleware is running before the customizer sets the properties'
      )
      console.error('[TailorKit] Check if the customizer "tailorkit-set-options" event has been triggered')
      return formData
    }

    if (formDataSize <= 2) {
      console.warn('[TailorKit] WARNING: FormData has very few entries, might be missing customizer properties')
    }

    // Step 0a: Inject canvas preview File from CanvasPreviewManager cache.
    // The File is cached in-memory (not in a DOM <input type="file">) to avoid
    // theme AJAX-cart scripts that skip forms with file inputs (e.g. Modular).
    // See CanvasPreviewManager JSDoc for full context.
    injectCanvasPreviewFromCache(formData)

    // Step 0: Inject layer interaction transforms (US-C04 — Save to order)
    // Must run before any cart add so transforms are included in the main product properties.
    injectLayerTransforms(formData)

    // Step 1: Extract shared info used by both pricing and charm items
    const additionalCost = extractAdditionalCostFromFormData(formData)
    const mainProductQuantity = extractMainProductQuantity(formData)
    const mainProductName = extractMainProductName(formData)
    const refId = extractRefId(formData)

    // Step 2: Collect all additional cart items into a single batch
    // Batching into one /cart/add.js call avoids Shopify race conditions
    // that occur when multiple sequential cart-add requests fire rapidly.
    const additionalItems: CartItemPayload[] = []

    // Step 3: Hidden pricing product item
    if (additionalCost > 0) {
      // Claim the ATC form synchronously, before any async work below, so
      // whichever mechanism reaches the claim first wins — this interceptor,
      // or the cart-form-sync.ts submit-listener fallback (for themes whose
      // ATC call doesn't go through fetch). See pricing-claim.ts for why the
      // claim is TTL-based and keyed on the form element, rather than a
      // refId or event.defaultPrevented (both proved unreliable) or a
      // capture-phase reset (some themes' own ATC handling is ALSO a
      // capture-phase document listener, with no guaranteed order vs ours).
      const atcVariantId = (formData.get('id') as string) ?? undefined
      const atcForm = findAtcFormForVariant(atcVariantId)

      // Pass the variant id so the global backstop still coordinates when the
      // variant→form lookup misses or resolves to a different form (form === null).
      if (claimPricingFire(atcForm, atcVariantId)) {
        const hiddenProduct = await getCachedHiddenPricingProduct()

        if (!hiddenProduct) {
          console.error('[TailorKit] Cannot proceed with pricing - hidden product not available in cache')
          console.error(
            '[TailorKit] Please ensure the hidden product is created in Shopify admin with handle:',
            OPTION_PRICING_PRODUCT_HANDLE
          )
        } else {
          const hiddenProductPrice = hiddenProduct.variants[0]?.price
          const basePricingQuantity = calculatePricingQuantity(additionalCost, hiddenProductPrice)
          const totalPricingQuantity = basePricingQuantity * mainProductQuantity
          const pricingItem = buildHiddenPricingItem(
            refId,
            hiddenProduct,
            totalPricingQuantity,
            mainProductName,
            additionalCost
          )
          if (pricingItem) {
            additionalItems.push(pricingItem)
          }
        }
      }
    }

    if (FEATURE_FLAGS.CHARM_BUILDER_STOREFRONT) {
      const charmGroups = extractCharmGroups(formData)
      for (const group of charmGroups) {
        const groupRefId = group.refId || refId
        const groupProductName = group.productName || mainProductName
        const charmPayloads = buildCharmItems(group.charms, mainProductQuantity, groupRefId, groupProductName)
        additionalItems.push(...charmPayloads)
      }
    }

    // Cross-product addon items must be added BEFORE main product form submit.
    // Shopify pre-form batches use FIFO: first /cart/add.js call → closest to main product.
    // Single batch avoids cart drawer flickering from multiple sequential requests.
    // CAVEAT: Relies on undocumented Shopify ordering — may break if Shopify changes behavior.
    const addonItems = extractAndRemoveAddonItems(formData)

    if (addonItems.length > 0) {
      // Separate addon charms from main product charms by _PF_ref_id
      const refIdProp = `${PROPERTY_PREFIX}_ref_id`
      const charmProp = `${PROPERTY_PREFIX}_charm`
      const addonRefIds = new Set(addonItems.map(item => item.properties?.[refIdProp]).filter(Boolean))

      const addonCharms = additionalItems.filter(
        item => item.properties?.[charmProp] === 'true' && addonRefIds.has(item.properties[refIdProp])
      )

      const mainItems = additionalItems.filter(item => !addonCharms.includes(item))

      // Group addon charms by refId so each addon's charms stay next to their parent
      const addonCharmsByRefId = new Map<string, CartItemPayload[]>()
      for (const charm of addonCharms) {
        const refId = charm.properties?.[refIdProp] || ''
        if (!addonCharmsByRefId.has(refId)) addonCharmsByRefId.set(refId, [])
        addonCharmsByRefId.get(refId)!.push(charm)
      }

      // Interleave: each addon followed immediately by its charms
      const interleavedAddons: CartItemPayload[] = []
      for (const addon of addonItems) {
        interleavedAddons.push(addon)
        const addonRefId = addon.properties?.[refIdProp]
        if (addonRefId && addonCharmsByRefId.has(addonRefId)) {
          interleavedAddons.push(...addonCharmsByRefId.get(addonRefId)!)
        }
      }

      // Single batch to avoid cart drawer flickering.
      // Shopify /cart/add.js reverses the items array in cart display:
      //   last item in array = closest to main product (top of batch section).
      // We build desired display order then reverse so Shopify's reversal
      // restores the intended order: mainItems → addon1 → addon1Charms → addon2.
      const batchItems = [...mainItems, ...interleavedAddons].reverse()
      if (batchItems.length > 0) {
        await addAdditionalItemsToCart(batchItems)
      }
    } else {
      // No cross-product addons — use original behavior
      if (additionalItems.length > 0) {
        const added = await addAdditionalItemsToCart(additionalItems)
        if (!added) {
          console.error('[TailorKit] Failed to add additional items to cart')
        }
      }
    }

    // Step 7: Handle canvas preview (keep existing logic commented for now)
    // const canvasPreviewPropertyKey = `properties[${CANVAS_PREVIEW_PROPERTY_KEY}]`
    // const canvasPreviewBase64 = formData.get(canvasPreviewPropertyKey) as string

    // const deleteCanvasPreview = () => {
    //   formData.delete(canvasPreviewPropertyKey)
    // }

    // if (canvasPreviewBase64 && isValidBase64DataURL(canvasPreviewBase64)) {
    //   try {
    //     const file = await urlToFile(canvasPreviewBase64, `tlk-canvas-preview-${Date.now()}`)
    //     const uploadResult = await uploadImageToServer(file, false)

    //     if (uploadResult.success && uploadResult.url) {
    //       formData.set(canvasPreviewPropertyKey, uploadResult.url)
    //     } else {
    //       deleteCanvasPreview()
    //     }
    //   } catch (error) {
    //     console.error('[TailorKit] Error uploading preview:', error)
    //     deleteCanvasPreview()
    //   }
    // } else {
    //   console.warn('[TailorKit] Invalid canvas preview data URL format, removing from form data')
    //   deleteCanvasPreview()
    // }
  } catch (error) {
    console.error('[TailorKit] Error in add to cart middleware:', error)
    // Continue with main product even if pricing fails
  }

  return formData
}
