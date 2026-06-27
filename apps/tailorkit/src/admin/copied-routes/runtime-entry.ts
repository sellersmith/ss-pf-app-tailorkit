import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AppProvider as PolarisAppProvider } from '@shopify/polaris'
import polarisTranslations from '@shopify/polaris/locales/en.json'
import type { i18n as I18nInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import type { AppApiClient } from '../../../../../web/core/src/app-platform/admin'
import type { TailorKitProductEditorRootLoaderData } from '../../domain/product-editor-loader-adapter'
import type { TailorKitCopiedRouteExecutionPlan } from '../../domain/product-personalizer-copied-route-execution-plan'
import type { TailorKitCopiedRouteId } from '../../domain/copied-route-id'
import { bindPageFlyAuthenticatedFetch, bindPageFlyRawFetch } from '../product-editor-island/pagefly-authenticated-fetch-shim'
import { TailorKitProductEditorLoaderProvider } from '../product-editor-island/pagefly-product-editor-loader-context'
import { bindPageFlyToastNotifications } from '../product-editor-island/pagefly-toast-events-shim'
import { TailorKitCopiedRouteLoading } from './runtime-loading'
import { ensureTailorKitCopiedRouteI18n } from './tailorkit-copied-route-i18n'

export interface TailorKitCopiedRouteRuntimeModule {
  default?: unknown
  clientLoader?: unknown
  links?: unknown
  shouldRevalidate?: unknown
  HydrateFallback?: unknown
}

export type TailorKitCopiedRouteRuntimeLoader = () => Promise<TailorKitCopiedRouteRuntimeModule>

export const tailorkitCopiedRouteRuntimeLoaders = {
  'personalized-products._index': () =>
    import('../../../upstream/tailorkit-app/app/routes/personalized-products._index/route'),
  'personalized-products.$id': () =>
    import('../../../upstream/tailorkit-app/app/routes/personalized-products.$id/route'),
  'personalized-products.loading': () =>
    import('../../../upstream/tailorkit-app/app/routes/personalized-products.loading/route'),
  'orders._index': () => import('../../../upstream/tailorkit-app/app/routes/orders._index/route'),
  'orders.$id': () => import('../../../upstream/tailorkit-app/app/routes/orders.$id/route'),
  // Single-shell: the loaded module is a PageFly shell (not an upstream route) that owns the Sales Tools
  // tab layout + pathname-switches the 3 verbatim tab bodies. See storefront-setup-admin-route-host-contract.
  'storefront-setup': () => import('./storefront-setup-shell'),
} satisfies Record<TailorKitCopiedRouteId, TailorKitCopiedRouteRuntimeLoader>

export function loadTailorKitCopiedRouteRuntimeModule(
  routeId: TailorKitCopiedRouteId
): Promise<TailorKitCopiedRouteRuntimeModule> {
  return tailorkitCopiedRouteRuntimeLoaders[routeId]()
}

export interface TailorKitCopiedRouteRuntimeProps {
  apiClient: AppApiClient
  executionPlan: TailorKitCopiedRouteExecutionPlan
  notifications?: {
    show(message: string, tone?: 'success' | 'critical' | 'info'): void
  }
  rootLoaderData?: TailorKitProductEditorRootLoaderData
  routeState?: unknown
  onNavigate?(path: string, options?: { replace?: boolean; state?: unknown }): void
}

export interface TailorKitCopiedRouteRuntimeHandle {
  unmount(): void
}

type TailorKitCopiedRouteComponent = React.ComponentType<Record<string, never>>

type TailorKitWindowWithPublicEnv = typeof window & {
  PUBLIC_ENV?: Record<string, unknown>
}

function hasObjectShape(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function withRootLoaderData(loaderData: unknown, rootLoaderData?: TailorKitProductEditorRootLoaderData) {
  const base = hasObjectShape(loaderData) ? loaderData : {}
  return rootLoaderData ? { ...base, rootLoaderData } : base
}

/**
 * Copied TailorKit modules read `window.PUBLIC_ENV` directly in a few admin paths.
 * Hydrate it before importing the upstream route so copied code runs without edits.
 */
function syncRootLoaderPublicEnv(rootLoaderData?: TailorKitProductEditorRootLoaderData) {
  if (typeof window === 'undefined' || !rootLoaderData?.PUBLIC_ENV) return () => undefined

  const targetWindow = window as TailorKitWindowWithPublicEnv
  const previousPublicEnv = targetWindow.PUBLIC_ENV
  targetWindow.PUBLIC_ENV = {
    ...(previousPublicEnv ?? {}),
    ...rootLoaderData.PUBLIC_ENV,
  }

  return () => {
    if (previousPublicEnv) {
      targetWindow.PUBLIC_ENV = previousPublicEnv
      return
    }

    delete targetWindow.PUBLIC_ENV
  }
}

function routeSnapshotFor(executionPlan: TailorKitCopiedRouteExecutionPlan, routeState?: unknown) {
  const requestUrl = new URL(executionPlan.clientLoaderArgs.request.url)
  const fullPath = `${executionPlan.route.tailorkitPathname}${requestUrl.search}${requestUrl.hash}`

  return {
    pathname: executionPlan.route.tailorkitPathname,
    search: requestUrl.search,
    hash: requestUrl.hash,
    fullPath,
    state: routeState ?? null,
    params: executionPlan.route.params,
  }
}

function localeFromRootLoaderData(rootLoaderData?: TailorKitProductEditorRootLoaderData) {
  return rootLoaderData?.shopData.shopConfig.locale
}

function renderTailorKitCopiedRouteLoading() {
  return React.createElement(
    PolarisAppProvider,
    { i18n: polarisTranslations },
    React.createElement(TailorKitCopiedRouteLoading)
  )
}

function TailorKitCopiedRouteRuntime({
  apiClient,
  executionPlan,
  notifications,
  rootLoaderData,
  routeState,
  onNavigate,
}: TailorKitCopiedRouteRuntimeProps) {
  const [RouteComponent, setRouteComponent] = React.useState<TailorKitCopiedRouteComponent | null>(null)
  const [loaderData, setLoaderData] = React.useState<Record<string, unknown> | null>(null)
  const [i18n, setI18n] = React.useState<I18nInstance | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    bindPageFlyAuthenticatedFetch(apiClient)
    bindPageFlyRawFetch(apiClient)
    bindPageFlyToastNotifications(notifications ?? null)
    const restorePublicEnv = syncRootLoaderPublicEnv(rootLoaderData)
    setRouteComponent(null)
    setLoaderData(null)
    setI18n(null)
    setLoadError(null)

    async function loadRoute() {
      const copiedRouteI18n = await ensureTailorKitCopiedRouteI18n(localeFromRootLoaderData(rootLoaderData))
      const routeModule = await loadTailorKitCopiedRouteRuntimeModule(executionPlan.route.routeId)
      const component = routeModule.default

      if (typeof component !== 'function') {
        throw new Error(`TailorKit copied route has no default component: ${executionPlan.route.routeId}`)
      }

      const rawLoaderData =
        typeof routeModule.clientLoader === 'function'
          ? await routeModule.clientLoader(executionPlan.clientLoaderArgs)
          : {}

      if (cancelled) return
      setLoaderData(withRootLoaderData(rawLoaderData, rootLoaderData))
      setRouteComponent(() => component as TailorKitCopiedRouteComponent)
      setI18n(copiedRouteI18n)
    }

    void loadRoute().catch(error => {
      if (!cancelled) {
        setLoadError(error instanceof Error ? error.message : 'Cannot load TailorKit copied route')
      }
    })

    return () => {
      cancelled = true
      restorePublicEnv()
      bindPageFlyAuthenticatedFetch(null)
      bindPageFlyRawFetch(null)
      bindPageFlyToastNotifications(null)
    }
  }, [apiClient, executionPlan, notifications, rootLoaderData])

  if (loadError) return React.createElement('div', { role: 'alert' }, loadError)
  if (!RouteComponent || !loaderData || !i18n) return renderTailorKitCopiedRouteLoading()

  return React.createElement(
    PolarisAppProvider,
    { i18n: polarisTranslations },
    React.createElement(
      I18nextProvider,
      { i18n },
      React.createElement(
        TailorKitProductEditorLoaderProvider,
        {
          loaderData,
          route: routeSnapshotFor(executionPlan, routeState),
          onNavigate,
        },
        React.createElement(RouteComponent)
      )
    )
  )
}

export function renderTailorKitCopiedRoute(
  target: HTMLElement,
  props: TailorKitCopiedRouteRuntimeProps
): TailorKitCopiedRouteRuntimeHandle {
  let root: Root | null = createRoot(target)
  root.render(React.createElement(TailorKitCopiedRouteRuntime, props))

  return {
    unmount() {
      root?.unmount()
      root = null
      bindPageFlyAuthenticatedFetch(null)
      bindPageFlyRawFetch(null)
      bindPageFlyToastNotifications(null)
    },
  }
}

declare global {
  interface Window {
    PageFlyTailorKitCopiedRoutes?: {
      render: typeof renderTailorKitCopiedRoute
    }
  }
}

if (typeof window !== 'undefined') {
  window.PageFlyTailorKitCopiedRoutes = {
    render: renderTailorKitCopiedRoute,
  }
}
