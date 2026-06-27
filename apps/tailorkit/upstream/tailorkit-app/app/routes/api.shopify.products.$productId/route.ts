import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { PREFIX_PRODUCT_ID } from '~/constants/shopify'
import { authenticate } from '~/shopify/app.server'
import { ShopifyApiClient } from '~/shopify/graphql/api.server'
import { catchAsync } from '~/utils/catchAsync'

type ApplyAIMockupsRequestBody = {
  mockupUrls: string[]
}

/**
 * Apply AI mockups to a Shopify product by creating new media and reordering them to the front.
 *
 * Route: POST /api/shopify/products/:productId
 */
export const action = catchAsync(async ({ params, request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request)

  if (request.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, { status: 405 })
  }

  const productIdParam = params.productId
  if (!productIdParam) {
    return json({ success: false, error: 'Missing productId' }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as ApplyAIMockupsRequestBody | null
  const mockupUrls = body?.mockupUrls

  if (!Array.isArray(mockupUrls) || mockupUrls.length === 0) {
    return json({ success: false, error: 'mockupUrls is required' }, { status: 400 })
  }

  const productGid = `${PREFIX_PRODUCT_ID}${productIdParam}`
  const api = new ShopifyApiClient(admin)

  // 1) Create media, collect created media IDs (in the same order as URLs)
  const createdMediaIds: string[] = []
  for (let i = 0; i < mockupUrls.length; i++) {
    const url = mockupUrls[i]
    if (!url) continue

    const result = await api.createProductMedia(
      {
        alt: `AI mockup ${i + 1}`,
        mediaContentType: 'IMAGE',
        originalSource: url,
      },
      productGid
    )

    const mediaId = result?.media?.[0]?.id
    if (mediaId) {
      createdMediaIds.push(mediaId)
    }
  }

  if (!createdMediaIds.length) {
    return json({ success: false, error: 'Failed to create product media' }, { status: 500 })
  }

  // 2) Reorder: move created media starting from position 1 (2nd image), not position 0 (featured image).
  await api.productReorderMedia(
    productGid,
    // Shopify expects UnsignedInt64 values encoded as strings in GraphQL variables for MoveInput.newPosition.
    // Start from position 1 to avoid replacing the featured image
    createdMediaIds.map((id, index) => ({ id, newPosition: String(index + 1) }))
  )

  return json({ success: true, createdMediaIds })
})
