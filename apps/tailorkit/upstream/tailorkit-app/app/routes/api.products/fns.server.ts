import type { AssistantService } from '~/libs/openai/assistant.service'
import type { IPrintifyCategory } from './constants'

/**
 * Get Printify category parameters for product recommendation
 * @param shopifyProducts - Array of Shopify products with titles
 * @param categoriesProps - Optional pre-fetched categories
 * @returns Object with topLevelTag and subLevelTag for filtering
 */
export async function getPrintifyParamsForRecommendation(
  shopifyProducts: { title: string }[],
  assistant: AssistantService,
  categoriesProps?: IPrintifyCategory[]
): Promise<{ topLevelTag: string; subLevelTag: string }> {
  const categories: IPrintifyCategory[] = categoriesProps || (await getPrintifyCategories())
  const simplifiedCategories = categories.map(category => ({
    topLevelTag: category.topLevel.tag,
    subLevelTags: category.topLevel.subLevel.map(subLevel => subLevel.tag).join(', '),
  }))

  const prompt = `Analyze and classify these products into the most appropriate categories:
    Products to Classify:
    ${shopifyProducts.map((product, index) => `${index + 1}. ${product.title}`).join('\n')}

    Available Categories:
    ${simplifiedCategories
      .map(
        category => `• ${category.topLevelTag}
      Sub-categories: ${category.subLevelTags}`
      )
      .join('\n\n')}

    Instructions:
    - Each product must be classified into exactly ONE top-level tag and ONE sub-level tag
    - Choose the most specific and relevant categories
    - Ensure sub-level tag belongs to the chosen top-level tag
  `

  const result = await assistant.extractProductClassification(prompt)

  // Return analysis result directly
  return result
}

/**
 * Get suggested title classification for products
 * @param assistant - The OpenAI assistant service instance
 * @param shopifyProducts - Array of Shopify products with titles
 * @returns Object containing suggested title and reasoning
 */
export async function getProductTitleClassification(assistant: AssistantService, shopifyProducts: { title: string }[]) {
  try {
    const prompt = `Please analyze these product titles and extract the most relevant product type:
      Product Titles:
      ${shopifyProducts.map((product, index) => `${index + 1}. ${product.title}`).join('\n')}

      Return a JSON object with:
      - suggestedTitles: The most common or relevant product types
      - reasoning: Why these product types were chosen
    `

    const result = await assistant.extractProductTitleClassification(prompt)
    return result
  } catch (error) {
    console.error('Error in getProductTitleClassification:', error)
    return {
      suggestedTitles: [],
      reasoning: 'Failed to classify product titles',
    }
  }
}

/**
 * Query products from Printify
 * @param args - The arguments for the query
 * @returns The products from Printify
 */
export const queryProductsFromPrintify = async (args: { limit?: number; params?: string[] }) => {
  const { limit = 30, params = [] } = args

  const url = `https://printify.com/product-catalog-service/api/v1/blueprints/search?limit=${limit}${params.length ? `&${params.join('&')}` : ''}`
  const printifyRes = await fetch(url)
    .then(res => res.json())
    .catch(console.error)

  return printifyRes
}

/**
 * Get the categories from Printify
 * @returns The categories from Printify
 */
export async function getPrintifyCategories() {
  const url = `https://printify.com/product-catalog-service/api/v1/categories`
  const printifyRes = await fetch(url)
    .then(res => res.json())
    .catch(console.error)
  return printifyRes
}

export const findTopLevelTagFromSubTag = (categories: any, subTagName: string) => {
  for (const category of categories) {
    const topLevelTag = category.topLevel.tag
    const subLevels = category.topLevel.subLevel

    if (subLevels) {
      for (const sub of subLevels) {
        if (sub.tag === subTagName) {
          return topLevelTag
        }
      }
    }
  }
  return null // not found
}

/**
 * Get the image URL from the Printify product
 * @param product - The product from Printify
 * @returns The image URL
 */
export const getPrintifyImageUrl = (product: { images?: { url?: string; src?: string }[] }) => {
  let imageUrl = '/assets/product-placeholder.jpg'

  if (product.images?.[0]) {
    const image = product.images[0]

    // Try url first
    if (image.url && image.url.startsWith('https://')) {
      imageUrl = image.url
    }

    // Try src, check if it's already a full URL or just an ID
    else if (image.src) {
      if (image.src.startsWith('https://')) {
        imageUrl = image.src
      } else {
        const PRINTIFY_IMAGE_BASE_URL = 'https://images.printify.com/api/catalog'
        // It's just an ID, construct the full URL using configuration
        imageUrl = `${PRINTIFY_IMAGE_BASE_URL}/${image.src}.jpg`
      }
    }
  }

  return imageUrl
}
