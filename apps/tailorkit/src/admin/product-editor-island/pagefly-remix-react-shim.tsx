import React from 'react'
import {
  useTailorKitProductEditorLoaderData,
  useTailorKitProductEditorRouteContext,
} from './pagefly-product-editor-loader-context'
import { mapTailorKitCreateFlowNavigationTarget } from '../../domain/product-personalizer-create-flow-navigation'

export interface ClientLoaderFunctionArgs {
  params: Readonly<Record<string, string>>
  request: Request
}

export interface ShouldRevalidateFunctionArgs {
  currentUrl: URL
  nextUrl: URL
}
type SearchParamsInit = string | URLSearchParams | string[][] | Record<string, string>
type SearchParamsSetter = (
  nextInit: SearchParamsInit | ((previous: URLSearchParams) => SearchParamsInit),
  options?: { replace?: boolean; state?: unknown }
) => void
type LinkTarget = string | { pathname?: string; search?: string; hash?: string }

const LOCATION_CHANGE_EVENT = 'tailorkit-pagefly-locationchange'

function locationSnapshot() {
  if (typeof window === 'undefined') return ''
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

function subscribeToLocationChanges(onChange: () => void) {
  if (typeof window === 'undefined') return () => undefined

  window.addEventListener('popstate', onChange)
  window.addEventListener(LOCATION_CHANGE_EVENT, onChange)

  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(LOCATION_CHANGE_EVENT, onChange)
  }
}

function notifyLocationChange() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT))
}

function toSearchParams(init: SearchParamsInit): URLSearchParams {
  return new URLSearchParams(init)
}

function fillMissingParam(params: URLSearchParams, key: string, value?: string) {
  if (value && !params.has(key)) params.set(key, value)
}

function useLocationSnapshot() {
  return React.useSyncExternalStore(subscribeToLocationChanges, locationSnapshot, () => '')
}

function fallbackWindowLocation() {
  if (typeof window === 'undefined') {
    return { pathname: '/', search: '', hash: '', state: null, key: 'pagefly-product-editor' }
  }

  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    state: window.history.state ?? null,
    key: window.history.state?.key ?? 'pagefly-product-editor',
  }
}

function linkTargetToHref(to: LinkTarget) {
  if (typeof to === 'string') return to

  return `${to.pathname ?? ''}${to.search ?? ''}${to.hash ?? ''}` || '#'
}

function isModifiedEvent(event: React.MouseEvent<HTMLAnchorElement>) {
  return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey
}

function isExternalHref(href: string) {
  return /^[a-z][a-z\d+\-.]*:\/\//i.test(href) || href.startsWith('//')
}

export function Link({
  to,
  children,
  onClick,
  target,
  download,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: LinkTarget; children?: React.ReactNode }) {
  const navigate = useNavigate()
  const href = linkTargetToHref(to)

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event)
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        isModifiedEvent(event) ||
        target ||
        download ||
        isExternalHref(href)
      ) {
        return
      }

      event.preventDefault()
      navigate(href)
    },
    [download, href, navigate, onClick, target]
  )

  return (
    <a href={href} target={target} download={download} onClick={handleClick} {...props}>
      {children}
    </a>
  )
}

export function useLoaderData<T = unknown>(): T {
  const loaderData = useTailorKitProductEditorLoaderData()

  if (!loaderData) {
    throw new Error('TailorKit ProductEditor loader data is unavailable in the PageFly island host')
  }

  return loaderData as T
}

export function useRouteLoaderData<T = unknown>(routeId?: string): T | undefined {
  const loaderData = useTailorKitProductEditorLoaderData()

  if (routeId === 'root') return loaderData?.rootLoaderData as T | undefined

  return undefined
}

export function useParams() {
  const loaderData = useTailorKitProductEditorLoaderData()
  const { route } = useTailorKitProductEditorRouteContext()

  if (route?.params) return route.params
  if (!loaderData?.id) return {}

  return {
    id: loaderData.id,
  }
}

export function useLocation() {
  const { route } = useTailorKitProductEditorRouteContext()
  useLocationSnapshot()

  if (route) {
    return {
      pathname: route.pathname,
      search: route.search,
      hash: route.hash,
      state: route.state ?? null,
      key: 'pagefly-product-editor',
    }
  }

  return fallbackWindowLocation()
}

export function useNavigate() {
  const routeContext = useTailorKitProductEditorRouteContext()

  return React.useCallback((to: string | number, options?: { replace?: boolean; state?: unknown }) => {
    if (typeof to === 'number') {
      if (typeof window !== 'undefined') window.history.go(to)
      return
    }

    const mappedTo = mapTailorKitCreateFlowNavigationTarget(to)

    if (routeContext.route) {
      routeContext.navigate(mappedTo, options)
      return
    }

    if (typeof window === 'undefined') return

    const nextUrl = new URL(mappedTo, window.location.href)
    const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
    const state = options?.state ?? window.history.state

    if (options?.replace) {
      window.history.replaceState(state, '', nextPath)
    } else {
      window.history.pushState(state, '', nextPath)
    }

    notifyLocationChange()
  }, [routeContext])
}

export function useSearchParams() {
  const loaderData = useTailorKitProductEditorLoaderData()
  const routeContext = useTailorKitProductEditorRouteContext()
  const snapshot = useLocationSnapshot()

  const params = React.useMemo(() => {
    const fallbackSearch = typeof window === 'undefined' ? '' : window.location.search
    const next = new URLSearchParams(routeContext.route?.search ?? fallbackSearch)

    fillMissingParam(next, 'tab', loaderData?.tab)
    fillMissingParam(next, 'mockup', loaderData?.mockupId)
    fillMissingParam(next, 'printAreaId', loaderData?.printAreaId)
    fillMissingParam(next, 'templateId', loaderData?.templateId)
    fillMissingParam(next, 'viewId', loaderData?.viewId)

    return next
  }, [loaderData, routeContext.route?.search, snapshot])

  const setSearchParams = React.useCallback<SearchParamsSetter>((nextInit, options) => {
    const current = new URLSearchParams(routeContext.route?.search ?? (typeof window === 'undefined' ? '' : window.location.search))
    const next =
      typeof nextInit === 'function' ? toSearchParams(nextInit(new URLSearchParams(current))) : toSearchParams(nextInit)
    const query = next.toString()
    const location = routeContext.route ?? fallbackWindowLocation()
    const nextPath = `${location.pathname}${query ? `?${query}` : ''}${location.hash}`

    if (routeContext.route) {
      routeContext.navigate(nextPath, options)
      return
    }

    if (typeof window === 'undefined') return

    const state = options?.state ?? window.history.state

    if (options?.replace) {
      window.history.replaceState(state, '', nextPath)
    } else {
      window.history.pushState(state, '', nextPath)
    }

    notifyLocationChange()
  }, [routeContext])

  return [params, setSearchParams] as const
}

export function useNavigation() {
  return { state: 'idle' as const, location: undefined, formData: undefined }
}

export function useRevalidator() {
  return { state: 'idle' as const, revalidate: () => undefined }
}

export function useRouteError() {
  return undefined
}

export function isRouteErrorResponse() {
  return false
}

export function Outlet() {
  return null
}

export function useFetcher<T = unknown>() {
  const fail = () => {
    throw new Error('TailorKit Remix useFetcher action is not adapted in the PageFly ProductEditor island yet')
  }

  return {
    state: 'idle' as const,
    data: undefined as T | undefined,
    formData: undefined,
    Form: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    load: fail,
    submit: fail,
  }
}
