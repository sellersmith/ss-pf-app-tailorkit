import { BlockStack, Box, Divider, IndexTable, InlineStack, Pagination, Scrollable, Text } from '@shopify/polaris'
import { type IndexTableHeading } from '@shopify/polaris/build/ts/src/components/IndexTable'
import { type NonEmptyArray } from '@shopify/polaris/build/ts/src/types'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '~/libs/external-store'
import { usePagination } from '~/utils/hooks/usePagination'
import PrintAreaTableCell from './PrintAreaTableCell'
import { ProductProviderStore } from '~/routes/settings_.providers.product.$id/stores/productProviderStore'

export interface IPlaceholder {
  variantName: string
  position: string
  width: number
  height: number
}

const ITEMS_PER_PAGE = 25

export const PrintAreaTable = () => {
  const { t } = useTranslation()
  const variants = useStore(ProductProviderStore, state => state.variants)

  const placeholders = useMemo(() => {
    let placeholders: IPlaceholder[] = []
    for (const variant of variants) {
      const variantPlaceholders = variant.placeholders || []
      const placeholdersWithVariant = variantPlaceholders.map(placeholder => ({
        variantName: variant.title,
        ...placeholder,
      }))

      placeholders = [...placeholders, ...placeholdersWithVariant]
    }

    return placeholders
  }, [variants])

  const headings: NonEmptyArray<IndexTableHeading> = useMemo(
    () => [
      {
        id: 'print-name',
        title: t('name'),
      },
      {
        id: 'print-areas',
        title: t('areas'),
      },
      {
        id: 'print-width',
        title: t('width'),
      },
      {
        id: 'print-height',
        title: t('height'),
      },
    ],
    [t]
  )

  // Paginate the placeholders data
  const { currentData, currentPage, totalPages, isFirstPage, isLastPage, nextPage, previousPage, totalItems }
    = usePagination({
      data: placeholders,
      itemsPerPage: ITEMS_PER_PAGE,
      initialPage: 1,
    })

  return (
    <BlockStack gap={'200'}>
      <Divider borderColor="border" />
      <Text as="p" variant="bodyMd" fontWeight="medium">
        {t('print-areas')}
      </Text>
      <Scrollable style={{ height: '280px', maxHeight: '280px' }}>
        <div className="print-areas-table">
          <IndexTable headings={headings} itemCount={placeholders.length} selectable={false}>
            {currentData.map((placeholder, index) => (
              <PrintAreaTableCell key={index} placeholder={placeholder} index={index} />
            ))}
          </IndexTable>
        </div>
      </Scrollable>
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
    </BlockStack>
  )
}
