import type { LoaderFunctionArgs } from '@remix-run/node'
import { GoogleSheetAction, handleGoogleSheetData } from './fn.server'
import { authenticate } from '~/shopify/app.server'

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request)
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  try {
    switch (action) {
      case GoogleSheetAction.GET: {
        const googleSheetData = await handleGoogleSheetData({ action: GoogleSheetAction.GET })
        return Response.json(googleSheetData)
      }

      case GoogleSheetAction.SET: {
        const googleSheetData = await handleGoogleSheetData({ action: GoogleSheetAction.SET })
        return Response.json(googleSheetData)
      }

      default: {
        return Response.json({ error: 'Invalid action' }, { status: 400 })
      }
    }
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
