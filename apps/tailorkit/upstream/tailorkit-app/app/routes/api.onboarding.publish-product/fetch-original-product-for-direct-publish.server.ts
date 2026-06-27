/**
 * Fetches the original product (id, handle, variant ids) for the integrate-direct
 * publish path — no duplication, no inventory mutation. The integrate-direct flow
 * attaches a personalization integration onto the merchant's existing product.
 *
 * Returns up to 250 variant ids (matches the page size used by `duplicateProduct`).
 */

import VariantIntegration from '~/models/VariantIntegration.server'

const FETCH_PRODUCT_QUERY = /* GraphQL */ `
  query getProductForDirectPublish($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      variants(first: 250) {
        nodes {
          id
        }
      }
    }
  }
`

export interface OriginalProductForDirectPublish {
  productId: string
  handle: string
  title: string
  variantIds: string[]
}

/** Normalize incoming product id to Shopify GID format. */
function ensureProductGid(productId: string): string {
  return productId.startsWith('gid://shopify/Product/') ? productId : `gid://shopify/Product/${productId}`
}

export async function fetchOriginalProductForDirectPublish(
  admin: { graphql: (...args: any[]) => any },
  productId: string
): Promise<OriginalProductForDirectPublish | null> {
  const result = await admin.graphql(FETCH_PRODUCT_QUERY, {
    variables: { id: ensureProductGid(productId) },
  })
  const parsed = await result.json()
  const product = parsed?.data?.product
  if (!product) return null
  const variantIds = (product.variants?.nodes || []).map((v: { id: string }) => v.id).filter(Boolean)
  return {
    productId: product.id,
    handle: product.handle,
    title: product.title,
    variantIds,
  }
}

/**
 * Defense-in-depth: returns true when the product has any active personalization
 * integration. Step 1 already disables such products in the UI, but a tampered
 * client could still POST — this guard makes the server reject it.
 */
export async function productHasActiveIntegration(shopDomain: string, productId: string): Promise<boolean> {
  // Match both raw numeric id and full GID — the products list and webhooks may store either form.
  const numericId = productId.replace('gid://shopify/Product/', '')
  const exists = await VariantIntegration.exists({
    shopDomain,
    productActivated: true,
    productId: { $in: [productId, numericId, `gid://shopify/Product/${numericId}`] },
  })
  return Boolean(exists)
}
