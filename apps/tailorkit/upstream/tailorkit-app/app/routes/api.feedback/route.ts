import type { LoaderFunctionArgs } from '@remix-run/node'
import fs from 'fs'
import path from 'path'
import { uuid } from '~/utils/uuid'
import { fileURLToPath } from 'url'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import { getActiveFeedbackForms, getActiveOnboardingForms, saveFeedbackResponses } from '~/modules/Feedback/fns.server'
import { catchAsync } from '~/utils/catchAsync'
import { FEEDBACK_TYPE } from '~/modules/Feedback/constants'
import { getCurrentStepData } from '~/models/UserJourney.server'
import { USER_JOURNEY_TYPE } from '../api.user-journey/constants'

export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const searchParams = new URL(request.url).searchParams
  const formType = searchParams.get('formType') || FEEDBACK_TYPE.GIVE_US_YOUR_FEEDBACK

  switch (formType) {
    case FEEDBACK_TYPE.ONBOARDING_FEEDBACK: {
      // Fetch the active onboarding form
      const activeOnboardingForms = await getActiveOnboardingForms()
      if (!activeOnboardingForms) {
        return { success: false, message: 'No active onboarding form found' }
      }

      // Fetch the current step data for the user
      const currentStepData = await getCurrentStepData(shopDomain, USER_JOURNEY_TYPE.ONBOARDING)
      const { currentStep = '', isFinished = false, showOnboarding = false, data = [] } = currentStepData || {}

      return json({
        success: true,
        isFinished,
        currentStep,
        questions: activeOnboardingForms.questions || [],
        currentStepData: data,
        formId: activeOnboardingForms._id,
        isShowFirstTime: !currentStepData || showOnboarding,
      })
    }

    default: {
      return json(await getActiveFeedbackForms(formType as FEEDBACK_TYPE))
    }
  }
})

export async function action({ request }: LoaderFunctionArgs) {
  try {
    const {
      session: { shop: shopDomain },
    } = await authenticate.admin(request)

    // Get the resolved path to the file
    const __filename = fileURLToPath(import.meta.url)

    // Get the name of the directory
    const __dirname = path.dirname(__filename)

    // Save responses
    await saveFeedbackResponses(await request.json(), { shopDomain }, async (dataURI: string): Promise<string> => {
      const test = dataURI.match(/^data:[^\/]+\/([^;]+);base64,/)

      if (test) {
        // Save uploaded files to the specified directory
        const base64Data = dataURI.replace(/^data:[^\/]+\/[^;]+;base64,/, '')
        const fileName = `${shopDomain.split('.')[0]}_${uuid().split('-')[0]}.${test[1]}`

        const relativePath = 'uploads'
        const absolutePath = path.resolve(`${__dirname}/../../../public/${relativePath}`)

        if (!fs.existsSync(absolutePath)) {
          fs.mkdirSync(absolutePath)
        }

        fs.writeFile(`${absolutePath}/${fileName}`, base64Data, 'base64', err => err && console.error(err))

        return `${process.env.SHOPIFY_APP_URL}/${relativePath}/${fileName}`
      }

      return ''
    })

    return json({ success: true })
  } catch (e: any) {
    return json({ success: false, message: e?.message || e })
  }
}
