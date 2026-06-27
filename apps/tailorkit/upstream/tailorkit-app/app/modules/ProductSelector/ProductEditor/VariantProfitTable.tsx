import type { VariantProfitTableProps } from '~/modules/ProductSelector/type'
import type { AppliedFilterInterface, NonEmptyArray } from '@shopify/polaris/build/ts/src/types'
import type { IndexTableHeading } from '@shopify/polaris/build/ts/src/components/IndexTable/IndexTable'
import { useTranslation } from 'react-i18next'
import { useCallback, useMemo, useState } from 'react'
import { camelToTitleCase } from '~/bootstrap/fns/misc'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import {
  calculateFinalPrice,
  calculateProfitMargin,
} from '~/routes/settings_.providers.product.$id/components/VariantsConfig/fns'
import {
  IndexTable,
  TextField,
  Text,
  useIndexResourceState,
  ChoiceList,
  BlockStack,
  IndexFilters,
  IndexFiltersMode,
  useSetIndexFiltersMode,
  Box,
  Modal,
} from '@shopify/polaris'

export default function VariantProfitTable({ options, variants, disabled, onUpdateVariants }: VariantProfitTableProps) {
  const { t } = useTranslation()

  // Track event
  const { trackEvent } = useEventsTracking()

  // Define resources
  const resourceName = {
    singular: 'variant',
    plural: 'variants',
  }

  // Handle field updates
  const handleFieldChange = useCallback(
    (id: string | string[], field: string, value: string) => {
      const idsToUpdate = (id instanceof Array ? id : [id]).map(id => Number(id))

      const _variants = variants.map((variant: any) => {
        if (idsToUpdate.includes(variant.id)) {
          variant[field] = Number(value)

          if (field === 'cost') {
            variant.profit = variant.price - variant.cost
            variant.margin = calculateProfitMargin(variant.cost, variant.price)
          } else if (field === 'margin') {
            variant.price = calculateFinalPrice(variant.cost, variant.margin)
            variant.profit = variant.price - variant.cost
          } else if (field === 'price') {
            variant.profit = variant.price - variant.cost
            variant.margin = calculateProfitMargin(variant.cost, variant.price)
          } else if (field === 'profit') {
            variant.price = variant.cost + variant.profit
            variant.margin = calculateProfitMargin(variant.cost, variant.price)
          }

          ;['cost', 'margin', 'price', 'profit'].forEach(field => {
            variant[field] = parseFloat(Number(variant[field]).toFixed(2))
          })
        }

        return variant
      })

      onUpdateVariants?.(_variants)

      // Track event
      trackEvent(EVENTS_TRACKING.CHANGE_VARIANT_PROFIT, { id, field, value })
    },
    [onUpdateVariants, trackEvent, variants]
  )

  // Table filters
  const { mode, setMode } = useSetIndexFiltersMode(IndexFiltersMode.Default)

  const [queryValue, setQueryValue] = useState<string>()
  const [selectedFilters, setSelectedFilters] = useState<{ [key: string]: string[] }>()

  const handleQueryClear = useCallback(() => setQueryValue(''), [])
  const handleQueryChange = useCallback((value: string) => setQueryValue(value), [])

  const handleSelectFilters = useCallback(
    (optionType: string, values: string[]) => setSelectedFilters(prev => ({ ...prev, [optionType]: values })),
    []
  )

  const handleClearAllFilters = useCallback(() => {
    setSelectedFilters({})
  }, [])

  const handleCancelFilters = useCallback(() => {
    handleQueryClear()
    handleClearAllFilters()
    setMode(IndexFiltersMode.Default)
  }, [handleClearAllFilters, handleQueryClear, setMode])

  const filters = useMemo(
    () =>
      Object.keys(options).map(optionType => ({
        key: optionType,
        label: camelToTitleCase(optionType),
        filter: (
          <ChoiceList
            titleHidden
            allowMultiple
            title={camelToTitleCase(optionType)}
            selected={selectedFilters?.[optionType] || []}
            onChange={(values: string[]) => handleSelectFilters(optionType, values)}
            choices={options[optionType].map(option => ({ label: option, value: option }))}
          />
        ),
      })),
    [handleSelectFilters, options, selectedFilters]
  )

  const appliedFilters = useMemo(() => {
    const appliedFilters: AppliedFilterInterface[] = []

    if (selectedFilters && Object.keys(selectedFilters).length) {
      Object.keys(selectedFilters).forEach(optionType => {
        if (selectedFilters?.[optionType]?.length) {
          appliedFilters.push({
            key: optionType,
            label: `${camelToTitleCase(optionType)}: ${selectedFilters?.[optionType]?.join(', ')}`,
            onRemove: () => handleSelectFilters(optionType, []),
          })
        }
      })
    }

    return appliedFilters
  }, [handleSelectFilters, selectedFilters])

  const filteredVariants = useMemo(() => {
    return (
      selectedFilters && Object.keys(selectedFilters).length
        ? variants.filter(variant => {
            return Object.keys(selectedFilters).every(optionType => {
              return (
                !selectedFilters[optionType].length || selectedFilters[optionType].includes(variant.options[optionType])
              )
            })
          })
        : variants
    ).filter(variant => !queryValue || variant.title.toLowerCase().indexOf(queryValue.toLowerCase()) > -1)
  }, [selectedFilters, queryValue, variants])

  const { selectedResources, handleSelectionChange } = useIndexResourceState(
    filteredVariants.map(v => ({ ...v, id: `${v.id}` }))
  )

  // Bulk actions
  const [bulkEditField, setBulkEditField] = useState<string>()
  const [bulkEditValue, setBulkEditValue] = useState<string>()
  const [bulkEditModalOpen, setBulkEditModalOpen] = useState(false)

  const closeBulkEditModal = useCallback(() => {
    setBulkEditField(undefined)
    setBulkEditValue(undefined)
    setBulkEditModalOpen(false)
  }, [])

  const bulkEdit = useCallback((field: string) => {
    setBulkEditField(field)
    setBulkEditModalOpen(true)
  }, [])

  const applyBulkEdit = useCallback(() => {
    closeBulkEditModal()

    if (bulkEditField && bulkEditValue) {
      handleFieldChange(selectedResources, bulkEditField, bulkEditValue)
    }
  }, [bulkEditField, bulkEditValue, closeBulkEditModal, handleFieldChange, selectedResources])

  const bulkActions = [
    {
      content: t('edit-cost'),
      onAction: () => bulkEdit('cost'),
    },
    {
      content: t('edit-margin'),
      onAction: () => bulkEdit('margin'),
    },
    {
      content: t('edit-price'),
      onAction: () => bulkEdit('price'),
    },
    {
      content: t('edit-profit'),
      onAction: () => bulkEdit('profit'),
    },
  ]

  // Table headings
  const headings = [
    { title: t('variant') },
    { title: t('cost') },
    { title: t('margin') },
    { title: t('price') },
    { title: t('profit') },
  ]

  // Table rows
  const rowMarkup = useMemo(
    () =>
      filteredVariants.map(({ id, title, cost, margin, price, profit }, index) => (
        <IndexTable.Row id={`${id}`} key={`${id}`} selected={selectedResources.includes(`${id}`)} position={index}>
          <IndexTable.Cell>
            <Box maxWidth="150px">
              <Text truncate as="span" variant="bodyMd">
                {title}
              </Text>
            </Box>
          </IndexTable.Cell>

          <IndexTable.Cell>
            <TextField
              label=""
              prefix="$"
              size="slim"
              autoComplete="off"
              disabled={disabled}
              value={`${cost || 0}`}
              onChange={value => handleFieldChange(`${id}`, 'cost', value)}
            />
          </IndexTable.Cell>

          <IndexTable.Cell>
            <TextField
              label=""
              suffix="%"
              size="slim"
              autoComplete="off"
              disabled={disabled}
              value={`${margin || 0}`}
              onChange={value => handleFieldChange(`${id}`, 'margin', value)}
            />
          </IndexTable.Cell>

          <IndexTable.Cell>
            <TextField
              label=""
              prefix="$"
              size="slim"
              autoComplete="off"
              disabled={disabled}
              value={`${price || 0}`}
              onChange={value => handleFieldChange(`${id}`, 'price', value)}
            />
          </IndexTable.Cell>

          <IndexTable.Cell>
            <TextField
              label=""
              prefix="$"
              size="slim"
              autoComplete="off"
              disabled={disabled}
              value={`${profit || 0}`}
              onChange={value => handleFieldChange(`${id}`, 'profit', value)}
            />
          </IndexTable.Cell>
        </IndexTable.Row>
      )),
    [disabled, filteredVariants, handleFieldChange, selectedResources]
  )

  return (
    <>
      <BlockStack>
        <IndexFilters
          tabs={[]}
          mode={mode}
          selected={0}
          setMode={setMode}
          filters={filters}
          queryValue={queryValue}
          onQueryClear={handleQueryClear}
          appliedFilters={appliedFilters}
          closeOnChildOverlayClick={true}
          onQueryChange={handleQueryChange}
          onClearAll={handleClearAllFilters}
          queryPlaceholder={t('search-variants')}
          cancelAction={{
            loading: false,
            disabled: false,
            onAction: handleCancelFilters,
          }}
        />

        <IndexTable
          selectable
          bulkActions={bulkActions}
          resourceName={resourceName}
          itemCount={filteredVariants.length}
          onSelectionChange={handleSelectionChange}
          selectedItemsCount={selectedResources.length}
          headings={headings as NonEmptyArray<IndexTableHeading>}
        >
          {rowMarkup}
        </IndexTable>
      </BlockStack>

      {bulkEditModalOpen && bulkEditField && (
        <Modal
          size="small"
          title={t('bulk-edit')}
          open={bulkEditModalOpen}
          onClose={closeBulkEditModal}
          primaryAction={{
            content: t('save'),
            onAction: applyBulkEdit,
          }}
          secondaryActions={[
            {
              content: t('cancel'),
              onAction: closeBulkEditModal,
            },
          ]}
        >
          <Modal.Section>
            <TextField
              autoComplete="off"
              value={bulkEditValue || '0'}
              label={t(camelToTitleCase(bulkEditField))}
              onChange={value => setBulkEditValue(value)}
              prefix={bulkEditField !== 'margin' ? '$' : undefined}
              suffix={bulkEditField === 'margin' ? '%' : undefined}
            />
          </Modal.Section>
        </Modal>
      )}
    </>
  )
}
