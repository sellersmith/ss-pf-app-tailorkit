import type { ActionFunctionArgs } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import { json } from '~/bootstrap/fns/fetch.server'
import { catchAsync } from '~/utils/catchAsync'
import {
  deleteCheckboxes,
  duplicateCheckboxes,
  activateCheckboxes,
  deactivateCheckboxes,
  getUpsellProductLimit,
  isCheckboxLimitReached,
  UPSELL_LIMIT_ERROR,
} from '~/services/checkbox.server'
import { LIST_ACTIONS } from './constants'
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
  const checkboxIds = JSON.parse(formData.get('checkboxIds') as string) as string[]

  if (!checkboxIds?.length) {
    return json({ success: false, message: 'No add-ons selected' }, { status: 400 })
  }

  // Get shop data for tracking
  const shopData = await getShopData(shopDomain)

  switch (actionType) {
    case LIST_ACTIONS.DELETE: {
      const result = await deleteCheckboxes(shopDomain, checkboxIds, admin.graphql)
      if (shopData) {
        trackEvent(shopData, EVENTS_TRACKING.CHECKBOX_BULK_DELETED, {
          [EVENTS_PARAMETERS_NAME.CHECKBOX_COUNT]: result.deletedCount,
        }).catch(err => console.error('Failed to track bulk add-on deletion:', err))
      }
      return json({
        success: true,
        message: `${result.deletedCount} add-on(s) deleted`,
        data: result,
      })
    }

    case LIST_ACTIONS.DUPLICATE: {
      // Validate upsell product limit before duplicating
      const upsellProductLimit = getUpsellProductLimit(shopData)
      if (await isCheckboxLimitReached(shopDomain, upsellProductLimit, checkboxIds.length)) {
        return json({ success: false, message: UPSELL_LIMIT_ERROR }, { status: 403 })
      }

      const duplicates = await duplicateCheckboxes(shopDomain, checkboxIds, admin.graphql)
      if (shopData) {
        trackEvent(shopData, EVENTS_TRACKING.CHECKBOX_BULK_DUPLICATED, {
          [EVENTS_PARAMETERS_NAME.CHECKBOX_COUNT]: duplicates.length,
        }).catch(err => console.error('Failed to track bulk add-on duplication:', err))
      }
      return json({
        success: true,
        message: `${duplicates.length} add-on(s) duplicated`,
        data: duplicates,
      })
    }

    case LIST_ACTIONS.ACTIVATE: {
      const result = await activateCheckboxes(shopDomain, checkboxIds, admin.graphql)
      if (shopData) {
        trackEvent(shopData, EVENTS_TRACKING.CHECKBOX_BULK_ACTIVATED, {
          [EVENTS_PARAMETERS_NAME.CHECKBOX_COUNT]: result.modifiedCount,
          [EVENTS_PARAMETERS_NAME.CHECKBOX_STATUS]: 'active',
        }).catch(err => console.error('Failed to track bulk add-on activation:', err))
      }
      return json({
        success: true,
        message: `${result.modifiedCount} add-on(s) activated`,
        data: result,
      })
    }

    case LIST_ACTIONS.DEACTIVATE: {
      const result = await deactivateCheckboxes(shopDomain, checkboxIds, admin.graphql)
      if (shopData) {
        trackEvent(shopData, EVENTS_TRACKING.CHECKBOX_BULK_DEACTIVATED, {
          [EVENTS_PARAMETERS_NAME.CHECKBOX_COUNT]: result.modifiedCount,
          [EVENTS_PARAMETERS_NAME.CHECKBOX_STATUS]: 'draft',
        }).catch(err => console.error('Failed to track bulk add-on deactivation:', err))
      }
      return json({
        success: true,
        message: `${result.modifiedCount} add-on(s) deactivated`,
        data: result,
      })
    }

    default:
      return json({ success: false, message: 'Invalid action' }, { status: 400 })
  }
})
