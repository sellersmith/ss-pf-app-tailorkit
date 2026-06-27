import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { getGlobalStyling } from '~/models/GlobalStyling.server'
import UserJourney from '~/models/UserJourney.server'
import { USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'
import { authenticate } from '~/shopify/app.server'
import { defaultCheckboxStyling } from '~/types/global-styling'
import type { OnboardingStepKey } from './constants'

export interface OnboardingStepData {
  step: string
  completed: boolean
  skipped?: boolean
  checkboxId?: string
}

interface UserJourneyDocument {
  isFinished?: boolean
  currentStep?: OnboardingStepKey
  progress?: number
  data?: OnboardingStepData[]
}

interface CollectionNode {
  id: string
  title: string
  image?: { url: string; altText?: string | null }
}

interface ProductNode {
  tags?: string[]
  vendor?: string
  productType?: string
}

export interface CheckboxOnboardingLoaderData {
  isOnboardingCompleted: boolean
  currentStep: OnboardingStepKey
  progress: number
  onboardingData: OnboardingStepData[]
  collections: Array<{ id: string; title: string; image?: { url: string; altText?: string | null } }>
  tags: string[]
  vendors: string[]
  productTypes: string[]
  checkboxStyling: typeof defaultCheckboxStyling
}

/**
 * Loader for checkbox onboarding page
 * Fetches user journey state and product data for checkbox form
 * Theme config is fetched lazily on the client
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const {
    admin,
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  // 1. Check if onboarding is already completed
  const userJourney = await UserJourney.findOne({
    shopDomain,
    type: USER_JOURNEY_TYPE.CHECKBOX_ONBOARDING,
  }).lean<UserJourneyDocument | null>()

  if (userJourney?.isFinished) {
    return json({
      isOnboardingCompleted: true,
      currentStep: 'shareKnowledge' as OnboardingStepKey,
      progress: 3,
      onboardingData: [],
      collections: [],
      tags: [],
      vendors: [],
      productTypes: [],
      checkboxStyling: defaultCheckboxStyling,
    })
  }

  // 3. Fetch product data for checkbox form (same as checkboxes.add loader)
  let collections: Array<{ id: string; title: string; image?: { url: string; altText?: string | null } }> = []
  let tags: string[] = []
  let vendors: string[] = []
  let productTypes: string[] = []

  try {
    // Fetch collections with image
    const collectionsResponse = await admin.graphql(`
      query {
        collections(first: 100) {
          edges {
            node {
              id
              title
              image {
                url
                altText
              }
            }
          }
        }
      }
    `)
    const collectionsData = await collectionsResponse.json()
    collections
      = collectionsData.data?.collections?.edges?.map((edge: { node: CollectionNode }) => ({
        id: edge.node.id,
        title: edge.node.title,
        image: edge.node.image ? { url: edge.node.image.url, altText: edge.node.image.altText } : undefined,
      })) || []

    // Fetch product tags, vendors, and types via products query
    const productsResponse = await admin.graphql(`
      query {
        products(first: 250) {
          edges {
            node {
              tags
              vendor
              productType
            }
          }
        }
      }
    `)
    const productsData = await productsResponse.json()
    const products: Array<{ node: ProductNode }> = productsData.data?.products?.edges || []

    // Extract unique tags, vendors, and product types
    const tagsSet = new Set<string>()
    const vendorsSet = new Set<string>()
    const productTypesSet = new Set<string>()

    products.forEach(edge => {
      const product = edge.node
      if (product.tags) {
        product.tags.forEach(tag => tagsSet.add(tag))
      }
      if (product.vendor) {
        vendorsSet.add(product.vendor)
      }
      if (product.productType) {
        productTypesSet.add(product.productType)
      }
    })

    tags = Array.from(tagsSet).sort()
    vendors = Array.from(vendorsSet).sort()
    productTypes = Array.from(productTypesSet).sort()
  } catch (error) {
    console.error('Error fetching product data for checkbox onboarding:', error)
    // Continue with empty arrays if fetch fails
  }

  // 4. Fetch global checkbox styling for preview
  const globalStyling = await getGlobalStyling(shopDomain)
  const checkboxStyling = globalStyling?.styling?.checkbox || defaultCheckboxStyling

  // 5. Get current onboarding state
  const currentStep = (userJourney?.currentStep as OnboardingStepKey) || 'shareKnowledge'
  const progress = typeof userJourney?.progress === 'number' ? userJourney.progress : 0
  const onboardingData = userJourney?.data ?? []

  return json({
    isOnboardingCompleted: false,
    currentStep,
    progress,
    onboardingData,
    collections,
    tags,
    vendors,
    productTypes,
    checkboxStyling,
  } satisfies CheckboxOnboardingLoaderData)
}
