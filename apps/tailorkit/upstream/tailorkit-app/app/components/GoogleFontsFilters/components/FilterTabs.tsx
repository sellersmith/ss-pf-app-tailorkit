import { BlockStack, Box, Button, InlineStack, Popover, Text, TextField } from '@shopify/polaris'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MultipleButtonToggle } from '~/components/Button/MultipleButtonToggle'
import { FilterCheckboxList, type FilterTabOption } from './FilterCheckboxList'
import { FilterTagList, type FilterTagItem } from './FilterTagList'

export interface FilterTab {
  id: string
  content: string
}

export interface FilterTabsProps {
  label: string
  placeholder: string
  inputValue: string
  onInputChange: (value: string) => void
  selectedValues: string[]
  onToggle: (value: string) => void
  onClear: () => void
  disabled?: boolean
  tabs: FilterTab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  currentTabOptions: FilterTabOption[]
  currentTabSelectedCount: number
  onSelectAllInTab: () => void
  onDeselectAllInTab: () => void
  labelMap: Map<string, string>
  onActiveStateChange?: (isActive: boolean) => void
  hasMore: boolean
  onLoadMore: () => void
}

export function FilterTabs({
  label,
  placeholder,
  inputValue,
  onInputChange,
  selectedValues,
  onToggle,
  onClear,
  disabled,
  tabs,
  activeTab,
  onTabChange,
  currentTabOptions,
  currentTabSelectedCount,
  onSelectAllInTab,
  onDeselectAllInTab,
  labelMap,
  onActiveStateChange,
  hasMore,
  onLoadMore,
}: FilterTabsProps) {
  const { t } = useTranslation()
  const [popoverActive, setPopoverActive] = useState(false)

  // Notify parent when popover state changes
  useEffect(() => {
    onActiveStateChange?.(popoverActive)
  }, [popoverActive, onActiveStateChange])

  const togglePopoverActive = useCallback(() => setPopoverActive(active => !active), [])

  const selectedTagItems: FilterTagItem[] = useMemo(
    () =>
      selectedValues.map(value => ({
        id: value,
        label: labelMap.get(value) || value,
      })),
    [selectedValues, labelMap]
  )

  const handleRemoveTag = (id: string) => {
    onToggle(id)
  }

  const selectedTagsContent
    = selectedTagItems.length > 0 ? (
      <FilterTagList items={selectedTagItems} onRemove={handleRemoveTag} disabled={disabled} />
    ) : null

  const activator = (
    <TextField
      label={label}
      value=""
      onChange={() => {}}
      autoComplete="off"
      placeholder={t('select-style')}
      disabled={disabled}
      verticalContent={selectedTagsContent}
      clearButton={selectedValues.length > 0}
      onClearButtonClick={onClear}
      onFocus={togglePopoverActive}
      readOnly
    />
  )

  const buttonToggleOptions = useMemo(
    () =>
      tabs.map(tab => ({
        value: tab.id,
        label: (
          <Text as="span" variant="bodySm">
            {tab.content}
          </Text>
        ),
      })),
    [tabs]
  )

  const handleTabChange = useCallback(
    (selected: string[]) => {
      if (selected.length > 0) {
        onTabChange(selected[0])
      }
    },
    [onTabChange]
  )

  return (
    <Popover
      active={popoverActive}
      activator={activator}
      onClose={togglePopoverActive}
      autofocusTarget="none"
      preferredAlignment="left"
      fullWidth
    >
      <Popover.Pane fixed>
        <Box padding="200">
          <BlockStack gap="200">
            {/* Search Field */}
            <TextField
              label=""
              labelHidden
              value={inputValue}
              onChange={onInputChange}
              placeholder={placeholder}
              autoComplete="off"
              disabled={disabled}
              autoFocus
              clearButton
              onClearButtonClick={() => onInputChange('')}
            />

            {/* Select All / Deselect All Actions */}
            <InlineStack align="space-between">
              <Button variant="plain" tone="critical" onClick={onSelectAllInTab} disabled={disabled}>
                {t('select-all')}
              </Button>
              <Button variant="plain" onClick={onDeselectAllInTab} disabled={disabled || currentTabSelectedCount === 0}>
                {t('deselect-all')}
              </Button>
            </InlineStack>

            {/* Tab Buttons */}
            <MultipleButtonToggle
              options={buttonToggleOptions}
              selected={[activeTab]}
              onClick={handleTabChange}
              disableToggle
              allowScroll
            />
          </BlockStack>
        </Box>
      </Popover.Pane>

      <Popover.Pane>
        <Box padding="200">
          <div style={{ height: '200px', overflowY: 'auto' }}>
            <FilterCheckboxList
              options={currentTabOptions}
              selectedValues={selectedValues}
              onToggle={onToggle}
              disabled={disabled}
              hasMore={hasMore}
              onLoadMore={onLoadMore}
            />
          </div>
        </Box>
      </Popover.Pane>
    </Popover>
  )
}
