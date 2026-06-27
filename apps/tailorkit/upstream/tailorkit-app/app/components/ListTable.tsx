import type { TFunction } from 'i18next'
import type { IndexFiltersProps, TabProps } from '@shopify/polaris'
import type { NonEmptyArray } from '@shopify/polaris/build/ts/src/types'
import type { WithDataSourceChildProps } from '~/bootstrap/hoc/withDataSource'
import type { ComponentProps, ComponentState, ErrorInfo, ReactNode } from 'react'
import type { BulkActionsProps } from '@shopify/polaris/build/ts/src/components/BulkActions'
import type { IndexTableHeading } from '@shopify/polaris/build/ts/src/components/IndexTable'
import isEmpty from 'lodash/isEmpty'
import isEqual from 'lodash/isEqual'
import withDataSource from '~/bootstrap/hoc/withDataSource'
import BlockLoading from '~/components/loading/BlockLoading'
import React, { PureComponent, useEffect, useRef, useMemo } from 'react'
import { ITEM_LIST_LIMITATION } from '~/constants'
import { authenticatedFetch } from '~/shopify/fns.client'
import { ErrorBoundary } from '~/components/ErrorBoundary'
import { VIEW_ACTIONS } from '~/routes/api.views/constants'
import {
  BlockStack,
  Box,
  Card,
  Divider,
  IndexFilters,
  IndexFiltersMode,
  IndexTable,
  InlineStack,
  Pagination,
} from '@shopify/polaris'

export type ListTableView = {
  name: string
  filters: {
    queryValue: string
    [key: string]: any
  }
  actions?: any[]
  showTabAll?: boolean
}

export type ListTableFilter = {
  key: string
  label: string
  shortcut: boolean
  filter: ReactNode | any
}

export type ListTableProps = WithDataSourceChildProps &
  ComponentProps<any> & {
    t: TFunction
    limit?: number
    condensed?: boolean
    selectable?: boolean
    showBorder?: boolean
    showFilter?: boolean
    emptyState?: ReactNode
    views?: ListTableView[]
    defaultFilterBy?: ListTableView
    showPagination?: boolean
    filters?: ListTableFilter[]
    bulkActions?: BulkActionsProps['actions']
    headings: NonEmptyArray<IndexTableHeading>
    sortOptions?: IndexFiltersProps['sortOptions']
    promotedBulkActions?: BulkActionsProps['promotedActions']
    renderRowMarkup: (item: any, idx: number) => ReactNode
    renderFilterLabel?: (key: string, value: string | any[]) => string
    resourceName?: {
      singular: string
      plural: string
    }
    disabledSelectable?: string[]
    onSelectionChange?: (selectedResources: any[], allResourcesSelected: boolean) => void
    defaultResourceKey?: string
    disableStickyMode?: boolean
  }

export type ListTableState = ComponentState & {
  error?: Error
  selected: number
  views: ListTableView[]
}

export class ListTableComponent<P, S> extends PureComponent<P & ListTableProps, S & ListTableState> {
  state: S & ListTableState = {
    views: [],
    selected: 0,
    queryValue: '',
  }

  static getDerivedStateFromProps(props: ListTableProps, state: ListTableState): ListTableState {
    if (!state.queryValue && props.filterValues?.queryValue) {
      return { ...state, queryValue: props.filterValues.queryValue }
    }

    return state
  }

  constructor(props: P & ListTableProps) {
    super(props)

    const views = props.views || []
    const defaultFilterBy = props.defaultFilterBy || {}

    const selected = views.findIndex((view: any) => view?.id === defaultFilterBy?.id)
    if (selected >= 0) {
      this.state.selected = selected
    }

    if (props.error) {
      this.state.error = props.error
    }

    if (props.filterValues?.queryValue) {
      this.state.queryValue = props.filterValues.queryValue
    }

    // Load saved views
    setTimeout(() => {
      const { views, showTabAll = true } = props

      if (views === undefined) {
        // Fetch saved views
        authenticatedFetch(`/api/views?path=${location.pathname}`).then(({ items }) =>
          this.setState({ views: showTabAll ? [{ name: 'All' }, ...items] : [...items] })
        )
      } else {
        this.setState({ views: showTabAll ? [{ name: 'All' }, ...views] : [...views] })
      }
    }, 200)
  }

  componentDidUpdate(prevProps: Readonly<any>, prevState: Readonly<any>, snapshot?: any): void {
    const { views } = this.state
    const { filterValues } = this.props

    if (!prevState.views?.length && views?.length) {
      views.forEach((view: any, idx: number) => {
        let matched = true

        if (Object.keys(view.filters || {}).length !== Object.keys(filterValues).length) {
          matched = false
        } else {
          for (const p in view.filters) {
            if (typeof view.filters[p] === 'string') {
              if (view.filters[p].toLowerCase() !== filterValues[p]?.toLowerCase()) {
                matched = false
              }
            } else if (view.filters[p] !== filterValues[p]) {
              matched = false
            }
          }
        }

        if (matched) {
          this.setState({ selected: idx })
        }
      })
    }
  }

  render(): ReactNode {
    // Extract props
    const { total, loading, emptyState, filterValues, showBorder = true } = this.props

    // Extract current state
    const { error } = this.state

    // Check if empty state should be shown
    const showEmptyState = !total && !loading && isEmpty(filterValues)

    return error ? (
      <ErrorBoundary error={error} />
    ) : (
      <>
        {showEmptyState && emptyState ? (
          emptyState
        ) : showBorder ? (
          <Card padding="0" roundedAbove="sm">
            {this.renderFilters()}
            {this.renderTable()}
          </Card>
        ) : (
          <BlockStack>
            {this.renderFilters()}
            {this.renderTable()}
          </BlockStack>
        )}
      </>
    )
  }

  renderFilters(): ReactNode {
    // Extract props
    const {
      t,
      sort,
      loading,
      setSort,
      firstLoad,
      sortOptions,
      filterValues,
      showFilter = true,
      showFilterInSearchParams = true,
      useIndexResourceState: { mode, setMode },
      disableStickyMode = false,
    } = this.props

    // Extract current state
    const { selected, queryValue } = this.state

    // Generate filters
    const filters = this.generateFilters()

    // Generate tabs for saved views
    const tabs = this.generateTabsForViews()

    // Generate applied filters.
    const appliedFilters = this.generateAppliedFilters()

    // Generate primary action for filters
    const primaryAction = this.generatePrimaryActionForFilters()

    // Detect filter mode
    const _mode
      = !selected && showFilterInSearchParams && (queryValue || Object.keys(filterValues)?.length > 0)
        ? IndexFiltersMode['Filtering']
        : mode

    return (
      <>
        {showFilter && !firstLoad && (
          <IndexFilters
            canCreateNewView
            tabs={tabs}
            mode={_mode}
            onSort={setSort}
            filters={filters}
            loading={loading}
            setMode={setMode}
            selected={selected}
            sortSelected={sort}
            sortOptions={sortOptions}
            primaryAction={primaryAction}
            appliedFilters={appliedFilters}
            onSelect={this.setSelectedView}
            onQueryClear={this.onQueryClear}
            onCreateNewView={this.createView}
            queryValue={this.state.queryValue}
            onQueryChange={this.onQueryChange}
            onClearAll={this.clearAllAppliedFilters}
            queryPlaceholder={t('searching-in-all')}
            disableStickyMode={disableStickyMode}
            cancelAction={{
              onAction: this.cancelFilters,
              disabled: false,
              loading: false,
            }}
          />
        )}
      </>
    )
  }

  renderTable(): ReactNode {
    // Extract props
    const {
      t,
      page,
      items,
      total,
      setPage,
      headings,
      condensed,
      firstLoad,
      selectable,
      bulkActions,
      resourceName,
      renderRowMarkup,
      promotedBulkActions,
      showPagination = true,
      limit = ITEM_LIST_LIMITATION,
      disabledSelectable,
      useSetIndexFiltersMode,
      onSelectionChange,
      defaultResourceKey,
    } = this.props

    const { selected, views } = this.state
    const _selectable = disabledSelectable ? !disabledSelectable?.includes(views[selected]?.id) : selectable
    const { selectedResources, allResourcesSelected, handleSelectionChange, allItemsCanSelect }
      = useSetIndexFiltersMode || {}

    // Generate empty state
    const emptyState = firstLoad ? <BlockLoading /> : undefined

    return (
      <BlockStack>
        <SelectionWatcher
          selectedResources={selectedResources}
          allResourcesSelected={allResourcesSelected}
          onSelectionChange={onSelectionChange}
          items={items}
          defaultResourceKey={defaultResourceKey}
        />
        <IndexTable
          headings={headings}
          condensed={condensed}
          emptyState={emptyState}
          selectable={_selectable}
          itemCount={allItemsCanSelect?.length}
          bulkActions={bulkActions}
          resourceName={resourceName}
          onSelectionChange={handleSelectionChange}
          promotedBulkActions={promotedBulkActions}
          selectedItemsCount={allResourcesSelected ? 'All' : selectedResources?.length}
        >
          {items.map((item: any, index: number) => (
            <React.Fragment key={item._id || item.id || index}>
              {renderRowMarkup(item, index, selectedResources, this, useSetIndexFiltersMode)}
            </React.Fragment>
          ))}
        </IndexTable>

        {showPagination && !firstLoad && total > 0 && (
          <>
            <Divider />

            <Box padding={'400'}>
              <InlineStack gap={'300'} blockAlign="center">
                <Pagination
                  hasNext={(page - 1) * (limit || ITEM_LIST_LIMITATION) + items?.length < total}
                  hasPrevious={page > 1}
                  onNext={() => setPage && setPage(page + 1)}
                  onPrevious={() => setPage && setPage(page - 1)}
                />
                {t('page-page-of-total', { page, total: Math.ceil(total / limit) })}
              </InlineStack>
            </Box>
          </>
        )}
      </BlockStack>
    )
  }

  getSelectedResources = () => {
    const {
      useSetIndexFiltersMode: { selectedResources },
    } = this.props

    return selectedResources
  }

  clearAllSelection = () => {
    const {
      useSetIndexFiltersMode: { handleSelectionChange },
    } = this.props

    handleSelectionChange('page', false)
  }

  generateFilters(): ListTableFilter[] {
    const { filters, filterValues, setFilterValues } = this.props

    return (
      filters?.map((def: ListTableFilter) => {
        const _def = { ...def }
        const { Component, props } = def.filter

        if (Component && props) {
          _def.filter = (
            <Component
              {...props}
              {...(props.choices ? { selected: filterValues[def.key] || [] } : {})}
              {...(props.value ? { value: filterValues[def.key] || props.value } : {})}
              onChange={(value: any) => setFilterValues({ ...filterValues, [def.key]: value })}
            />
          )

          return _def
        }

        return def
      }) || []
    )
  }

  generateAppliedFilters(): IndexFiltersProps['appliedFilters'] {
    const filters = this.generateFilters()
    const { queryKey, filterValues, renderFilterLabel } = this.props

    // Generate applied filters from current filter values
    const appliedFilters: IndexFiltersProps['appliedFilters'] = []

    for (const key in filterValues) {
      if (key !== queryKey && filterValues[key]?.length) {
        const filter = filters?.find((filter: ListTableFilter) => filter.key === key)

        if (filter) {
          appliedFilters.push({
            key,
            label: renderFilterLabel ? renderFilterLabel(key, this.state[key] || filterValues[key]) : filter.label,
            onRemove: () => this.removeAppliedFilter(key),
          })
        }
      }
    }

    return appliedFilters
  }

  generatePrimaryActionForFilters(): any {
    const { views, selected } = this.state
    const { filterValues: newFilters } = this.props
    const currentFilters = [...views][selected]?.filters || {}
    const disabled = isEqual(currentFilters, newFilters)

    return selected === 0
      ? {
          type: 'save-as',
          onAction: this.createView,
          disabled,
          loading: false,
        }
      : {
          type: 'save',
          onAction: this.updateView,
          disabled,
          loading: false,
        }
  }

  generateTabsForViews(): TabProps[] {
    const { setFilterValues } = this.props
    const { views } = this.state

    return (
      views?.map((item: any, index: number) => ({
        index,
        content: item.name,
        // The default view should be locked on the first position
        isLocked: index === 0,
        id: `${index}-${item.name}`,
        key: `${index}-${item.name}`,
        onAction: () => setFilterValues(views[index].filters || {}),
        actions:
          // The default view should not be customizable
          index === 0
            ? []
            : item.actions
              ? item.actions
              : [
                  {
                    type: 'rename',
                    onPrimaryAction: async (value: string): Promise<boolean> => {
                      this.renameView(value, index)
                      return true
                    },
                  },
                  {
                    type: 'duplicate',
                    onPrimaryAction: async (value: string): Promise<boolean> => {
                      this.duplicateView(value, index)
                      return true
                    },
                  },
                  {
                    type: 'delete',
                    onPrimaryAction: async (): Promise<boolean> => {
                      this.deleteView(index)
                      return true
                    },
                  },
                ],
      })) || []
    )
  }

  createView = async (value: string): Promise<boolean> => {
    const { filterValues } = this.props
    const { views } = this.state

    // Create view
    authenticatedFetch(
      `/api/views?path=${location.pathname}&action=${VIEW_ACTIONS.CREATE}&name=${encodeURIComponent(value)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(filterValues),
      }
    )

    this.setState({
      selected: views.length,
      views: [...views, { name: value, filters: filterValues }],
    })

    return true
  }

  renameView = (value: string, index: number) => {
    const { views } = this.state

    const newViews = views.map((item: any, idx: number) => {
      if (idx === index) {
        // Rename view
        authenticatedFetch(
          // eslint-disable-next-line max-len
          `/api/views?path=${location.pathname}&action=${VIEW_ACTIONS.RENAME}&oldName=${encodeURIComponent(item.name)}&newName=${encodeURIComponent(value)}`
        )

        item.name = value
      }

      return item
    })

    this.setState({ views: newViews })
  }

  updateView = async () => {
    const { filterValues } = this.props
    const { views, selected } = this.state
    const newViews = [...views].map((view, index) => (index === selected ? { ...view, filters: filterValues } : view))

    // Update view
    authenticatedFetch(
      // eslint-disable-next-line max-len
      `/api/views?path=${location.pathname}&action=${VIEW_ACTIONS.UPDATE}&name=${encodeURIComponent(views[selected].name)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(filterValues),
      }
    )

    this.setState({ views: newViews })

    return true
  }

  duplicateView = (name: string, index: number) => {
    const { views } = this.state
    const newFilters = views[index]?.filters

    // Duplicate view
    authenticatedFetch(
      `/api/views?path=${location.pathname}&action=${VIEW_ACTIONS.CREATE}&name=${encodeURIComponent(name)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newFilters),
      }
    )

    this.setState({
      selected: views.length,
      views: [...views, { name, filters: newFilters }],
    })
  }

  deleteView = (index: number) => {
    const { views } = this.state
    const newViews = [...views]
    const name = newViews.splice(index, 1)[0]?.name

    // Delete view
    authenticatedFetch(
      `/api/views?path=${location.pathname}&action=${VIEW_ACTIONS.DELETE}&name=${encodeURIComponent(name)}`
    )

    this.setState({
      selected: 0,
      views: newViews,
    })

    // Clear all filter after select tab 0 (All)
    this.clearAllAppliedFilters()
  }

  setSelectedView = (selected: number) => {
    this.clearAllSelection()
    this.setState({ selected })
    this.props.setFilterValues(this.state.views[selected].filters || {})
  }

  onQueryChange = (queryValue: string) => {
    const { filterValues, setFilterValues } = this.props

    setFilterValues({ ...filterValues, queryValue })

    this.setState({ queryValue })
  }

  onQueryClear = () => this.onQueryChange('')

  removeAppliedFilter = (key: string): void => {
    const { filterValues, setFilterValues } = this.props

    setFilterValues({ ...filterValues, [key]: undefined })
  }

  clearAllAppliedFilters = () => {
    const { setFilterValues } = this.props

    setFilterValues({})
  }

  cancelFilters = () => {
    const { setFilterValues } = this.props
    const { views, selected } = this.state

    setFilterValues({ ...(views[selected]?.filters || {}) })

    this.setState({ queryValue: '' })
  }

  static getDerivedStateFromError(error: Error): any {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to console
    console.error(error, errorInfo)
  }
}

// Utility function for efficient array comparison
function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false
  return a.every((item, index) => item === b[index])
}

// Helper component to watch for selection changes and call the callback
function SelectionWatcher({
  selectedResources,
  allResourcesSelected,
  onSelectionChange,
  items,
  defaultResourceKey,
}: {
  selectedResources?: string[]
  allResourcesSelected?: boolean
  onSelectionChange?: (selectedResources: any[], allResourcesSelected: boolean) => void
  items?: any[]
  defaultResourceKey?: string
}) {
  const prevSelectedResources = useRef<any[]>([])
  const prevAllResourcesSelected = useRef<boolean>(false)
  const prevSelectedResourceIds = useRef<string[]>([])

  // Memoize current selected resource IDs for stable comparison
  const currentSelectedResourceIds = useMemo(() => selectedResources || [], [selectedResources])

  // Memoize selected objects mapping to avoid recalculation
  const currentSelectedObjects = useMemo(() => {
    if (!items?.length || !currentSelectedResourceIds.length) return []

    return currentSelectedResourceIds
      .map((selectedId: string) => {
        return items.find(item => {
          const itemId = defaultResourceKey ? item[defaultResourceKey] : item._id || item.id
          return itemId === selectedId
        })
      })
      .filter(Boolean) // Remove any undefined items
  }, [currentSelectedResourceIds, items, defaultResourceKey])

  useEffect(() => {
    const currentAllResourcesSelected = allResourcesSelected || false

    // Efficient comparison using array equality check
    const selectionChanged
      = !arraysEqual(prevSelectedResourceIds.current, currentSelectedResourceIds)
      || prevAllResourcesSelected.current !== currentAllResourcesSelected

    if (selectionChanged && onSelectionChange) {
      onSelectionChange(currentSelectedObjects, currentAllResourcesSelected)
    }

    // Update refs
    prevSelectedResources.current = currentSelectedObjects
    prevAllResourcesSelected.current = currentAllResourcesSelected
    prevSelectedResourceIds.current = currentSelectedResourceIds
  }, [currentSelectedResourceIds, currentSelectedObjects, allResourcesSelected, onSelectionChange])

  return null
}

const ListTable = withDataSource(ListTableComponent)

export default ListTable
