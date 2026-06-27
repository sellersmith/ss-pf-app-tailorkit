import { Liquid } from 'liquidjs'
import fs from 'fs'
import path from 'path'
import { TAILORKIT_NAMESPACE, TAILORKIT_APP_SETTINGS, TAILORKIT_GLOBAL_STYLING } from '~/constants/metafield-keys'
import { PREFIX_PRODUCT_ID, PREFIX_VARIANT_ID } from '~/constants/shopify'
import { getShopifyApiClient } from '~/shopify/graphql/api.server'
import { formatNumberIdToShopifyObjectId } from '~/utils/shopify'
import type { ProductMetafield, TailorkitCustomizerArgs } from './type'
import { DEFAULT_APP_BLOCK_INSTALLATION_SETTINGS } from '../../../extensions/tailorkit-src/src/assets/constants/app-block'
import { ProductPersonalizerCustomizerWebComponentTag } from 'extensions/tailorkit-src/src/assets/constants'
import { mongoDBCacheStorage } from '~/models/Cache.server'
import { THIRTY_MINUTES_IN_MILLISECONDS } from '~/constants'

// Supported locales
const SUPPORTED_LOCALES = ['en', 'ar', 'de', 'es', 'fr', 'hi', 'it', 'ja', 'pt-BR', 'tr', 'vi', 'zh']

// Cache for loaded locale files
const localeCache = new Map<string, Record<string, any>>()

/**
 * Loads the locale file for the specified language.
 *
 * @param {string} locale - The locale code (e.g., 'en', 'es', 'fr').
 * @returns {Record<string, any>} The translations object for the locale.
 */
export function loadLocale(locale: string = 'en'): Record<string, any> {
  // Normalize locale (e.g., 'en-US' -> 'en', 'pt-br' -> 'pt-BR')
  const normalizedLocale = normalizeLocale(locale)

  // Check cache first
  if (localeCache.has(normalizedLocale)) {
    return localeCache.get(normalizedLocale)!
  }

  try {
    // Special case: English uses 'en.default.json'
    const fileName = normalizedLocale === 'en' ? 'en.default.json' : `${normalizedLocale}.json`
    const localePath = path.join(process.cwd(), 'extensions/tailorkit/locales', fileName)
    const localeData = JSON.parse(fs.readFileSync(localePath, 'utf8'))
    localeCache.set(normalizedLocale, localeData)
    return localeData
  } catch (error) {
    console.warn(`Failed to load locale '${normalizedLocale}', falling back to 'en'`)

    // Fallback to English
    if (normalizedLocale !== 'en') {
      return loadLocale('en')
    }

    // If even English fails, return empty object
    console.error('Failed to load fallback locale:', error)
    return {}
  }
}

/**
 * Normalizes a locale code to match the available locale files.
 *
 * @param {string} locale - The locale code to normalize.
 * @returns {string} The normalized locale code.
 */
function normalizeLocale(locale: string): string {
  // Remove any region code for most languages (e.g., 'en-US' -> 'en')
  const baseLocale = locale.split('-')[0].toLowerCase()

  // Special case for Portuguese (Brazil)
  if (baseLocale === 'pt' && locale.toLowerCase().includes('br')) {
    return 'pt-BR'
  }

  // Check if the base locale is supported
  if (SUPPORTED_LOCALES.includes(baseLocale)) {
    return baseLocale
  }

  // Check if the full locale is supported (e.g., 'pt-BR')
  const fullLocale = SUPPORTED_LOCALES.find(l => l.toLowerCase() === locale.toLowerCase())
  if (fullLocale) {
    return fullLocale
  }

  // Default to English
  return 'en'
}

/**
 * Registers a custom 't' filter for liquidjs to handle translations.
 *
 * @param {Liquid} engine - The liquidjs engine instance.
 * @param {Record<string, any>} translations - The translations object.
 */
function registerTranslationFilter(engine: Liquid, translations: Record<string, any>) {
  engine.registerFilter('t', function (key: string) {
    if (!key) return ''

    // Split the key by dots to navigate nested objects
    const keys = key.split('.')
    let value: any = translations

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        // Key not found, return the key itself as fallback
        return key
      }
    }

    // If the final value is an object, return it as JSON (for cases like line 108 in customizer.liquid)
    if (typeof value === 'object' && value !== null) {
      return value
    }

    return String(value)
  })
}

/**
 * Prepares a product object for displaying on the product page.
 *
 * Retrieves product and variant information from Shopify using the supplied shop domain and identifiers.
 * The function formats the product object with its featured image and the selected (or first available) variant.
 * Results are cached for 30 minutes to avoid Shopify Admin API rate limits.
 *
 * @param {string} shopDomain - The Shopify store's domain.
 * @param {string|number} productId - The identifier of the product.
 * @param {string|number} variantId - The identifier of the product variant.
 * @returns {Promise<Object>} A promise that resolves to the formatted product object for the product page.
 * @throws {Error} Throws an error if either the product or the variant cannot be found.
 */
export async function prepareProductOnProductPage(
  shopDomain: string,
  productId: string | number,
  variantId: string | number
) {
  // Generate cache key based on shop, product, and variant
  const cacheKey = `product-page_${shopDomain}_${productId}_${variantId}`

  // Try to get cached data from MongoDB
  const cachedData = await mongoDBCacheStorage.get(cacheKey)
  if (cachedData) {
    return cachedData
  }

  // If no cache, fetch from Shopify
  const api = await getShopifyApiClient(shopDomain)

  // Format product and variant ids
  const shopifyProductId = formatNumberIdToShopifyObjectId(productId, PREFIX_PRODUCT_ID)
  const shopifyVariantId = formatNumberIdToShopifyObjectId(variantId, PREFIX_VARIANT_ID)

  // Retrieve product and variant concurrently
  const [product, variant] = await Promise.all([
    api.getProductById(shopifyProductId),
    api.getProductVariantById(shopifyVariantId),
  ])

  if (!product || !variant) {
    throw new Error('Product or variant not found')
  }

  const result = {
    ...product,
    id: productId,
    featured_image: { ...product.featuredImage, src: product.featuredImage.url },
    selected_or_first_available_variant: { ...variant, featured_image: variant.image, id: variantId },
  }

  // Cache the result for 30 minutes in MongoDB
  await mongoDBCacheStorage.set(cacheKey, result, THIRTY_MINUTES_IN_MILLISECONDS)

  return result
}

/**
 * Fetches app_settings and global_styling metafields for a shop.
 * Results are cached in MongoDB for 30 minutes.
 */
export async function getAppSettingsAndStyling(shopDomain: string) {
  const cacheKey = `app-settings-styling_${shopDomain}`

  const cachedData = await mongoDBCacheStorage.get(cacheKey)
  if (cachedData) {
    return cachedData as { appSettings: Record<string, unknown> | null; globalStyling: Record<string, unknown> | null }
  }

  const api = await getShopifyApiClient(shopDomain)
  const metafields = (await api.getAppMetafields()).appInstallation.metafields

  const appSettingsNode = metafields.nodes.find((n: any) => n.key === TAILORKIT_APP_SETTINGS)
  const globalStylingNode = metafields.nodes.find((n: any) => n.key === TAILORKIT_GLOBAL_STYLING)

  const result = {
    appSettings: appSettingsNode?.value ? JSON.parse(appSettingsNode.value) : null,
    globalStyling: globalStylingNode?.value ? JSON.parse(globalStylingNode.value) : null,
  }

  await mongoDBCacheStorage.set(cacheKey, result, THIRTY_MINUTES_IN_MILLISECONDS)
  return result
}

/**
 * Renders the Tailorkit customizer for the product page.
 *
 * This function renders the Tailorkit customizer for the product page using the provided settings and product information.
 * It uses Liquid templates to generate the HTML code for the customizer.
 *
 * @param {TailorkitCustomizerArgs} args - The arguments for rendering the Tailorkit customizer.
 * @returns {Promise<string>} A promise that resolves to the HTML code for the Tailorkit customizer.
 * @throws {Error} Throws an error if the required parameters are missing or if the customizer template cannot be rendered.
 */
export async function renderTailorkitCustomizer(args: TailorkitCustomizerArgs) {
  try {
    const {
      productOnProductPage,
      variantId,
      productAppMetafield,
      settings = DEFAULT_APP_BLOCK_INSTALLATION_SETTINGS,
      locale = 'en',
      appSettings = null,
      globalStyling = null,
    } = args

    if (!variantId || !productOnProductPage) {
      throw new Error('Missing required parameters: variantId or productOnProductPage')
    }

    const { layout_type } = settings
    const basePath = 'extensions/tailorkit'
    const engine = new Liquid({
      root: [`${basePath}/blocks/`, `${basePath}/snippets/`],
      extname: '.liquid',
    })

    // Load translations for the specified locale
    const translations = loadLocale(locale)

    // Register custom tags and filters
    registerSchemaTag(engine)
    registerTranslationFilter(engine, translations)

    const context = {
      block: { settings },
      product: productOnProductPage,
      app: {
        metafields: {
          [TAILORKIT_NAMESPACE]: {
            [variantId]: { value: productAppMetafield } as ProductMetafield,
            ...(appSettings ? { [TAILORKIT_APP_SETTINGS]: { value: appSettings } } : {}),
            ...(globalStyling ? { [TAILORKIT_GLOBAL_STYLING]: { value: globalStyling } } : {}),
          },
        },
      },
    }

    let html: string
    try {
      html = engine.renderFileSync(layout_type, context)
    } catch (error) {
      console.error('Failed to render liquid template:', error)
      throw new Error('Failed to render customizer template')
    }

    const CUSTOMIZER_TAG = {
      open: `<${ProductPersonalizerCustomizerWebComponentTag}`,
      close: `</${ProductPersonalizerCustomizerWebComponentTag}>`,
    }

    const startIndex = html.indexOf(CUSTOMIZER_TAG.open)
    const endIndex = html.indexOf(CUSTOMIZER_TAG.close)

    if (startIndex === -1 || endIndex === -1) {
      return ''
    }

    return html.slice(startIndex, endIndex + CUSTOMIZER_TAG.close.length)
  } catch (error) {
    console.error('Error in renderTailorkitCustomizer:', error)
    throw error
  }
}

function registerSchemaTag(engine: Liquid) {
  engine.registerTag('schema', {
    parse(tagToken, remainTokens) {
      let closed = false
      while (remainTokens.length) {
        const token = remainTokens.shift()
        // @ts-ignore
        if (token?.name === 'endschema') {
          closed = true
          break
        }
      }
      if (!closed) {
        throw new Error(`Schema tag ${tagToken.getText()} is not closed properly`)
      }
    },
    *render(context, emitter) {
      yield this.liquid.renderer.renderTemplates([], context, emitter)
    },
  })
}
