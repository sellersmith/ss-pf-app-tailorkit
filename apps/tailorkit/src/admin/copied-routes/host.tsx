import { Banner, BlockStack, Text } from '@shopify/polaris'
import React from 'react'
import type { AdminAppHost } from '../../../../../web/core/src/app-platform/admin'
import {
  createTailorKitProductEditorRootLoaderData,
  type TailorKitProductEditorRootAppConfig,
} from '../../domain/product-editor-loader-adapter'
import { mapTailorKitProductPersonalizerPathToPageFlyPath } from '../../domain/product-personalizer-create-flow-navigation'
import { inspectTailorKitAdminRouteHost } from '../route-host-inspection'
import { TailorKitCopiedRouteLoading } from './runtime-loading'
import { loadTailorKitCopiedRouteRuntime } from './runtime-loader'

interface TailorKitCopiedRouteHostProps {
  host: AdminAppHost
}

interface TailorKitThemeConfigResponse {
  success: true
  appConfig: Partial<TailorKitProductEditorRootAppConfig>
}

function createTailorKitAppAssetBaseUrl(host: AdminAppHost) {
  const markerPath = '__tailorkit_asset_base__.json'
  const markerUrl = host.ports.assets.resolveAppAssetUrl(markerPath)
  return markerUrl.slice(0, -markerPath.length)
}

function createRootLoaderData(host: AdminAppHost, appConfig?: Partial<TailorKitProductEditorRootAppConfig>) {
  return createTailorKitProductEditorRootLoaderData({
    shopDomain: host.shop.identity.shopDomain,
    currency: host.shop.localization.currency,
    locale: host.shop.localization.locale,
    timezone: host.shop.localization.timezone,
    appHandle: host.shopify.appHandle,
    baseUrl: createTailorKitAppAssetBaseUrl(host),
    planName: host.shop.plan.planName,
    planTier: host.shop.plan.tier,
    subscriptionGeneration: host.subscription.subscriptionGeneration,
    appConfig,
  })
}

function summarizeRouteHostBlockers(routeHost: ReturnType<typeof inspectTailorKitAdminRouteHost>) {
  return routeHost.readiness.blockers.map(blocker => blocker.id).join(', ')
}

// Theme-config is shop-level and route-independent, yet the copied list clientLoader reads it at mount.
// Cache the promise per shop so route-module switches (list <-> editor) and the brief remount window
// reuse one fetch instead of re-hitting the multi-call Shopify theme probe every time.
const themeConfigByShop = new Map<string, Promise<Partial<TailorKitProductEditorRootAppConfig> | undefined>>()

function loadTailorKitThemeConfigOnce(host: AdminAppHost) {
  const key = host.shop.identity.shopDomain || host.appId
  let cached = themeConfigByShop.get(key)
  if (!cached) {
    cached = host.api
      .get<TailorKitThemeConfigResponse>('/theme-config')
      .then(response => response.appConfig)
      .catch(() => undefined)
    themeConfigByShop.set(key, cached)
  }
  return cached
}

// Identity of the copied route MODULE being rendered (list vs a specific product editor). The runtime
// owns its own in-memory route after mount and pushes URL changes back to PageFly; remounting on every
// PageFly URL change re-imports the runtime + refetches theme-config for navigations the runtime already
// applied. Keying the load effect on module identity (not host identity) breaks that feedback loop.
function routeModuleKey(routeHost: ReturnType<typeof inspectTailorKitAdminRouteHost>): string | null {
  if (!routeHost.routeTarget || !routeHost.canActivateRuntime || !routeHost.executionPlan) return null
  const { routeId, params } = routeHost.executionPlan.route
  return `${routeId}:${params?.id ?? ''}`
}

/** Hosts copied TailorKit Remix route modules through PageFly app-platform assets and ports. */
export const TailorKitCopiedRouteHost: React.FC<TailorKitCopiedRouteHostProps> = ({ host }) => {
  const targetRef = React.useRef<HTMLDivElement | null>(null)
  const hostRef = React.useRef(host)
  hostRef.current = host
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const routeHost = React.useMemo(() => inspectTailorKitAdminRouteHost(host), [host.route.fullPath])
  const moduleKey = routeModuleKey(routeHost)

  React.useEffect(() => {
    if (!targetRef.current || !moduleKey) {
      setLoading(false)
      return undefined
    }

    let cancelled = false
    let cleanup: (() => void) | undefined
    setLoading(true)
    setError(null)

    async function loadCopiedRoute() {
      const activeHost = hostRef.current
      const appConfig = await loadTailorKitThemeConfigOnce(activeHost)
      const rootLoaderData = createRootLoaderData(activeHost, appConfig)
      const { runtimePlan, runtimeModule } = await loadTailorKitCopiedRouteRuntime(activeHost)

      if (cancelled || !targetRef.current || !runtimePlan.executionPlan) return
      const handle = runtimeModule.renderTailorKitCopiedRoute(targetRef.current, {
        apiClient: activeHost.api,
        executionPlan: runtimePlan.executionPlan,
        notifications: activeHost.ports.notifications,
        rootLoaderData,
        routeState: activeHost.route.state,
        onNavigate(path, options) {
          const nextPath = mapTailorKitProductPersonalizerPathToPageFlyPath(hostRef.current.routeBase, path)
          hostRef.current.ports.navigation.navigate(nextPath, options)
        },
      })
      cleanup = handle.unmount
    }

    void loadCopiedRoute()
      .catch(loadError => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Cannot load TailorKit copied route runtime')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [moduleKey])

  if (!routeHost.routeTarget) {
    return (
      <Banner tone="warning" title="TailorKit route is not mapped">
        <Text as="p">Current PageFly route does not map to a copied TailorKit Product Personalizer route.</Text>
      </Banner>
    )
  }

  if (!routeHost.canActivateRuntime) {
    const blockers = summarizeRouteHostBlockers(routeHost)

    return (
      <Banner tone="critical" title="TailorKit route host is not ready">
        <Text as="p">{blockers || 'Copied TailorKit route runtime is blocked by an unknown host guard.'}</Text>
      </Banner>
    )
  }

  return (
    <BlockStack gap="400">
      {error ? (
        <Banner tone="critical" title="Cannot load TailorKit route">
          <Text as="p">{error}</Text>
        </Banner>
      ) : null}
      {loading ? <TailorKitCopiedRouteLoading label="Loading TailorKit Product Personalizer" /> : null}
      <div ref={targetRef} />
    </BlockStack>
  )
}
