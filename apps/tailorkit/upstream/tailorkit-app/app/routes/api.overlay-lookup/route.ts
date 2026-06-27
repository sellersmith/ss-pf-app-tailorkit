import type { LoaderFunctionArgs } from '@remix-run/node'
import Asset from '~/models/Asset.server'
import { catchAsync } from '~/utils/catchAsync'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'

export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)

  // Get product title from query string
  const searchParams = new URL(request.url).searchParams
  const productTitle = searchParams.get('product_title')

  if (!productTitle) {
    return json({ success: false })
  }

  const parts = productTitle.toLowerCase().split(' - ')
  const variantNames = (parts.pop() || '').split(' / ')
  const _productTitle = parts.join(' - ')

  const regExpPattern: any = _productTitle
    .replace(/(\W+|\b\w\b)/g, ' ')
    .trim()
    .replace(/\s+/g, '|')

  // Find suitable overlays based on the product title
  let overlays = await Asset.aggregate([
    {
      $match: {
        type: 'overlay',
        shopDomain: '*',
        tags: {
          $regex: regExpPattern,
          $options: 'i',
        },
      },
    },
    {
      $sort: {
        updatedAt: -1,
      },
    },
  ]).exec()

  // Filter the suitable overlays for the best matching
  overlays = overlays
    .map(o => {
      o.score = 0
      o.matchedTags = 0

      o.tags?.forEach((t: string, i: number) => {
        if (variantNames.includes(t)) {
          // Matching in variant name is more important
          o.matchedTags++
          o.score += t.length / (i + 1)
        } else if (_productTitle.indexOf(t) > -1) {
          // Matching in product title is less important
          o.matchedTags++
          o.score += t.length / ((i + 1) * 2)
        }
      })

      return o
    })
    .filter(o => o.score && o.matchedTags > 0)
    .sort((a, b) => {
      if (a.score > b.score || (a.score === b.score && a.matchedTags > b.matchedTags)) {
        return -1
      }

      if (a.score < b.score || (a.score === b.score && a.matchedTags < b.matchedTags)) {
        return 1
      }

      return 0
    })

  return json({ success: true, overlays })
})

export const action = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)

  const payload = (await request.json()) || {}
  const { previewUrl, transparentRegions } = payload

  // Update overlay with transparent regions
  if (previewUrl && transparentRegions) {
    await Asset.updateOne({ previewUrl }, { metadata: { transparentRegions } })
  }

  return json({ success: true })
})
