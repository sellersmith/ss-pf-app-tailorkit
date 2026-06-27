import { useCallback, useMemo, useState } from 'react'

interface PaginationOptions<T> {
  data: T[]
  itemsPerPage: number
  initialPage?: number
}

interface PaginationResult<T> {
  currentPage: number
  totalPages: number
  currentData: T[]
  isFirstPage: boolean
  isLastPage: boolean
  goToPage: (page: number) => void
  nextPage: () => void
  previousPage: () => void
  totalItems: number
}

/**
 * A custom hook for handling pagination logic
 * Time Complexity: O(1) for all operations except slicing which is O(n)
 * Space Complexity: O(n) where n is itemsPerPage
 * @param options PaginationOptions containing data array and configuration
 * @returns PaginationResult with pagination state and controls
 */
export function usePagination<T>({ data, itemsPerPage, initialPage = 1 }: PaginationOptions<T>): PaginationResult<T> {
  // Input validation
  if (itemsPerPage <= 0) {
    throw new Error('itemsPerPage must be greater than 0')
  }

  if (initialPage <= 0) {
    throw new Error('initialPage must be greater than 0')
  }

  // State for current page
  const [currentPage, setCurrentPage] = useState(initialPage)

  // Calculate total pages
  const totalPages = useMemo(() => Math.ceil(data.length / itemsPerPage), [data.length, itemsPerPage])

  // Ensure current page is within bounds when data changes
  useMemo(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages))
    }
  }, [currentPage, totalPages])

  // Get current page data
  const currentData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return data.slice(startIndex, startIndex + itemsPerPage)
  }, [currentPage, data, itemsPerPage])

  // Navigation handlers
  const goToPage = useCallback(
    (page: number) => {
      const targetPage = Math.max(1, Math.min(page, totalPages))
      setCurrentPage(targetPage)
    },
    [totalPages]
  )

  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1)
    }
  }, [currentPage, totalPages])

  const previousPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1)
    }
  }, [currentPage])

  return {
    currentPage,
    totalPages,
    currentData,
    isFirstPage: currentPage === 1,
    isLastPage: currentPage === totalPages,
    goToPage,
    nextPage,
    previousPage,
    totalItems: data.length,
  }
}
