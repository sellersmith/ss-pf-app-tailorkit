import { useMemo } from 'react'
import { useLocation } from '@remix-run/react'
// Adapter not needed for route-based detection

/**
 * Hook to detect if the current context is the unified editor
 *
 * Uses the template environment adapter to determine if we're in unified mode.
 * Also checks pathname to ensure we're on the specific editor route (/personalized-products/$id),
 * not the index route (/personalized-products).
 *
 * Computes synchronously on every render - no effects needed since both pathname
 * and adapter state can be checked synchronously.
 *
 * @returns `true` if in unified editor mode, `false` otherwise
 *
 * @example
 * ```tsx
 * const isUnifiedEditor = useIsUnifiedEditor()
 * if (isUnifiedEditor) {
 *   // Hide floating chat buttons
 * }
 * ```
 */
export function useIsUnifiedEditor(): boolean {
  const location = useLocation()

  // Compute synchronously from pathname only
  return useMemo(() => {
    // Only match /personalized-products/{id}, not /personalized-products
    return /^\/personalized-products\/[^/]+/.test(location.pathname)
  }, [location.pathname])
}
