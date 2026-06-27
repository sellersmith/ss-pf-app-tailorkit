/**
 * Onboarding flow router API.
 *
 * Multiplexes 4 mutations on shop.appConfig:
 * - MARK_INTENT_PAGE_SHOWN: gates the install intent page (set once on first render).
 * - RECORD_INTENT_SELECTION: persists the merchant's flow pick.
 * - RECORD_DEMO_CLICKED: flag flip when the demo card is clicked.
 * - SET_LAST_CREATE_FLOW: per-shop default for the create-flow dropdown.
 */

import type { ActionFunctionArgs } from '@remix-run/node'
import { z } from 'zod'
import { json } from '~/bootstrap/fns/fetch.server'
import { errorResponse } from '~/utils/error-response.server'
import { authenticate } from '~/shopify/app.server'
import {
  markIntentPageShown,
  recordIntentSelection,
  recordDemoClicked,
  setLastCreateFlow,
} from '~/models/helpers/onboarding-flow-helpers.server'
import { getShopData } from '~/models/Shop.server'
import { syncUserDataToCustomerIo } from '~/modules/customer.io/api.server'
import { trackEvent } from '~/bootstrap/fns/mixpanel.server'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { CREATE_FLOWS, ONBOARDING_FLOW_ROUTER_ACTIONS } from './constants'

const recordIntentSelectionSchema = z.object({
  selected: z.enum(CREATE_FLOWS),
  timeToSelectSeconds: z.number().min(0).max(3600),
  demoClickedFirst: z.boolean(),
})

const setLastCreateFlowSchema = z.object({
  flow: z.enum(CREATE_FLOWS),
})

export async function action({ request }: ActionFunctionArgs) {
  try {
    const {
      session: { shop: shopDomain },
    } = await authenticate.admin(request)

    const body = await request.json()
    const action = body.action

    switch (action) {
      case ONBOARDING_FLOW_ROUTER_ACTIONS.MARK_INTENT_PAGE_SHOWN: {
        await markIntentPageShown(shopDomain)
        return json({ success: true })
      }

      case ONBOARDING_FLOW_ROUTER_ACTIONS.RECORD_INTENT_SELECTION: {
        const { selected, timeToSelectSeconds, demoClickedFirst } = recordIntentSelectionSchema.parse(body)
        await recordIntentSelection(shopDomain, selected, timeToSelectSeconds, demoClickedFirst)
        // Flow choice doubles as the dropdown default — set it here so the merchant's
        // first dropdown click on a returning visit defaults to whatever they picked.
        await setLastCreateFlow(shopDomain, selected)
        // Fire Mixpanel + Customer.io async — same payload as the standalone intent
        // page action, so intent → publish → subscribe funnel works regardless of surface.
        getShopData(shopDomain)
          .then(shop => {
            if (!shop) return
            const isReinstall = Boolean(shop.lastReinstalledAt)
            trackEvent(shop, EVENTS_TRACKING.ONBOARDING_INTENT_SELECTED, {
              intent: selected,
              time_to_select_seconds: timeToSelectSeconds,
              demo_clicked_first: demoClickedFirst,
              is_reinstall: isReinstall,
            }).catch(() => {})
            const email = shop.shopConfig?.customer_email || shop.shopConfig?.email
            if (email) {
              // Only set first_install_intent on the very first selection — never
              // overwrite it on subsequent clicks (returning merchants re-selecting).
              const alreadyHasIntent = Boolean(shop.appConfig?.onboardingIntent?.selected)
              syncUserDataToCustomerIo(email, {
                ...(alreadyHasIntent ? {} : { first_install_intent: selected }),
                last_create_flow: selected,
                is_reinstall: isReinstall,
              }).catch((err: unknown) => {
                console.error('[api.onboarding-flow-router] Customer.io sync failed:', err)
              })
            }
          })
          .catch((err: unknown) => {
            console.error('[api.onboarding-flow-router] intent selection tracking failed:', err)
          })
        return json({ success: true })
      }

      case ONBOARDING_FLOW_ROUTER_ACTIONS.RECORD_DEMO_CLICKED: {
        await recordDemoClicked(shopDomain)
        // Fire Mixpanel event. Fire-and-forget; never block the response.
        getShopData(shopDomain)
          .then(shop => shop && trackEvent(shop, EVENTS_TRACKING.ONBOARDING_DEMO_CLICKED, {}))
          .catch((err: unknown) => {
            console.error('[api.onboarding-flow-router] demo tracking failed:', err)
          })
        return json({ success: true })
      }

      case ONBOARDING_FLOW_ROUTER_ACTIONS.SET_LAST_CREATE_FLOW: {
        const { flow } = setLastCreateFlowSchema.parse(body)
        await setLastCreateFlow(shopDomain, flow)
        // Mirror to Customer.io trait so lifecycle emails can target the
        // merchant's most recent flow choice. Fire-and-forget — never block.
        getShopData(shopDomain)
          .then(shop => {
            const email = shop?.shopConfig?.customer_email || shop?.shopConfig?.email
            if (email) {
              return syncUserDataToCustomerIo(email, { last_create_flow: flow })
            }
          })
          .catch((err: unknown) => {
            console.error('[api.onboarding-flow-router] Customer.io sync failed:', err)
          })
        return json({ success: true })
      }

      default: {
        return errorResponse('Invalid action', 400)
      }
    }
  } catch (error: unknown) {
    console.error('[api.onboarding-flow-router]', error)
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return errorResponse(message, 500)
  }
}
