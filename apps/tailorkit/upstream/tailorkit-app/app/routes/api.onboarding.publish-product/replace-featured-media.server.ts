/**
 * Server-side helper that promotes a generated mockup image to a product's featured
 * position (index 0). Used by the simplified-onboarding publish flow when the merchant
 * opts in via the "Replace featured product image" toggle on Step 5.
 *
 * Flow:
 *   1. productCreateMedia({ originalSource: featuredMediaUrl }) — attaches the image
 *   2. Poll the media's status until READY (bounded retry loop). Shopify processes image
 *      uploads asynchronously; calling productReorderMedia before status=READY errors out.
 *   3. productReorderMedia({ newPosition: '0' }) — moves the new media to the featured slot
 *
 * Failure is non-fatal — callers should treat any error as "skip media replacement" and
 * let the rest of the publish succeed.
 */

import type { ShopifyApiClient } from '~/shopify/graphql/api.server'

/** Max polling attempts × interval = worst-case wait before giving up on media processing. */
const MEDIA_READY_POLL_MAX_ATTEMPTS = 8
const MEDIA_READY_POLL_INTERVAL_MS = 2000

export type ReplaceFeaturedMediaStage = 'create-media' | 'polling' | 'reorder'

export interface ReplaceFeaturedMediaResult {
  success: boolean
  mediaId?: string
  /** Pipeline stage that failed (undefined on success). Useful for telemetry segmentation. */
  stage?: ReplaceFeaturedMediaStage
  /** Normalized error code — either a Shopify userError message or an internal sentinel. */
  error?: string
}

/** GraphQL used to poll a single MediaImage's processing status. */
const GET_MEDIA_STATUS_QUERY = /* GraphQL */ `
  query getMediaStatus($id: ID!) {
    node(id: $id) {
      ... on MediaImage {
        id
        status
      }
    }
  }
`

/**
 * Bounded polling loop. Resolves once status is READY, or returns the terminal non-ready
 * status (FAILED / TIMEOUT) when the loop exhausts.
 */
async function waitForMediaReady(
  admin: { graphql: (...args: any[]) => any },
  mediaId: string
): Promise<{ ready: boolean; status: string }> {
  for (let attempt = 0; attempt < MEDIA_READY_POLL_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await admin.graphql(GET_MEDIA_STATUS_QUERY, { variables: { id: mediaId } })
      const parsed = await response.json()
      const status = parsed?.data?.node?.status as string | undefined
      if (status === 'READY') return { ready: true, status }
      if (status === 'FAILED') return { ready: false, status }
      // UPLOADED / PROCESSING / unknown — keep polling.
    } catch (err) {
      // Transient GraphQL errors — treat as a skip-this-attempt, keep the loop going.
      console.warn('[replace-featured-media] media status poll failed:', err)
    }
    await new Promise(r => setTimeout(r, MEDIA_READY_POLL_INTERVAL_MS))
  }
  return { ready: false, status: 'TIMEOUT' }
}

/** Create the new media + poll for readiness + reorder to the featured slot. */
export async function replaceFeaturedMedia(opts: {
  shopifyApi: ShopifyApiClient
  admin: { graphql: (...args: any[]) => any }
  productId: string
  productTitle: string
  featuredMediaUrl: string
}): Promise<ReplaceFeaturedMediaResult> {
  const { shopifyApi, admin, productId, productTitle, featuredMediaUrl } = opts

  // 1. Create the media attached to the product.
  let mediaId: string | undefined
  try {
    const created = await shopifyApi.createProductMedia(
      {
        originalSource: featuredMediaUrl,
        mediaContentType: 'IMAGE',
        alt: `${productTitle} — personalization preview`,
      },
      productId
    )
    mediaId = created?.media?.[0]?.id
    const userErrors = created?.mediaUserErrors || []
    if (userErrors.length) {
      return {
        success: false,
        stage: 'create-media',
        error: userErrors.map((e: { message: string }) => e.message).join('; '),
      }
    }
    if (!mediaId) {
      return { success: false, stage: 'create-media', error: 'NO_MEDIA_ID' }
    }
  } catch (err) {
    return {
      success: false,
      stage: 'create-media',
      error: err instanceof Error ? err.message : 'unknown',
    }
  }

  // 2. Wait for Shopify to finish processing before reordering — skipping the wait causes
  //    reorder to reject with "media not ready" in a meaningful fraction of cases.
  const readiness = await waitForMediaReady(admin, mediaId)
  if (!readiness.ready) {
    return { success: false, mediaId, stage: 'polling', error: `MEDIA_NOT_READY_${readiness.status}` }
  }

  // 3. Reorder the newly-created media to position 0 (featured).
  try {
    await shopifyApi.productReorderMedia(productId, [{ id: mediaId, newPosition: '0' }])
    return { success: true, mediaId }
  } catch (err) {
    return {
      success: false,
      mediaId,
      stage: 'reorder',
      error: err instanceof Error ? err.message : 'unknown',
    }
  }
}
