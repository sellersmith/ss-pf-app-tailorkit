import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import fs from 'fs'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticateAppProxy } from '~/bootstrap/shopify/auth'
import { catchAsync } from '~/utils/catchAsync'
import { getAppSettingsAndStyling, prepareProductOnProductPage, renderTailorkitCustomizer } from './fns'
import { getProductAppMetafield } from '../api.integration/fns.server'
import { DEFAULT_APP_BLOCK_INSTALLATION_SETTINGS } from '../../../extensions/tailorkit-src/src/assets/constants/app-block'
import Shop from '~/models/Shop.server'
import type { ShopDocument } from '~/models/Shop'
import { trackFeatureEvent } from '~/bootstrap/fns/feature-tracking.server'
import { selectFeatures, type FeatureContext } from '../../../extensions/tailorkit-src/server/feature-registry.server'

// Extension asset path + in-memory cache.
// Assets are immutable between deploys (server restart invalidates cache naturally), so
// caching the file contents avoids re-reading ~550KB of JS on every POST to this route.
const EXTENSION_ASSETS_PATH = `${process.cwd()}/extensions/tailorkit/assets`
const assetCache = new Map<string, string>()
const readAsset = (name: string): string => {
  const cached = assetCache.get(name)
  if (cached !== undefined) return cached
  const content = fs.readFileSync(`${EXTENSION_ASSETS_PATH}/${name}`, 'utf8')
  assetCache.set(name, content)
  return content
}

/**
 * GET handler for the fallback panel injector.
 * Called by the client-side detection script when the app block is missing.
 *
 * @query productId - Shopify product numeric ID
 * @query variantId - Shopify variant numeric ID
 * @query locale - Optional locale code (default: 'en')
 */
export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAppProxy(request)
  const { shop } = session

  const url = new URL(request.url)
  const productId = url.searchParams.get('productId')
  const variantId = url.searchParams.get('variantId')
  const locale = url.searchParams.get('locale') || 'en'

  if (!productId || !variantId || !/^\d+$/.test(productId) || !/^\d+$/.test(variantId)) {
    return json({ status: 'error', message: 'Invalid or missing productId/variantId' }, { status: 400 })
  }

  // Check if integration exists for this variant
  // Pass productId to enable product-level metafield fallback for legacy integrations
  // (matches customizer.liquid behavior: variant key first, then product key)
  const productAppMetafield = await getProductAppMetafield(shop, variantId, productId)
  // Empty object ("{}") is the unpublish sentinel written by cleanupVariantInAppMetafield —
  // treat it the same as "no integration" so the fallback CTA is not rendered after unpublish.
  if (!productAppMetafield || Object.keys(productAppMetafield).length === 0) {
    return json({ status: 'success', html: '' })
  }

  // Fetch app settings + product data in parallel
  const [{ appSettings, globalStyling }, productOnProductPage] = await Promise.all([
    getAppSettingsAndStyling(shop),
    prepareProductOnProductPage(shop, productId, variantId),
  ])

  // Render customizer HTML
  const html = await renderTailorkitCustomizer({
    productOnProductPage,
    variantId,
    productAppMetafield,
    settings: DEFAULT_APP_BLOCK_INSTALLATION_SETTINGS,
    locale,
    appSettings,
    globalStyling,
  })

  // Non-blocking: track fallback panel usage for adoption metrics
  if (html) {
    Shop.findOne({ shopDomain: shop })
      .lean()
      .then(shopDoc => {
        if (shopDoc) {
          trackFeatureEvent(shopDoc as unknown as ShopDocument, 'app_proxy_fallback', 'panel_served', {
            productId,
            variantId,
          })
        }
      })
      .catch(err => {
        console.warn('[app_proxy_fallback] tracking failed:', err?.message)
      })
  }

  return json({ status: 'success', html })
})

/**
 * This action is used to prepare the product variant integration metafield
 * and the product on product page
 *
 * The payload includes product id, variant id, settings, and optional locale
 * @example
 * ```
 * fetch('/apps/tailorkit-dev-app/app_proxy/product-variant-integration', {
 *   method: "POST",
 *   headers: {
 *     "Content-Type": "application/json",
 *   },
 *   body: JSON.stringify({
 *     productId: 8977427366133,
 *     variantId: 46234168885493,
 *     settings: { layout_type: 'customizer' },
 *     locale: 'en' // Optional: 'en', 'es', 'fr', 'de', 'it', 'pt-BR', 'ja', 'zh', 'ar', 'hi', 'tr', 'vi'
 *   })
 * })
 * ```
 */
export const action = catchAsync(async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticateAppProxy(request)

  const { shop } = session

  // Get product id from payload
  const payload = await request.json()
  const { productId, variantId, settings, locale } = payload

  // Fetch metafield data, product data, and app settings concurrently
  // Pass productId to enable product-level metafield fallback for legacy integrations
  const [productAppMetafield, productOnProductPage, { appSettings, globalStyling }] = await Promise.all([
    getProductAppMetafield(shop, variantId, productId),
    prepareProductOnProductPage(shop, productId, variantId),
    getAppSettingsAndStyling(shop),
  ])

  const html = await renderTailorkitCustomizer({
    productOnProductPage,
    variantId,
    productAppMetafield,
    settings,
    locale,
    appSettings,
    globalStyling,
  })

  // Select applicable feature bundles declaratively via the registry. Adding a future
  // bundle (e.g. tailorkit-ai-magic.js) only requires a new entry in feature-registry.ts —
  // this handler does not change. Order is preserved from registry array.
  const featureCtx: FeatureContext = { metafield: productAppMetafield, appSettings }
  const scripts = selectFeatures(featureCtx).map(f => ({ name: f.name, content: readAsset(f.name) }))

  const css = readAsset('tailorkit.css')

  const assets = {
    html,
    css,
    scripts,
  }

  return json({
    status: 'success',
    message: `Hello ${shop}`,
    assets,
  })
})
