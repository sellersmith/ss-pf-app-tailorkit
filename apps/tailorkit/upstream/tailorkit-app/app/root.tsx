import type { HeadersFunction, LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { useLoaderData, useRouteError, useRouteLoaderData } from '@remix-run/react'
import polarisStyles from '@shopify/polaris/build/esm/styles.css?url'
import type { AdminContext } from '@shopify/shopify-app-remix/server'
import { boundary } from '@shopify/shopify-app-remix/server'
import { json } from '~/bootstrap/fns/fetch.server'
import remixI18n, { i18nCookie } from '~/bootstrap/i18n/i18n.server'
import CrispChatStyles from '~/styles/crisp-chat.css?url'
import GlobalStyles from '~/styles/global.css?url'
import { isAuthRoute, isPublicRoute, NavMenuItems } from './bootstrap/app-config'
import type { ShopDocument } from './models/Shop'
import Shop from './models/Shop.server'
import { canUseFreeResources } from './models/PricingPlan.fns'
import PublicRoot from './public-root'
import { getEssentialShopData } from './routes/api.preferences/fns.server'
import { PROPERTY_PREFIX } from './routes/webhooks/fns.server'
import { appName, authenticate, registerWebhooks } from './shopify/app.server'
import type { RootLoaderData } from './types/loaders'
import { catchAsync } from './utils/catchAsync'
import { App } from './components/layouts/AppContent'
import { ErrorBoundaryFallback } from './components/ErrorBoundary'
import { afterAuthHandler } from './shopify/shopify.server'
import { checkAndConfirmReferral } from '~/services/ss-referral/index.server'
import { formatErrorMessage } from './utils/formatErrorMessage'
import { isDealActive, isDealEligible } from './models/helpers/first-month-deal.server'
import { getActiveTrialDays } from './models/helpers/trial-utils'
import type { SubscriptionDocument } from './models/Subscription'
import type { PricingPlanDocument } from './models/PricingPlan'
import PricingPlan from './models/PricingPlan.server'

export const DEFAULT_STORE_ASSET_DOMAIN = 'sample-store-tailorkit.myshopify.com'

export const headers: HeadersFunction = headersArgs => {
  return boundary.headers(headersArgs)
}

export const loader = catchAsync(async ({ request, params }: LoaderFunctionArgs) => {
  const url = new URL(request.url)

  const isPublic = isPublicRoute(url)

  if (isPublic) {
    return json({ isPublic })
  }

  const maintenanceMode = process.env.MAINTENANCE_MODE === 'true'

  let shopDomain = ''
  let adminContext: AdminContext | null = null

  // Authenticate the route if needed (exclude only '/' and '/auth/login' which is not need to auth)
  const shouldAuthenticate = isAuthRoute(url)
  if (shouldAuthenticate) {
    adminContext = await authenticate.admin(request)

    const {
      session: { shop: _shop },
    } = adminContext

    // Register essentials webhooks if needed
    // This task must run asynchronously to avoid blocking the main thread
    registerWebhooks(adminContext.admin, _shop).catch(console.error)

    shopDomain = _shop
  }

  // Detect locale from the request in the following order:
  //
  // 1. The `lng` query param in the requested URL.
  // 2. The `i18n` cookie is sent along with the request.
  // 3. The `Accept-Language` header.
  const locale = await remixI18n.getLocale(request)

  let shopData: ShopDocument | null = null

  if (shopDomain) {
    // Get essential shop data when having admin context otherwise it receives normal shop data
    // Essential data spans across app
    // Normal shop data will only exist when authenticating and it does not require many fields or properties for processing
    // Just set a safe guard for it.
    try {
      shopData = adminContext ? await getEssentialShopData(adminContext) : await Shop.findOne({ shopDomain })
      if (!shopData && adminContext) {
        // Try to init shop data if it fails
        await afterAuthHandler({ admin: adminContext.admin, session: adminContext.session })

        // Try to get essential shop data again
        shopData = await getEssentialShopData(adminContext)

        // First install — check for a pending cross-sell referral and confirm conversion.
        // Fire-and-forget — never blocks the install flow.
        void checkAndConfirmReferral({
          request,
          convertedShopDomain: shopDomain,
          convertedEmail: shopData?.shopConfig?.email ?? undefined,
          convertedShopDescription: shopData?.metadata?.shopDescription ?? undefined,
        })
      } else if (shopData?.lastReinstalledAt && adminContext) {
        // Reinstall — also check referral (shop exists from previous install)
        void checkAndConfirmReferral({
          request,
          convertedShopDomain: shopDomain,
          convertedEmail: shopData?.shopConfig?.email ?? undefined,
          convertedShopDescription: shopData?.metadata?.shopDescription ?? undefined,
        })
      }
    } catch (error) {
      console.error('[Critical Error]: ', formatErrorMessage(error))
    }
  }

  // CANONICAL lastAccess write point — do not duplicate elsewhere
  if (shopDomain && shopData) {
    void Shop.updateOne({ shopDomain }, { $set: { lastAccess: new Date() } }).catch(console.error)
  }

  // Redirect to pricing page server-side if user cannot use free resources
  // This prevents the dashboard flash that occurs with client-side redirect in withNavMenu
  if (shopData && shouldAuthenticate) {
    const isPricingPage = url.pathname.startsWith('/pricing')
    const isDashboard = url.pathname.startsWith('/dashboard')
    const isOnboardingEditor
      = url.pathname.startsWith('/personalized-products/') && url.searchParams.get('onboarding') === 'true'
    // Allow the install intent page through — it's a one-time first-impression
    // surface that gates everything else; redirecting it to /pricing would
    // skip the intent capture for reinstalled merchants whose subscription
    // got cancelled on uninstall.
    const isOnboardingIntent = url.pathname.startsWith('/onboarding-intent')
    if (
      !canUseFreeResources({ shopData })
      && !isPricingPage
      && !isDashboard
      && !isOnboardingEditor
      && !isOnboardingIntent
    ) {
      return adminContext ? adminContext.redirect(NavMenuItems.PRICING) : redirect(NavMenuItems.PRICING)
    }
  }

  const {
    SHOPIFY_API_KEY,
    SHOPIFY_PARTNER_ID,
    CRISP_WEBSITE_ID,
    STORE_ASSET_DOMAIN = DEFAULT_STORE_ASSET_DOMAIN,
    MIXPANEL_ACCESS_TOKEN,
    // Mixpanel Session Replay / Heatmap config (optional)
    MIXPANEL_REPLAY_SAMPLE_PERCENT,
    MIXPANEL_RECORD_MASK_TEXT_SELECTOR,
    MIXPANEL_RECORD_BLOCK_CLASS,
    APP_HANDLE,
    TEST_CHARGE,
    ENABLE_DEVTOOLS = false,
    NODE_ENV,
  } = process.env
  const { BASE_URL } = import.meta.env

  // Compute $1 first month deal flags for UI (widget + pricing page)
  const dealActive = isDealActive()
  const dealEligible = shopDomain ? await isDealEligible(shopDomain) : false

  // Compute remaining trial days from active-days tracking (V2+ plans)
  // Only show trial countdown when user has an active/approved subscription
  // (trial starts on charge approval, not on install)
  let remainingTrialDays: number | null = null
  const subscription = shopData?.subscription as SubscriptionDocument | null
  const hasApprovedSubscription = subscription?.status === 'active'
  if (shopData?.trialStartedAt && !shopData.trialCompletedAt && hasApprovedSubscription) {
    const plan = subscription?.plan as PricingPlanDocument | null
    // Use plan's trialDays if subscribed, otherwise query DB for default trial period
    // (varies by environment: 14 in prod, 1 in WIP/RC)
    const trialPeriod
      = plan?.trialDays
      ?? (await PricingPlan.findOne({ status: 'active', trialDays: { $gt: 0 } }, { trialDays: 1 }).lean())?.trialDays
      ?? 14
    const activeDays = getActiveTrialDays(shopData)
    const days = Math.max(0, trialPeriod - activeDays)
    remainingTrialDays = days > 0 ? days : null
  }

  const data: RootLoaderData = {
    params,
    locale,
    apiKey: SHOPIFY_API_KEY,
    crispWebsiteId: CRISP_WEBSITE_ID || '',
    shopifyPartnerId: SHOPIFY_PARTNER_ID || '',
    shopData: shopData || null,
    mixPanelAccessToken: MIXPANEL_ACCESS_TOKEN,
    maintenanceMode,
    PROPERTY_PREFIX,
    polarisStyles,
    crispChatStyles: CrispChatStyles,
    globalStyles: GlobalStyles,
    isDealActive: dealActive,
    isDealEligible: dealEligible,
    remainingTrialDays,
    PUBLIC_ENV: {
      BASE_URL,
      STORE_ASSET_DOMAIN,
      APP_NAME: appName,
      APP_HANDLE,
      TEST_CHARGE,
      ENABLE_DEVTOOLS,
      NODE_ENV,
      // Pass-through optional replay config to the client
      MIXPANEL_REPLAY_SAMPLE_PERCENT,
      MIXPANEL_RECORD_MASK_TEXT_SELECTOR,
      MIXPANEL_RECORD_BLOCK_CLASS,
    },
  }

  return json(data, {
    headers: { 'Set-Cookie': await i18nCookie.serialize(locale) },
  })
})

export function useRootLoaderData() {
  return useRouteLoaderData<typeof loader>('root')
}

export const handle = {
  // Define `i18n` namespaces our route need to use.
  i18n: ['index'],
}

const Root = withRoot(App)

export default Root

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  const error = useRouteError()

  if (error) {
    return <ErrorBoundaryFallback />
  }

  return boundary.error(error)
}

function withRoot(AppComponent: React.FC) {
  return function Root() {
    const loaderData = useLoaderData<RootLoaderData>()

    if (!loaderData) {
      console.error('Error from root loader')
      return <ErrorBoundaryFallback />
    }

    const isPublic = loaderData.isPublic

    if (isPublic) {
      return <PublicRoot />
    }

    return <AppComponent />
  }
}
