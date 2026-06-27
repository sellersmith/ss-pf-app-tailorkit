import type { ActionFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import { json } from '~/bootstrap/fns/fetch.server'
import { catchAsync } from '~/utils/catchAsync'
import {
  createCheckbox,
  getUpsellProductLimit,
  isCheckboxLimitReached,
  UPSELL_LIMIT_ERROR,
} from '~/services/checkbox.server'
import { ADD_ACTIONS } from './constants'
import { trackEvent } from '~/bootstrap/fns/mixpanel.server'
import { EVENTS_TRACKING, EVENTS_PARAMETERS_NAME } from '~/bootstrap/constants/eventsTracking'
import { getShopData } from '~/models/Shop.server'

export const action = catchAsync(async ({ request }: ActionFunctionArgs) => {
  const {
    admin,
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const formData = await request.formData()
  const actionType = formData.get('action') as string

  switch (actionType) {
    case ADD_ACTIONS.CREATE: {
      // Validate upsell product limit before creating
      const shopData = await getShopData(shopDomain)
      const upsellProductLimit = getUpsellProductLimit(shopData)
      if (await isCheckboxLimitReached(shopDomain, upsellProductLimit)) {
        return json({ success: false, message: UPSELL_LIMIT_ERROR }, { status: 403 })
      }

      const data = JSON.parse(formData.get('data') as string)
      const checkbox = await createCheckbox(shopDomain, data, admin.graphql)

      // Track checkbox creation
      if (shopData) {
        trackEvent(shopData, EVENTS_TRACKING.CHECKBOX_CREATED, {
          [EVENTS_PARAMETERS_NAME.CHECKBOX_ID]: checkbox._id.toString(),
          [EVENTS_PARAMETERS_NAME.CHECKBOX_TITLE]: checkbox.title,
          [EVENTS_PARAMETERS_NAME.CHECKBOX_PLACEMENT]: checkbox.typePlacement,
          [EVENTS_PARAMETERS_NAME.CHECKBOX_TRIGGER_TYPE]: checkbox.triggerProductsType,
          [EVENTS_PARAMETERS_NAME.CHECKBOX_SOURCE]: 'form',
        }).catch(err => console.error('Failed to track checkbox creation:', err))
      }

      // Option 1: Return JSON response
      // return json({ success: true, data: checkbox })

      // Option 2: Redirect to edit page after creation
      return redirect(`/storefront-setup/checkboxes/edit/${checkbox._id}`)
    }

    default:
      return json({ success: false, message: 'Invalid action' }, { status: 400 })
  }
})
