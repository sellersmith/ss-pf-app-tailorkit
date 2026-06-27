/* eslint-disable max-len */
import type { LoaderFunctionArgs } from '@remix-run/node'
import Printify from '~/modules/Fulfillments/Printify'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import { DEFAULT_SHOP_ID, DEFAULT_API_TOKEN } from '../api.user-journey/constants'

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  try {
    await authenticate.admin(request)

    const bludeprintId = params.id || ''

    // Get source and category from query params
    const url = new URL(request.url)
    const source = url.searchParams.get('source')
    const providerId = url.searchParams.get('providerId')

    if (!providerId) {
      throw new Error('Provider ID is required')
    }

    switch (source) {
      default: {
        // Fetch Printify product's variants
        const printify = new Printify({
          accessToken: DEFAULT_API_TOKEN,
          shopId: DEFAULT_SHOP_ID,
        })

        let res: any = await printify.catalog.getBlueprintVariants(bludeprintId, providerId)
        const items = res?.variants || []

        // Fetch variant prices
        res = await fetch(
          `https://printify.com/product-catalog-service/api/v2/blueprints/${bludeprintId}/print-providers/${providerId}/variants`
        )
          .then(res => res.json())
          .catch(console.error)

        return json({
          success: true,
          items: items.map((item: any) => ({
            ...item,
            costs: res.data.find((v: any) => v.id === item.id)?.costs,
            available: res.data.find((v: any) => v.id === item.id)?.available,
          })),
        })
      }
    }

    return json({ success: true, items: [] })
  } catch (e: any) {
    console.error(e)
    return json({ success: false, message: e.message || e })
  }
}
