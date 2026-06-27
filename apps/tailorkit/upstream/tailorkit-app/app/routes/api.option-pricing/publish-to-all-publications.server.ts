/**
 * Minimal Shopify API surface needed for publishing — keeps this helper decoupled from
 * the full ShopifyApiClient, so it can be unit-tested without pulling server-only deps.
 */
export interface PublishApi {
  getStorePublications(): Promise<Array<{ node: { id: string; name: string } }>>
  publishablePublish(productId: string, publicationId: string): Promise<unknown>
}

/**
 * Publish product to every publication returned by the shop.
 * Each Shopify Market with its own catalog surfaces as a separate publication — iterating
 * them ensures the hidden pricing product is reachable for every buyer region, not just
 * the Primary market.
 */
export async function publishProductToAllPublications(api: PublishApi, productId: string): Promise<void> {
  try {
    const storePublications = await api.getStorePublications()

    if (!storePublications?.length) {
      console.warn('⚠️ No publications found on shop')
      return
    }

    for (const pub of storePublications) {
      const { id, name } = pub.node
      try {
        await api.publishablePublish(productId, id)
        console.log(`✅ Product published to ${name}`)
      } catch (error) {
        // One publication failing (e.g. an app channel with restrictions) shouldn't block the rest
        console.warn(`⚠️ Failed to publish to ${name}:`, error)
      }
    }
  } catch (error) {
    console.error('Failed to publish product to publications:', error)
  }
}
