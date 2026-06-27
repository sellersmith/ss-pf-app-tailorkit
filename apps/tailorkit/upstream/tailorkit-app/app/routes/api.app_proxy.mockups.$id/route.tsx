import { json } from '@remix-run/node'
import type { LoaderFunctionArgs } from '@remix-run/node'
import Mockup from '~/models/Mockup.server'
import { authenticateAppProxy } from '~/bootstrap/shopify/auth'
import { catchAsync } from '~/utils/catchAsync'

export const loader = catchAsync(async ({ request, params }: LoaderFunctionArgs) => {
  try {
    const { session } = await authenticateAppProxy(request)
    console.log('✅ App Proxy Authentication Success - Shop:', session.shop)

    const mockupId = params.id
    if (!mockupId) {
      return json(
        { error: 'Mockup ID is required' },
        {
          status: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
        }
      )
    }

    console.log('🔍 Searching for mockup:', mockupId, 'in shop:', session.shop)

    const mockup = await Mockup.findOne({
      _id: mockupId,
      shopDomain: session.shop,
    }).lean()

    if (!mockup) {
      console.log('❌ Mockup not found:', mockupId)
      return json(
        { error: 'Mockup not found' },
        {
          status: 404,
          headers: { 'Access-Control-Allow-Origin': '*' },
        }
      )
    }

    console.log('✅ Mockup found:', (mockup as any)._id)
    return json(mockup, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch (authError: any) {
    console.error('❌ App Proxy Authentication Failed:', authError)
    return json(
      { error: 'Authentication failed', details: authError.message },
      {
        status: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})
