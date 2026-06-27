import { json } from '@remix-run/node'
import type { LoaderFunctionArgs } from '@remix-run/node'
import Mockup from '~/models/Mockup.server'
import { authenticate } from '~/shopify/app.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request)

  try {
    const mockupId = params.id
    if (!mockupId) {
      return json({ error: 'Mockup ID is required' }, { status: 400 })
    }

    const mockup = await Mockup.findOne({
      _id: mockupId,
      shopDomain: session.shop,
    }).lean()

    if (!mockup) {
      return json({ error: 'Mockup not found' }, { status: 404 })
    }

    return json(mockup)
  } catch (error) {
    console.error('Error fetching mockup:', error)
    return json({ error: 'Failed to fetch mockup' }, { status: 500 })
  }
}
