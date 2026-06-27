import type { WithTranslationProps } from '~/bootstrap/hoc/withTranslation'
import ListTable, { type ListTableComponent } from '~/components/ListTable'
import withNavMenu from '~/bootstrap/hoc/withNavMenu'
import { ILLUSTRATORS } from '~/constants/assets-url'
import { authenticatedFetch } from '~/shopify/fns.client'
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useLoaderData, useRevalidator, useSearchParams } from '@remix-run/react'
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  ChoiceList,
  EmptyState,
  Icon,
  type IndexFiltersProps,
  IndexTable,
  //InlineStack,
  Modal,
  Page,
  Popover,
  Text,
  Thumbnail,
  useBreakpoints,
} from '@shopify/polaris'
/*import { openInNewTab } from '~/utils/openInNewTab'
import { ELink } from '~/constants/enum'*/
import { type EOptionSet } from '~/types/psd'
import dateFormat from 'dateformat'
import { getDistanceToNow } from '~/bootstrap/fns/time'
import { OPTION_SET_TYPE_FORMATTED, THUMBNAILS_OPTION_SET } from './constants'
import { DeleteIcon, DuplicateIcon } from '@shopify/polaris-icons'
import { showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'

import { HydrateFallback } from '~/routes/dashboard/route'
import { TEMPLATE_TYPE } from '../api.templates/constants'
import { LIBRARY_ACTIONS } from '../api.libraries/constants'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { getShopifyThumbnail } from '~/utils/loadImage'
import styles from './styles.css?url'
import { withInteractiveChat } from '~/modules/InteractiveChat/withInteractiveChat'

export { HydrateFallback }
export const links = () => [{ rel: 'stylesheet', href: styles }]

export const clientLoader = async () => {
  // Find all saved views
  const { items: views } = (await authenticatedFetch(`/api/views?path=${location.pathname}`)) || {}

  return { views }
}

// Define a variable to hold a reference to the list table instance
let tableRef: ListTableComponent<any, any>
interface IModalDelete {
  open: boolean
  type: string
  content: string
  assetActive: any[]
  assetInActive: any[]
}

const Index = withNavMenu(function Index(props: WithTranslationProps) {
  const { t } = props

  const { smDown } = useBreakpoints()
  const { views = [] } = useLoaderData<typeof clientLoader>() || {}
  const [searchParams] = useSearchParams()
  const defaultTab = searchParams.get('tab')

  const { revalidate } = useRevalidator()

  useEffect(() => {
    revalidate()
  }, [revalidate])

  const { trackEvent } = useEventsTracking()

  useLayoutEffect(() => {
    trackEvent(EVENTS_TRACKING.OPEN_LIBRARIES_INDEX)
  }, [trackEvent])

  // const navigate = useNavigate()
  // const id = uuid()

  // const [createButtonActive, setCreateButtonActive] = useState(false)
  const [collectionPopoverActive, setCollectionPopoverActive] = useState(false)
  const [shouldLoadAllHeadings, setShouldLoadAllHeadings] = useState<boolean>(false)

  const [refresh, setRefresh] = useState<any>()

  // Define state for the modal delete option sets
  const [modalDelete, setModalDelete] = useState<IModalDelete>({
    open: false,
    type: 'delete',
    content: '',
    assetActive: [],
    assetInActive: [],
  })

  const [warningBannerStatus, setWarningBannerStatus] = useState({ showing: false, title: '', content: '' })

  const toggleModalDelete = useCallback(
    (modalDeleteState: IModalDelete) => {
      setModalDelete({ ...modalDeleteState, open: !modalDelete.open })
    },
    [modalDelete]
  )

  const closeModalDelete = useCallback(() => setModalDelete({ ...modalDelete, open: false }), [modalDelete])

  // Define resource name
  const resourceName = useMemo(
    () => ({
      singular: t('asset'),
      plural: t('assets'),
    }),
    [t]
  )

  const allHeadings = useMemo(
    () => [
      {
        id: 'thumbnail',
        title: (
          <Text as={'span'} visuallyHidden>
            {t('thumbnail')}
          </Text>
        ),
      },
      {
        id: 'name',
        title: t('name'),
      },
      {
        id: 'status',
        title: t('status'),
      },
      {
        id: 'number-of-uses',
        title: t('number-of-uses'),
      },
      {
        id: 'type',
        title: t('type'),
      },
      {
        id: 'collection',
        title: t('collection'),
      },
      {
        id: 'created-date',
        title: t('date-created'),
      },
      {
        id: 'updated-date',
        title: t('last-update'),
      },
    ],
    [t]
  )

  const headings = useMemo(() => {
    let hiddenColumns: string[] = []

    if (!shouldLoadAllHeadings) {
      hiddenColumns = ['number-of-uses', 'status', 'collection', 'created-date', 'updated-date']
    }
    const headings = allHeadings.filter(heading => !hiddenColumns.includes(heading.id))

    return headings
  }, [allHeadings, shouldLoadAllHeadings])

  const filterViews = useMemo(
    () => [
      ...Object.entries(OPTION_SET_TYPE_FORMATTED).map(([key, value]) => ({
        id: key,
        name: t(value),
        filters: { queryValue: '', type: [key] },
        actions: [],
      })),
      ...views,
    ],
    [t, views]
  )

  const defaultFilterBy = useMemo(() => {
    return filterViews.find(filter => filter.id === defaultTab)
  }, [defaultTab, filterViews])

  const disabledSelectable = useMemo(() => {
    return [TEMPLATE_TYPE.PREMADE_TEMPLATE]
  }, [])

  // const toggleCreatePopover = useCallback(() => {
  //   setCreateButtonActive(!createButtonActive)
  // }, [createButtonActive])

  const toggleCollectionPopover = useCallback(() => {
    setCollectionPopoverActive(!collectionPopoverActive)
  }, [collectionPopoverActive])

  const getActiveInactiveItems = useCallback((selectedResources: any[]) => {
    const assets = selectedResources.reduce(
      (assets: { assetActive: any[]; assetInActive: any[] }, resource: any) => {
        if (resource.type !== TEMPLATE_TYPE.CLIPART && resource.status === 'active') {
          assets.assetActive.push(resource)
          return assets
        }

        assets.assetInActive.push(resource)
        return assets
      },
      { assetActive: [], assetInActive: [] }
    )

    return assets
  }, [])

  // Define function to duplicate items
  const duplicateItems = useCallback(async () => {
    showToast(t(TOAST.LIBRARY_LISTING.DUPLICATING))

    const itemsSelected = tableRef?.getSelectedResources() || []
    if (itemsSelected && itemsSelected.length > 0) {
      const res = await authenticatedFetch(`/api/libraries?action=${LIBRARY_ACTIONS.DUPLICATE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ selectedResources: tableRef?.getSelectedResources() }),
      })

      if (res?.success) {
        showToast(t(TOAST.LIBRARY_LISTING.DUPLICATED))
        setRefresh({})
        tableRef?.clearAllSelection()
      } else {
        showToast(t(TOAST.LIBRARY_LISTING.DUPLICATE_FAILED), { isError: true })
      }
    }
  }, [t])

  // Define function to delete items
  const deleteItems = useCallback(() => {
    const listItems: any[] = tableRef?.props?.items || []
    const selectedItemIds: string[] = tableRef?.getSelectedResources() || []
    const selectedResources = listItems.filter(item => selectedItemIds.includes(item.refId))
    const assets = getActiveInactiveItems(selectedResources)

    const { assetActive, assetInActive } = assets
    const modalDeleteStatus: IModalDelete = {
      open: true,
      type: 'delete',
      content: t('do-you-want-to-delete-count-item-s', { count: selectedResources.length }),
      assetActive,
      assetInActive,
    }

    toggleModalDelete(modalDeleteStatus)
  }, [getActiveInactiveItems, t, toggleModalDelete])

  // Define function to delete option sets
  const deleteOptionSets = useCallback(async () => {
    const { assetActive, assetInActive } = modalDelete

    if (assetInActive.length > 0) {
      showToast(t(TOAST.LIBRARY_LISTING.DELETING))

      const assetInActiveIds = assetInActive.map(asset => asset.refId)
      const res = await authenticatedFetch(`/api/libraries?action=${LIBRARY_ACTIONS.DELETE}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ selectedResources: assetInActiveIds }),
      })

      if (res?.success) {
        showToast(t(TOAST.LIBRARY_LISTING.DELETED))
        tableRef?.clearAllSelection()
      } else {
        showToast(t(TOAST.LIBRARY_LISTING.DELETE_FAILED), { isError: true })
      }
    }

    if (assetActive.length > 0) {
      setWarningBannerStatus({
        showing: true,
        title: t('deletion-failed-for-some-templates'),
        content:
          assetActive.length > 1
            ? t('option-sets-are-active-they-are-used-with-templates')
            : t('this-option-set-is-active-it-is-used-with-template'),
      })
    }

    setRefresh({})
    closeModalDelete()
  }, [closeModalDelete, modalDelete, t])

  // Define options for filtering option sets
  const filters = useMemo(
    () => [
      {
        key: 'status',
        label: t('status'),
        filter: {
          Component: ChoiceList,
          props: {
            titleHidden: true,
            allowMultiple: false,
            title: t('status'),
            choices: [
              { value: 'active', label: t('active') },
              { value: 'inactive', label: t('inactive') },
            ],
          },
        },
        shortcut: true,
      },
      {
        key: 'type',
        label: t('type'),
        filter: {
          Component: ChoiceList,
          props: {
            titleHidden: true,
            allowMultiple: true,
            title: t('type'),
            choices: Object.entries(OPTION_SET_TYPE_FORMATTED).map(([key, value]) => ({
              value: key,
              label: t(value),
            })),
          },
        },
        shortcut: true,
      },
    ],
    [t]
  )

  // Define options for sorting option sets
  const sortOptions: IndexFiltersProps['sortOptions'] = useMemo(
    () => [
      { label: t('name'), value: 'name asc', directionLabel: t('a-z') },
      { label: t('name'), value: 'name desc', directionLabel: t('z-a') },
      { label: t('last-updated'), value: 'updatedAt asc', directionLabel: t('oldest-first') },
      { label: t('last-updated'), value: 'updatedAt desc', directionLabel: t('newest-first') },
      { label: t('collections'), value: 'collectionCounting asc', directionLabel: t('lowest-first') },
      { label: t('collections'), value: 'collectionCounting desc', directionLabel: t('highest-first') },
    ],
    [t]
  )

  // Generate create new Option set button
  // const createButtonActivator = (
  //   <Button disclosure variant="primary" onClick={toggleCreatePopover}>
  //     {t('create-asset')}
  //   </Button>
  // )

  // Define promoted bulk actions
  const promotedBulkActions = useMemo(
    () => [
      {
        content: <Icon source={DuplicateIcon} />,
        accessibilityLabel: t('duplicate-item'),
        onAction: duplicateItems,
      },
      {
        content: <Icon source={DeleteIcon} tone="textCritical" />,
        accessibilityLabel: t('delete-item'),
        destructive: true,
        onAction: deleteItems,
      },
    ],
    [t, duplicateItems, deleteItems]
  )

  const onAfterLoadItems = useCallback((items: any[]) => {
    const shouldLoadAllHeadings = items.some((item: any) => !item.isFromTailorkit)
    setShouldLoadAllHeadings(shouldLoadAllHeadings)
  }, [])

  // Define function to render filter label
  const renderFilterLabel = useCallback(
    (key: string, value: string | any[]): string => {
      switch (key) {
        case 'status':
          return `${t('status')}: ${t(value).toLowerCase()}`

        case 'type':
          return `${t('type')}: ${(value instanceof Array ? value : [value]).map(val => t(OPTION_SET_TYPE_FORMATTED[val]).toLowerCase()).join(', ')}`

        default:
          return value as string
      }
    },
    [t]
  )

  // Generate markup for empty state
  const emptyState = useMemo(
    () => (
      <BlockStack gap={'500'}>
        <Card roundedAbove="sm">
          <BlockStack align="center">
            <EmptyState heading={t('no-data-yet')} image={ILLUSTRATORS.EMPTY_TEMPLATE}>
              <BlockStack gap={'200'}>
                <Text variant="bodyMd" as="p" tone="subdued">
                  {t('data-subtext')}
                </Text>
              </BlockStack>
            </EmptyState>
          </BlockStack>
        </Card>

        {/*<InlineStack gap={'100'} align="center">
          <Text as="p" variant="bodyMd">
            {t('learn-more-about')}
          </Text>
          <Button variant="plain" onClick={() => openInNewTab(ELink.HOW_TO_USE_OPTION_SET)}>
            {t('library').toLowerCase()}
          </Button>
        </InlineStack>*/}
      </BlockStack>
    ),
    [t]
  )

  // Define function to render row markup
  const renderRowMarkup = useCallback(
    (asset: any, index: number, selectedResources?: string[], ref?: any) => {
      // Save a reference to the list table instance
      tableRef = ref
      const {
        refId,
        name,
        createdAt,
        updatedAt,
        status,
        numberOfUses = 0,
        collection,
        type,
        previewUrl,
        isFromTailorkit,
      } = asset
      const typeUsed = [TEMPLATE_TYPE.CLIPART, TEMPLATE_TYPE.PREMADE_TEMPLATE].includes(type) ? 'template' : 'layer'

      const getNumberOfUsedKey = () => {
        if (numberOfUses === 0) {
          return { [`number-of-used-${typeUsed}`]: '00' }
        }
        if (numberOfUses < 2) {
          return { [`number-of-used-${typeUsed}`]: '01' }
        }

        if (numberOfUses >= 2 && numberOfUses < 10) {
          return { [`number-of-used-${typeUsed}s`]: `0${numberOfUses}` }
        }

        return { [`number-of-used-${typeUsed}s`]: numberOfUses }
      }

      const numberOfUsesKey = Object.entries(getNumberOfUsedKey()).map(([key, value]) => ({ key, value }))[0]

      return (
        <IndexTable.Row id={refId} key={refId} position={index} selected={selectedResources?.includes(refId)}>
          <IndexTable.Cell className="emtlkit--w-42">
            <Thumbnail
              source={getShopifyThumbnail(previewUrl) || THUMBNAILS_OPTION_SET[type]}
              alt={name}
              size={'extraSmall'}
            />
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Box maxWidth="350px">
              <Text as="p" variant="bodyMd" truncate>
                {name}
              </Text>
            </Box>
          </IndexTable.Cell>
          {!isFromTailorkit && (
            <Fragment>
              <IndexTable.Cell>
                <Badge tone={status === 'active' ? 'success' : 'enabled'}>{t(status)}</Badge>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Text truncate variant="bodyMd" as="span">
                  {t(numberOfUsesKey.key, { num: numberOfUsesKey.value })}
                </Text>
              </IndexTable.Cell>
            </Fragment>
          )}
          <IndexTable.Cell>
            <Text truncate variant="bodyMd" as="span">
              {t(OPTION_SET_TYPE_FORMATTED[type as EOptionSet])}
            </Text>
          </IndexTable.Cell>
          {!isFromTailorkit && (
            <Fragment>
              <IndexTable.Cell>
                {collection ? (
                  collection.length <= 1 ? (
                    <Text truncate variant="bodyMd" as="span">
                      {collection}
                    </Text>
                  ) : (
                    <Popover
                      activator={
                        <Button disclosure onClick={toggleCollectionPopover}>
                          {t(collection[0])}
                        </Button>
                      }
                      active={collectionPopoverActive}
                      onClose={() => setCollectionPopoverActive(false)}
                    ></Popover>
                  )
                ) : (
                  <Text truncate variant="bodyMd" as="span">
                    {t('none')}
                  </Text>
                )}
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Text variant="bodyMd" as="span">
                  {dateFormat(createdAt, 'mmm d, yyyy')}
                </Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Text variant="bodyMd" as="span">
                  {getDistanceToNow(updatedAt)}
                </Text>
              </IndexTable.Cell>
            </Fragment>
          )}
        </IndexTable.Row>
      )
    },
    [collectionPopoverActive, t, toggleCollectionPopover]
  )

  return (
    <Page
      title={t('library')}
      // primaryAction={
      //   <Popover
      //     activator={createButtonActivator}
      //     active={createButtonActive}
      //     onClose={() => setCreateButtonActive(false)}
      //   >
      //     <ActionList
      //       items={OPTION_SETS_OPTIONS.map(item => ({
      //         content: t(item.labelKey),
      //         onAction: () => {
      //           // navigate(`/option-sets/${id}?option_type=${item.value}`)
      //         },
      //       }))}
      //     />
      //   </Popover>
      // }
    >
      {warningBannerStatus.showing && (
        <Box paddingBlockEnd={'400'}>
          <Banner
            title={warningBannerStatus.title}
            tone="warning"
            onDismiss={() => setWarningBannerStatus({ ...warningBannerStatus, showing: false })}
          >
            <Text as="p" variant="bodyMd">
              {warningBannerStatus.content}
            </Text>
          </Banner>
        </Box>
      )}
      <ListTable
        queryKey="name"
        showTabAll={false}
        sort={['updatedAt desc']}
        dataSource="/api/libraries"
        defaultResourceKey={'refId'}
        condensed={smDown}
        disableStickyMode={smDown}
        t={t}
        filters={filters}
        refresh={refresh}
        views={filterViews}
        headings={headings}
        emptyState={emptyState}
        sortOptions={sortOptions}
        resourceName={resourceName}
        showFilterInSearchParams={false}
        disabledSelectable={disabledSelectable}
        promotedBulkActions={promotedBulkActions}
        defaultFilterBy={defaultFilterBy || filterViews[0]}
        renderRowMarkup={renderRowMarkup}
        onAfterLoadItems={onAfterLoadItems}
        renderFilterLabel={renderFilterLabel}
      />

      <Modal
        open={modalDelete.open}
        title={t('delete-count-item-s', { count: tableRef?.getSelectedResources()?.length || 0 })}
        onClose={closeModalDelete}
        primaryAction={
          modalDelete.type === 'delete'
            ? {
                content: t('delete'),
                destructive: true,
                onAction: deleteOptionSets,
              }
            : undefined
        }
        secondaryActions={[
          {
            content: t('cancel'),
            onAction: closeModalDelete,
          },
        ]}
      >
        <Modal.Section>{modalDelete.content}</Modal.Section>
      </Modal>
    </Page>
  )
})

export default withInteractiveChat(Index)
