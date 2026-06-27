import type { ShopifyGlobal } from '@shopify/app-bridge-react'
import { INVALID_SHOP_ERROR, INVALID_SHOPIFY_CONFIG } from '~/constants/errors'
import { getMyShopifySubdomainName } from '~/shopify/fns'

export function redirectShopifyAdmin(pathName: string, shopify: ShopifyGlobal = window.shopify) {
  // Validate shopify object
  if (!shopify || !shopify.origin || !shopify.config) {
    console.error(INVALID_SHOPIFY_CONFIG)
    return
  }

  const { origin: shopifyOrigin, config: shopConfig } = shopify
  const shopDomain = shopConfig.shop

  // Validate shopDomain
  if (!shopDomain) {
    console.error(INVALID_SHOP_ERROR)
    return
  }

  const myShopifyDomain = getMyShopifySubdomainName(shopDomain)

  // Ensure pathName starts with a slash
  const sanitizedPathName = pathName.startsWith('/') ? pathName : `/${pathName}`

  try {
    // Redirect to Shopify admin
    window.parent.location.href = `${shopifyOrigin}/store/${myShopifyDomain}${sanitizedPathName}`
  } catch (error) {
    console.error('Failed to redirect to Shopify Admin:', error)
  }
}
