/**
 * usePaginatedProducts — reusable cursor-based pagination hook.
 *
 * Manages cursor stack for prev/next page navigation and reports
 * pagination state to a parent via callback. Shared by ProductGrid
 * and ProductList.
 */

import { useCallback, useEffect, useRef } from 'react'

export interface PaginationState {
  hasNext: boolean
  hasPrevious: boolean
  onNext: () => void
  onPrevious: () => void
}

export interface UsePaginatedProductsOptions {
  /** Current "hasMore" cursor returned by the API (falsy = no next page) */
  hasMore: string | undefined
  /** Whether pagination mode is active */
  paginationMode: boolean
  /** Fetch a page by cursor (undefined = first page) */
  fetchPage: (cursor: string | undefined) => void
  /** Callback to report pagination state to the parent component */
  onPaginationChange?: (pagination: PaginationState) => void
}

export function usePaginatedProducts({
  hasMore,
  paginationMode,
  fetchPage,
  onPaginationChange,
}: UsePaginatedProductsOptions) {
  const cursorStackRef = useRef<string[]>([])
  const onPaginationChangeRef = useRef(onPaginationChange)
  onPaginationChangeRef.current = onPaginationChange

  /** Reset cursor history (call after new search/filter) */
  const resetCursorStack = useCallback(() => {
    cursorStackRef.current = []
  }, [])

  const handleNextPage = useCallback(() => {
    if (!hasMore) return
    cursorStackRef.current = [...cursorStackRef.current, hasMore]
    fetchPage(hasMore)
  }, [hasMore, fetchPage])

  const handlePreviousPage = useCallback(() => {
    const stack = cursorStackRef.current
    if (stack.length === 0) return
    const newStack = stack.slice(0, -1)
    cursorStackRef.current = newStack
    fetchPage(newStack[newStack.length - 1])
  }, [fetchPage])

  // Report pagination state to parent.
  // `isReportingActive` toggles when the parent passes `onPaginationChange` as
  // undefined (e.g. the consumer renders both ProductGrid and ProductList in
  // parallel and switches the callback to whichever view is active). Including
  // it in deps ensures the new active view re-fires its current state when the
  // parent toggles in — without it, switching views leaves the parent reading
  // stale pagination controls from the previously-active view.
  const isReportingActive = paginationMode && Boolean(onPaginationChange)
  useEffect(() => {
    if (isReportingActive && onPaginationChangeRef.current) {
      onPaginationChangeRef.current({
        hasNext: Boolean(hasMore),
        hasPrevious: cursorStackRef.current.length > 0,
        onNext: handleNextPage,
        onPrevious: handlePreviousPage,
      })
    }
  }, [isReportingActive, hasMore, handleNextPage, handlePreviousPage])

  return {
    cursorStackRef,
    resetCursorStack,
    handleNextPage,
    handlePreviousPage,
  }
}
