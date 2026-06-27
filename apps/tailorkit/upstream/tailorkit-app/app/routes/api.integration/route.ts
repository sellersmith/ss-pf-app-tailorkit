import { type LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { catchAsync } from '~/utils/catchAsync'
import { authenticate } from '~/shopify/app.server'
import { EActionType } from '~/constants/fetcher-keys'
import { CUSTOMERIO_EVENTS } from '~/modules/customer.io/constants'
import { postEventToCustomerIo } from '~/modules/customer.io/api.server'
import {
  countSavedIntegrations,
  publishIntegrationProcess,
  saveIntegrationProcess,
  unpublishIntegrationProcess,
} from './fns.server'
import Shop, { getShopData, updateShopUsages } from '~/models/Shop.server'
import {
  updateUserMilestoneIfShopHasCreatedIntegration,
  updateUserMilestoneIfShopHasPublishedOnOnlineStore,
} from '../api.user-journey/journeys/achieve-first-sale/fns.server'
import { applyPromotionIfQualified } from '~/models/Promotion.server'
import { decompressData } from '~/utils/file-types/zip'
import { isInTrial } from '../api.pricing/utils/fns'
import type { SubscriptionDocument } from '~/models/Subscription'
import { TOURS } from '~/constants/tours'
import UserJourney from '~/models/UserJourney.server'

export const action = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
    admin,
  } = await authenticate.admin(request)

  // Get action from search params
  const formData = await request.formData()
  const action = formData.get('action') as string

  // Get shop data and occurred events
  const shopData = await getShopData(shopDomain)
  const occurredEvents = shopData?.appConfig?.occurredEvents || {}

  switch (action) {
    case EActionType.SAVE_PRODUCT: {
      const integrationRawData = formData.get('integration') as Blob
      const compressedData = new Uint8Array(await integrationRawData.arrayBuffer())
      const integrationData = decompressData(compressedData)

      await saveIntegrationProcess({ ...integrationData, shopDomain })

      // Count saved integrations
      const savedIntegrations = await countSavedIntegrations(shopDomain)

      const { isFirstIntegration } = savedIntegrations

      if (isFirstIntegration || !occurredEvents[CUSTOMERIO_EVENTS.CREATED_FIRST_INTEGRATION]) {
        // Send created_first_integration event to customer.io
        postEventToCustomerIo({
          shopDomain,
          noDuplicate: true,
          eventData: { createdAt: new Date() },
          eventName: CUSTOMERIO_EVENTS.CREATED_FIRST_INTEGRATION,
        }).catch(console.error)

        // Update user milestone
        updateUserMilestoneIfShopHasCreatedIntegration(shopDomain).catch(console.error)

        if (!integrationData.notInEditor) {
          // Update user journeys
          const tours = [TOURS.INTEGRATION_EDITOR_INTRO_TOUR, TOURS.INTEGRATIONS_INDEX_TOUR]

          await Promise.all(
            tours.map(tour => UserJourney.updateOne({ shopDomain, type: tour }, { isFinished: true }, { upsert: true }))
          )
        }
      }

      // Update shop uages
      updateShopUsages(shopDomain).catch(console.error)

      // Mark onboarding as completed when user saves their first integration
      if (!occurredEvents?.completed_onboarding) {
        Shop.updateOne({ shopDomain }, { 'appConfig.occurredEvents.completed_onboarding': true }).catch(console.error)
      }

      return json({ success: true, data: {} })
    }

    case EActionType.PUBLISH_PRODUCT: {
      const integrationId = formData.get('integrationId') as string
      const data = await publishIntegrationProcess(admin, integrationId, shopDomain)
      let showConfetti = false

      // Count published integrations
      const { numPublishedIntegrations } = await countSavedIntegrations(shopDomain)

      // Check if this is the first published integration
      if (!occurredEvents[CUSTOMERIO_EVENTS.PUBLISHED_FIRST_INTEGRATION]) {
        // Send published_first_integration event to customer.io
        postEventToCustomerIo({
          shopDomain,
          noDuplicate: true,
          eventData: { createdAt: new Date() },
          eventName: CUSTOMERIO_EVENTS.PUBLISHED_FIRST_INTEGRATION,
        }).catch(console.error)

        // Update user milestone
        updateUserMilestoneIfShopHasPublishedOnOnlineStore(shopDomain).catch(console.error)

        const { subscription } = shopData || {}
        const isInTrialPeriod = isInTrial(subscription as SubscriptionDocument)

        if (isInTrialPeriod) {
          // Apply promotion if qualified
          applyPromotionIfQualified(shopDomain)
        }

        showConfetti = true
      }

      // Update shop usages
      await Shop.updateOne({ shopDomain }, { 'usages.integrations': numPublishedIntegrations })

      // Update shop uages and wait for it to get latest published count
      await updateShopUsages(shopDomain, false)

      // Get updated shop data for PTE checks
      const updatedShopData = await getShopData(shopDomain)

      // Apply PTE promotions if qualified (check on EVERY publish, not just first)
      // This ensures badges and coupons are awarded when hitting milestones (3, 5, 7)
      applyPromotionIfQualified(updatedShopData).catch(console.error)

      return json({ success: true, data, showConfetti })
    }

    case EActionType.UNPUBLISH_PRODUCT: {
      const integrationId = formData.get('integrationId') as string

      const data = await unpublishIntegrationProcess({ admin, integrationId, shopDomain })

      // Update shop uages
      updateShopUsages(shopDomain).catch(console.error)

      return json({ success: true, data })
    }
  }
})
