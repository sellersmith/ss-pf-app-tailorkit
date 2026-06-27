import type { IndexFiltersProps } from '@shopify/polaris'
import { BlockStack, Card, EmptyState, Icon, Modal, Page, Text } from '@shopify/polaris'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckboxService } from '~/api/services/checkboxes'
import { NavMenuItems } from '~/bootstrap/app-config'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import ListTable, { type ListTableComponent } from '~/components/ListTable'
import { ILLUSTRATORS } from '~/constants/assets-url'
import type { CheckboxDocument } from '~/types/checkbox'
import useDevices from '~/utils/hooks/useDevice'
import { hideToast, showGenericErrorToast, showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import { renderFilters } from './render-filters'
import { renderResourceName } from './render-resource-name'
import { renderSortOptions } from './render-sort-options'
import RowMarkupDesktop from './RowMarkupDesktop'
import RowMarkupMobile from './RowMarkupMobile'
import { PlusIcon } from '@shopify/polaris-icons'

// Define a variable to hold a reference to the list table instance
let tableRef: ListTableComponent<any, any>

const TABLE_SORT_DEFAULT = ['updatedAt desc']

interface CheckboxesIndexRouteClientProps {
  checkboxCount: number
  upsellProductLimit: number | null
}

export default function CheckboxesIndexRouteClient({
  checkboxCount,
  upsellProductLimit,
}: CheckboxesIndexRouteClientProps) {
  const { t } = useTranslation()
  const { isMobileView } = useDevices()
  const { trackEvent } = useEventsTracking()
  const hasTrackedView = useRef(false)

  // Track page view (only once)
  useEffect(() => {
    if (!hasTrackedView.current) {
      trackEvent(EVENTS_TRACKING.CHECKBOX_LIST_VIEWED)
      hasTrackedView.current = true
    }
  }, [trackEvent])

  // State for refresh trigger and modals
  const [refresh, setRefresh] = useState<any>()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showActivateModal, setShowActivateModal] = useState(false)
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)

  // Define options for filtering checkboxes
  const filters = useMemo(() => renderFilters({ t }), [t])

  // Define options for sorting checkboxes
  const sortOptions: IndexFiltersProps['sortOptions'] = useMemo(() => renderSortOptions({ t }), [t])

  // Define resource name
  const resourceName = useMemo(() => renderResourceName({ t }), [t])

  // Define table headings
  const headings = useMemo(
    () => [
      { id: 'title', title: t('title') },
      { id: 'status', title: t('status') },
      { id: 'placement', title: t('placement') },
      { id: 'last-updated', title: t('last-updated') },
    ],
    [t]
  )

  // Duplicate checkboxes handler
  const duplicateCheckboxes = useCallback(
    async (selectedIds?: string[]) => {
      const selectedResources = isMobileView ? selectedIds : tableRef?.getSelectedResources()

      if (!selectedResources?.length) {
        return
      }

      showToast(t(selectedResources.length > 1 ? TOAST.ADDON.DUPLICATING_MULTIPLE : TOAST.ADDON.DUPLICATING))

      const res = await CheckboxService.duplicate(selectedResources)

      if (res?.success) {
        showToast(t(selectedResources.length > 1 ? TOAST.ADDON.DUPLICATED_MULTIPLE : TOAST.ADDON.DUPLICATED))
      } else {
        showGenericErrorToast()
      }

      if (res?.success) {
        setRefresh({})
        tableRef?.clearAllSelection()
      }
    },
    [isMobileView, t]
  )

  // Delete checkboxes handler
  const deleteCheckboxes = useCallback(
    async (selectedIds?: string[]) => {
      const selectedResources = isMobileView ? selectedIds : tableRef?.getSelectedResources()

      if (!selectedResources?.length) {
        return
      }

      showToast(t(selectedResources.length > 1 ? TOAST.ADDON.DELETING_MULTIPLE : TOAST.ADDON.DELETING))

      const res = await CheckboxService.deleteMany(selectedResources)

      if (res?.success) {
        showToast(t(selectedResources.length > 1 ? TOAST.ADDON.DELETED_MULTIPLE : TOAST.ADDON.DELETED))
      } else {
        showGenericErrorToast()
      }

      setShowDeleteModal(false)

      if (res?.success) {
        setRefresh({})
        tableRef?.clearAllSelection()
      }
    },
    [isMobileView, t]
  )

  // Activate checkboxes handler
  const activateCheckboxes = useCallback(
    async (selectedIds?: string[]) => {
      const selectedResources = isMobileView ? selectedIds : tableRef?.getSelectedResources()

      if (!selectedResources?.length) {
        return
      }

      const infoToastKey = selectedResources.length > 1 ? TOAST.ADDON.ACTIVATING_MULTIPLE : TOAST.ADDON.ACTIVATING
      showToast(t(infoToastKey))

      const res = await CheckboxService.activate(selectedResources)

      hideToast(t(infoToastKey))

      if (res?.success) {
        showToast(t(selectedResources.length > 1 ? TOAST.ADDON.ACTIVATED_MULTIPLE : TOAST.ADDON.ACTIVATED))
      } else {
        showGenericErrorToast()
      }

      setShowActivateModal(false)

      if (res?.success) {
        setRefresh({})
        tableRef?.clearAllSelection()
      }
    },
    [isMobileView, t]
  )

  // Deactivate checkboxes handler
  const deactivateCheckboxes = useCallback(
    async (selectedIds?: string[]) => {
      const selectedResources = isMobileView ? selectedIds : tableRef?.getSelectedResources()

      if (!selectedResources?.length) {
        return
      }

      showToast(t(selectedResources.length > 1 ? TOAST.ADDON.DEACTIVATING_MULTIPLE : TOAST.ADDON.DEACTIVATING))

      const res = await CheckboxService.deactivate(selectedResources)

      if (res?.success) {
        showToast(t(selectedResources.length > 1 ? TOAST.ADDON.DEACTIVATED_MULTIPLE : TOAST.ADDON.DEACTIVATED))
      } else {
        showGenericErrorToast()
      }

      setShowDeactivateModal(false)

      if (res?.success) {
        setRefresh({})
        tableRef?.clearAllSelection()
      }
    },
    [isMobileView, t]
  )

  // Toggle modal functions
  const toggleDeleteModal = useCallback(() => setShowDeleteModal(prev => !prev), [])
  const toggleActivateModal = useCallback(() => setShowActivateModal(prev => !prev), [])
  const toggleDeactivateModal = useCallback(() => setShowDeactivateModal(prev => !prev), [])

  // Define promoted bulk actions
  const promotedBulkActions = useMemo(
    () => [
      {
        content: t('set-as-active'),
        onAction: toggleActivateModal,
      },
      {
        content: t('set-as-draft'),
        onAction: toggleDeactivateModal,
      },
    ],
    [t, toggleActivateModal, toggleDeactivateModal]
  )

  // Define standard bulk actions
  const bulkActions = useMemo(
    () => [
      {
        content: t('duplicate'),
        onAction: duplicateCheckboxes,
      },
      {
        content: (
          <Text tone="critical" as="span">
            {t('delete')}
          </Text>
        ),
        onAction: toggleDeleteModal,
      },
    ],
    [duplicateCheckboxes, t, toggleDeleteModal]
  )

  // Define function to render row markup
  const renderRowMarkup = useCallback(
    (checkbox: CheckboxDocument, index: number, selectedResources?: string[], ref?: any) => {
      // Save a reference to the list table instance
      tableRef = ref

      return isMobileView ? (
        <RowMarkupMobile
          checkbox={checkbox}
          index={index}
          selectedResources={selectedResources}
          tableRef={tableRef}
          onDuplicate={duplicateCheckboxes}
          onDelete={ids => {
            tableRef && (tableRef.getSelectedResources = () => ids)
            toggleDeleteModal()
          }}
          onActivate={ids => {
            tableRef && (tableRef.getSelectedResources = () => ids)
            toggleActivateModal()
          }}
          onDeactivate={ids => {
            tableRef && (tableRef.getSelectedResources = () => ids)
            toggleDeactivateModal()
          }}
        />
      ) : (
        <RowMarkupDesktop checkbox={checkbox} index={index} selectedResources={selectedResources} />
      )
    },
    [isMobileView, duplicateCheckboxes, toggleDeleteModal, toggleActivateModal, toggleDeactivateModal]
  )

  // Define function to render filter label
  const renderFilterLabel = useCallback(
    (key: string, value: string | any[]): string => {
      switch (key) {
        case 'status':
          return `${t('status')}: ${t(value as string)?.toLowerCase()}`
        case 'placement':
          return `${t('placement')}: ${t(value as string)?.toLowerCase()}`
        default:
          return value as string
      }
    },
    [t]
  )

  // Generate markup for empty state
  const emptyState = useMemo(
    () => (
      <BlockStack gap="500">
        <Card roundedAbove="sm">
          <BlockStack align="center">
            <EmptyState
              heading={t('empty-addon')}
              image={ILLUSTRATORS.EMPTY_TEMPLATE}
              action={{
                content: t('add-add-on-products'),
                url: `${NavMenuItems.STOREFRONT_SETUP_CHECKBOXES}/add`,
              }}
            >
              <BlockStack gap="200">
                <p>{t('empty-addon-description')}</p>
              </BlockStack>
            </EmptyState>
          </BlockStack>
        </Card>
      </BlockStack>
    ),
    [t]
  )

  // Get selected resources for modal title
  const selectedResources = tableRef?.getSelectedResources?.() || []
  const selectedResourceLength = selectedResources?.length || 0

  // Check if user has reached their upsell product limit
  const isAtLimit = upsellProductLimit !== null && checkboxCount >= upsellProductLimit

  return (
    <Page
      title={t('add-on-products')}
      fullWidth
      backAction={{
        url: NavMenuItems.STOREFRONT_SETUP_SALES,
      }}
      // @ts-ignore - content accepts JSX for mobile icon
      primaryAction={
        isAtLimit
          ? undefined
          : {
              content: isMobileView ? <Icon source={PlusIcon} /> : t('add-add-on-products'),
              url: `${NavMenuItems.STOREFRONT_SETUP_CHECKBOXES}/add`,
            }
      }
      secondaryActions={[
        {
          content: t('manage-styling'),
          url: NavMenuItems.STOREFRONT_SETUP_CHECKBOXES_STYLING,
        },
      ]}
    >
      <ListTable
        t={t}
        queryKey="title"
        refresh={refresh}
        filters={filters}
        headings={headings}
        emptyState={emptyState}
        sort={TABLE_SORT_DEFAULT}
        sortOptions={sortOptions}
        dataSource="/api/checkboxes"
        resourceName={resourceName}
        renderRowMarkup={renderRowMarkup}
        condensed={isMobileView}
        disableStickyMode={isMobileView}
        renderFilterLabel={renderFilterLabel}
        promotedBulkActions={promotedBulkActions}
        bulkActions={bulkActions}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal}
        onClose={toggleDeleteModal}
        title={
          selectedResourceLength > 1
            ? t('delete-num-addon-products', { num: selectedResourceLength })
            : t('delete-addon')
        }
        primaryAction={{
          destructive: true,
          content: t('delete'),
          onAction: deleteCheckboxes,
        }}
        secondaryActions={[
          {
            content: t('cancel'),
            onAction: toggleDeleteModal,
          },
        ]}
      >
        <Modal.Section>
          <Text as="span" variant="bodyMd">
            {t('delete-addon-confirmation')}
          </Text>
        </Modal.Section>
      </Modal>

      {/* Activate Confirmation Modal */}
      <Modal
        open={showActivateModal}
        onClose={toggleActivateModal}
        title={
          selectedResourceLength > 1
            ? t('activate-num-addon-products', { num: selectedResourceLength })
            : t('activate-addon')
        }
        primaryAction={{
          content: t('set-as-active'),
          onAction: activateCheckboxes,
        }}
        secondaryActions={[
          {
            content: t('cancel'),
            onAction: toggleActivateModal,
          },
        ]}
      >
        <Modal.Section>
          <Text as="span" variant="bodyMd">
            {t('activate-addon-confirmation')}
          </Text>
        </Modal.Section>
      </Modal>

      {/* Deactivate Confirmation Modal */}
      <Modal
        open={showDeactivateModal}
        onClose={toggleDeactivateModal}
        title={
          selectedResourceLength > 1
            ? t('deactivate-num-addon-products', { num: selectedResourceLength })
            : t('deactivate-addon')
        }
        primaryAction={{
          content: t('set-as-draft'),
          onAction: deactivateCheckboxes,
        }}
        secondaryActions={[
          {
            content: t('cancel'),
            onAction: toggleDeactivateModal,
          },
        ]}
      >
        <Modal.Section>
          <Text as="span" variant="bodyMd">
            {t('deactivate-addon-confirmation')}
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  )
}
