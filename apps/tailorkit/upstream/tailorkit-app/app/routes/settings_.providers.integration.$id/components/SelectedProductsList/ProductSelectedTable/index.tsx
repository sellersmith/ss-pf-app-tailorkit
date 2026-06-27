import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { IndexTable, useIndexResourceState, Text, Box, InlineStack, Pagination, BlockStack } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { type NonEmptyArray } from '@shopify/polaris/build/ts/src/types'
import { type IndexTableHeading } from '@shopify/polaris/build/ts/src/components/IndexTable'
import type { UseImportedProductsListReturn } from '~/routes/settings_.providers.integration.$id/hooks/useImportedProductsList'
import type { UseSelectedProductsDetailsReturn } from '~/routes/settings_.providers.integration.$id/hooks/useSelectedProductsDetails'
import { SetProfitMarginModal } from '../../SetProfitMarginModal'
import ProductSelectedRow from './ProductSelectedRow'
import { usePagination } from '~/utils/hooks/usePagination'
import type { ProviderCapabilities } from '~/services/fulfillment/types'

interface IProductSelectedTableProps {
  initialPage: number
  setInitialPage: (page: number) => void
  loading?: boolean
  selectedProductsDetails: UseSelectedProductsDetailsReturn['selectedProductsDetails']
  recentlyProductIds: string[]
  confirmUsingPrintifyChoice?: boolean
  providerInfo: UseImportedProductsListReturn['providerInfo']
  capabilities?: ProviderCapabilities
  handleSetProfitMargin: UseImportedProductsListReturn['handleSetProfitMargin']
  handleDeleteSelectedProduct: UseImportedProductsListReturn['handleDeleteSelectedProduct']
}

const ITEMS_PER_PAGE = 10

function ProductSelectedTable(props: IProductSelectedTableProps) {
  const {
    initialPage,
    setInitialPage,
    loading,
    confirmUsingPrintifyChoice,
    selectedProductsDetails,
    providerInfo,
    capabilities,
    recentlyProductIds,
    handleDeleteSelectedProduct,
    handleSetProfitMargin,
  } = props
  const { t } = useTranslation()

  // Implement ability to select items
  const resourceIDResolver = useCallback((product: any) => product.id.toString(), [])

  const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection } = useIndexResourceState(
    selectedProductsDetails,
    {
      resourceIDResolver,
      selectedResources: recentlyProductIds,
    }
  )

  // Paginate the variant data
  const { currentData, currentPage, totalPages, isFirstPage, isLastPage, totalItems, nextPage, previousPage }
    = usePagination({
      data: selectedProductsDetails,
      itemsPerPage: ITEMS_PER_PAGE,
      initialPage,
    })

  const [profitModalActive, setProfitModalActive] = useState(false)
  const [_loading, setLoading] = useState(loading)

  // Memoize table headings
  const headings = useMemo<NonEmptyArray<IndexTableHeading>>(
    () => [
      {
        id: 'products',
        title: t('products'),
      },
      {
        id: 'select-provider',
        title: (
          <Text as="span" visuallyHidden>
            {t('select-provider')}
          </Text>
        ),
      },
    ],
    [t]
  )

  // Memoize bulk actions
  const promotedBulkActions = useMemo(
    () => [
      {
        content: t('set-profit-margin'),
        onAction: () => setProfitModalActive(true),
      },
      {
        content: t('delete'),
        destructive: true,
        onAction: async () => {
          clearSelection()
          setLoading(true)
          try {
            await handleDeleteSelectedProduct(selectedResources)
          } finally {
            setLoading(false)
          }
        },
      },
    ],
    [clearSelection, handleDeleteSelectedProduct, selectedResources, t]
  )

  const onNextPage = useCallback(() => {
    setInitialPage(currentPage + 1)
    nextPage()
  }, [currentPage, nextPage, setInitialPage])

  const onPreviousPage = useCallback(() => {
    setInitialPage(currentPage - 1)
    previousPage()
  }, [currentPage, previousPage, setInitialPage])

  // Sync internal loading state with prop and clear selections when loading
  useEffect(() => {
    setLoading(loading ?? false)
    if (loading) {
      clearSelection()
    }
  }, [clearSelection, loading])

  return (
    <div className="product-selected-table-wrapper">
      <BlockStack gap={'400'}>
        <Box borderWidth="025" borderColor="border" borderRadius="200" shadow="300">
          <IndexTable
            headings={headings}
            itemCount={selectedProductsDetails.length}
            selectable
            selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
            onSelectionChange={handleSelectionChange}
            promotedBulkActions={promotedBulkActions}
            resourceName={{ singular: t('product'), plural: t('products') }}
          >
            {currentData.map((product, index) => (
              <ProductSelectedRow
                key={product.id}
                product={product}
                index={index}
                loading={loading || _loading}
                selectedResources={selectedResources}
                providerId={providerInfo._id}
                providerName={providerInfo?.name}
                capabilities={capabilities}
                confirmUsingPrintifyChoice={confirmUsingPrintifyChoice}
              />
            ))}
          </IndexTable>
        </Box>
        {totalItems > ITEMS_PER_PAGE && (
          <Box padding={'200'}>
            <InlineStack gap={'300'} blockAlign="center">
              <Pagination
                hasPrevious={!isFirstPage}
                onPrevious={onPreviousPage}
                hasNext={!isLastPage}
                onNext={onNextPage}
              />
              <Text as="p" variant="bodyMd" tone="subdued">
                {t('page-page-of-total', { page: currentPage, total: totalPages })}
              </Text>
            </InlineStack>
          </Box>
        )}
        {profitModalActive && (
          <SetProfitMarginModal
            active={profitModalActive}
            productIds={selectedResources}
            defaultProfitMargin={
              selectedResources.length === 1
                ? selectedProductsDetails.find(product => product.id.toString() === selectedResources[0])
                    ?.baseProfitMargin || 0
                : 0
            }
            onClose={() => setProfitModalActive(false)}
            handleSetProfitMargin={handleSetProfitMargin}
          />
        )}
      </BlockStack>
    </div>
  )
}

export default memo(ProductSelectedTable)
