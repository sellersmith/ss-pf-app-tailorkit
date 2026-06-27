import {
  Box,
  Text,
  EmptySearchResult,
  Modal,
  Spinner,
  Link,
  Scrollable,
  Filters,
  ChoiceList,
  type AppliedFilterInterface,
  type FilterInterface,
} from '@shopify/polaris'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LIST_VIEW_TYPE, ListItems } from '../components/ListItems'
import { useFetchShineOnProducts } from './hooks/useFetchShineOnProducts'
import isEmpty from 'lodash/isEmpty'
import { usePreventPageScroll } from '../hooks/usePreventPageScroll'
import EmptySearchMarkup from '../ImageSelector/components/EmptySearchMarkup'
import type { ShineOnNormalizedProduct } from '~/modules/Fulfillments/ShineOn/types'

const SHINEON_PRODUCT_TYPES = ['necklace', 'ring', 'bracelet', 'watch', 'earring', 'keychain']

interface IShineOnProductsSelectorProps {
  active: boolean
  onClose: () => void
  onSelect: (products: ShineOnNormalizedProduct[]) => Promise<void>
  allowMultiple?: boolean
  providerId: string
  selectedProductIds?: string[]
}

export const ShineOnProductsSelector = (props: IShineOnProductsSelectorProps) => {
  const { active, onClose, onSelect, allowMultiple = true, providerId, selectedProductIds = [] } = props
  const { t } = useTranslation()

  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedProductIds)
  const [queryString, setQueryString] = useState('')
  const [productTypeSelected, setProductTypeSelected] = useState<string[]>([])

  const { products, allProducts, isFetching, isSearching } = useFetchShineOnProducts({
    queryString,
    providerId,
    productTypeFilter: productTypeSelected,
  })

  const initialLoading = isFetching

  const productsFormatted = useMemo(
    () =>
      products.map(product => ({
        _id: product.productId,
        previewUrl: product.images[0] || '',
        alt: product.title,
        selected: selectedIds.includes(product.productId),
      })),
    [products, selectedIds]
  )

  const productTypesFormatted = useMemo(
    () =>
      SHINEON_PRODUCT_TYPES.map(type => ({
        label: t(type.charAt(0).toUpperCase() + type.slice(1)),
        value: type,
      })),
    [t]
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
    setProductTypeSelected([])
  }, [])
  const handleSelectProductTypes = useCallback((value: string[]) => setProductTypeSelected(value), [])

  const filters: FilterInterface[] = [
    {
      key: 'productType',
      label: t('product-type'),
      filter: (
        <ChoiceList
          title="Product Types"
          titleHidden
          choices={productTypesFormatted}
          selected={productTypeSelected || []}
          onChange={handleSelectProductTypes}
          allowMultiple
        />
      ),
      shortcut: true,
      pinned: true,
    },
  ]

  const generateAppliedFilters = useCallback((): AppliedFilterInterface[] => {
    if (!isEmpty(productTypeSelected)) {
      return [
        {
          key: 'productType',
          label: `${t('product-type')} ${productTypeSelected.map(val => t(val.charAt(0).toUpperCase() + val.slice(1))).join(', ')}`,
          onRemove: () => setProductTypeSelected([]),
        },
      ]
    }
    return []
  }, [productTypeSelected, t])

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
      .map(id => allProducts.find(p => p.productId === id))
      .filter((p): p is ShineOnNormalizedProduct => !!p)
    await onSelect(selected)
    setSelecting(false)
    onClose()
  }

  usePreventPageScroll(active)

  return (
    <Modal
      open={active}
      size="large"
      title={t('select-products-from-shineon')}
      onClose={onClose}
      primaryAction={{
        content: t('select'),
        onAction: handleSelectProducts,
        loading: selecting,
      }}
      secondaryActions={[{ content: t('cancel'), onAction: onClose }]}
      footer={
        <Link removeUnderline target="_blank" url={'https://fulfillment.shineon.com'}>
          {t('open-shineon')}
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
                  filters={filters}
                  queryPlaceholder={t('search-products')}
                  appliedFilters={generateAppliedFilters()}
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
