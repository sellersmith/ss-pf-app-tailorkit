import { PROPERTY_PREFIX } from '../constants'
import type { ShopifyCart } from '../types/shopify-cart'

interface CartItemComparison {
  id: number
  key: string
  quantity: number
  tailorkitProperties: any
  refId: string | null
}

export const lastFetchedCartProducts: any = { items: [] }
let isFetching: boolean = false
let queueCallbacks: Array<{ handler: Function; operationType: string }> = []

/**
 * Observe cart changes and call the handler function when the cart changes
 * @param handler - The function to call when the cart changes
 * @returns A function to disconnect the observer
 */
export default function observeCartChanges(handler: Function) {
  const cartObserver = new PerformanceObserver(list => {
    const cartChangeEntries = list.getEntries().filter((entry: any) => {
      const isValidRequestType = ['xmlhttprequest', 'fetch'].includes(entry.initiatorType)
      const isCartChangeRequest = /\/cart\/(change|add|update|clear)/.test(entry.name)
      return isValidRequestType && isCartChangeRequest
    })

    if (cartChangeEntries?.length && typeof handler === 'function') {
      // Determine the type of cart operation
      const lastEntry = cartChangeEntries[cartChangeEntries.length - 1] as any
      const operationType = lastEntry.name.includes('/cart/add')
        ? 'add'
        : lastEntry.name.includes('/cart/change')
          ? 'change'
          : lastEntry.name.includes('/cart/update')
            ? 'update'
            : lastEntry.name.includes('/cart/clear')
              ? 'clear'
              : 'unknown'

      // Push the handlers to a queue so that we only need to fetch cart.js one time.
      queueCallbacks.push({ handler, operationType })
      // Prevent handling another request if the earlier request is still in progress
      if (isFetching) return
      isFetching = true

      fetch(`${(window as any).Shopify?.routes?.root || '/'}cart.js`)
        .then(res => res.json())
        .then((data: ShopifyCart) => {
          // Only update the product offers list when cart items change
          // Include quantity and key to detect quantity changes and item changes
          const lastFetchedProductsWithTailorkitFlag: CartItemComparison[] = (
            lastFetchedCartProducts?.items?.length
              ? lastFetchedCartProducts.items.map((item: any) => ({
                  id: item.id,
                  key: item.key, // Include cart line item key
                  quantity: item.quantity, // Include quantity for change detection
                  tailorkitProperties: item.properties[PROPERTY_PREFIX] || null,
                  refId: item.properties[`${PROPERTY_PREFIX}_ref_id`] || null,
                }))
              : []
          ).sort((a: CartItemComparison, b: CartItemComparison) => a.key.localeCompare(b.key))

          const currentProductsWithTailorkitFlag: CartItemComparison[] = (
            data?.items?.length
              ? data.items.map((item: any) => ({
                  id: item.id,
                  key: item.key, // Include cart line item key
                  quantity: item.quantity, // Include quantity for change detection
                  tailorkitProperties: item.properties[PROPERTY_PREFIX] || null,
                  refId: item.properties[`${PROPERTY_PREFIX}_ref_id`] || null,
                }))
              : []
          ).sort((a: CartItemComparison, b: CartItemComparison) => a.key.localeCompare(b.key))

          // Compare both arrays to detect any changes (additions, removals, quantity changes)
          const stringifiedLastFetchedProducts = JSON.stringify(lastFetchedProductsWithTailorkitFlag)
          const stringifiedCurrentProducts = JSON.stringify(currentProductsWithTailorkitFlag)
          const hasChanges = stringifiedLastFetchedProducts !== stringifiedCurrentProducts

          if (hasChanges) {
            console.log('[TailorKit] Cart change detected:', {
              before: lastFetchedProductsWithTailorkitFlag,
              after: currentProductsWithTailorkitFlag,
            })

            // Cache the latest cart items
            lastFetchedCartProducts['items'] = data?.items || []
            Promise.allSettled(queueCallbacks.map(item => item.handler(data, item.operationType)))
          }
        })
        .catch(e => console.error(e))
        .finally(() => {
          queueCallbacks = []
          isFetching = false
        })
    }
  })
  cartObserver.observe({ entryTypes: ['resource'] })

  return () => cartObserver.disconnect()
}
