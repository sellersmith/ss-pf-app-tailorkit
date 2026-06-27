import { json } from '@remix-run/node'
import type { LoaderFunctionArgs } from '@remix-run/node'
import Mockup from '~/models/Mockup.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  console.log('🔍 Public Mockup Route - Request URL:', request.url)

  try {
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

    // Get shop domain from query parameter for testing
    const url = new URL(request.url)
    const shopDomain = url.searchParams.get('shop')

    if (!shopDomain) {
      return json(
        { error: 'Shop domain is required as query parameter' },
        {
          status: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
        }
      )
    }

    console.log('🔍 Searching for mockup:', mockupId, 'in shop:', shopDomain)

    const mockup = await Mockup.findOne({
      _id: mockupId,
      shopDomain: shopDomain,
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
  } catch (error: any) {
    console.error('❌ Error fetching mockup:', error)
    return json(
      { error: 'Failed to fetch mockup', details: error.message },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
}
