import { type LoaderFunctionArgs } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import { getTutorials } from '~/utils/supabase-client.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await authenticate.admin(request)
    const tutorials = await getTutorials(20)

    return Response.json({ success: true, data: tutorials })
  } catch (error: any) {
    console.error('Error in /api/tutorials:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}
