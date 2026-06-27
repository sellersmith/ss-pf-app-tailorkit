import { Box, Text, EmptySearchResult, Modal, Spinner, Link, Scrollable, Filters } from '@shopify/polaris'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LIST_VIEW_TYPE, ListItems } from '../components/ListItems'
import { useFetchPrintWayProducts } from './hooks/useFetchPrintWayProducts'
import { usePreventPageScroll } from '../hooks/usePreventPageScroll'
import EmptySearchMarkup from '../ImageSelector/components/EmptySearchMarkup'
import type { NormalizedProduct } from '~/services/fulfillment/types'

interface IPrintWayProductsSelectorProps {
  active: boolean
  onClose: () => void
  onSelect: (products: NormalizedProduct[]) => Promise<void>
  allowMultiple?: boolean
  providerId: string
  selectedProductIds?: string[]
}

export const PrintWayProductsSelector = (props: IPrintWayProductsSelectorProps) => {
  const { active, onClose, onSelect, allowMultiple = true, providerId, selectedProductIds = [] } = props
  const { t } = useTranslation()

  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedProductIds)
  const [queryString, setQueryString] = useState('')

  const { products, allProducts, isFetching, isSearching } = useFetchPrintWayProducts({
    queryString,
    providerId,
  })

  const initialLoading = isFetching

  const productsFormatted = useMemo(
    () =>
      products.map(product => ({
        _id: product.externalId,
        previewUrl: product.images[0] || '',
        alt: product.title,
        selected: selectedIds.includes(product.externalId),
      })),
    [products, selectedIds]
  )

  const loadingState = (
    <div className="emtlkit--d-flex emtlkit--flex-center emtlkit--flex-justify-center h-100">
      <Box padding={'800'}>
        <Spinner />
      </Box>
    </div>
  )

  const emptySearchMarkup = (
    <Box padding={'400'}>
      <div className="emtlkit--d-flex emtlkit--flex-center emtlkit--flex-justify-center h-100">
        <EmptySearchResult
          title={t('no-product-found')}
          withIllustration
          description={t('try-changing-the-search-term')}
        />
      </div>
    </Box>
  )

  const handleFiltersClearAll = useCallback(() => {
    setQueryString('')
  }, [])

  const handleClickItem = (newCheck: boolean, item: { _id: string }) => {
    if (newCheck) {
      setSelectedIds(allowMultiple ? [...selectedIds, item._id] : [item._id])
    } else {
      setSelectedIds(selectedIds.filter(id => id !== item._id))
    }
  }

  const handleSelectProducts = async () => {
    setSelecting(true)
    const selected = selectedIds
      .map(id => allProducts.find(p => p.externalId === id))
      .filter((p): p is NormalizedProduct => !!p)
    await onSelect(selected)
    setSelecting(false)
    onClose()
  }

  usePreventPageScroll(active)

  return (
    <Modal
      open={active}
      size="large"
      title={t('select-products-from-printway')}
      onClose={onClose}
      primaryAction={{
        content: t('select'),
        onAction: handleSelectProducts,
        loading: selecting,
      }}
      secondaryActions={[{ content: t('cancel'), onAction: onClose }]}
      footer={
        <Link removeUnderline target="_blank" url={'https://printway.io'}>
          {t('open-printway')}
        </Link>
      }
      noScroll
    >
      <div style={{ height: 'calc(100vh - 116px - var(--pc-modal-dialog-vertical-spacing))' }}>
        {initialLoading ? (
          loadingState
        ) : (
          <Modal.Section>
            <Box paddingBlockEnd={'200'}>
              <div className="filter-product-selector-modal">
                <Filters
                  queryValue={queryString}
                  filters={[]}
                  queryPlaceholder={t('search-products')}
                  appliedFilters={[]}
                  onQueryChange={setQueryString}
                  onQueryClear={() => setQueryString('')}
                  onClearAll={handleFiltersClearAll}
                  closeOnChildOverlayClick
                />
              </div>
            </Box>
            {isSearching ? (
              loadingState
            ) : (
              <Scrollable style={{ maxHeight: 'calc(100vh - 320px)', overflowX: 'hidden' }}>
                <ListItems
                  resourceName={t('product')}
                  type={LIST_VIEW_TYPE.LIST}
                  items={productsFormatted}
                  components={product => (
                    <Text as="p" variant="bodySm" alignment="center">
                      {product.alt}
                    </Text>
                  )}
                  onClickItem={handleClickItem}
                  emptySearchMockup={emptySearchMarkup}
                  emptyState={<EmptySearchMarkup resourceName={'product'} />}
                />
              </Scrollable>
            )}
          </Modal.Section>
        )}
      </div>
    </Modal>
  )
}
