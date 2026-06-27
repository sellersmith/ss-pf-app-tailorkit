import {
  Box,
  Text,
  EmptySearchResult,
  Modal,
  Spinner,
  Link,
  Scrollable,
  InlineStack,
  Bleed,
  Filters,
  ChoiceList,
  type AppliedFilterInterface,
  type FilterInterface,
} from '@shopify/polaris'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LIST_VIEW_TYPE, ListItems } from '../components/ListItems'
import { useFetchPrintifyProducts } from './hooks/useFetchPrintifyProducts'
import { AdvancedBlueprintInfo } from './components/AdvancedBlueprintInfo'
import type { IBlueprintWithAdvanceInfo } from '~/routes/api.providers-connection.$id/Printify/types'
import isEmpty from 'lodash/isEmpty'
import { usePreventPageScroll } from '../hooks/usePreventPageScroll'
import EmptySearchMarkup from '../ImageSelector/components/EmptySearchMarkup'

interface IPrintifyProductsSelectorModal {
  active: boolean
  onClose: () => void
  onSelect: (blueprints: IBlueprintWithAdvanceInfo[]) => Promise<void>
  allowMultiple?: boolean
  providerId: string
  selectedProductIds?: string[]
}

export const PrintifyProductsSelector = (props: IPrintifyProductsSelectorModal) => {
  const { active, onClose, onSelect, allowMultiple = true, providerId, selectedProductIds = [] } = props
  const { t } = useTranslation()

  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedProductIds)
  const [queryString, setQueryString] = useState('')
  const [brandSelected, setBrandSelected] = useState<string[]>([])

  const { blueprints, allBrands, allBlueprints, isFetching, isSearching, fetchNextPage, isFetchNextPage }
    = useFetchPrintifyProducts({
      queryString,
      providerId,
      brandSelected,
    })

  const initialLoading = !queryString && (isFetching || blueprints.length === 0)

  const bluePrintsFormatted = useMemo(() => {
    return blueprints.map(print => {
      const { id, title, images } = print
      const _id = id.toString()

      return {
        _id,
        previewUrl: images[0],
        alt: title,
        selected: selectedIds.includes(_id),
      }
    })
  }, [blueprints, selectedIds])

  const allBrandsFormatted = useMemo(() => allBrands.map(brand => ({ label: brand, value: brand })), [allBrands])

  const loadingState = (
    <div className="emtlkit--d-flex emtlkit--flex-center emtlkit--flex-justify-center h-100">
      <Box padding={'800'}>
        <Spinner />
      </Box>
    </div>
  )

  // Defined the empty state for searching
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
    setBrandSelected([])
  }, [])

  const handleSelectBrands = useCallback((value: string[]) => setBrandSelected(value), [])

  const filters: FilterInterface[] = [
    {
      key: 'brand',
      label: t('brand'),
      filter: (
        <ChoiceList
          title="Brands"
          titleHidden
          choices={allBrandsFormatted}
          selected={brandSelected || []}
          onChange={handleSelectBrands}
          allowMultiple
        />
      ),
      shortcut: true,
      pinned: true,
    },
  ]

  const generateAppliedFilters = useCallback((): AppliedFilterInterface[] => {
    if (!isEmpty(brandSelected)) {
      return [
        {
          key: 'brand',
          label: brandSelected.length ? `${t('brand')} ${brandSelected.map(val => `${val}`).join(', ')}` : '',
          onRemove: () => setBrandSelected([]),
        },
      ]
    }

    return []
  }, [brandSelected, t])

  const handleClickItem = (newCheck: boolean, item: any) => {
    if (newCheck) {
      const newIds = allowMultiple ? [...(selectedIds || []), item._id] : [item._id]
      setSelectedIds(newIds)
    } else {
      const filteredIds = selectedIds?.filter(id => id !== item._id)
      setSelectedIds(filteredIds)
    }
  }

  const handleSelectBlueprints = async () => {
    setSelecting(true)
    const productSelectedData: any[] = selectedIds.map(id =>
      allBlueprints.find(blueprint => blueprint.id.toString() === id)
    )

    await onSelect(productSelectedData)
    setSelecting(false)
    onClose()
  }

  const handleCancel = () => {
    onClose()
  }

  usePreventPageScroll(active)

  return (
    <Modal
      open={active}
      size="large"
      title={t('select-product-printify')}
      onClose={onClose}
      primaryAction={{
        content: t('select'),
        onAction: handleSelectBlueprints,
        loading: selecting,
      }}
      secondaryActions={[
        {
          content: t('cancel'),
          onAction: handleCancel,
        },
      ]}
      footer={
        <Link removeUnderline target="_blank" url={'https://printify.com/app/products'}>
          {t('open-printify')}
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
              <Scrollable
                style={{ maxHeight: 'calc(100vh - 320px)', overflowX: 'hidden' }}
                onScrolledToBottom={fetchNextPage}
              >
                <ListItems
                  resourceName={t('product')}
                  type={LIST_VIEW_TYPE.LIST}
                  items={bluePrintsFormatted}
                  components={blueprint => (
                    <Text as="p" variant="bodySm" alignment="center">
                      {blueprint.alt}
                    </Text>
                  )}
                  subComponent={(blueprintId: string) => (
                    <Bleed marginInline={'400'}>
                      <Box
                        paddingBlock={'200'}
                        paddingInline={'1000'}
                        borderColor="border"
                        borderBlockStartWidth="025"
                        borderBlockEndWidth="025"
                      >
                        <AdvancedBlueprintInfo blueprintId={blueprintId} />
                      </Box>
                    </Bleed>
                  )}
                  onClickItem={handleClickItem}
                  emptySearchMockup={emptySearchMarkup}
                  emptyState={<EmptySearchMarkup resourceName={'product'} />}
                />
                {isFetchNextPage && (
                  <InlineStack align="center">
                    <Spinner size="small" />
                  </InlineStack>
                )}
              </Scrollable>
            )}
          </Modal.Section>
        )}
      </div>
    </Modal>
  )
}
