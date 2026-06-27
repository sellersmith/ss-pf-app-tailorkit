import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)

  return json({ apiKey: process.env.SHOPIFY_API_KEY })
}
