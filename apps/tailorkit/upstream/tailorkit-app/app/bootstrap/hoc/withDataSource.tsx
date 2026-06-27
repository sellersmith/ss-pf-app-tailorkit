import type { ComponentClass, FunctionComponent } from 'react'
import { ITEM_LIST_LIMITATION } from '~/constants'
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { authenticatedFetch } from '~/shopify/fns.client'
import { useIndexResourceState, useSetIndexFiltersMode } from '@shopify/polaris'
import { getFilterParams, prepareFilter } from '../fns/filter/filter.fns'

export type WithDataSourceProps = {
  sort: string[]
  // The data key used for querying items that match a keyword
  queryKey: string
  // The URL for requesting data
  dataSource: string
  // Whether to update page URL when filtering
  updatePageUrl?: boolean
  // And other properties as well
  [key: string]: any
}

export type WithDataSourceChildProps = {
  page: number
  items: any[]
  total: number
  limit?: number
  loading: boolean
  queryKey: string
  firstLoad: boolean
  selectable?: boolean
  showPagination?: number
  sort: string[] | undefined
  defaultResourceKey?: string
  nestedRowKey?: string
  nestedSortKey?: string
  setPage: (page: number) => void
  setSort: (sort: string[]) => void
  filterValues: { queryValue?: string; [key: string]: string | any[] | undefined }
  defaultFilterBy?: { queryValue: string; [key: string]: string | any[] | undefined }
  setFilterValues: (filterValues: { queryValue: string; [key: string]: string | any[] | undefined }) => void
  /**
   * Object returned by calling the function `useSetIndexFiltersMode`
   *
   * @see useSetIndexFiltersMode
   */
  useSetIndexFiltersMode: any
  /**
   * Object returned by calling the function `useIndexResourceState`
   *
   * @see useIndexResourceState
   */
  useIndexResourceState: any
}

const timers: { [key: string]: any } = {}
const aborters: { [key: string]: AbortController } = {}

export default function withDataSource(
  Component: FunctionComponent<WithDataSourceChildProps> | ComponentClass<WithDataSourceChildProps>
) {
  return function WithDataSource(props: WithDataSourceProps) {
    const {
      refresh,
      queryKey,
      dataSource,
      defaultFilterBy,
      defaultResourceKey,
      nestedRowKey,
      nestedSortKey,
      sort: _sort,
      limit: _limit,
      loading: _loading,
      onAfterLoadItems,
      updatePageUrl = true,
      ...otherProps
    } = props

    // Define component state
    const [page, setPage] = useState<number>(1)
    const [total, setTotal] = useState<number>(0)
    const [items, setItems] = useState<any[]>([])
    const [sort, setSort] = useState<string[]>(_sort)
    const [loading, setLoading] = useState<boolean>(true)
    const [firstLoad, setFirstLoad] = useState<boolean>(true)
    const [limit, setLimit] = useState<number>(_limit || ITEM_LIST_LIMITATION)
    const [filterValues, setFilterValues] = useState<{ [key: string]: any }>(defaultFilterBy?.filters || {})

    // Populate initial values from query string
    useLayoutEffect(() => {
      const searchParams = new URLSearchParams(window.location.search)

      if (searchParams.has('page')) {
        setPage(Math.max(1, Number(searchParams.get('page'))))
      }

      if (searchParams.has('sort')) {
        setSort([searchParams.get('sort')!])
      }

      if (searchParams.has('limit')) {
        setLimit(Math.min(ITEM_LIST_LIMITATION, Number(searchParams.get('limit'))))
      }

      // Get filter params
      const filters = getFilterParams(searchParams)

      if (filters.length) {
        const filterValues = filters.reduce((acc: any, filter) => {
          const _filter = prepareFilter(filter)

          const { value } = _filter
          const { field, type, operator } = _filter

          if (field === queryKey) {
            acc.queryValue = value
          } else if (type === 'amount' && operator === 'range') {
            acc[field] = value.split('~')
          } else if (operator === 'any') {
            acc[field] = value.split(',')
          } else {
            acc[field] = value
          }

          return acc
        }, {})

        setFilterValues(filterValues)
      }
    }, [queryKey])

    // Reset page number when filter value changes
    const [lastFilterValues, setLastFilterValues] = useState<{ [key: string]: any }>()

    useLayoutEffect(() => {
      if (lastFilterValues === undefined) {
        setLastFilterValues(filterValues)
      } else if (JSON.stringify(filterValues) !== JSON.stringify(lastFilterValues)) {
        setPage(1)
        setLastFilterValues(filterValues)
      }
    }, [filterValues, lastFilterValues])

    // Define function for fetching data
    const fetchData = useCallback(async () => {
      // Set loading state
      setLoading(true)

      // Prevent sending multiple requests
      abortRequest(dataSource)

      // Schedule requesting data after a timeout
      timers[dataSource] = setTimeout(async () => {
        const { queryValue, ...otherFilters } = filterValues

        // Generate search params
        const searchParams = [`limit=${limit || ITEM_LIST_LIMITATION}`]

        page > 1 && searchParams.push(`page=${page}`)
        sort?.length && searchParams.push(`sort=${sort[0].toString().replace(' ', '__')}`)
        queryValue && searchParams.push(`filter__${queryKey}=string__has__${encodeURIComponent(queryValue)}`)

        for (const filterOnKey in otherFilters) {
          if (otherFilters[filterOnKey] instanceof Array && otherFilters[filterOnKey].length) {
            if (
              otherFilters[filterOnKey].length === 2
              && !isNaN(Number(otherFilters[filterOnKey][0]))
              && !isNaN(Number(otherFilters[filterOnKey][1]))
            ) {
              searchParams.push(`filter__${filterOnKey}=amount__range__${otherFilters[filterOnKey].join('~')}`)
            } else {
              searchParams.push(`filter__${filterOnKey}=${otherFilters[filterOnKey].join(',')}`)
            }
          } else if (typeof otherFilters[filterOnKey] === 'string' && otherFilters[filterOnKey]) {
            searchParams.push(`filter__${filterOnKey}=${otherFilters[filterOnKey]}`)
          }
        }

        // Request data
        const queryString = searchParams.join('&')
        aborters[dataSource] = new AbortController()

        const res = await authenticatedFetch(
          `${dataSource}${queryString ? `${dataSource.includes('?') ? '&' : '?'}${queryString}` : ''}`,
          {
            signal: aborters[dataSource].signal,
          }
        )

        if (res && res.message !== 'aborted') {
          const { items = [], total = 0 } = res

          setItems(items)
          setTotal(total)
          setLoading(false)
          setFirstLoad(false)
          typeof onAfterLoadItems === 'function' && onAfterLoadItems(items)

          // Update URL
          if (updatePageUrl && queryString) {
            history.pushState({}, '', `?${queryString.replace(`limit=${ITEM_LIST_LIMITATION}&`, '')}`)
          }
        }
      }, 100)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataSource, filterValues, limit, page, queryKey, refresh, sort])

    useEffect(() => {
      fetchData()

      return () => abortRequest(dataSource)
    }, [dataSource, fetchData])

    // Implement ability to filter items
    const filters = useSetIndexFiltersMode()

    // Implement ability to select items
    const resourceIDResolver = useCallback(
      (item: any) => (defaultResourceKey ? item[defaultResourceKey] : item.id || item._id),
      [defaultResourceKey]
    )

    // With the table has nested row, we need to add the nested items to the selection, because the checkboxes work on the nested items
    const _items = (
      nestedRowKey
        ? items.reduce((acc, item) => {
            if (Array.isArray(item[nestedRowKey])) {
              const nestedItems = item[nestedRowKey].sort((a, b) => {
                if (nestedSortKey) {
                  return new Date(b[nestedSortKey]).getTime() - new Date(a[nestedSortKey]).getTime()
                }
                return 0
              })
              acc.push(...nestedItems)
            }
            return acc
          }, [])
        : items
    ).flat()

    const selection = useIndexResourceState(_items, { resourceIDResolver })
    return (
      <Component
        {...otherProps}
        page={page}
        sort={sort}
        items={items}
        limit={limit}
        total={total}
        setPage={setPage}
        setSort={setSort}
        queryKey={queryKey}
        firstLoad={firstLoad}
        filterValues={filterValues}
        loading={loading || _loading}
        useIndexResourceState={filters}
        defaultFilterBy={defaultFilterBy}
        setFilterValues={setFilterValues}
        useSetIndexFiltersMode={{ ...selection, allItemsCanSelect: _items }}
      />
    )
  }
}

function abortRequest(dataSource: string) {
  aborters[dataSource] && aborters[dataSource].abort()
  timers[dataSource] && clearTimeout(timers[dataSource])
}
