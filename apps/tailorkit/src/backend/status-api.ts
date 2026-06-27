import type { AppBackendRegisterContext } from '../../../../web/server/src/app-platform/contracts'
import {
  tailorkitAppDataCollections,
  tailorkitMigrationPhases,
  tailorkitMigrationStatus,
  tailorkitStorefrontDependencyPolicy,
  tailorkitStorefrontSourcePolicy,
} from '../domain/migration-boundary'
import { getTailorKitProductPersonalizerRouteHostReadiness } from '../domain/product-personalizer-route-host-readiness'

/** Registers read-only migration status so the admin shell reflects the real migration boundary. */
export function registerTailorKitStatusApi(ctx: AppBackendRegisterContext): void {
  ctx.api.route({
    method: 'GET',
    path: '/status',
    capability: 'canReadShopContext',
    async handler(request) {
      const shop = await ctx.ports.shopContext.getSafeContext(request.context, ['identity', 'plan', 'app'])

      return {
        body: {
          appId: ctx.app.appId,
          status: 'copy-first-recovery',
          shop,
          migration: {
            ...tailorkitMigrationStatus,
            phases: tailorkitMigrationPhases,
          },
          routeHostReadiness: getTailorKitProductPersonalizerRouteHostReadiness(),
          appDataCollections: tailorkitAppDataCollections.map(definition => definition.collection),
          storefrontDependencyPolicy: tailorkitStorefrontDependencyPolicy,
          storefrontSourcePolicy: tailorkitStorefrontSourcePolicy,
        },
      }
    },
  })
}
