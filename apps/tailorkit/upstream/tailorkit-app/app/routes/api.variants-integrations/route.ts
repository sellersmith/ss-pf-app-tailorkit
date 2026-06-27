import { type LoaderFunctionArgs } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import { catchAsync } from '~/utils/catchAsync'
import { getAllVariantsIntegrated, getIntegrationByVariantId } from './fns.server'
import { VARIANTS_INTEGRATIONS_ACTIONS } from './constants'
import { json } from '~/bootstrap/fns/fetch.server'

export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const variants = await getAllVariantsIntegrated({ shopDomain })

  return json({ success: true, variants })
})

export const action = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const payload = await request.json()
  const { action } = payload

  switch (action) {
    case VARIANTS_INTEGRATIONS_ACTIONS.GET_INTEGRATION_BY_VARIANT_ID: {
      const { variant_id } = payload
      const { integration, variantIntegration } = await getIntegrationByVariantId(shopDomain, variant_id)
      return json({ success: true, integration, variantIntegration })
    }

    default: {
      return json({ success: false, message: 'Invalid action' })
    }
  }
})
