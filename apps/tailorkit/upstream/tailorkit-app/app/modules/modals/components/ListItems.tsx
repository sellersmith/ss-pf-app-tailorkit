import type { InlineGridProps } from '@shopify/polaris'
import { InlineGrid, Pagination, Box, InlineStack, Text } from '@shopify/polaris'
import { Fragment } from 'react'
import { GridItem } from './GridItem'
import { ThumbnailSkeleton } from './ThumbnailSkeleton'
import { ListItem } from './ListItem'
import EmptySearchMarkup from '../ImageSelector/components/EmptySearchMarkup'
import { TemplateGridItem } from './TemplateGridItem'
import { usePagination } from '~/utils/hooks/usePagination'

export interface IItem {
  _id: string
  previewUrl: string
  alt?: string
  selected?: boolean
  isUploading?: boolean
  isSelecting?: boolean
  stylesImageItem?: React.CSSProperties
  productPageUrl?: string
  [key: string]: any
}

export enum LIST_VIEW_TYPE {
  LIST = 'list',
  GRID = 'grid',
}

interface IListItemsProps {
  type: LIST_VIEW_TYPE
  isLoading?: boolean
  allowMultiple?: boolean
  resourceName: string
  queryString?: string
  items: IItem[]
  emptySearchMockup?: React.ReactNode
  emptyState?: React.ReactNode
  limit?: number
  gridColumns?: InlineGridProps['columns']
  stylesImageItem?: React.CSSProperties
  showCheckbox?: boolean
  imageInSpecificWidth?: number
  showTitle?: boolean
  showViewDemoButton?: boolean
  showSelectButton?: boolean
  components?: (item: IItem) => React.ReactNode
  onClickItem?: (newCheck: boolean, item: IItem) => void
  subComponent?: (id: string) => React.ReactNode
}

export const ListItems = (props: IListItemsProps) => {
  const {
    type,
    isLoading,
    items,
    resourceName,
    emptySearchMockup,
    queryString,
    emptyState,
    limit,
    gridColumns = { xs: 2, md: 4 },
    stylesImageItem,
    showCheckbox = true,
    showTitle,
    showViewDemoButton,
    showSelectButton,
    components,
    onClickItem,
    subComponent,
    imageInSpecificWidth = 180,
  } = props

  // Pagination configuration
  const ITEMS_PER_PAGE = 20
  const { currentData, currentPage, totalPages, isFirstPage, isLastPage, nextPage, previousPage, totalItems }
    = usePagination({
      data: items,
      itemsPerPage: ITEMS_PER_PAGE,
      initialPage: 1,
    })

  const dataIsEmpty = !items.length && !isLoading
  const isEmptyState = !queryString && dataIsEmpty
  const isEmptySearch = queryString && dataIsEmpty

  if (isEmptyState) {
    return emptyState || <EmptySearchMarkup resourceName={resourceName} />
  }

  if (isEmptySearch) {
    return emptySearchMockup || <EmptySearchMarkup resourceName={resourceName} />
  }

  if (type === 'grid') {
    return (
      <>
        <InlineGrid columns={gridColumns} alignItems="start" gap="400">
          {currentData.map((item, index) => {
            const { _id } = item

            if (components) {
              return (
                <GridItem
                  imageInSpecificWidth={imageInSpecificWidth}
                  stylesImageItem={stylesImageItem}
                  key={_id}
                  item={item}
                  showCheckbox={showCheckbox}
                  onClickItem={onClickItem}
                  components={components}
                />
              )
            }

            return (
              <TemplateGridItem
                imageInSpecificWidth={imageInSpecificWidth}
                stylesImageItem={stylesImageItem}
                key={_id}
                item={item}
                index={index}
                showCheckbox={showCheckbox}
                showTitle={showTitle}
                showViewDemoButton={showViewDemoButton}
                showSelectButton={showSelectButton}
                productPageUrl={item.productPageUrl}
                onClickItem={onClickItem}
              />
            )
          })}

          {isLoading ? <ThumbnailSkeleton stylesImageItem={stylesImageItem} quantity={limit} /> : null}
        </InlineGrid>

        {totalItems > ITEMS_PER_PAGE && (
          <Box padding={'200'}>
            <InlineStack gap={'300'} blockAlign="center">
              <Pagination
                hasPrevious={!isFirstPage}
                onPrevious={previousPage}
                hasNext={!isLastPage}
                onNext={nextPage}
              />
              <Text as="p" variant="bodyMd" tone="subdued">
                Page {currentPage} of {totalPages}
              </Text>
            </InlineStack>
          </Box>
        )}
      </>
    )
  }

  return (
    <>
      <InlineGrid columns={'1'} alignItems="start" gap={'200'}>
        {currentData.map(item => {
          const { _id } = item

          return (
            <Fragment key={_id}>
              <ListItem
                showCheckbox={showCheckbox}
                stylesImageItem={stylesImageItem}
                item={item}
                onClickItem={onClickItem}
                components={components}
              />
              {subComponent && subComponent(_id)}
            </Fragment>
          )
        })}
      </InlineGrid>

      {totalItems > ITEMS_PER_PAGE && (
        <Box padding={'200'}>
          <InlineStack gap={'300'} blockAlign="center">
            <Pagination hasPrevious={!isFirstPage} onPrevious={previousPage} hasNext={!isLastPage} onNext={nextPage} />
            <Text as="p" variant="bodyMd" tone="subdued">
              Page {currentPage} of {totalPages}
            </Text>
          </InlineStack>
        </Box>
      )}
    </>
  )
}
