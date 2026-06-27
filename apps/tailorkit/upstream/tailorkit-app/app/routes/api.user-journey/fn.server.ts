import type { OnboardingData, UserJourneyDocument } from '~/models/UserJourney'
import { TEMPLATE_DESIGN_TYPE } from '../api.templates_designs/constants'
import { ONBOARDING_PRODUCT_YOUR_SELL_KEY, ONBOARDING_QUESTION_KEY } from '~/modules/Feedback/constants'
import { DEFAULT_API_TOKEN, DEFAULT_SHOP_ID, USER_JOURNEY_TYPE } from './constants'
import Printify from '~/modules/Fulfillments/Printify'
import { getAdvanceBlueprintsProvider } from '../api.providers-connection.$id/Printify/fns.server'
import {
  importProductToShopify,
  preparedMediaDataToShopify,
  preparedProductsDataToShopify,
  preparedVariantsDataToShopify,
} from '../api.providers-integration.$id/fns.server'
import { type ShopifyApiClient } from '~/shopify/graphql/api.server'
import { EPROVIDER } from '~/constants/fulfillment-providers'
import UserJourney, { saveUserJourney } from '~/models/UserJourney.server'
import { getPremadeTemplateByCategory } from '../api.templates_designs/fn.server'
import { uuid } from '~/utils/uuid'
import type { AdminApiContext } from '@shopify/shopify-app-remix/server'
import type { ShopifyRestResources } from '@shopify/shopify-api'
import { json } from '~/bootstrap/fns/fetch.server'
import type { RestResources } from '@shopify/shopify-api/rest/admin/2025-07'
import { EMPTY_ARRAY } from '~/constants'
import { getObjectModel } from '~/utils/getObjectModel'
import { getShopData } from '~/models/Shop.server'
import { isShopifyTrialPlan } from '~/bootstrap/fns/misc'
import Integration from '~/models/Integration.server'
import VariantIntegration from '~/models/VariantIntegration.server'
import { NavMenuItems } from '~/bootstrap/app-config'

/**
 * @author KhanhNT
 * Function to get current answer selected from question on the Onboarding modal
 *
 * @param data {OnboardingData[]} - Array of onboarding data
 * @param questionKey {string} - Question's key
 * @returns {string | null}
 */
export function getCurrentSelectedOnboardingData(data: OnboardingData[], questionKey: string) {
  const currentSelected = data.find(d => d.questionKey === questionKey)?.selectedValue
  return currentSelected
}

/**
 * @author KhanhNT
 * Returns a random design type from a predefined set of design types.
 * Excludes the "OTHERS" design type from the selection.
 */
export function getRandomDesignType(TYPES?: string[]) {
  const types = TYPES || Object.values(TEMPLATE_DESIGN_TYPE)

  if (types && types.length > 0) {
    return types[Math.floor(Math.random() * types.length)]
  }

  console.warn('getRandomDesignType: There are no template design types')
  return ''
}

/**
 * @author KhanhNT
 * Retrieves the selected topic from onboarding data.
 * If no topic is selected or the selected topic is "OTHERS," it defaults to a random design type.
 *
 * @param data - An array of onboarding data containing question keys and selected values.
 * @returns The selected topic or a random design type.
 */
export function getTopicSelected(data: OnboardingData[]): string {
  const topicFocus = getCurrentSelectedOnboardingData(data, ONBOARDING_QUESTION_KEY.TOPIC_FOCUS)

  if (!topicFocus) {
    return getRandomDesignType()
  }

  return topicFocus
}

/**
 * @author KhanhNT
 * Returns a random product type from a predefined set of product types.
 * Excludes the "OTHERS" product type from the selection.
 */
export function getRandomProductType(TYPES?: string[]): string {
  const printifyProductTypes = Object.values(ONBOARDING_PRODUCT_YOUR_SELL_KEY).filter((option: any) => option.PRINTIFY)
  const options: any[] = TYPES || printifyProductTypes

  if (options && options.length > 0) {
    const randomOption = options[Math.floor(Math.random() * options.length)]
    return randomOption.PRINTIFY.BLUEPRINT_ID
  }

  console.warn('getRandomProductType: There are no blueprint here!')
  return ''
}

/**
 * @author KhanhNT
 * Retrieves the selected blueprint id from onboarding data.
 * If no product is selected or the selected product is "OTHERS," it defaults to a random blueprint id.
 *
 * @param data - An array of onboarding data containing question keys and selected values.
 * @returns The blueprint id of the selected product or a blueprint id of random product type.
 */
export function getBlueprintIdForIntegrationTour(data: OnboardingData[]) {
  const currentSelectedOnboardingData = getCurrentSelectedOnboardingData(
    data,
    ONBOARDING_QUESTION_KEY.PRODUCT_YOUR_SELL
  )
  const selectedProductsType = currentSelectedOnboardingData?.split(', ') || EMPTY_ARRAY
  const _selectedProductsType = selectedProductsType.map(
    productType => (ONBOARDING_PRODUCT_YOUR_SELL_KEY as any)[productType]
  )

  const isMultipleProductType = _selectedProductsType.length > 1
  const productType = isMultipleProductType
    ? getRandomProductType(_selectedProductsType)
    : _selectedProductsType[0] || ''

  const blueprint = productType && (ONBOARDING_PRODUCT_YOUR_SELL_KEY as any)[productType]
  const blueprintId = blueprint?.PRINTIFY?.BLUEPRINT_ID

  if (!blueprintId || blueprintId === ONBOARDING_PRODUCT_YOUR_SELL_KEY.OTHERS.VALUE) {
    return getRandomProductType()
  }

  return blueprintId
}

/**
 * @author KhanhNT
 * Initializes a default product from Printify by fetching blueprint details,
 * associated provider, and variants. Prepares the data for import into Shopify
 * with basic cost and variant details.
 *
 * @param {string} blueprintId - The ID of the Printify blueprint to initialize.
 * @param {ShopifyApiClient} api - The Shopify API client for importing the product.
 * @returns {Promise<{ productsImported: number; productsFailed: number } | null>}
 *          - The result of the import process, including counts of imported and failed products.
 */
export async function initDefaultProductFromPrintify(
  blueprintId: string,
  api: ShopifyApiClient,
  admin: AdminApiContext<ShopifyRestResources>,
  shopDomain: string
) {
  try {
    const printify = new Printify({
      accessToken: DEFAULT_API_TOKEN,
      shopId: DEFAULT_SHOP_ID,
    })
    const blueprint = await printify.catalog.getBlueprint(blueprintId)
    const shopData = await getShopData(shopDomain)
    const isShopifyTrial = isShopifyTrialPlan(shopData?.shopConfig)

    if (blueprint) {
      // Fetch providers of the blueprint
      const providers = (await printify.catalog.getBlueprintProviders(blueprintId)) || []
      const firstProvider = providers[0]
      const providerId = `${firstProvider.id}`

      // Get base cost from provider
      const providerMoreData = (await getAdvanceBlueprintsProvider(blueprintId, providerId)) || {}
      const baseCost = (providerMoreData?.min_price || 0) / 100

      // Fetch variants of the blueprint of the provider
      const blueprintVariants = (await printify.catalog.getBlueprintVariants(blueprintId, providerId)) || []
      // Default get the first variant
      const firstVariant = blueprintVariants?.variants?.[0]

      // Populate variants, assign cost for them
      const _blueprintVariants = {
        ...firstVariant,
        cost: baseCost,
        profitMargin: 0,
        price: baseCost,
      }

      // Assign variants for it
      const product: any = {
        ...blueprint,
        variants: [_blueprintVariants],
      }

      // Prepare variants data
      const variantsData = await preparedVariantsDataToShopify(product, shopDomain)

      // Populate product to import to Shopify
      const productData = {
        productId: blueprintId,
        productProviderId: providerId,
        product: preparedProductsDataToShopify(product),
        media: isShopifyTrial ? [] : preparedMediaDataToShopify(product),
        variants: variantsData,
      }

      // Import product to Shopify
      const importedProductsResponse = await importProductToShopify({
        formattedProducts: [productData],
        printify,
        api,
        admin,
        providerName: EPROVIDER.PRINTIFY,
      })

      const { productsImported, productsFailed } = importedProductsResponse || {}

      return {
        productsImported,
        productsFailed,
      }
    }
  } catch (error) {
    console.error(`Error initializing default product: ${error}`)
    return null
  }
}

/**
 * @author KhanhNT
 * Handles the template selection process by retrieving a premade template based on the selected topic.
 * Deletes any existing template editor quick tour for the shop domain.
 *
 * @param {string} shopDomain - The shop domain.
 * @param {OnboardingData[]} data - An array of onboarding data containing question keys and selected values.
 * @returns {Promise<string>} - A URL for the selected premade template or an empty string if no template is found.
 */
export async function handleTemplate(
  shopDomain: string,
  data: OnboardingData[],
  deleteTour: boolean = true
): Promise<string> {
  // Get the selected topics from data
  const topicList = getTopicSelected(data || []).split(', ')

  // Choose a random topic if multiple are available
  const selectedTopic = topicList.length > 1 ? getRandomDesignType(topicList) : topicList[0] || ''

  // Fetch the premade template for the selected topic
  const premadeTemplate = selectedTopic ? await getPremadeTemplateByCategory(selectedTopic) : ''

  if (deleteTour) {
    await UserJourney.deleteOne({ shopDomain, type: USER_JOURNEY_TYPE.TEMPLATE_EDITOR_QUICK_TOUR })
  }

  return premadeTemplate
    ? `/templates/${uuid()}?premadeTemplateId=${premadeTemplate._id}&tour=${USER_JOURNEY_TYPE.TEMPLATE_EDITOR_QUICK_TOUR}`
    : ''
}

/**
 * @author KhanhNT
 * Saves the onboarding progress for a user journey and optionally opens the template editor.
 *
 * @param {Object} args - The arguments for saving onboarding progress.
 * @param {string} args.shopDomain - The shop domain.
 * @param {UserJourneyDocument & { openTemplateEditor?: boolean }} args.payload - The payload containing user journey data
 *                                                                                and a flag to open the template editor.
 * @returns {Promise<Response>} - A response indicating success and an optional return URL.
 */
export async function handleSaveOnboardingProgress({
  shopDomain,
  payload,
}: {
  shopDomain: string
  payload: UserJourneyDocument & { openTemplateEditor?: boolean }
}) {
  const { type, data = [], currentStep, progress = 0, isFinished, openTemplateEditor = false } = payload

  await saveUserJourney({ shopDomain, data, currentStep, isFinished, progress, type })

  if (openTemplateEditor) {
    const returnUrl = await handleTemplate(shopDomain, data as OnboardingData[])
    return json({ success: true, returnUrl })
  }

  return json({ success: true })
}

/**
 * @author KhanhNT
 * Handles the integration process by initializing default products from Printify,
 * fetching product variant nodes, and returning a response with product variants.
 * Deletes any existing integration editor quick tour for the shop domain.
 *
 * @param args - An object containing the shop domain, Shopify API client, and a flag indicating if it's a tutorial.
 * @returns A response with the product variants and a return URL for the integration editor quick tour.
 */
export async function handleIntegration(args: {
  shopDomain: string
  api: ShopifyApiClient
  isTutorial?: boolean
  admin: AdminApiContext<RestResources>
}) {
  const { shopDomain, isTutorial = false } = args
  await UserJourney.deleteOne({ shopDomain, type: USER_JOURNEY_TYPE.INTEGRATION_EDITOR_QUICK_TOUR })

  // const userJourney = await getCurrentStepData(shopDomain, USER_JOURNEY_TYPE.ONBOARDING)
  // const data = userJourney?.data || []
  // const blueprintId = getBlueprintIdForIntegrationTour(data as OnboardingData[])

  // if (blueprintId) {
  //   // Initialize default products from Printify
  //   const { productsImported } = (await initDefaultProductFromPrintify(blueprintId, api, admin, shopDomain)) || {}

  //   // Extract variant IDs from imported products
  //   const variantIds = productsImported?.flatMap(productImported =>
  //     productImported.productVariants.productVariantsBulkCreate.productVariants.map(
  //       (variant: { id: string }) => variant.id
  //     )
  //   )

  //   // Fetch product variant nodes from API
  //   const productVariantNodes = await api.getProductVariants({ query: convertIdsToQuery(variantIds || []) })

  //   const tour = !isTutorial ? USER_JOURNEY_TYPE.INTEGRATION_EDITOR_QUICK_TOUR : USER_JOURNEY_TYPE.INTEGRATION_TUTORIAL

  //   // Return response with product variants
  //   return json({
  //     success: true,
  //     returnUrl: `/integrations/${uuid()}?mockup=${uuid()}&tour=${tour}`,
  //     productVariants: productVariantNodes?.nodes || [],
  //   })
  // }

  // Get the most recent integration by sorting by createdAt in descending order
  const latestIntegration = await Integration.findOne({ shopDomain }).sort({ createdAt: -1 })

  let tour: any = isTutorial ? USER_JOURNEY_TYPE.INTEGRATION_TUTORIAL : USER_JOURNEY_TYPE.INTEGRATION_EDITOR_QUICK_TOUR
  let integrationId = uuid()
  let mockupId = uuid()

  if (!isTutorial && latestIntegration) {
    integrationId = latestIntegration._id
    const firstVariantId = latestIntegration.variants?.[0]
    const firstVariant = await VariantIntegration.findOne({ id: firstVariantId })
    mockupId = firstVariant?.mockup || uuid()
    tour = ''
  }

  return json({
    success: true,
    returnUrl: `${NavMenuItems.PERSONALIZED_PRODUCTS}/${integrationId}?mockup=${mockupId}${tour ? `&tour=${tour}` : ''}`,
    productVariants: [],
    integrationId,
  })
}

/**
 * @author LongPC
 * Mutate user milestone by adding a new step to the user journey data
 *
 * @param args - An object containing the shop domain, user journey type, and current step
 */
export async function mutateUserMilestone(args: {
  shopDomain: string
  type: USER_JOURNEY_TYPE
  currentStep: string
  currentStepData?: { [key: string]: any }
}) {
  try {
    const { shopDomain, type, currentStep, currentStepData = {} } = args

    const _userJourney = await UserJourney.findOne({ shopDomain, type })

    if (!_userJourney) {
      const data = [
        {
          step: currentStep,
          ...currentStepData,
        },
      ]
      await UserJourney.create({ shopDomain, type, currentStep, data })

      return
    }

    const userJourney = getObjectModel(_userJourney)
    let userJourneyData = userJourney.data || []

    const _data = userJourneyData.find((d: any) => d.step === currentStep)

    // If the step is already completed, do nothing
    if (_data) {
      userJourneyData = userJourneyData.map((d: any) => {
        if (d.step === currentStep) {
          // Update the step data
          return { ...d, ...currentStepData }
        }

        return d
      })
    } else {
      // Add new step to user journey data
      userJourneyData.push({
        step: currentStep,
        ...currentStepData,
      })
    }

    await UserJourney.updateOne({ shopDomain, type }, { currentStep, data: userJourneyData })
  } catch (e) {
    throw e
  }
}
