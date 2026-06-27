import type { ActionFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import UserJourney from '~/models/UserJourney.server'
import { USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'
import {
  createCheckbox,
  getUpsellProductLimit,
  isCheckboxLimitReached,
  UPSELL_LIMIT_ERROR,
} from '~/services/checkbox.server'
import { authenticate } from '~/shopify/app.server'
import { catchAsync } from '~/utils/catchAsync'
import { ONBOARDING_ACTIONS, type OnboardingStepKey } from './constants'
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

  // Get shop data for tracking
  const shopData = await getShopData(shopDomain)

  switch (actionType) {
    case ONBOARDING_ACTIONS.SAVE_PROGRESS: {
      const currentStep = formData.get('currentStep') as OnboardingStepKey
      const progress = parseInt(formData.get('progress') as string, 10)
      const data = JSON.parse(formData.get('data') as string)

      await UserJourney.updateOne(
        { shopDomain, type: USER_JOURNEY_TYPE.CHECKBOX_ONBOARDING },
        {
          currentStep,
          progress,
          data,
          isFinished: false,
        },
        { upsert: true }
      )

      // Track step completed
      if (shopData) {
        trackEvent(shopData, EVENTS_TRACKING.CHECKBOX_ONBOARDING_STEP_COMPLETED, {
          [EVENTS_PARAMETERS_NAME.ONBOARDING_STEP]: currentStep,
        }).catch(err => console.error('Failed to track onboarding step completed:', err))
      }

      return json({ success: true })
    }

    case ONBOARDING_ACTIONS.CREATE_CHECKBOX: {
      // Validate upsell product limit before creating
      const upsellProductLimit = getUpsellProductLimit(shopData)
      if (await isCheckboxLimitReached(shopDomain, upsellProductLimit)) {
        return json({ success: false, message: UPSELL_LIMIT_ERROR }, { status: 403 })
      }

      const checkboxData = JSON.parse(formData.get('data') as string)
      const checkbox = await createCheckbox(shopDomain, checkboxData, admin.graphql)

      // Track checkbox created during onboarding
      if (shopData) {
        trackEvent(shopData, EVENTS_TRACKING.CHECKBOX_CREATED, {
          [EVENTS_PARAMETERS_NAME.CHECKBOX_ID]: checkbox._id?.toString(),
          [EVENTS_PARAMETERS_NAME.CHECKBOX_TITLE]: checkbox.title,
          [EVENTS_PARAMETERS_NAME.CHECKBOX_PLACEMENT]: checkbox.typePlacement,
          [EVENTS_PARAMETERS_NAME.CHECKBOX_TRIGGER_TYPE]: checkbox.triggerProductsType,
          [EVENTS_PARAMETERS_NAME.CHECKBOX_SOURCE]: 'onboarding',
        }).catch(err => console.error('Failed to track checkbox creation from onboarding:', err))
      }

      return json({ success: true, checkboxId: checkbox._id?.toString() })
    }

    case ONBOARDING_ACTIONS.COMPLETE_ONBOARDING: {
      const data = JSON.parse(formData.get('data') as string)

      await UserJourney.updateOne(
        { shopDomain, type: USER_JOURNEY_TYPE.CHECKBOX_ONBOARDING },
        {
          currentStep: 'completed',
          progress: 3,
          data,
          isFinished: true,
        },
        { upsert: true }
      )

      // Track onboarding completed
      if (shopData) {
        trackEvent(shopData, EVENTS_TRACKING.CHECKBOX_ONBOARDING_COMPLETED, {}).catch(err =>
          console.error('Failed to track onboarding completed:', err)
        )
      }

      return redirect('/storefront-setup/checkboxes')
    }

    case ONBOARDING_ACTIONS.SKIP_STEP: {
      const currentStep = formData.get('currentStep') as OnboardingStepKey
      const progress = parseInt(formData.get('progress') as string, 10)
      const data = JSON.parse(formData.get('data') as string)

      await UserJourney.updateOne(
        { shopDomain, type: USER_JOURNEY_TYPE.CHECKBOX_ONBOARDING },
        {
          currentStep,
          progress,
          data,
          isFinished: false,
        },
        { upsert: true }
      )

      // Track step skipped
      if (shopData) {
        trackEvent(shopData, EVENTS_TRACKING.CHECKBOX_ONBOARDING_STEP_SKIPPED, {
          [EVENTS_PARAMETERS_NAME.ONBOARDING_STEP]: currentStep,
        }).catch(err => console.error('Failed to track onboarding step skipped:', err))
      }

      return json({ success: true })
    }

    default:
      return json({ success: false, message: 'Invalid action' }, { status: 400 })
  }
})
