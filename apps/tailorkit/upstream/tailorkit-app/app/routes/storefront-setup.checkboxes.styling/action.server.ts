import type { ActionFunctionArgs } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import { json } from '~/bootstrap/fns/fetch.server'
import { catchAsync } from '~/utils/catchAsync'
import { getGlobalStyling, saveGlobalStyling } from '~/models/GlobalStyling.server'
import { updateGlobalStylingToAppMetafields } from '~/routes/api.preferences/fns.server'
import type { CheckboxGlobalStyling, GlobalStyling } from '~/types/global-styling'
import { createDefaultGlobalStyling } from '~/types/global-styling'
import { STYLING_ACTIONS } from './constants'

export const action = catchAsync(async ({ request }: ActionFunctionArgs) => {
  const {
    admin,
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const formData = await request.formData()
  const actionType = formData.get('action') as string

  switch (actionType) {
    case STYLING_ACTIONS.SAVE: {
      const checkboxStyling = JSON.parse(formData.get('data') as string) as CheckboxGlobalStyling

      // Get existing global styling or create default
      const existingGlobalStyling = await getGlobalStyling(shopDomain)
      const currentStyling: GlobalStyling = existingGlobalStyling?.styling || createDefaultGlobalStyling()

      // Update checkbox styling within global styling
      const updatedStyling: GlobalStyling = {
        ...currentStyling,
        checkbox: checkboxStyling,
      }

      // Save to database
      await saveGlobalStyling(shopDomain, updatedStyling)

      // Sync to Shopify metafield for storefront access
      await updateGlobalStylingToAppMetafields(admin, updatedStyling)

      return json({ success: true, data: checkboxStyling })
    }

    default:
      return json({ success: false, message: 'Invalid action' }, { status: 400 })
  }
})
