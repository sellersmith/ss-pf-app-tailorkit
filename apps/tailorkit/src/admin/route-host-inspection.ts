import type { AdminAppHost } from '../../../../web/core/src/app-platform/admin'
import { createTailorKitCopiedRouteExecutionPlan } from '../domain/product-personalizer-copied-route-execution-plan'
import { getTailorKitProductPersonalizerRouteHostReadiness } from '../domain/product-personalizer-route-host-readiness'

/** TailorKit wholesale copy-first migration route inspection must stay host-only and behavior-free. */
export function inspectTailorKitAdminRouteHost(host: Pick<AdminAppHost, 'route'>) {
  const executionPlan = createTailorKitCopiedRouteExecutionPlan(host.route.fullPath)
  const routeTarget = executionPlan
    ? {
        route: executionPlan.route,
        routeModule: executionPlan.routeModule,
      }
    : null
  const readiness = getTailorKitProductPersonalizerRouteHostReadiness()

  return {
    routeTarget,
    executionPlan,
    readiness,
    canActivateRuntime: Boolean(routeTarget && readiness.canActivateRuntime),
  }
}
