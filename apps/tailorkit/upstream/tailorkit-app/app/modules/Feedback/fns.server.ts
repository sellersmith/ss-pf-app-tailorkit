import type { FeedbackFormDocument } from './types'
import FeedbackForm from './models/FeedbackForm.server'
import FeedbackResponse from './models/FeedbackResponse.server'
import { FEEDBACK_TYPE } from './constants'
import mongoose from 'mongoose'
import { getShopData } from '~/models/Shop.server'

export async function getActiveFeedbackForms(formType: FEEDBACK_TYPE): Promise<FeedbackFormDocument[]> {
  const now = new Date()

  return FeedbackForm.find({
    $and: [
      { status: 'active' },
      {
        $or: [{ startAt: null }, { startAt: { $lte: now } }, { startAt: { $exists: false } }],
      },
      {
        $or: [{ endAt: null }, { endAt: { $gte: now } }, { endAt: { $exists: false } }],
      },
      { formType },
    ],
  })
}

/**
 * @author KhanhNT
 * Retrieves the active onboarding feedback form from the database.
 *
 * This function queries the FeedbackForm collection to find a document with the formType
 * set to ONBOARDING_FEEDBACK and the status set to 'active'. The form is returned in a
 * lean format, which means it is returned as a plain JavaScript object (not a full Mongoose document).
 *
 * @returns {Promise<FeedbackFormDocument | null>} The active onboarding feedback form document if found, or null if no active form exists.
 */
export async function getActiveOnboardingForms(): Promise<FeedbackFormDocument | null> {
  const activeOnboardingForms = await FeedbackForm.findOne({
    formType: FEEDBACK_TYPE.ONBOARDING_FEEDBACK,
    status: 'active',
  }).lean<any>()
  return activeOnboardingForms
}

export async function saveFeedbackResponses(
  payload: { [id: string]: any },
  additionalData: any = {},
  saveFileCallback?: (dataURI: string) => Promise<string>
): Promise<void> {
  const {
    Types: { ObjectId },
  } = mongoose

  for (const formId in payload) {
    // Get form data
    const form = await FeedbackForm.findOne({
      _id: ObjectId.isValid(formId as string) ? new ObjectId(formId as string) : formId,
    })

    if (!form) {
      continue
    }

    // Prepare data for saving
    const responses = []

    // Get local time of submissions
    const { localTime, ...rest } = payload[formId]

    for (const question in rest) {
      const value = payload[formId][question]

      // Check if the value is a file (data URI) and process it
      if (typeof value === 'string' && value.startsWith('data:') && typeof saveFileCallback === 'function') {
        payload[formId][question] = await saveFileCallback(value)
      }

      // Store the response with the English question key (from payload)
      responses.push({ question, answer: payload[formId][question] })
    }

    // Save responses to app database
    await FeedbackResponse.create({ formId, responses, localTime, ...additionalData })

    const { postResponsesTo, formType } = form
    if (postResponsesTo) {
      let dataToSend = { ...rest }
      const sendAdditionalDataToForm = formType !== FEEDBACK_TYPE.GIVE_US_YOUR_FEEDBACK
      const shopDomain = additionalData?.shopDomain

      if (sendAdditionalDataToForm && shopDomain) {
        /**
         * @author KhanhNT
         * We could entirely receive this variable from the client,
         * but I’m concerned that transmitting sensitive data like email, Shopify Partner ID, and shopId might pose security risks.
         * Therefore, it’s necessary to handle the query at the backend layer instead.
         */
        try {
          const shopData = await getShopData(shopDomain)
          const { id: shopId, email } = shopData?.shopConfig || {}
          const SHOPIFY_PARTNER_ID = process.env.SHOPIFY_PARTNER_ID || ''

          if (!SHOPIFY_PARTNER_ID) {
            console.warn('SHOPIFY_PARTNER_ID is not defined in the environment variables.')
          }

          dataToSend = {
            ShopDomain: shopDomain,
            'Store Access': `https://partners.shopify.com/${SHOPIFY_PARTNER_ID}/stores/${shopId}`,
            Email: email,
            ...rest,
          }
        } catch (error) {
          console.error('Error fetching shop data:', error)
          return // Prevent further execution if shop data fails
        }
      }

      if (!/^https?:\/\/.+/.test(postResponsesTo)) {
        console.error('Invalid postResponsesTo URL:', postResponsesTo)
        return
      }

      try {
        await fetch(postResponsesTo, {
          method: 'POST',
          body: JSON.stringify({
            Timestamp: new Date().toISOString(),
            'Local time': localTime,
            ...dataToSend,
          }),
        })
      } catch (error) {
        console.error('Failed to post responses:', error)
      }
    }
  }
}
