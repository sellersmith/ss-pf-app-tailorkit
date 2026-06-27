import type { ShopifyCart } from '../types/shopify-cart'

export async function getCart(): Promise<ShopifyCart> {
  const cart = await fetch(`${(window as any).Shopify?.routes?.root || '/'}cart.js`)
  return cart.json()
}
