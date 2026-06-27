import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { ONE_HOUR_IN_MILLISECONDS } from '~/constants'
import Shop, { updateShopUsages } from '~/models/Shop.server'
import { authenticate } from '~/shopify/app.server'
import { mergeDeep } from '~/utils/mergeDeep'
import { PROPERTY_PREFIX } from '../webhooks/fns.server'
import {
  getEssentialShopData,
  getThemeShopConfig,
  updateAppMetafields,
  updateGlobalStylingToAppMetafields,
  updateOccurredEvent,
} from './fns.server'
import { getGlobalStyling, saveGlobalStyling } from '~/models/GlobalStyling.server'
import { createDefaultGlobalStyling } from '~/types/global-styling'
import { INVALID_SHOP_ERROR } from '~/constants/errors'

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Get adminContext
    const adminContext = await authenticate.admin(request)

    const params = new URL(request.url).searchParams
    const _themeConfig = params.get('themeConfig')

    // Get essential shop data
    const shopData = await getEssentialShopData(adminContext)

    let themeConfig = {}
    if (_themeConfig) {
      // Get theme config
      themeConfig = await getThemeShopConfig(adminContext)
    }

    // Inject theme config into app config for serving preferences
    shopData.appConfig = mergeDeep(shopData.appConfig || {}, themeConfig)

    return json({ ...shopData, PROPERTY_PREFIX })
  } catch (e: any) {
    return json({ success: false, message: e?.message || e })
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    // Get adminContext
    const adminContext = await authenticate.admin(request)

    const {
      admin,
      session: { shop: shopDomain },
    } = adminContext

    const requestBody = await request.json()
    const { action } = requestBody

    switch (action) {
      case 'GET_GLOBAL_STYLING': {
        const globalStyling = await getGlobalStyling(shopDomain)
        return json({ globalStyling: globalStyling?.styling || createDefaultGlobalStyling() })
      }

      case 'UPDATE_REVIEW': {
        const { reviewData } = requestBody

        // Get current shop data
        const shop = await Shop.findOne({ shopDomain })
        if (!shop) {
          throw new Error(INVALID_SHOP_ERROR)
        }

        // Update review data in appConfig.
        // Legacy action: kept for backward-compat with older clients.
        // Merge into the last entry only when submitted within the same hour
        // (e.g. user edits feedback after rating); otherwise append.
        const currentReviewData = shop.appConfig?.reviewData || []
        const lastReviewData = currentReviewData[currentReviewData.length - 1]
        const submittedSoonAfterLast
          = lastReviewData?.submittedAt
          && new Date(reviewData.submittedAt).getTime() - new Date(lastReviewData.submittedAt).getTime()
            < ONE_HOUR_IN_MILLISECONDS
        const updatedReviewData = submittedSoonAfterLast
          ? currentReviewData.map((review: any, index: number) =>
              index === currentReviewData.length - 1 ? { ...review, ...reviewData } : review
            )
          : [...currentReviewData, reviewData]

        // Update shop document
        await Shop.updateOne(
          { shopDomain },
          {
            $set: {
              'appConfig.reviewData': updatedReviewData,
            },
          }
        )

        // Update shop uages
        updateShopUsages(shopDomain).catch(console.error)

        return json({ success: true })
      }

      case 'UPDATE_REVIEW_ASK_STATE': {
        // New action: persist suppression/result state for the in-app
        // App Store review prompt. Merges into appConfig.reviewAskState.
        const { reviewAskState } = requestBody as { reviewAskState?: Record<string, unknown> }
        if (!reviewAskState || typeof reviewAskState !== 'object') {
          return json({ success: false, message: 'Missing reviewAskState' }, { status: 400 })
        }

        const setUpdate: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(reviewAskState)) {
          setUpdate[`appConfig.reviewAskState.${key}`] = value
        }

        await Shop.updateOne({ shopDomain }, { $set: setUpdate })

        // Update shop usages (non-blocking)
        updateShopUsages(shopDomain).catch(console.error)

        return json({ success: true })
      }

      case 'UPDATE_APP_METAFIELDS': {
        const { appMetafields } = requestBody

        // Update personalizer product setting
        const result = await updateAppMetafields(admin, shopDomain, appMetafields)

        // Update shop uages
        updateShopUsages(shopDomain).catch(console.error)

        return json(result)
      }

      case 'UPDATE_GLOBAL_STYLING': {
        const { styling } = requestBody

        if (!styling) {
          return json({ success: false, message: 'Missing styling' }, { status: 400 })
        }

        // 1) Save to Shopify app metafields as well if provided
        try {
          await updateGlobalStylingToAppMetafields(admin, styling)
        } catch (e) {
          console.warn('Failed to save globalStyling to metafields, proceeding to DB save:', e)
        }

        // 2) Persist to database
        await saveGlobalStyling(shopDomain, styling)

        // Update shop usages (non-blocking)
        updateShopUsages(shopDomain).catch(console.error)

        return json({ success: true })
      }

      case 'UPDATE_OCCURRED_EVENT': {
        const { eventName, value } = requestBody

        // Update occurred event
        await updateOccurredEvent(shopDomain, eventName, value)

        // Update shop uages
        updateShopUsages(shopDomain).catch(console.error)

        return json({ success: true })
      }

      default: {
        console.warn('Invalid action:', action)
        return json({ success: false, message: 'Invalid action' })
      }
    }
  } catch (e: any) {
    console.error('API preferences error:', e)
    return json({
      success: false,
      message: e?.message || 'An unexpected error occurred',
    })
  }
}
