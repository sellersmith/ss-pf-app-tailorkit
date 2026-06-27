import {
  tailorkitPageFlyApiRouteBridgeDecisions,
  type TailorKitPageFlyApiRouteBridgeDecision,
} from './product-personalizer-authenticated-fetch-bridge-contract'

export interface TailorKitResolvedPageFlyApiRouteBridge {
  decision: TailorKitPageFlyApiRouteBridgeDecision
  params: Readonly<Record<string, string>>
  normalizedPath: string
}

function normalizePath(input: string) {
  const pathname = input.match(/^https?:\/\//) ? new URL(input).pathname : input.split(/[?#]/)[0] || '/'
  return (pathname.startsWith('/') ? pathname : `/${pathname}`).replace(/\/+$/, '') || '/'
}

function matchPattern(pattern: string, path: string): Readonly<Record<string, string>> | null {
  const patternParts = normalizePath(pattern).split('/').filter(Boolean)
  const pathParts = normalizePath(path).split('/').filter(Boolean)

  if (patternParts.length !== pathParts.length) return null

  return patternParts.reduce<Record<string, string> | null>((params, patternPart, index) => {
    if (!params) return null

    const pathPart = pathParts[index]
    if (patternPart.startsWith(':')) {
      params[patternPart.slice(1)] = decodeURIComponent(pathPart)
      return params
    }

    return patternPart === pathPart ? params : null
  }, {})
}

/**
 * Resolves PageFly app API paths back to the TailorKit source-mapped bridge decision.
 * It does not execute handlers; route-host runtime must use this before enabling copied routes.
 */
export function resolveTailorKitPageFlyApiRouteBridge(
  method: string,
  path: string
): TailorKitResolvedPageFlyApiRouteBridge | null {
  const normalizedMethod = method.toUpperCase()
  const normalizedPath = normalizePath(path)

  for (const decision of tailorkitPageFlyApiRouteBridgeDecisions) {
    if (decision.method !== normalizedMethod) continue

    const params = matchPattern(decision.path, normalizedPath)
    if (!params) continue

    return { decision, params, normalizedPath }
  }

  return null
}
