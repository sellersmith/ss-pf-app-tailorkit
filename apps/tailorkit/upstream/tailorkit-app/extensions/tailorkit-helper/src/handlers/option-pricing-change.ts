import { PROPERTY_PREFIX } from '../constants'
import type { ShopifyCart, CartLineItem, LineItemProperties } from '../types/shopify-cart'
import { CartOperationDebouncer, ExpressCheckoutHandler, CartConflictResolver } from '../utils/cart-synchronization'
import handleUpdateCart from '../utils/update-cart'
import { ensureCartImageControllerInitialized } from './cart-image-controller'
import { CartHiddenProductManager } from './cart-hidden-product-manager'

/**
 * Interface for tracking main product to hidden product relationships
 */
interface ProductLink {
  mainItem: CartLineItem
  hiddenItems: CartLineItem[]
  refId: string
}

/**
 * Constants for hidden product identification
 */
export const OPTION_PRICING_PROPERTY_PREFIX = '_TLK Option Cost'
const HIDDEN_PRODUCT_IDENTIFIER = `${PROPERTY_PREFIX}_hidden`
const CHARM_PRODUCT_IDENTIFIER = `${PROPERTY_PREFIX}_charm`

// Global instances for advanced features
const debouncer = new CartOperationDebouncer()
const expressCheckoutHandler = ExpressCheckoutHandler.getInstance()

/**
 * Handle option pricing synchronization when cart changes occur
 * Addresses all edge cases found in real-world personalization apps:
 * 1. Quantity changes propagation
 * 2. Main product removal cleanup
 * 3. Hidden product orphan cleanup
 * 4. Express checkout compatibility
 * 5. Multiple product handling
 * 6. Third-party app conflicts
 * 7. Performance optimization
 * 8. Error recovery
 */
export default async function handleOptionPricingChange(cartData: ShopifyCart, operationType: string = 'unknown') {
  // Skip processing if express checkout is active
  if (expressCheckoutHandler.isActive()) return

  // Debounce the operation to prevent rapid successive calls
  debouncer.debounce('cart-sync', async () => {
    try {
      // Step 1: Sync hidden product quantities with their main products
      const productLinks = buildProductRelationshipMap(cartData.items)
      for (const link of productLinks) {
        await processProductLink(link)
      }

      // Step 2: Clean up orphaned hidden products (skip on 'add' to avoid
      // removing items that were just added but whose main product hasn't
      // appeared in the cart response yet due to timing)
      if (operationType !== 'add' && operationType !== 'unknown') {
        const hadOrphans = await cleanupOrphanedHiddenProducts(cartData.items)
        if (hadOrphans) {
          await triggerCartUIRefresh()
        }
      }
    } catch (error) {
      console.error('[TailorKit] Error in cart synchronization:', error)
    }
  })
}

/**
 * Build a map of main products to their associated hidden pricing products
 * Based on ref_id relationships found in line item properties
 */
function buildProductRelationshipMap(cartItems: CartLineItem[]): ProductLink[] {
  const links: ProductLink[] = []
  const processedRefIds = new Set<string>()

  // Find all main products with TailorKit customization
  const mainProducts = cartItems.filter(
    item => item.properties[`${PROPERTY_PREFIX}_ref_id`] && !item.properties[HIDDEN_PRODUCT_IDENTIFIER]
  )

  for (const mainItem of mainProducts) {
    const refId = mainItem.properties[`${PROPERTY_PREFIX}_ref_id`] as string

    if (processedRefIds.has(refId)) continue
    processedRefIds.add(refId)

    // Find all hidden products associated with this main product
    const hiddenItems = cartItems.filter(
      hiddenItem =>
        hiddenItem.properties[HIDDEN_PRODUCT_IDENTIFIER] === 'true'
        && hiddenItem.properties[`${PROPERTY_PREFIX}_ref_id`] === refId
    )

    if (hiddenItems.length > 0) {
      links.push({ mainItem, hiddenItems, refId })
    }
  }

  return links
}

/**
 * Process synchronization for a specific main product and its hidden products
 * Handles quantity updates and removal scenarios
 */
async function processProductLink(link: ProductLink): Promise<void> {
  const { mainItem, hiddenItems, refId } = link

  // Case 1: Main product quantity changed - update hidden pricing products proportionally
  // Skip charm products — they have their own quantity logic set at ATC time
  for (const hiddenItem of hiddenItems) {
    if (hiddenItem.properties[CHARM_PRODUCT_IDENTIFIER] === 'true') continue
    await synchronizeHiddenProductQuantity(mainItem, hiddenItem, refId)
  }

  // Case 2: Check for missing main product (removal scenario)
  // This is handled by cleanupOrphanedHiddenProducts
}

/**
 * Synchronize hidden product quantity based on main product quantity
 * Maintains the original pricing ratio while scaling with main product quantity
 */
async function synchronizeHiddenProductQuantity(
  mainItem: CartLineItem,
  hiddenItem: CartLineItem,
  refId: string
): Promise<void> {
  try {
    // Calculate the original hidden quantity needed per main product unit
    // This is based on the original pricing when the item was first added
    const originalCost = parseFloat(hiddenItem.properties[`${OPTION_PRICING_PROPERTY_PREFIX} - Amount`] || '0')
    const hiddenProductPrice = hiddenItem.price / 100 // Convert from cents

    // Calculate the original hidden quantity per main product unit (same logic as addProductToCartMiddleware)
    const originalHiddenQuantityPerMainUnit = Math.round(originalCost / hiddenProductPrice)

    // Calculate new required quantity for hidden product
    const newHiddenQuantity = Math.max(1, originalHiddenQuantityPerMainUnit * mainItem.quantity)

    if (newHiddenQuantity !== hiddenItem.quantity) {
      // Merge properties safely to avoid conflicts with third-party apps
      // Pass empty updates object since we're not changing properties, just preserving existing ones
      const mergedProperties = CartConflictResolver.mergeProperties(hiddenItem.properties, {})

      // Update hidden product qty — response contains the full updated cart,
      // so we use it directly for UI refresh (saves an extra /cart.js roundtrip).
      // Fire-and-forget: don't block sync waiting for DOM update.
      const updatedCart = await updateCartLineItem(hiddenItem.key, newHiddenQuantity, mergedProperties)
      refreshCartUI(updatedCart)
    }
  } catch (error) {
    console.error(`[TailorKit] Error synchronizing quantity for ref_id ${refId}:`, error)
    throw error // Let recovery system handle this
  }
}

/**
 * Clean up hidden products that no longer have associated main products.
 * Returns true if orphans were found and removed.
 */
async function cleanupOrphanedHiddenProducts(cartItems: CartLineItem[]): Promise<boolean> {
  // Get all ref_ids from main products
  const mainProducts = cartItems.filter(
    item => item.properties[`${PROPERTY_PREFIX}_ref_id`] && !item.properties[HIDDEN_PRODUCT_IDENTIFIER]
  )
  const activeRefIds = new Set(mainProducts.map(item => item.properties[`${PROPERTY_PREFIX}_ref_id`] as string))

  // Find all hidden products
  const hiddenProducts = cartItems.filter(item => item.properties[HIDDEN_PRODUCT_IDENTIFIER] === 'true')

  // Find orphaned hidden products
  const orphanedHiddenProducts = hiddenProducts.filter(
    item =>
      item.properties[`${PROPERTY_PREFIX}_ref_id`]
      && !activeRefIds.has(item.properties[`${PROPERTY_PREFIX}_ref_id`] as string)
  )

  // Remove orphaned hidden products in a SINGLE /cart/update.js call.
  // Using one batch request instead of N individual /cart/change.js calls
  // prevents the PerformanceObserver feedback loop that freezes the page.
  if (orphanedHiddenProducts.length === 0) return false

  const updates: Record<string, number> = {}
  for (const orphan of orphanedHiddenProducts) {
    updates[orphan.key] = 0
  }

  try {
    const response = await fetch('/cart/update.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    })
    if (!response.ok) {
      throw new Error(`Failed to batch-remove orphans: ${response.status}`)
    }
    return true
  } catch (error) {
    console.error('[TailorKit] Error batch-removing orphaned products:', error)
    throw error
  }
}

/**
 * Update a cart line item using Shopify's cart change API.
 * Returns the updated cart object from the response (Shopify returns full cart).
 */
async function updateCartLineItem(
  itemKey: string,
  newQuantity: number,
  properties: LineItemProperties
): Promise<ShopifyCart> {
  try {
    const response = await fetch('/cart/change.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: itemKey,
        quantity: newQuantity,
        properties: properties,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to update cart item: ${response.status} ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error(`[TailorKit] Error updating cart item ${itemKey}:`, error)
    throw error
  }
}

/**
 * Refresh cart UI using already-available cart data (no extra /cart.js fetch).
 * Used after /cart/change.js which returns the full updated cart.
 */
async function refreshCartUI(cart: ShopifyCart): Promise<void> {
  try {
    await handleUpdateCart({}, cart, () => {
      const cartImageController = ensureCartImageControllerInitialized()
      if (cartImageController) {
        cartImageController.processCartImagesWithData(cart)
      }

      const hiddenManager = CartHiddenProductManager.getInstance()
      if (hiddenManager) {
        hiddenManager.processCartWithData(cart)
      }
    })
  } catch (error) {
    console.error('[TailorKit] Error refreshing cart UI:', error)
  }
}

/**
 * Trigger cart UI refresh by fetching latest cart state first.
 * Use when no cart data is available (e.g., after orphan cleanup via /cart/update.js).
 */
async function triggerCartUIRefresh(): Promise<void> {
  try {
    const cartResponse = await fetch('/cart.js')
    if (!cartResponse.ok) {
      throw new Error(`Failed to fetch cart data: ${cartResponse.status} ${cartResponse.statusText}`)
    }
    const cart = await cartResponse.json()
    await refreshCartUI(cart)
  } catch (error) {
    console.error('[TailorKit] Error triggering cart UI refresh:', error)
  }
}

/**
 * Force cleanup of orphaned hidden products (for manual use)
 * This bypasses the operation type check and always runs cleanup
 */
export async function forceCleanupOrphanedProducts(): Promise<void> {
  try {
    const response = await fetch('/cart.js')
    const cart = await response.json()
    const hadOrphans = await cleanupOrphanedHiddenProducts(cart.items)
    if (hadOrphans) {
      triggerCartUIRefresh()
    }
  } catch (error) {
    console.error('[TailorKit] Force cleanup failed:', error)
  }
}

// Initialize express checkout handler
if (typeof window !== 'undefined') {
  expressCheckoutHandler.init()

  // Export utilities for debugging
  ;(window as any).TailorkitCartUtils = {
    isExpressCheckoutActive: () => expressCheckoutHandler.isActive(),
    forceCleanup: forceCleanupOrphanedProducts,
  }
}
