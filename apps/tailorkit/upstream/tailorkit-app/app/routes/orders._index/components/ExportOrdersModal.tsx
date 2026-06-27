import { BlockStack, ChoiceList, Modal, InlineStack, Checkbox, Text, Button } from '@shopify/polaris'
import { ExportIcon } from '@shopify/polaris-icons'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { authenticatedFetch } from '~/shopify/fns.client'
import { ORDER_CSV_COLUMNS } from '~/utils/csv'
import { showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'

export type ExportScope = 'page' | 'selected' | 'search' | 'all'

interface Props {
  open: boolean
  onClose: () => void
  selectedCount: number
  searchCount: number
  totalCount: number
  pageCount: number
  getSelectedIds: () => string[]
  getPageIds: () => string[]
  locationSearch: string
  t: (key: string) => string
}

/**
 * Modal for exporting orders to CSV
 */
export default function ExportOrdersModal(props: Props) {
  const {
    open,
    onClose,
    selectedCount,
    searchCount,
    totalCount,
    pageCount,
    getSelectedIds,
    getPageIds,
    locationSearch,
    t,
  } = props

  // Persist last used scope in localStorage
  const STORAGE_KEY = 'tlk_last_export_scope'
  // Scope of the export (current-page, selected orders, etc.)
  // Initialize optimistically – we'll refine in a useEffect below.
  const [scope, setScope] = useState<ExportScope>('all')
  // Default columns to be pre-selected when the modal first opens.
  // Keep this list in sync with product requirements / UX mocks.
  // NOTE: Keys must match those defined in ORDER_CSV_COLUMNS.
  const DEFAULT_COLUMN_KEYS: string[] = [
    'id', // Order ID
    'name',
    'product_sku',
    'product_name',
    'variant_id',
    'quantity',
    'design_file_url',
    'created_at',
    'email',
    'shipping_address.first_name',
    'shipping_address.last_name',
    'phone',
    'shipping_address.country_code',
    'shipping_address.address1',
    'shipping_address.city',
    'shipping_address.province',
    'shipping_address.zip',
  ]

  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set(DEFAULT_COLUMN_KEYS))

  // When the modal opens, decide which scope should be pre-selected.
  // Rules:
  //   1. Use the last scope chosen by the user (stored in localStorage) **if still valid**.
  //   2. If "selected" was stored but there are no selected orders, fall back to "page".
  //   3. If no previous choice, choose "selected" when there are selected orders, otherwise "page".
  useEffect(() => {
    if (!open) return

    let preferred = (localStorage.getItem(STORAGE_KEY) as ExportScope | null) || null

    // Validate preferred choice
    if (preferred === 'selected' && selectedCount === 0) {
      preferred = 'page'
    }

    if (!preferred) {
      preferred = selectedCount > 0 ? 'selected' : 'page'
    }

    setScope(preferred)
  }, [open, selectedCount])

  const options = useMemo(() => {
    return [
      {
        label: `${t('current-page') || 'Current page'} (${pageCount})`,
        value: 'page',
        disabled: pageCount === 0,
      },
      {
        label: `${t('all-orders')} (${totalCount})`,
        value: 'all',
        disabled: totalCount === 0,
      },
      {
        label: `${t('selected-orders')} (${selectedCount})`,
        value: 'selected',
        disabled: selectedCount === 0,
      },
      {
        label: `${searchCount} ${t('orders-matching-search') || 'orders matching your search'}`,
        value: 'search',
        disabled: searchCount === 0,
      },
    ]
  }, [pageCount, selectedCount, searchCount, totalCount, t])

  const toggleColumn = useCallback((key: string) => {
    setSelectedColumns(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  const selectAll = () => setSelectedColumns(new Set(ORDER_CSV_COLUMNS.map(c => c.key)))
  const deselectAll = () => setSelectedColumns(new Set())

  const handleExport = useCallback(async () => {
    try {
      localStorage.setItem(STORAGE_KEY, scope)
      showToast(t(TOAST.ORDER.EXPORTING))

      let url = `/api/orders/export?scope=${scope}`
      if (scope === 'selected') {
        const idsQuery = getSelectedIds().join(',')
        url += `&ids=${encodeURIComponent(idsQuery)}`
      }
      if (scope === 'page') {
        const idsQuery = getPageIds().join(',')
        url += `&scope=page&ids=${encodeURIComponent(idsQuery)}`
      }
      if (scope === 'search') {
        // Re-use current search params (remove leading ?)
        url += `&${locationSearch.replace(/^\?/, '')}`
      }
      if (selectedColumns.size) {
        url += `&columns=${Array.from(selectedColumns).join(',')}`
      }

      const response = await authenticatedFetch(url)

      if (response?.success) {
        if (response.emailed) {
          showToast(t(TOAST.ORDER.EMAILED))
          onClose()
          return
        }

        if (response.url) {
          showToast(t(TOAST.ORDER.EXPORTED))
          window.open(response.url, '_blank')
          onClose()
          return
        }
      }

      throw new Error('Export failed')
    } catch (e) {
      console.error(e)
      showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
    }
  }, [scope, getSelectedIds, getPageIds, locationSearch, t, onClose, selectedColumns])

  const columnsMarkup = useMemo(() => {
    return (
      <>
        <InlineStack align="end" gap="200">
          <Button disabled={selectedColumns.size === ORDER_CSV_COLUMNS.length} variant="plain" onClick={selectAll}>
            {t('select-all') || 'Select all'}
          </Button>
          <Button disabled={selectedColumns.size === 0} variant="plain" onClick={deselectAll}>
            {t('deselect-all') || 'Deselect all'}
          </Button>
        </InlineStack>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 8 }}>
          {ORDER_CSV_COLUMNS.map(col => (
            <Checkbox
              key={col.key}
              label={col.label}
              checked={selectedColumns.has(col.key)}
              onChange={() => toggleColumn(col.key)}
            />
          ))}
        </div>
      </>
    )
  }, [selectedColumns, toggleColumn, t])

  return (
    // Prevent page scroll when modal is open
    (
      usePreventPageScroll(open),
      (
        <Modal
          open={open}
          onClose={onClose}
          title={t('export-orders')}
          primaryAction={{
            icon: ExportIcon,
            disabled: selectedColumns.size === 0,
            content: t('export-orders'),
            onAction: handleExport,
          }}
          secondaryActions={[{ content: t('cancel'), onAction: onClose }]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <s-box>
                <ChoiceList
                  title={
                    <Text as="p" variant="bodyMd" fontWeight="medium">
                      {t('export')}
                    </Text>
                  }
                  choices={options}
                  selected={[scope]}
                  onChange={v => setScope(v[0] as ExportScope)}
                />
              </s-box>

              <InlineStack gap="200" align="space-between">
                <Text as="p" variant="bodyMd" fontWeight="medium">
                  {t('order-data-to-export') || 'Order data to export'}
                </Text>
                {columnsMarkup}
              </InlineStack>
            </BlockStack>
          </Modal.Section>
        </Modal>
      )
    )
  )
}
