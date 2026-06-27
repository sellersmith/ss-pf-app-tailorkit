import { type LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { getDetailIntegration } from '~/models/Integration.server'
import { authenticate } from '~/shopify/app.server'
import { catchAsync } from '~/utils/catchAsync'

export const loader = catchAsync(async ({ params, request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const { searchParams } = new URL(request.url)
  const mockupId = searchParams.get('mockup') || ''
  const populateTemplate = searchParams.get('populateTemplate') === '1'

  const integrationId = params.id || ''
  const integrationData = await getDetailIntegration({
    _id: integrationId,
    shopDomain,
    mockupId,
    populateTemplate,
  })

  return json(integrationData)
})
