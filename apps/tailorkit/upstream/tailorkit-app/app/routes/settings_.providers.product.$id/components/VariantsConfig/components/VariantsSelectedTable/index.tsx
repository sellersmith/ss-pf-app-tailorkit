import { Fragment, useCallback, useMemo, useState } from 'react'
import {
  BlockStack,
  Box,
  ChoiceList,
  EmptySearchResult,
  IndexFilters,
  type IndexFiltersProps,
  IndexTable,
  InlineStack,
  Pagination,
  Text,
  useIndexResourceState,
  useSetIndexFiltersMode,
} from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { type IndexTableHeading } from '@shopify/polaris/build/ts/src/components/IndexTable'
import { type FilterInterface, type NonEmptyArray } from '@shopify/polaris/build/ts/src/types'
import { useStore } from '~/libs/external-store'
import { ProductProviderStore } from '~/routes/settings_.providers.product.$id/stores/productProviderStore'
import { type IGroupProviderVariants } from '../../hooks/usePrintifyVariants'
import isEmpty from 'lodash/isEmpty'
import { capitalize } from 'extensions/tailorkit-src/src/assets/utils/helpers'
import ModalEditMetric from '~/routes/settings_.providers.product.$id/components/ModalEditMetric'
import { EMPTY_ARRAY } from '~/constants'
import { useProviderVariants } from '../../hooks/useProviderVariants'
import VariantRowMarkup from './VariantRowMarkup'
import { usePagination } from '~/utils/hooks/usePagination'
import { MAX_PROFIT_MARGIN } from '~/routes/settings_.providers.integration.$id/constants'

const ITEMS_PER_PAGE = 10

export const VariantsSelectedTable = (props: { _groupVariants: IGroupProviderVariants }) => {
  const { t } = useTranslation()
  const { _groupVariants } = props
  const variantUpdating = useStore(ProductProviderStore, state => state.variants) || EMPTY_ARRAY

  const { mode, setMode } = useSetIndexFiltersMode()
  const { combinedVariants } = useProviderVariants()

  // Filter state
  const [queryValue, setQueryValue] = useState('')
  const [filterValues, setFilterValues] = useState<{ [vKey: string]: string[] }>({})
  // Error state
  const [error, setError] = useState<{ [key: string]: string | undefined }>({})

  const [modalEditMetric, setModalEditMetric] = useState<any>({
    modal: '',
    active: false,
    prefix: Fragment,
    suffix: Fragment,
  })

  const filteredVariants = useMemo(() => {
    if (!isEmpty(filterValues)) {
      const categories = Object.keys(filterValues) // Get category names, e.g., ["color", "size"]
      const validOptions: any = {}

      // Filter valid options for each category
      categories.forEach(category => {
        validOptions[category] = filterValues[category].map(option => option) // Extract the option name (key)
      })
      const output = combinedVariants(categories, validOptions, variantUpdating)
      return output.filter(variant => variant?.title?.toLowerCase()?.includes(queryValue?.toLowerCase()))
    }

    return variantUpdating.filter(variant => variant?.title?.toLowerCase()?.includes(queryValue?.toLowerCase()))
  }, [combinedVariants, filterValues, queryValue, variantUpdating])

  const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection }
    = useIndexResourceState(filteredVariants)

  const closeModalEditMetric = useCallback(() => {
    setModalEditMetric({ modal: '', active: false, suffix: Fragment, prefix: Fragment })
  }, [])

  // For Variant Index table
  const headings: NonEmptyArray<IndexTableHeading> = useMemo(
    () => [
      {
        id: 'variant-title',
        title: t('variant'),
      },
      {
        id: 'cost',
        title: t('cost'),
      },
      {
        id: 'profit-margin',
        title: t('profit-margin'),
      },
      {
        id: 'final-price',
        title: t('final-price'),
      },
      {
        id: 'profit',
        title: t('profit'),
      },
    ],
    [t]
  )

  const bulkActions = useMemo(
    () => [
      {
        content: t('edit-cost'),
        onAction: () => {
          setModalEditMetric({
            modal: 'cost',
            active: true,
            prefix: '$',
          })
        },
      },
      {
        content: t('edit-profit-margin'),
        onAction: () => {
          setModalEditMetric({
            modal: 'profit-margin',
            active: true,
            suffix: '%',
            maxValue: MAX_PROFIT_MARGIN,
          })
        },
      },
      {
        content: (
          <Text as={'dd'} tone="critical">
            {t('delete')}
          </Text>
        ),
        onAction: () => {
          ProductProviderStore.dispatch({
            type: 'SET_VARIANTS',
            payload: {
              variants: variantUpdating.filter(variant => !selectedResources.includes(variant.id.toString())),
            },
          })

          clearSelection()
        },
      },
    ],
    [selectedResources, t, variantUpdating, clearSelection]
  )

  const filters: FilterInterface[] = useMemo(() => {
    const filters = Object.entries(_groupVariants).map(([vKey, variantValueArr]) => {
      const choiceOptions = variantValueArr.map(variant => {
        const [key] = Object.keys(variant)
        return { label: key, value: key }
      })

      return {
        key: vKey,
        label: capitalize(vKey),
        filter: (
          <ChoiceList
            title={capitalize(vKey)}
            choices={choiceOptions}
            selected={filterValues[vKey] || []}
            onChange={(selected: string[]) => setFilterValues({ ...filterValues, [vKey]: selected })}
            allowMultiple
          />
        ),
        pinned: true,
      }
    })

    return filters
  }, [_groupVariants, filterValues])

  const handleFilterRemove = useCallback(
    (vKey: string) => {
      const _filterValues = Object.fromEntries(
        Object.entries(filterValues).filter(filter => {
          const [fKey] = filter

          return fKey !== vKey
        })
      )

      setFilterValues(_filterValues)
    },
    [filterValues]
  )

  const generateAppliedFilters = useCallback((): IndexFiltersProps['appliedFilters'] => {
    if (!isEmpty(filterValues)) {
      return Object.entries(filterValues).map(filter => {
        const [vKey, value] = filter

        return {
          key: vKey,
          label: value.length ? `${capitalize(vKey)} ${(value as string[]).map(val => `${val}`).join(', ')}` : '',
          onRemove: handleFilterRemove,
        }
      })
    }
    return []
  }, [filterValues, handleFilterRemove])

  // Defined the empty state for searching
  const emptySearchMarkup = (
    <Box padding={'400'}>
      <div className="emtlkit--d-flex emtlkit--flex-center emtlkit--flex-justify-center h-100">
        <EmptySearchResult
          title={t('no-variants-found')}
          withIllustration
          description={t('try-changing-the-search-term')}
        />
      </div>
    </Box>
  )

  // Paginate the variant data
  const {
    currentData,
    currentPage,
    totalPages,
    goToPage,
    isFirstPage,
    isLastPage,
    nextPage,
    previousPage,
    totalItems,
  } = usePagination({
    data: filteredVariants,
    itemsPerPage: ITEMS_PER_PAGE,
    initialPage: 1,
  })

  const handleFiltersQueryChange = useCallback(
    (value: string) => {
      // Reset current page
      goToPage(1)

      // Update query value
      setQueryValue(value)
    },
    [goToPage]
  )

  const handleFiltersClearAll = useCallback(() => {
    handleFiltersQueryChange('')
    setFilterValues({})
  }, [handleFiltersQueryChange])

  return (
    <BlockStack>
      <IndexFilters
        tabs={[]}
        selected={0}
        queryPlaceholder={t('search-variants')}
        mode={mode}
        filters={filters}
        queryValue={queryValue}
        appliedFilters={generateAppliedFilters()}
        setMode={setMode}
        onClearAll={handleFiltersClearAll}
        onQueryChange={handleFiltersQueryChange}
        onQueryClear={() => handleFiltersQueryChange('')}
        cancelAction={{
          onAction: handleFiltersClearAll,
          disabled: false,
          loading: false,
        }}
      />
      <IndexTable
        selectable
        headings={headings}
        //@ts-ignore
        bulkActions={bulkActions}
        emptyState={emptySearchMarkup}
        itemCount={filteredVariants.length}
        selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
        onSelectionChange={handleSelectionChange}
        resourceName={{
          singular: 'variant',
          plural: 'variants',
        }}
      >
        {currentData.map((variant, index) => (
          <VariantRowMarkup
            key={variant.id}
            variant={variant}
            index={index}
            selectedResources={selectedResources}
            setError={setError}
            error={error}
          />
        ))}
      </IndexTable>

      {totalItems > ITEMS_PER_PAGE && (
        <Box padding={'200'}>
          <InlineStack gap={'300'} blockAlign="center">
            <Pagination hasPrevious={!isFirstPage} onPrevious={previousPage} hasNext={!isLastPage} onNext={nextPage} />
            <Text as="p" variant="bodyMd" tone="subdued">
              {t('page-page-of-total', { page: currentPage, total: totalPages })}
            </Text>
          </InlineStack>
        </Box>
      )}

      {modalEditMetric.modal && (
        <ModalEditMetric
          open={modalEditMetric.active}
          inputPrefix={modalEditMetric.prefix}
          inputSuffix={modalEditMetric.suffix}
          inputType="number"
          title={modalEditMetric.modal}
          maxValue={modalEditMetric.maxValue}
          onDone={value => {
            if (modalEditMetric.modal === 'cost') {
              ProductProviderStore.dispatch({
                type: 'UPDATE_COST_VARIANT',
                payload: { variantIds: selectedResources, cost: +(value || 0) },
              })
            } else if (modalEditMetric.modal === 'profit-margin') {
              ProductProviderStore.dispatch({
                type: 'UPDATE_PROFIT_MARGIN_VARIANT',
                payload: { variantIds: selectedResources, profitMargin: +(value || 0) },
              })
            }

            closeModalEditMetric()
          }}
          onClose={() => {
            closeModalEditMetric()
          }}
        />
      )}
    </BlockStack>
  )
}
