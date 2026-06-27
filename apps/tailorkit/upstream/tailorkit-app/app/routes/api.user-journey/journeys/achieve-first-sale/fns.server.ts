import type { ShopDocument } from '~/models/Shop'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import { USER_JOURNEY_STEPS, USER_JOURNEY_TYPE } from '../../constants'
import { mutateUserMilestone } from '../../fn.server'
import { getShopifyApiClient, type ShopifyApiClient } from '~/shopify/graphql/api.server'

/**
 * This function is used to update user milestone if shop has created template
 * @param shopData
 */
export const updateUserMilestoneIfShopHasCreatedTemplate = async (shopData: ShopDocument) => {
  try {
    const { shopDomain } = shopData

    await mutateUserMilestone({
      shopDomain,
      type: USER_JOURNEY_TYPE.ACHIEVE_FIRST_SALE,
      currentStep: USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.CREATE_TEMPLATE,
      currentStepData: {
        finished: true,
      },
    })
  } catch (error) {
    throw new Error(formatErrorMessage(error))
  }
}

/**
 * This function is used to update user milestone if shop has created integration
 *
 * @param shopDomain
 */
export const updateUserMilestoneIfShopHasCreatedIntegration = async (shopDomain: string) => {
  try {
    await mutateUserMilestone({
      shopDomain,
      type: USER_JOURNEY_TYPE.ACHIEVE_FIRST_SALE,
      currentStep: USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.INTEGRATE_WITH_PRODUCTS,
      currentStepData: {
        finished: true,
      },
    })
  } catch (error) {
    throw new Error(formatErrorMessage(error))
  }
}

/**
 * This function is used to update user milestone if shop has publish on online store
 *
 * @param shopDomain
 */
export const updateUserMilestoneIfShopHasPublishedOnOnlineStore = async (shopDomain: string) => {
  try {
    await mutateUserMilestone({
      shopDomain,
      type: USER_JOURNEY_TYPE.ACHIEVE_FIRST_SALE,
      currentStep: USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.PUBLISH_ON_ONLINE_STORE,
      currentStepData: {
        finished: true,
      },
    })
  } catch (error) {
    throw new Error(formatErrorMessage(error))
  }
}

/**
 * This function is used to update user milestone if shop has achieve first sale
 *
 * @param shopDomain
 * @param confettiBlasted
 */
export const updateUserMilestoneIfShopHasAchievedFirstSale = async (
  shopDomain: string,
  // Set default confetti blasted status to false
  confettiBlasted: boolean = false
) => {
  try {
    await mutateUserMilestone({
      shopDomain,
      type: USER_JOURNEY_TYPE.ACHIEVE_FIRST_SALE,
      currentStep: USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.ACHIEVE_FIRST_SALE,
      currentStepData: {
        finished: true,
        confettiBlasted,
      },
    })
  } catch (error) {
    throw new Error(formatErrorMessage(error))
  }
}

/**
 * This function is used to update user milestone if shop has achieved 200$ in trial period
 *
 * @param shopDomain
 * @param data
 */
export const updateUserMilestoneIfShopHasAchieved200DollarInTrialPeriod = async (
  shopDomain: string,
  data: {
    appGeneratedRevenue: number
    finished: boolean
  }
) => {
  try {
    await mutateUserMilestone({
      shopDomain,
      type: USER_JOURNEY_TYPE.ACHIEVE_FIRST_SALE,
      currentStep: USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.ACHIEVE_200_DOLLAR,
      currentStepData: data,
    })
  } catch (error) {
    throw new Error(formatErrorMessage(error))
  }
}

export const checkHaveProducts = async (shopDomain: string, api?: ShopifyApiClient) => {
  const _api = api || (await getShopifyApiClient(shopDomain))
  const products = await _api.checkUserHasProduct()

  return products?.length > 0
}

export const updateUserMilestoneIfShopHasProducts = async (shopDomain: string, api?: ShopifyApiClient) => {
  try {
    const hasProducts = await checkHaveProducts(shopDomain, api)

    if (hasProducts) {
      await mutateUserMilestone({
        shopDomain,
        type: USER_JOURNEY_TYPE.ACHIEVE_FIRST_SALE,
        currentStep: USER_JOURNEY_STEPS.ACHIEVE_FIRST_SALE.PREPARE_PRODUCTS,
        currentStepData: {
          finished: true,
        },
      })

      return true
    }

    return false
  } catch (error) {
    throw new Error(formatErrorMessage(error))
  }
}
