import { type LoaderFunctionArgs } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import { CHANGELOG_API } from '../api.google-sheet/constants'
import { GoogleSheetAction, handleGoogleSheetData } from '../api.google-sheet/fn.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Authenticate admin
    await authenticate.admin(request)

    // Fetch changelog data from Google Sheet Data
    const googleSheetData = await handleGoogleSheetData({ action: GoogleSheetAction.GET })
    const changelog = googleSheetData?.[CHANGELOG_API] || {}

    return Response.json(changelog)
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
