import type { AppApiRequest, AppBackendRegisterContext, AppContext } from '../../../../web/server/src/app-platform/contracts'
import { tailorkitAppDataCollections } from '../domain/migration-boundary'
import { TAILORKIT_CAPABILITIES } from '../domain/capabilities'
import {
  TAILORKIT_GLOBAL_STYLING_RECORD_ID,
  TAILORKIT_PERSONALIZER_SETTINGS_COLLECTION,
  readTailorKitGlobalStyling,
  type TailorKitGlobalStylingRecord,
} from './global-styling-repository'
import { syncTailorKitAppSettingsGlobalStylingMirror, writeTailorKitAppSettings } from './app-settings-repository'
import { createTailorKitGlobalStylingMetafield } from './storefront-styling-publisher'

const TAILORKIT_PREFERENCES_RECORD_ID = 'preferences'

const TAILORKIT_PREFERENCE_ACTIONS = {
  updateOccurredEvent: 'UPDATE_OCCURRED_EVENT',
  getGlobalStyling: 'GET_GLOBAL_STYLING',
  updateGlobalStyling: 'UPDATE_GLOBAL_STYLING',
  updateAppMetafields: 'UPDATE_APP_METAFIELDS',
} as const

interface TailorKitPreferencesRecord {
  id: typeof TAILORKIT_PREFERENCES_RECORD_ID
  occurredEvents: Record<string, unknown>
  updatedAt: string
}

function bodyObject(body: unknown) {
  return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {}
}

function personalizerSettingsDefinition() {
  const definition = tailorkitAppDataCollections.find(
    item => item.collection === TAILORKIT_PERSONALIZER_SETTINGS_COLLECTION
  )

  if (!definition) throw new Error('TailorKit personalizer settings collection is not registered in migration boundary')

  return definition
}

async function ensureCollection(ctx: AppBackendRegisterContext, requestContext: AppContext) {
  await ctx.ports.appData.registerCollection(requestContext, personalizerSettingsDefinition())
}

async function readPreferences(ctx: AppBackendRegisterContext, requestContext: AppContext) {
  await ensureCollection(ctx, requestContext)
  return ctx.ports.appData.get<TailorKitPreferencesRecord>(
    requestContext,
    TAILORKIT_PERSONALIZER_SETTINGS_COLLECTION,
    TAILORKIT_PREFERENCES_RECORD_ID
  )
}

async function readGlobalStyling(ctx: AppBackendRegisterContext, requestContext: AppContext) {
  await ensureCollection(ctx, requestContext)
  return readTailorKitGlobalStyling(ctx.ports, requestContext)
}

async function handleUpdateOccurredEvent(ctx: AppBackendRegisterContext, request: AppApiRequest) {
  const body = bodyObject(request.body)
  const eventName = typeof body.eventName === 'string' ? body.eventName.trim() : ''
  if (!eventName) {
    return {
      status: 400,
      body: { success: false, message: 'Missing TailorKit occurred event name' },
    }
  }

  const current = await readPreferences(ctx, request.context)
  const next: TailorKitPreferencesRecord = {
    id: TAILORKIT_PREFERENCES_RECORD_ID,
    occurredEvents: {
      ...(current?.occurredEvents || {}),
      [eventName]: body.value,
    },
    updatedAt: new Date().toISOString(),
  }

  await ctx.ports.appData.put(
    request.context,
    TAILORKIT_PERSONALIZER_SETTINGS_COLLECTION,
    TAILORKIT_PREFERENCES_RECORD_ID,
    next
  )

  return { body: { success: true, item: next } }
}

async function handleGetGlobalStyling(ctx: AppBackendRegisterContext, request: AppApiRequest) {
  const current = await readGlobalStyling(ctx, request.context)
  // Keep the copied UI response contract stable without importing the TailorKit default factory here.
  return { body: { globalStyling: current?.styling ?? {} } }
}

async function handleUpdateGlobalStyling(ctx: AppBackendRegisterContext, request: AppApiRequest) {
  const body = bodyObject(request.body)
  const styling = body.styling
  if (!styling || typeof styling !== 'object') {
    return {
      status: 400,
      body: { success: false, message: 'Missing styling' },
    }
  }

  const next: TailorKitGlobalStylingRecord = {
    id: TAILORKIT_GLOBAL_STYLING_RECORD_ID,
    styling: styling as Record<string, unknown>,
    updatedAt: new Date().toISOString(),
  }

  // Register the collection before writing — a client that posts UPDATE_GLOBAL_STYLING before any read
  // (e.g. the styling sub-view saving on a fresh host context) would otherwise hit "collection is not
  // registered". `registerCollection` is idempotent.
  await ensureCollection(ctx, request.context)
  await ctx.ports.appData.put(
    request.context,
    TAILORKIT_PERSONALIZER_SETTINGS_COLLECTION,
    TAILORKIT_GLOBAL_STYLING_RECORD_ID,
    next
  )

  // Mirror to the `em_tailorkit.global_styling` app metafield (storefront runtime JS reads this standalone
  // key) so the change reflects immediately, without waiting for the next storefront-runtime publish.
  await ctx.ports.appMetafields.setMany(request.context, [
    createTailorKitGlobalStylingMetafield(next.styling, 'tailorkit-global-styling-updated'),
  ])
  // Also refresh the `em_tailorkit.app_settings.globalStyling` fold-in, which the copied customizer Liquid
  // reads for the SSR personalization title (`app_settings.globalStyling.heading.text`).
  await syncTailorKitAppSettingsGlobalStylingMirror(ctx.ports, request.context)

  return { body: { success: true } }
}

async function handleUpdateAppMetafields(ctx: AppBackendRegisterContext, request: AppApiRequest) {
  const body = bodyObject(request.body)
  const appMetafields = body.appMetafields
  if (!appMetafields || typeof appMetafields !== 'object' || Array.isArray(appMetafields)) {
    return {
      status: 400,
      body: { success: false, message: 'Missing appMetafields' },
    }
  }

  await ensureCollection(ctx, request.context)
  const merged = await writeTailorKitAppSettings(ctx.ports, request.context, appMetafields as Record<string, unknown>)

  return { body: { success: true, appMetafields: merged } }
}

/** Stores copied TailorKit preference mutations in app-scoped data instead of PageFly core Shop. */
export function registerTailorKitPreferencesApi(ctx: AppBackendRegisterContext): void {
  ctx.api.route({
    method: 'POST',
    path: '/preferences',
    capability: TAILORKIT_CAPABILITIES.writePersonalizedProducts,
    async handler(request) {
      const action = bodyObject(request.body).action

      switch (action) {
        case TAILORKIT_PREFERENCE_ACTIONS.updateOccurredEvent:
          return handleUpdateOccurredEvent(ctx, request)
        case TAILORKIT_PREFERENCE_ACTIONS.getGlobalStyling:
          return handleGetGlobalStyling(ctx, request)
        case TAILORKIT_PREFERENCE_ACTIONS.updateGlobalStyling:
          return handleUpdateGlobalStyling(ctx, request)
        case TAILORKIT_PREFERENCE_ACTIONS.updateAppMetafields:
          return handleUpdateAppMetafields(ctx, request)
        default:
          return {
            status: 400,
            body: { success: false, message: 'Unsupported TailorKit preference action' },
          }
      }
    },
  })
}
