import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_CLIPARTS_PAGINATION, fetchCliparts } from '../utilities/fetchCliparts'
import unionBy from 'lodash/unionBy'
import type { TEMPLATE_TYPE } from '~/routes/api.templates/constants'

interface IClipartsProps {
  queryString: string
  clipartSource: TEMPLATE_TYPE[]
  categories?: string[]
  forceFetch?: boolean
  sortBy?: string
}

// Type for clipart items (based on Template model)
type Clipart = Record<string, any> & { _id: string }

interface PaginationState {
  page: number
  total: number
  pages: number
}

/**
 * Hook to fetch cliparts list with pagination support
 *
 * Provides automatic fetching, caching, and pagination for cliparts.
 * Handles category switching and search query changes efficiently.
 */
export const useCliparts = ({
  queryString,
  clipartSource,
  categories = [],
  forceFetch = true,
  sortBy = 'clicks',
}: IClipartsProps) => {
  const [clipartsList, setClipartsList] = useState<Clipart[]>([])
  const [isFetchNextPage, setIsFetchNextPage] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [pagination, setPagination] = useState<PaginationState>(DEFAULT_CLIPARTS_PAGINATION)

  // Track previous categories to detect tab changes (avoid expensive JSON.stringify)
  const prevCategoriesRef = useRef<string[]>(categories)
  const abortControllerRef = useRef<AbortController | null>(null)

  /**
   * Compare arrays efficiently without JSON.stringify
   */
  const arraysEqual = (a: string[], b: string[]): boolean => {
    if (a.length !== b.length) return false
    return a.every((value, index) => value === b[index])
  }

  /**
   * Fetch cliparts list for a specific page
   */
  const handleFetchCliparts = useCallback(
    async (page: number, refetch = false): Promise<void> => {
      try {
        const { cliparts, pagination: paginationRes } = await fetchCliparts({
          queryString,
          page,
          clipartSource,
          categories,
          sortBy: sortBy as 'createdAt' | 'name' | 'clicks',
        })
        const pages = Math.ceil(paginationRes.total / DEFAULT_CLIPARTS_PAGINATION.limit)

        if (cliparts) {
          setClipartsList(prev => (refetch ? cliparts : unionBy([...prev, ...cliparts], '_id')))
          setPagination({ ...paginationRes, pages })
        }
      } catch (error) {
        console.error('[useCliparts] Failed to fetch cliparts:', error)
        // Reset to default pagination on error
        if (refetch) {
          setClipartsList([])
          setPagination(DEFAULT_CLIPARTS_PAGINATION)
        }
      }
    },
    [categories, clipartSource, queryString, sortBy]
  )

  // Main effect for fetching cliparts when dependencies change
  useEffect(() => {
    if (!forceFetch) {
      return
    }

    // Abort any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    // Check if categories changed (tab switch)
    const categoriesChanged = !arraysEqual(prevCategoriesRef.current, categories)

    // Clear list immediately when switching tabs
    if (categoriesChanged) {
      setClipartsList([])
      prevCategoriesRef.current = categories
    }

    setIsFetching(true)

    // Fetch first page
    const fetchData = async () => {
      try {
        await handleFetchCliparts(1, true)
      } catch (error) {
        // Only log error if not aborted
        if (!abortControllerRef.current?.signal.aborted) {
          console.error('[useCliparts] Failed to fetch cliparts:', error)
        }
      } finally {
        // Only update loading state if not aborted
        if (!abortControllerRef.current?.signal.aborted) {
          setIsFetching(false)
        }
      }
    }

    fetchData()

    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [categories, clipartSource, queryString, sortBy, handleFetchCliparts, forceFetch])

  /**
   * Fetch the next page of cliparts
   */
  const fetchNextPage = useCallback(async () => {
    const nextPage = pagination.page + 1

    // Check if there are more pages
    if (nextPage > pagination.pages) {
      return
    }

    setIsFetchNextPage(true)

    try {
      await handleFetchCliparts(nextPage, false)
    } catch (error) {
      console.error('[useCliparts] Failed to fetch next page of cliparts:', error)
    } finally {
      setIsFetchNextPage(false)
    }
  }, [handleFetchCliparts, pagination.page, pagination.pages])

  return {
    clipartsList,
    isFetching,
    isFetchNextPage,
    fetchNextPage,
  }
}
