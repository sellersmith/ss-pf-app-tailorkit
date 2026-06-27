import { type LoaderFunctionArgs } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import { USER_JOURNEY_ACTIONS, USER_JOURNEY_STEPS, USER_JOURNEY_TYPE } from './constants'
import UserJourney from '~/models/UserJourney.server'
import { catchAsync } from '~/utils/catchAsync'
import { handleIntegration, handleSaveOnboardingProgress } from './fn.server'
import { ShopifyApiClient } from '~/shopify/graphql/api.server'
import { json } from '~/bootstrap/fns/fetch.server'
import type { AdminApiContext } from '@shopify/shopify-app-remix/server'
import type { RestResources } from '@shopify/shopify-api/rest/admin/2025-07'
import { updateUserMilestoneIfShopHasProducts } from './journeys/achieve-first-sale/fns.server'
import Shop from '~/models/Shop.server'
import { CUSTOMERIO_EVENTS } from '~/modules/customer.io/constants'

export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  // Get type from search params
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const types = searchParams.get('types')

  // Batch query: fetch multiple journey types in one request
  if (types) {
    const typeList = types.split(',').filter(Boolean)
    const userJourneys = await UserJourney.find({ shopDomain, type: { $in: typeList } }).lean()
    return json({ success: true, userJourneys })
  }

  if (!type) {
    return json({ success: true, userJourney: null })
  }

  const userJourney = await UserJourney.findOne({ shopDomain, type })

  return json({ success: true, userJourney })
})

export const action = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
    admin,
  } = await authenticate.admin(request)
  const api = new ShopifyApiClient(admin)

  // Get action from search params
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  // Parse request body
  const payload = await request.json()

  switch (action) {
    case USER_JOURNEY_ACTIONS.CHECK_AND_UPDATE_USER_MILESTONE: {
      /**
       * Handle user milestone update for "Achieve First Sale" journey
       */
      const userJourney = await UserJourney.findOne({
        shopDomain,
        type: USER_JOURNEY_TYPE.ACHIEVE_FIRST_SALE,
      })

      if (!userJourney) {
        return json({ success: true, userJourney: null })
      }

      const journeyData = userJourney.data ?? []
      const stepsMap = new Map(journeyData.map((step: any) => [step.step, step.finished]))

      const hasCreatedTemplate = stepsMap.get(USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.CREATE_TEMPLATE)
      if (!hasCreatedTemplate) {
        return json({ success: true, userJourney })
      }

      const hasPreparedProducts = stepsMap.get(USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.PREPARE_PRODUCTS)
      if (!hasPreparedProducts) {
        const isHasProducts = await updateUserMilestoneIfShopHasProducts(shopDomain, api)

        const updatedSteps = journeyData.filter(
          (step: any) => step.step !== USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.PREPARE_PRODUCTS
        )

        updatedSteps.push({
          step: USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.PREPARE_PRODUCTS,
          finished: isHasProducts,
        })

        userJourney.data = updatedSteps
      }

      return json({ success: true, userJourney })
    }

    case USER_JOURNEY_ACTIONS.SAVE_ONBOARDING_PROGRESS_STATE: {
      return handleSaveOnboardingProgress({ shopDomain, payload })
    }

    case USER_JOURNEY_ACTIONS.START_TEMPLATE_TOUR: {
      const { templateId, deleteTour = true } = payload
      if (deleteTour) {
        await UserJourney.deleteOne({ shopDomain, type: USER_JOURNEY_TYPE.TEMPLATE_EDITOR_QUICK_TOUR })
      }

      return json({
        success: true,
        returnUrl: `/templates/${templateId}?source=form&content=${templateId}&tour=${USER_JOURNEY_TYPE.TEMPLATE_EDITOR_QUICK_TOUR}`,
      })
    }

    case USER_JOURNEY_ACTIONS.START_INTEGRATION_TOUR: {
      const savedIntegrationTour = await handleIntegration({
        shopDomain,
        api,
        isTutorial: payload.isTutorial,
        admin: admin as AdminApiContext<RestResources>,
      })
      return savedIntegrationTour
    }

    // TODO: Temporary to test, remove this when release please.
    case USER_JOURNEY_ACTIONS.CLEAR_ONBOARDING_DATA: {
      const { type } = payload
      await UserJourney.deleteOne({ shopDomain, type })

      if (type === USER_JOURNEY_TYPE.ACHIEVE_FIRST_SALE) {
        // Get shop data
        const shopData = await Shop.findOne({ shopDomain }, 'appConfig')
        const occurredEvents = shopData?.appConfig?.occurredEvents || {}

        // Fix: Use $unset to remove specific events atomically without overwriting appConfig
        // Clear specific events from occurredEvents
        const eventsToRemove = [
          CUSTOMERIO_EVENTS.ACHIEVED_FIRST_ORDER,
          CUSTOMERIO_EVENTS.PUBLISHED_FIRST_INTEGRATION,
          CUSTOMERIO_EVENTS.CREATED_FIRST_TEMPLATE,
          CUSTOMERIO_EVENTS.CREATED_FIRST_INTEGRATION,
        ]

        const $unset: Record<string, 1> = {}
        eventsToRemove.forEach(eventName => {
          if (occurredEvents[eventName]) {
            $unset[`appConfig.occurredEvents.${eventName}`] = 1
          }
        })

        if (Object.keys($unset).length > 0) {
          await Shop.updateOne({ shopDomain }, { $unset })
        }
      }
      return json({ success: true })
    }
  }
  return json({ success: true })
})
