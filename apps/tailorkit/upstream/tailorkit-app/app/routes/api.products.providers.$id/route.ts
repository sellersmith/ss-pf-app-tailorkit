/* eslint-disable max-len */
import type { LoaderFunctionArgs } from '@remix-run/node'
import fetch from 'node-fetch'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  try {
    await authenticate.admin(request)

    const bludeprintId = params.id || ''

    // Get source and category from query params
    const url = new URL(request.url)
    const source = url.searchParams.get('source')

    switch (source) {
      default: {
        // Fetch Printify product's print providers
        const res: any = await fetch(
          `https://printify.com/product-catalog-service/api/v2/blueprints/${bludeprintId}/print-providers`
        )
          .then(res => res.json())
          .catch(console.error)

        return json({ success: true, items: res.data })
      }
    }
  } catch (e: any) {
    console.error(e)
    return json({ success: false, message: e.message || e })
  }
}
