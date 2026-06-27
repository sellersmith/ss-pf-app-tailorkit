import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import type { PipelineStage } from 'mongoose'
import { authenticate } from '~/shopify/app.server'
import { fetchList, json } from '~/bootstrap/fns/fetch.server'
import { catchAsync } from '~/utils/catchAsync'
import {
  getCheckboxById,
  createCheckbox,
  updateCheckbox,
  deleteCheckboxes,
  duplicateCheckboxes,
  activateCheckboxes,
  deactivateCheckboxes,
  getGlobalStyling,
  getOrderSetting,
} from '~/services/checkbox.server'
import { CheckboxModel } from '~/models/Checkbox.server'
import { CHECKBOX_ACTIONS } from './constants'
import { getPublishedVariantGids } from '~/routes/api.app_proxy.storefront/actions/cross-product-personalizer.server'

/**
 * GET /api/checkboxes
 * Supports ListTable query params: page, limit, sort, filter__*
 */
export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)
  const { searchParams } = new URL(request.url)

  // Check if requesting a single add-on
  const checkboxId = searchParams.get('id')
  if (checkboxId) {
    const checkbox = await getCheckboxById(shopDomain, checkboxId)
    if (!checkbox) {
      return json({ success: false, message: 'Add-on not found' }, { status: 404 })
    }
    return json({ success: true, data: checkbox })
  }

  // Handle status filter (map 'active'/'draft' to isActive boolean)
  // Filter can be comma-separated array: 'active,draft' or single value: 'active' or 'draft'
  const statusFilter = searchParams.get('filter__status')
  let statusMatch: PipelineStage | null = null

  if (statusFilter) {
    // Remove the string filter from searchParams (we'll handle it in pipeline)
    searchParams.delete('filter__status')

    // Parse comma-separated values (array format from ChoiceList)
    const statusValues = statusFilter.split(',').map(s => s.trim())

    // Only apply filter if not selecting both (show all when both selected)
    if (statusValues.length === 1) {
      if (statusValues[0] === 'active') {
        statusMatch = { $match: { isActive: true } }
      } else if (statusValues[0] === 'draft') {
        statusMatch = { $match: { isActive: false } }
      }
    }
    // If both 'active' and 'draft' are selected, don't filter (show all)
  }

  // Handle placement filter (use typePlacement field)
  const placementFilter = searchParams.get('filter__placement')
  if (placementFilter) {
    searchParams.delete('filter__placement')
    searchParams.set('filter__typePlacement', placementFilter)
  }

  // Create a new URL with modified search params
  const modifiedUrl = new URL(request.url)
  modifiedUrl.search = searchParams.toString()
  const modifiedRequest = new Request(modifiedUrl, request)

  // Initial pipeline to exclude soft-deleted items and apply status filter
  const initialPipeline: PipelineStage[] = [{ $match: { deletedAt: null } }, ...(statusMatch ? [statusMatch] : [])]

  // Use fetchList for ListTable compatibility
  const result = await fetchList(modifiedRequest, CheckboxModel, initialPipeline, [], false, [], shopDomain)

  return json({
    ...result,
    success: true,
  })
})

/**
 * POST /api/checkboxes
 * Actions: create, update, delete, duplicate, activate, deactivate
 */
export const action = catchAsync(async ({ request }: ActionFunctionArgs) => {
  const {
    admin,
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const formData = await request.formData()
  const actionType = formData.get('action') as string

  switch (actionType) {
    case CHECKBOX_ACTIONS.CREATE: {
      const data = JSON.parse(formData.get('data') as string)
      const checkbox = await createCheckbox(shopDomain, data, admin.graphql)
      return json({ success: true, data: checkbox })
    }

    case CHECKBOX_ACTIONS.UPDATE: {
      const checkboxId = formData.get('checkboxId') as string
      const data = JSON.parse(formData.get('data') as string)
      const checkbox = await updateCheckbox(shopDomain, checkboxId, data, admin.graphql)
      if (!checkbox) {
        return json({ success: false, message: 'Add-on not found' }, { status: 404 })
      }
      return json({ success: true, data: checkbox })
    }

    case CHECKBOX_ACTIONS.DELETE: {
      const checkboxIds = JSON.parse(formData.get('checkboxIds') as string) as string[]
      const result = await deleteCheckboxes(shopDomain, checkboxIds, admin.graphql)
      return json({ success: true, data: result })
    }

    case CHECKBOX_ACTIONS.DUPLICATE: {
      const checkboxIds = JSON.parse(formData.get('checkboxIds') as string) as string[]
      const duplicates = await duplicateCheckboxes(shopDomain, checkboxIds, admin.graphql)
      return json({ success: true, data: duplicates })
    }

    case CHECKBOX_ACTIONS.ACTIVATE: {
      const checkboxIds = JSON.parse(formData.get('checkboxIds') as string) as string[]
      const result = await activateCheckboxes(shopDomain, checkboxIds, admin.graphql)
      return json({ success: true, data: result })
    }

    case CHECKBOX_ACTIONS.DEACTIVATE: {
      const checkboxIds = JSON.parse(formData.get('checkboxIds') as string) as string[]
      const result = await deactivateCheckboxes(shopDomain, checkboxIds, admin.graphql)
      return json({ success: true, data: result })
    }

    case CHECKBOX_ACTIONS.GET_STYLING: {
      const styling = await getGlobalStyling(shopDomain)
      return json({ success: true, data: styling })
    }

    case CHECKBOX_ACTIONS.GET_ORDER_SETTING: {
      const orderSetting = await getOrderSetting(shopDomain)
      return json({ success: true, data: orderSetting })
    }

    case CHECKBOX_ACTIONS.CHECK_VARIANT_INTEGRATION: {
      const variantGid = formData.get('variantGid') as string
      if (!variantGid) {
        return json({ success: true, data: { isIntegrated: false } })
      }
      const publishedGids = await getPublishedVariantGids(shopDomain, [variantGid])
      return json({ success: true, data: { isIntegrated: publishedGids.has(variantGid) } })
    }

    default:
      return json({ success: false, message: 'Invalid action' }, { status: 400 })
  }
})
