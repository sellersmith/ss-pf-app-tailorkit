import React, { createContext, useContext } from 'react'
import type { TailorKitProductEditorLoaderData } from '../../domain/product-editor-loader-adapter'

const TailorKitProductEditorLoaderContext = createContext<unknown | null>(null)
const TailorKitProductEditorRouteContext = createContext<TailorKitProductEditorRouteContextValue>({
  route: null,
  navigate: () => undefined,
})

type TailorKitWindowWithPublicEnv = typeof window & {
  PUBLIC_ENV?: Record<string, unknown>
}

export interface TailorKitProductEditorRouteSnapshot {
  pathname: string
  search: string
  hash: string
  fullPath: string
  state?: unknown
  params?: Readonly<Record<string, string>>
}

export type TailorKitProductEditorRouteNavigate = (
  path: string,
  options?: { replace?: boolean; state?: unknown }
) => void

export interface TailorKitProductEditorRouteContextValue {
  route: TailorKitProductEditorRouteSnapshot | null
  navigate: TailorKitProductEditorRouteNavigate
}

export interface TailorKitProductEditorLoaderProviderProps {
  loaderData?: TailorKitProductEditorLoaderData | Record<string, unknown> | null
  route?: TailorKitProductEditorRouteSnapshot | null
  onNavigate?: TailorKitProductEditorRouteNavigate
  children: React.ReactNode
}

function toRouteSnapshot(
  path: string,
  previousRoute?: TailorKitProductEditorRouteSnapshot | null,
  state?: unknown
) {
  const basePath = previousRoute?.pathname || '/'
  const url = new URL(path, `https://pagefly.local${basePath}`)

  return {
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    fullPath: `${url.pathname}${url.search}${url.hash}`,
    state: state === undefined ? previousRoute?.state ?? null : state,
    params: previousRoute?.params,
  }
}

function rootLoaderPublicEnv(loaderData?: TailorKitProductEditorLoaderData | Record<string, unknown> | null) {
  const rootLoaderData = loaderData?.rootLoaderData
  if (!rootLoaderData || typeof rootLoaderData !== 'object') return null

  const publicEnv = (rootLoaderData as { PUBLIC_ENV?: unknown }).PUBLIC_ENV
  return publicEnv && typeof publicEnv === 'object' ? (publicEnv as Record<string, unknown>) : null
}

function syncTailorKitPublicEnv(loaderData?: TailorKitProductEditorLoaderData | Record<string, unknown> | null) {
  if (typeof window === 'undefined') return

  const publicEnv = rootLoaderPublicEnv(loaderData)
  if (!publicEnv) return

  const targetWindow = window as TailorKitWindowWithPublicEnv
  targetWindow.PUBLIC_ENV = {
    ...(targetWindow.PUBLIC_ENV ?? {}),
    ...publicEnv,
  }
}

export const TailorKitProductEditorLoaderProvider: React.FC<TailorKitProductEditorLoaderProviderProps> = ({
  loaderData,
  route,
  onNavigate,
  children,
}) => {
  const [routeState, setRouteState] = React.useState<TailorKitProductEditorRouteSnapshot | null>(route ?? null)

  React.useEffect(() => {
    setRouteState(route ?? null)
  }, [route?.fullPath])

  React.useEffect(() => {
    syncTailorKitPublicEnv(loaderData)
  }, [loaderData])

  const routeContext = React.useMemo<TailorKitProductEditorRouteContextValue>(
    () => ({
      route: routeState,
      navigate(path, options) {
        const nextRoute = toRouteSnapshot(path, routeState, options?.state)
        setRouteState(nextRoute)
        onNavigate?.(nextRoute.fullPath, options)
      },
    }),
    [onNavigate, routeState]
  )

  return (
    <TailorKitProductEditorLoaderContext.Provider value={loaderData ?? null}>
      <TailorKitProductEditorRouteContext.Provider value={routeContext}>
        {children}
      </TailorKitProductEditorRouteContext.Provider>
    </TailorKitProductEditorLoaderContext.Provider>
  )
}

export function useTailorKitProductEditorLoaderData<T = TailorKitProductEditorLoaderData>() {
  return useContext(TailorKitProductEditorLoaderContext) as T | null
}

export function useTailorKitProductEditorRouteContext() {
  return useContext(TailorKitProductEditorRouteContext)
}
