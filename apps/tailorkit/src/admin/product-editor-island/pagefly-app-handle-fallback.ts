const DEFAULT_APP_HANDLE = 'pagefly'

function cleanAppHandle(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim().replace(/^\/+|\/+$/g, '')
  if (trimmed === 'undefined' || trimmed === 'null') return undefined
  if (!trimmed || !/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/.test(trimmed)) return undefined

  return trimmed
}

function parseAppHandleFromPath(pathname: string): string | undefined {
  const segments = pathname.split('/').filter(Boolean)
  const appsSegmentIndex = segments.indexOf('apps')
  if (appsSegmentIndex < 0) return undefined

  try {
    return cleanAppHandle(decodeURIComponent(segments[appsSegmentIndex + 1] || ''))
  } catch {
    return undefined
  }
}

function parseAppHandleFromUrl(value: string): string | undefined {
  try {
    return parseAppHandleFromPath(new URL(value).pathname)
  } catch {
    return parseAppHandleFromPath(value)
  }
}

export function resolvePageFlyAdminAppHandleFallback(): string {
  if (typeof window === 'undefined') return DEFAULT_APP_HANDLE

  const cachedHandle = cleanAppHandle(window.localStorage?.getItem('app_handle'))
  const referrer = typeof document === 'undefined' ? '' : document.referrer

  return cachedHandle || parseAppHandleFromUrl(window.location.pathname) || parseAppHandleFromUrl(referrer) || DEFAULT_APP_HANDLE
}
