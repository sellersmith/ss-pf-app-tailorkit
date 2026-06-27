import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticateAppProxy } from '~/bootstrap/shopify/auth'
import { catchAsync } from '~/utils/catchAsync'

export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAppProxy(request)

  const { shop } = session

  // Response to hello world and status 200 to check app proxy is working
  return json({ message: `Hello ${shop}` }, { status: 200 })
})
