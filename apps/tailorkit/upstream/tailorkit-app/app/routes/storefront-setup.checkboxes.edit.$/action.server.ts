import type { ActionFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import { json } from '~/bootstrap/fns/fetch.server'
import { catchAsync } from '~/utils/catchAsync'
import { updateCheckbox, deleteCheckboxes } from '~/services/checkbox.server'
import { EDIT_ACTIONS } from './constants'
import { trackEvent } from '~/bootstrap/fns/mixpanel.server'
import { EVENTS_TRACKING, EVENTS_PARAMETERS_NAME } from '~/bootstrap/constants/eventsTracking'
import { getShopData } from '~/models/Shop.server'

export const action = catchAsync(async ({ request, params }: ActionFunctionArgs) => {
  const {
    admin,
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const checkboxId = params['*']
  if (!checkboxId) {
    return json({ success: false, message: 'Checkbox ID is required' }, { status: 400 })
  }

  const formData = await request.formData()
  const actionType = formData.get('action') as string

  // Get shop data for tracking
  const shopData = await getShopData(shopDomain)

  switch (actionType) {
    case EDIT_ACTIONS.UPDATE: {
      const data = JSON.parse(formData.get('data') as string)
      const checkbox = await updateCheckbox(shopDomain, checkboxId, data, admin.graphql)

      if (!checkbox) {
        return json({ success: false, message: 'Checkbox not found' }, { status: 404 })
      }

      // Track checkbox update
      if (shopData) {
        trackEvent(shopData, EVENTS_TRACKING.CHECKBOX_UPDATED, {
          [EVENTS_PARAMETERS_NAME.CHECKBOX_ID]: checkboxId,
        }).catch(err => console.error('Failed to track checkbox update:', err))
      }

      return json({ success: true, data: checkbox })
    }

    case EDIT_ACTIONS.DELETE: {
      await deleteCheckboxes(shopDomain, [checkboxId], admin.graphql)

      // Track checkbox deletion
      if (shopData) {
        trackEvent(shopData, EVENTS_TRACKING.CHECKBOX_DELETED, {
          [EVENTS_PARAMETERS_NAME.CHECKBOX_ID]: checkboxId,
        }).catch(err => console.error('Failed to track checkbox deletion:', err))
      }

      return redirect('/storefront-setup/checkboxes')
    }

    default:
      return json({ success: false, message: 'Invalid action' }, { status: 400 })
  }
})
