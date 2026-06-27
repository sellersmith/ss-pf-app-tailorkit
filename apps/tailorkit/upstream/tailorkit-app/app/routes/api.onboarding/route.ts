import { type LoaderFunctionArgs } from '@remix-run/node'
import { handleTemplate } from '../api.user-journey/fn.server'
import { USER_JOURNEY_TYPE } from '../api.user-journey/constants'
import { catchAsync } from '~/utils/catchAsync'
import UserJourney, { getCurrentStepData } from '~/models/UserJourney.server'
import { ONBOARDING_QUESTION_KEY } from '~/modules/Feedback/constants'
import { authenticate } from '~/shopify/app.server'
import Provider from '~/models/Provider.server'
import { EPROVIDER } from '~/constants/fulfillment-providers'

export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const { searchParams } = new URL(request.url)
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const shopDomainFromParams = searchParams.get('shopDomain')
  const tourType = searchParams.get('guide-tour-type')

  if (shopDomainFromParams !== shopDomain) {
    return Response.json({
      success: false,
      message: 'Invalid shop domain',
    })
  }

  if (!tourType) {
    return Response.json({
      success: false,
      message: 'Not found onboarding type',
    })
  }

  const userJourney = await getCurrentStepData(shopDomain, tourType as USER_JOURNEY_TYPE)
  const onboardingData = userJourney?.data || []
  const isFinishedOnboarding = userJourney?.isFinished

  const updateOnboardingData = async (data: any) => {
    await UserJourney.updateOne({ shopDomain, type: tourType }, data)
  }

  switch (tourType) {
    case USER_JOURNEY_TYPE.TEMPLATE_EDITOR_QUICK_TOUR: {
      const updatedData = { showOnboarding: true }
      await updateOnboardingData(updatedData)
      const redirectUrl = await handleTemplate(shopDomain, onboardingData, false)
      return Response.json({ success: true, redirectUrl })
    }

    case USER_JOURNEY_TYPE.ONBOARDING: {
      const updatedData = isFinishedOnboarding
        ? {
            currentStep: ONBOARDING_QUESTION_KEY.LET_STARTED,
            showOnboarding: true,
          }
        : { showOnboarding: true }
      await updateOnboardingData(updatedData)
      return Response.json({ success: true, redirectUrl: '/dashboard' })
    }

    case USER_JOURNEY_TYPE.PROVIDER_TOUR: {
      const updatedData = { currentStep: 'provider-tour-2', showOnboarding: true }
      const PritifyProviderId = await Provider.findOne({ name: EPROVIDER.PRINTIFY })

      await updateOnboardingData(updatedData)
      return Response.json({
        success: true,
        redirectUrl: `/settings/providers/connection/${PritifyProviderId?._id}?name=${EPROVIDER.PRINTIFY}`,
      })
    }

    default: {
      return Response.json({
        success: false,
        message: 'Not found onboarding type',
      })
    }
  }
})
