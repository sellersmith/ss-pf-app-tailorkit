import {
  tailorkitProductPersonalizerAdminRouteHostDecisions,
  tailorkitProductPersonalizerCopiedRouteHostContract,
  tailorkitProductPersonalizerCopiedRouteSourceMaps,
} from './product-personalizer-admin-route-host-contract'
import {
  tailorkitAuthenticatedFetchBridgeDecisions,
  tailorkitPageFlyApiRouteBridgeDecisions,
} from './product-personalizer-authenticated-fetch-bridge-contract'
import {
  tailorkitProductPersonalizerV01CoreFlows,
  tailorkitProductPersonalizerV01DeferredCoreFlowIds,
  tailorkitProductPersonalizerV01RouteHostCoreFlowIds,
} from './product-personalizer-route-scope'

export type TailorKitRouteHostReadinessStatus = 'ready' | 'blocked'

export interface TailorKitRouteHostReadinessBlocker {
  id: string
  source: 'admin-route-host' | 'authenticated-fetch-bridge' | 'pagefly-api-bridge' | 'v0-core-flow'
  reason: string
}

export interface TailorKitRouteHostPendingBridgeDecisionsByAdminRoute {
  routeId: string
  decisionIds: readonly string[]
}

export interface TailorKitRouteHostReadiness {
  status: TailorKitRouteHostReadinessStatus
  canActivateRuntime: boolean
  blockers: readonly TailorKitRouteHostReadinessBlocker[]
  adminRouteIds: readonly string[]
  deferredAdminRouteIds: readonly string[]
  mappedBridgeDecisionIds: readonly string[]
  pendingBridgeDecisionIds: readonly string[]
  blockingPendingBridgeDecisionIds: readonly string[]
  deferredPendingBridgeDecisionIds: readonly string[]
  pendingBridgeDecisionsByAdminRoute: readonly TailorKitRouteHostPendingBridgeDecisionsByAdminRoute[]
  failClosedPageFlyRoutes: readonly string[]
  deferredFailClosedPageFlyRoutes: readonly string[]
  mappedCoreFlowIds: readonly string[]
  pendingCoreFlowIds: readonly string[]
  deferredCoreFlowIds: readonly string[]
}

export class TailorKitRouteHostActivationError extends Error {
  constructor(readonly readiness: TailorKitRouteHostReadiness) {
    super(`TailorKit copied-route host is not ready: ${readiness.blockers.map(blocker => blocker.id).join(', ')}`)
    this.name = 'TailorKitRouteHostActivationError'
  }
}

/** Summarizes whether copied TailorKit admin routes can run through the PageFly host. */
export function getTailorKitProductPersonalizerRouteHostReadiness(): TailorKitRouteHostReadiness {
  const blockers: TailorKitRouteHostReadinessBlocker[] = []
  const routeHostCoreFlowIds = new Set<string>(tailorkitProductPersonalizerV01RouteHostCoreFlowIds)
  const deferredCoreFlowIds = new Set<string>(tailorkitProductPersonalizerV01DeferredCoreFlowIds)
  const routeHostCoreFlows = tailorkitProductPersonalizerV01CoreFlows.filter(flow => routeHostCoreFlowIds.has(flow.id))
  const deferredCoreFlows = tailorkitProductPersonalizerV01CoreFlows.filter(flow => deferredCoreFlowIds.has(flow.id))
  const routeHostAdminRouteIds = Array.from(new Set(routeHostCoreFlows.flatMap(flow => flow.mountableRouteIds)))
  const deferredAdminRouteIds = Array.from(new Set(deferredCoreFlows.flatMap(flow => flow.mountableRouteIds)))

  if (tailorkitProductPersonalizerCopiedRouteHostContract.status !== 'runtime-enabled') {
    throw new Error('Unexpected TailorKit copied-route host status')
  }

  for (const decision of tailorkitProductPersonalizerAdminRouteHostDecisions) {
    if (routeHostAdminRouteIds.includes(decision.routeId) && decision.status !== 'runtime-hosted') {
      blockers.push({
        id: `admin-route-not-runtime-hosted:${decision.routeId}`,
        source: 'admin-route-host',
        reason: decision.requiredHostCapabilities.join(', '),
      })
    }
  }

  for (const sourceMap of tailorkitProductPersonalizerCopiedRouteSourceMaps) {
    if (routeHostAdminRouteIds.includes(sourceMap.routeId) && sourceMap.status !== 'source-mapped-host-ready') {
      blockers.push({
        id: `source-map-host-pending:${sourceMap.routeId}`,
        source: 'admin-route-host',
        reason: sourceMap.hostCompatibilityRequirements.join(', '),
      })
    }
  }

  const mappedBridgeDecisionIds = tailorkitAuthenticatedFetchBridgeDecisions
    .filter(decision => decision.status !== 'pending-source-mapped-adapter')
    .map(decision => decision.id)
  const pendingBridgeDecisionIds = tailorkitAuthenticatedFetchBridgeDecisions
    .filter(decision => decision.status === 'pending-source-mapped-adapter')
    .map(decision => decision.id)
  const blockingPendingBridgeDecisionIds = tailorkitAuthenticatedFetchBridgeDecisions
    .filter(decision => decision.status === 'pending-source-mapped-adapter' && routeHostCoreFlowIds.has(decision.coreFlow))
    .map(decision => decision.id)
  const deferredPendingBridgeDecisionIds = tailorkitAuthenticatedFetchBridgeDecisions
    .filter(decision => decision.status === 'pending-source-mapped-adapter' && !routeHostCoreFlowIds.has(decision.coreFlow))
    .map(decision => decision.id)
  const pendingBridgeDecisionsByAdminRoute = tailorkitProductPersonalizerCopiedRouteHostContract.routeIds
    .map(routeId => ({
      routeId,
      decisionIds: tailorkitAuthenticatedFetchBridgeDecisions
        .filter(
          decision =>
            decision.status === 'pending-source-mapped-adapter' && decision.adminRouteIds.includes(routeId)
        )
        .map(decision => decision.id),
    }))
    .filter(entry => entry.decisionIds.length > 0)

  for (const decisionId of blockingPendingBridgeDecisionIds) {
    blockers.push({
      id: `authenticated-fetch-pending:${decisionId}`,
      source: 'authenticated-fetch-bridge',
      reason: 'Copied TailorKit authenticatedFetch surface is not mapped to a PageFly port adapter.',
    })
  }
  for (const entry of pendingBridgeDecisionsByAdminRoute) {
    const blockingDecisionIds = entry.decisionIds.filter(decisionId =>
      blockingPendingBridgeDecisionIds.includes(decisionId)
    )
    if (blockingDecisionIds.length === 0) continue

    blockers.push({
      id: `admin-route-authenticated-fetch-pending:${entry.routeId}`,
      source: 'authenticated-fetch-bridge',
      reason: `Copied route still has pending authenticatedFetch decisions: ${blockingDecisionIds.join(', ')}.`,
    })
  }

  const failClosedPageFlyRoutes = tailorkitPageFlyApiRouteBridgeDecisions
    .filter(decision => decision.status === 'fail-closed-provisional-host-adapter')
    .map(decision => `${decision.method} ${decision.path}`)
  const deferredDecisionIds = new Set(deferredPendingBridgeDecisionIds)
  const deferredFailClosedPageFlyRoutes = tailorkitPageFlyApiRouteBridgeDecisions
    .filter(
      decision =>
        decision.status === 'fail-closed-provisional-host-adapter'
        && decision.sourceDecisionIds.every(sourceDecisionId => deferredDecisionIds.has(sourceDecisionId))
    )
    .map(decision => `${decision.method} ${decision.path}`)

  for (const route of failClosedPageFlyRoutes.filter(route => !deferredFailClosedPageFlyRoutes.includes(route))) {
    blockers.push({
      id: `pagefly-api-fail-closed:${route}`,
      source: 'pagefly-api-bridge',
      reason: 'PageFly API route is intentionally fail-closed until copied TailorKit route host owns the flow.',
    })
  }

  const mappedCoreFlowIds = tailorkitProductPersonalizerV01CoreFlows
    .filter(flow => flow.status === 'route-hosted' || flow.status === 'bridge-mapped-pending-route-host')
    .map(flow => flow.id)
  const pendingCoreFlowIds = tailorkitProductPersonalizerV01CoreFlows
    .filter(flow => flow.status === 'blocked-pending-source-mapped-adapter')
    .map(flow => flow.id)
  const deferredCoreFlowIdsList = tailorkitProductPersonalizerV01CoreFlows
    .filter(flow => flow.status === 'deferred-pending-source-mapped-adapter')
    .map(flow => flow.id)

  for (const flowId of pendingCoreFlowIds) {
    blockers.push({
      id: `v0-core-flow-pending:${flowId}`,
      source: 'v0-core-flow',
      reason: 'V0.1 core flow still depends on a pending source-mapped adapter or fail-closed PageFly API route.',
    })
  }

  return {
    status: blockers.length ? 'blocked' : 'ready',
    canActivateRuntime: blockers.length === 0,
    blockers,
    adminRouteIds: routeHostAdminRouteIds,
    deferredAdminRouteIds,
    mappedBridgeDecisionIds,
    pendingBridgeDecisionIds,
    blockingPendingBridgeDecisionIds,
    deferredPendingBridgeDecisionIds,
    pendingBridgeDecisionsByAdminRoute,
    failClosedPageFlyRoutes,
    deferredFailClosedPageFlyRoutes,
    mappedCoreFlowIds,
    pendingCoreFlowIds,
    deferredCoreFlowIds: deferredCoreFlowIdsList,
  }
}

/** Fails closed before any future host can execute copied TailorKit admin routes. */
export function assertTailorKitProductPersonalizerRouteHostCanActivate(): TailorKitRouteHostReadiness {
  const readiness = getTailorKitProductPersonalizerRouteHostReadiness()

  if (!readiness.canActivateRuntime) {
    throw new TailorKitRouteHostActivationError(readiness)
  }

  return readiness
}
