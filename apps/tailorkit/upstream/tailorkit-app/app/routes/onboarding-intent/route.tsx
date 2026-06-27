/**
 * Install intent page — shown once per shop on first session after install.
 *
 * Four cards:
 * - Quick Setup, Full Editor, Charm Builder (commit cards) submit the intent
 *   form and route the merchant into the chosen flow.
 * - See Live Demo (demo card) is a plain anchor opening the storefront demo
 *   in a new tab; original tab stays on this page so the merchant can pick a
 *   real flow afterwards.
 *
 * Show-once gate: loader sets shownAt on first render. If shownAt is already
 * set, the loader redirects to the dashboard. No idle redirect — merchant
 * exits via Shopify admin sidebar nav whenever they want.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { useFetcher } from '@remix-run/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BlockStack, InlineGrid, Page, Text } from '@shopify/polaris'
import { z } from 'zod'
import { json } from '~/bootstrap/fns/fetch.server'
import { errorResponse } from '~/utils/error-response.server'
import { authenticate } from '~/shopify/app.server'
import { authenticatedFetch } from '~/shopify/fns.client'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'
import Shop from '~/models/Shop.server'
import type { ShopDocument } from '~/models/Shop'
import {
  markIntentPageShown,
  recordDemoClicked,
  recordIntentSelection,
  setLastCreateFlow,
  shouldShowIntentPage,
} from '~/models/helpers/onboarding-flow-helpers.server'
import { trackEvent } from '~/bootstrap/fns/mixpanel.server'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { syncUserDataToCustomerIo } from '~/modules/customer.io/api.server'
import { sleep } from '~/utils/sleep'
import { CommitIntentCard, DemoIntentCard } from './components/intent-card'
import { CREATE_FLOWS, INTENT_CARDS } from './intents'

const ACTION_RECORD_SELECTION = 'RECORD_SELECTION'
const ACTION_RECORD_DEMO_CLICKED = 'RECORD_DEMO_CLICKED'

const recordSelectionSchema = z.object({
  selected: z.enum(CREATE_FLOWS),
  // Reject negative timestamps (clock skew / tampering); upper bound enforced
  // implicitly by the time-to-select clamp at 3600s downstream.
  pageLoadedAt: z.coerce.number().min(0),
  demoClickedFirst: z.union([z.literal('true'), z.literal('false')]).transform(v => v === 'true'),
})

export async function loader({ request }: LoaderFunctionArgs) {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  // Brief retry to handle the install race condition: dashboard redirects here
  // before afterAuth/createOrUpdateShop has committed the shop doc to MongoDB.
  let shop = await Shop.findOne({ shopDomain }).lean<ShopDocument>()
  if (!shop) {
    console.warn(`[onboarding-intent] shop not found on first read, retrying (shopDomain=${shopDomain})`)
    for (let i = 0; i < 2; i++) {
      await sleep(300)
      shop = await Shop.findOne({ shopDomain }).lean<ShopDocument>()
      if (shop) break
    }
  }
  if (!shop) throw new Response('Shop not found', { status: 404 })

  // Show-once gate: redirect away if the page has already been shown.
  // Preserve query string so Shopify embedded-app auth params survive.
  if (!shouldShowIntentPage(shop)) {
    const url = new URL(request.url)
    throw redirect(`/dashboard${url.search}`)
  }

  // Idempotently mark the page as shown. Even if the merchant leaves without
  // picking, they won't see the page again.
  const alreadyShown = Boolean(shop.appConfig?.onboardingIntent?.shownAt)
  await markIntentPageShown(shopDomain)

  // Server-side page-shown event: reliable denominator for the intent conversion funnel.
  // Complements the client-side feature_used/onboarding_intent_router/discovered event
  // which can be silently dropped (JS errors, network failures).
  // Guard on alreadyShown so reloads don't double-count (markIntentPageShown is idempotent
  // but trackEvent has no such guard).
  if (!alreadyShown) {
    trackEvent(shop, EVENTS_TRACKING.ONBOARDING_INTENT_PAGE_SHOWN, {}).catch(() => {})
  }

  return json({ pageLoadedAt: Date.now() })
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const {
      session: { shop: shopDomain },
    } = await authenticate.admin(request)

    const formData = await request.formData()
    const actionType = formData.get('_action')

    // Fetch shop doc once for tracking calls in both branches.
    const shopData = await Shop.findOne({ shopDomain })

    if (actionType === ACTION_RECORD_DEMO_CLICKED) {
      await recordDemoClicked(shopDomain)
      if (shopData) {
        trackEvent(shopData, EVENTS_TRACKING.ONBOARDING_DEMO_CLICKED, {}).catch(() => {})
      }
      return json({ success: true })
    }

    if (actionType === ACTION_RECORD_SELECTION) {
      const { selected, pageLoadedAt, demoClickedFirst } = recordSelectionSchema.parse({
        selected: formData.get('selected'),
        pageLoadedAt: formData.get('pageLoadedAt'),
        demoClickedFirst: formData.get('demoClickedFirst') ?? 'false',
      })

      const timeToSelectSeconds = Math.min(Math.max(0, (Date.now() - pageLoadedAt) / 1000), 3600)

      // Auto-render skip is handled by useOnboarding reading the shownAt
      // timestamp directly (set by markIntentPageShown in the loader). We
      // intentionally DO NOT flip completed_onboarding here — that would also
      // trigger the legacy unpaid-merchant pricing redirect, which the
      // intent-driven flow needs to play out before any pricing decision.
      await Promise.all([
        recordIntentSelection(shopDomain, selected, timeToSelectSeconds, demoClickedFirst),
        setLastCreateFlow(shopDomain, selected),
      ])

      if (shopData) {
        // The intent page re-shows after uninstall+reinstall (clearShopConfigs
        // wipes appConfig, including onboardingIntent). is_reinstall lets
        // analysts separate fresh-install intent from reinstall-cohort intent.
        const isReinstall = Boolean(shopData.lastReinstalledAt)

        trackEvent(shopData, EVENTS_TRACKING.ONBOARDING_INTENT_SELECTED, {
          intent: selected,
          time_to_select_seconds: timeToSelectSeconds,
          demo_clicked_first: demoClickedFirst,
          is_reinstall: isReinstall,
        }).catch(() => {})

        // Customer.io traits — `first_install_intent` is set once at intent
        // commit; `last_create_flow` updates on every dropdown pick (handled
        // by /api/onboarding-flow-router). `is_reinstall` lets lifecycle
        // emails target reinstall-cohort merchants differently from new ones.
        const email = shopData.shopConfig?.customer_email || shopData.shopConfig?.email
        if (email) {
          syncUserDataToCustomerIo(email, {
            first_install_intent: selected,
            last_create_flow: selected,
            is_reinstall: isReinstall,
          }).catch((err: unknown) => {
            console.error('[onboarding-intent action] Customer.io sync failed:', err)
          })
        }
      }

      // All flows route via ?openCreateFlow= so the dashboard's URL consumer is the
      // single source of truth for flow activation. For full_editor specifically,
      // useOnboarding has already set onboardingModalActive=false (because
      // intentPageShown is now true), so the dashboard handler must force-render
      // OnboardingFlow.CategorySelection rather than relying on the legacy
      // auto-render path.
      return redirect(`/dashboard?openCreateFlow=${selected}`)
    }

    return errorResponse('Unknown action', 400)
  } catch (error: unknown) {
    console.error('[onboarding-intent action]', error)
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return errorResponse(message, 500)
  }
}

export default function OnboardingIntentRoute() {
  const { t } = useTranslation()
  const fetcher = useFetcher()
  const tracking = useFeatureTracking('onboarding_intent_router')
  const [demoClickedFirst, setDemoClickedFirst] = useState(false)
  // pageLoadedAt is captured client-side so timing is real wall-clock, not
  // server processing time. Persisted across re-renders via useState init.
  const [pageLoadedAt] = useState(() => Date.now())

  const isSubmitting = fetcher.state !== 'idle'

  // Fires once on mount — auto-enriched with lifecycle_stage / days_since_install
  // so the install-intent page shows up in feature-adoption funnels alongside
  // every other registered feature. Additive to the bespoke
  // ONBOARDING_INTENT_SELECTED event still fired in the action.
  useEffect(() => {
    tracking.trackDiscovered('install')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCommit = (flow: string) => {
    const fd = new FormData()
    fd.set('_action', ACTION_RECORD_SELECTION)
    fd.set('selected', flow)
    fd.set('pageLoadedAt', String(pageLoadedAt))
    fd.set('demoClickedFirst', String(demoClickedFirst))
    fetcher.submit(fd, { method: 'POST' })

    const timeToSelectSeconds = Math.max(0, Math.min((Date.now() - pageLoadedAt) / 1000, 3600))
    tracking.trackCompleted(`selected_${flow}`, timeToSelectSeconds)
  }

  const handleDemoClick = () => {
    setDemoClickedFirst(true)
    tracking.trackStarted({ source: 'demo' })
    // Fire-and-forget tracking via the separate API endpoint. Posting to this
    // route's own action (via fetcher.submit) would trigger Remix to
    // revalidate the loader, and the loader's "already shown" gate would then
    // bounce to /dashboard — which is wrong because the merchant is supposed
    // to remain on the intent page after clicking the demo. Use
    // authenticatedFetch so the App Bridge id token reaches the API endpoint
    // (which is gated by authenticate.admin).
    void authenticatedFetch('/api/onboarding-flow-router', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'RECORD_DEMO_CLICKED' }),
    }).catch((err: unknown) => {
      console.error('[onboarding-intent demo] tracking failed:', err)
    })
  }

  return (
    <Page>
      <BlockStack gap="600" inlineAlign="center">
        <BlockStack gap="200" inlineAlign="center">
          <Text as="h1" variant="heading2xl" alignment="center">
            {t('what-brings-you-to-tailorkit')}
          </Text>
          <Text as="p" variant="bodyLg" tone="subdued" alignment="center">
            {t('pick-what-you-re-here-for-we-ll-set-you-up-in-seconds')}
          </Text>
        </BlockStack>
        <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
          {INTENT_CARDS.map(card =>
            card.kind === 'commit' ? (
              <CommitIntentCard
                key={card.flow}
                card={card}
                onClick={() => handleCommit(card.flow)}
                disabled={isSubmitting}
              />
            ) : (
              <DemoIntentCard key={card.href} card={card} onClick={handleDemoClick} />
            )
          )}
        </InlineGrid>
      </BlockStack>
    </Page>
  )
}
