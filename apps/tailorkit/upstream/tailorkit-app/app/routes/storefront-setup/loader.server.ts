import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import UserJourney from '~/models/UserJourney.server'
import { USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'
import { authenticate } from '~/shopify/app.server'
import { catchAsync } from '~/utils/catchAsync'

export interface StorefrontSetupLoaderData {
  isCheckboxOnboardingCompleted: boolean
}

export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  // Check if checkbox onboarding has been completed
  const checkboxOnboarding = await UserJourney.findOne({
    shopDomain,
    type: USER_JOURNEY_TYPE.CHECKBOX_ONBOARDING,
  }).lean<{ isFinished?: boolean } | null>()

  const isCheckboxOnboardingCompleted = checkboxOnboarding?.isFinished === true

  return json<StorefrontSetupLoaderData>({
    isCheckboxOnboardingCompleted,
  })
})
