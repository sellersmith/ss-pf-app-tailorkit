import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { EActionType } from '~/constants/fetcher-keys'
import { authenticate } from '~/shopify/app.server'
import { catchAsync } from '~/utils/catchAsync'
import { cleanupShopDataAfterUninstalling, uninstallApp } from './fns.server'
import ShopifySession from '~/models/ShopifySession.server'

export const action = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  try {
    const {
      session: { shop: shopDomain },
    } = await authenticate.admin(request)

    const payload = (await request.json()) || {}
    const { action } = payload

    switch (action) {
      case EActionType.UNINSTALL_APP: {
        // Get user's access token
        const accessToken = (await ShopifySession.findOne({ shop: shopDomain }))?.accessToken

        if (!accessToken) return json({ success: false, message: 'Invalid access token' })

        const res = await uninstallApp(shopDomain, accessToken)

        // Clean up shop data
        cleanupShopDataAfterUninstalling(shopDomain)

        return json({ success: true, res })
      }

      default: {
        throw new Error('Invalid request')
      }
    }
  } catch (e: any) {
    return json({ success: false, message: e?.message || e })
  }
})
