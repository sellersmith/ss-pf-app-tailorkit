import mongoose from '~/bootstrap/db/connect-db.server'
import { type UserJourneyDocument } from './UserJourney'
import { Schema } from 'mongoose'
import { USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'
import { FEEDBACK_TYPE } from '~/modules/Feedback/constants'
import Shop from './Shop.server'
import { TOURS } from '~/constants/tours'
import { serverInitiator } from '~/bootstrap/fns/initiator'

const UserJourneySchema = new Schema<UserJourneyDocument>(
  {
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
    currentStep: {
      type: String,
      index: true,
      required: false,
    },
    progress: {
      type: Number,
    },
    type: {
      type: String,
      enum: [...Object.values(USER_JOURNEY_TYPE), ...Object.values(FEEDBACK_TYPE)],
      index: true,
      required: true,
    },
    data: [Schema.Types.Mixed],
    isFinished: {
      type: Boolean,
      index: true,
      default: false,
    },
    showOnboarding: {
      type: Boolean,
      index: true,
      default: false,
    },
  },
  { timestamps: true, strict: false }
)

const UserJourney = mongoose.models.UserJourney || mongoose.model('UserJourney', UserJourneySchema, 'user_journey')

export default UserJourney

/**
 * @author KhanhNT
 * Retrieves the current user journey data for a specific shop domain and journey type.
 *
 * This function queries the `UserJourney` collection in the database to find a document that matches
 * the provided `shopDomain` and `type` (which corresponds to the user journey type). The result is
 * returned in a lean format (plain JavaScript object) for better performance when no Mongoose
 * document features (like methods or virtuals) are needed.
 * If no document is found, it returns `null`.
 *
 * @param {string} shopDomain - The domain of the shop for which the user journey is being retrieved.
 * @param {USER_JOURNEY_TYPE} type - The type of user journey to retrieve (e.g., onboarding).
 * @returns {Promise<UserJourneyDocument | null>} A promise that resolves to the user journey document or null if not found.
 */
export async function getCurrentStepData(
  shopDomain: string,
  type: USER_JOURNEY_TYPE
): Promise<UserJourneyDocument | null> {
  const userJourney = await UserJourney.findOne({ shopDomain, type }).lean<any>()

  return userJourney
}

/**
 * @author KhanhNT
 * Saves or updates the user journey data for a specific shop domain and journey type.
 *
 * This function updates the `UserJourney` collection in the database with the provided data.
 * If a document matching the `shopDomain` and `type` is found, it updates the existing document.
 * If no matching document is found, it inserts a new document.
 *
 * @param {UserJourneyDocument} args - The user journey data to save or update.
 * @returns {Promise<any>} A promise that resolves to the result of the update operation.
 */
export async function saveUserJourney(args: UserJourneyDocument) {
  const { type, data, currentStep, progress = 0, isFinished, shopDomain } = args

  const userJourney = await UserJourney.updateOne(
    { shopDomain, type },
    {
      type,
      data,
      currentStep,
      progress,
      isFinished,
      showOnboarding: false,
    },
    { upsert: true, new: true }
  )

  return userJourney
}

export async function syncMissingUserJourney() {
  // 1. Find shops that have occurredEvents.created_first_integration = 1
  const shops = await Shop.find(
    {
      'appConfig.occurredEvents.`created_first_integration`': 1,
      uninstalledAt: null,
    },
    { shopDomain: 1 }
  ).lean<any>()

  if (!shops || shops.length === 0) return

  // 2. Mark integration tours as finished in user_journey for those shops
  const TOUR_TYPES = [TOURS.INTEGRATION_EDITOR_INTRO_TOUR, TOURS.INTEGRATIONS_INDEX_TOUR]

  await Promise.all(
    shops.map(async (shop: { shopDomain: string }) => {
      // Mark both integration-related tours as finished
      await Promise.all(
        TOUR_TYPES.map(async tourType => {
          try {
            await UserJourney.updateOne(
              { shopDomain: shop.shopDomain, type: tourType },
              {
                $set: {
                  shopDomain: shop.shopDomain,
                  type: tourType,
                  isFinished: true,
                },
                $setOnInsert: { currentStep: '', progress: 1, data: [] },
              },
              { upsert: true }
            )
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error('Failed to sync user journey for shop:', shop.shopDomain, 'tour:', tourType, e)
          }
        })
      )
    })
  )
}

serverInitiator.addInitiator(syncMissingUserJourney)
