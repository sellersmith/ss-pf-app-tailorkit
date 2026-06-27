import { AutoSelection, Box, Combobox, EmptySearchResult, InlineStack, Listbox, Spinner, Text } from '@shopify/polaris'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { escapeRegExp } from '~/utils/escapeRegex'
import { FilterTagList, type FilterTagItem } from './FilterTagList'
import styles from './FilterCombobox.module.css'

// Limit displayed options to prevent performance issues with 1600+ items, but allow incremental load-more on scroll.
const DEFAULT_DISPLAY_OPTIONS = 100
const DISPLAY_OPTIONS_PAGE_SIZE = 50
const SCROLL_BOTTOM_THRESHOLD_PX = 8

/**
 * Checks if a scroll container has reached (or nearly reached) the bottom.
 * Uses a threshold to reduce flakiness due to fractional pixels and rounding.
 */
function isScrolledToBottom(el: HTMLElement, thresholdPx: number = SCROLL_BOTTOM_THRESHOLD_PX) {
  return el.scrollTop + el.clientHeight >= el.scrollHeight - thresholdPx
}

/**
 * Finds the nearest scrollable ancestor for a given element.
 * This lets us piggyback on Polaris' internal scroll container without relying on undocumented props.
 */
function findScrollableAncestor(start: HTMLElement | null): HTMLElement | null {
  let el: HTMLElement | null = start
  while (el) {
    // Prefer the first ancestor that actually scrolls (works even if Polaris changes CSS).
    if (el.scrollHeight > el.clientHeight + 1) return el

    const style = window.getComputedStyle(el)
    const overflowY = style.overflowY
    const isScrollableByCss = overflowY === 'auto' || overflowY === 'scroll'
    if (isScrollableByCss) return el
    el = el.parentElement
  }
  return null
}

export interface FilterComboboxOption {
  value: string
  label: string
  /** Optional SVG string for visual preview (e.g., font style rendered in sample font) */
  sampleSvg?: string
}

export interface FilterComboboxGroup {
  groupLabel: string
  options: FilterComboboxOption[]
}

export interface UseIncrementalOptionsParams<TItem> {
  items: readonly TItem[]
  query: string
  getLabel: (item: TItem) => string
  initialDisplay?: number
  pageSize?: number
}

export interface UseIncrementalOptionsResult<TItem> {
  visibleItems: TItem[]
  totalMatching: number
  hasMore: boolean
  loadMore: () => void
}

/**
 * Shared incremental filtering + pagination logic used by FilterCombobox and other UIs (e.g., Polaris Filters popover).
 * Keeps TailorKit DRY while allowing different presentation components.
 */
export function useIncrementalOptions<TItem>({
  items,
  query,
  getLabel,
  initialDisplay = DEFAULT_DISPLAY_OPTIONS,
  pageSize = DISPLAY_OPTIONS_PAGE_SIZE,
}: UseIncrementalOptionsParams<TItem>): UseIncrementalOptionsResult<TItem> {
  const [displayLimit, setDisplayLimit] = useState(initialDisplay)

  useEffect(() => {
    setDisplayLimit(initialDisplay)
  }, [query, items, initialDisplay])

  const matchingItems = useMemo(() => {
    const q = query.trim()
    if (!q) return items
    const filterRegex = new RegExp(escapeRegExp(q), 'i')
    return items.filter(item => getLabel(item).match(filterRegex))
  }, [items, query, getLabel])

  const totalMatching = matchingItems.length

  const visibleItems = useMemo(() => matchingItems.slice(0, displayLimit), [matchingItems, displayLimit])

  const hasMore = totalMatching > visibleItems.length

  const loadMore = useCallback(() => {
    setDisplayLimit(prev => {
      if (prev >= totalMatching) return prev
      return Math.min(prev + pageSize, totalMatching)
    })
  }, [pageSize, totalMatching])

  return { visibleItems, totalMatching, hasMore, loadMore }
}

/**
 * Shared group filtering helper (used by FilterCombobox and other UIs).
 */
export function filterGroupsByQuery(groups: FilterComboboxGroup[], query: string) {
  const q = query.trim()
  const filterRegex = q ? new RegExp(escapeRegExp(q), 'i') : null
  return groups
    .map(group => ({
      ...group,
      options: group.options.filter(opt => (filterRegex ? opt.label.match(filterRegex) : true)),
    }))
    .filter(g => g.options.length > 0)
}

export interface FilterComboboxProps {
  label: string
  placeholder: string
  inputValue: string
  onInputChange: (value: string) => void
  selectedValues: string[]
  onToggle: (value: string) => void
  onClear: () => void
  disabled?: boolean
  /** Flat options list (for language filter) */
  options?: FilterComboboxOption[]
  /** Grouped options (for style filter) */
  groups?: FilterComboboxGroup[]
  /** Map of value -> label for selected tags */
  labelMap: Map<string, string>
  /** Callback when popover active state changes */
  onActiveStateChange?: (isActive: boolean) => void
}

export function FilterCombobox({
  label,
  placeholder,
  inputValue,
  onInputChange,
  selectedValues,
  onToggle,
  onClear,
  disabled,
  options,
  groups,
  labelMap,
  onActiveStateChange,
}: FilterComboboxProps) {
  const [scrollSentinelEl, setScrollSentinelEl] = useState<HTMLDivElement | null>(null)
  const [isPopoverActive, setIsPopoverActive] = useState(false)
  const cleanupRef = useRef<(() => void) | null>(null)
  const justSelectedRef = useRef(false)

  const flat = options || []
  const {
    visibleItems: filteredFlatOptions,
    hasMore,
    loadMore,
  } = useIncrementalOptions({
    items: flat,
    query: inputValue,
    getLabel: item => item.label,
    initialDisplay: DEFAULT_DISPLAY_OPTIONS,
    pageSize: DISPLAY_OPTIONS_PAGE_SIZE,
  })
  const filteredOptions = options ? filteredFlatOptions : null
  const hasMoreOptions = options ? hasMore : false

  const filteredGroups = useMemo(() => {
    if (!groups) return null
    return filterGroupsByQuery(groups, inputValue)
  }, [groups, inputValue])

  const handleDropdownScroll = useCallback(
    (el: HTMLElement) => {
      if (!hasMoreOptions) return
      if (!isScrolledToBottom(el)) return
      loadMore()
    },
    [hasMoreOptions, loadMore]
  )

  // Track popover active state based on sentinel element existence
  useEffect(() => {
    const newActiveState = Boolean(scrollSentinelEl)
    if (newActiveState !== isPopoverActive) {
      setIsPopoverActive(newActiveState)
      onActiveStateChange?.(newActiveState)
    }
  }, [scrollSentinelEl, isPopoverActive, onActiveStateChange])

  useEffect(() => {
    // Sentinel only exists when the Combobox popover is open; use state so the effect re-runs when it mounts.
    if (!scrollSentinelEl) return () => undefined

    // Defer one tick so layout/scrollHeight settles (Popover content may mount async).
    const timer = window.setTimeout(() => {
      const scrollEl = findScrollableAncestor(scrollSentinelEl)
      if (!scrollEl) return

      const onScroll = () => handleDropdownScroll(scrollEl)
      scrollEl.addEventListener('scroll', onScroll, { passive: true })

      // Run once immediately in case user opens the dropdown already at bottom (rare, but safe).
      handleDropdownScroll(scrollEl)
      cleanupRef.current = () => {
        scrollEl.removeEventListener('scroll', onScroll)
      }
    }, 0)

    return () => {
      window.clearTimeout(timer)
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [scrollSentinelEl, handleDropdownScroll])

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

  const handleSelect = (value: string) => {
    justSelectedRef.current = true
    // Save current input value before toggle (hooks will clear it)
    const savedInput = inputValue
    onToggle(value)
    // Restore input value immediately if popover is still open
    requestAnimationFrame(() => {
      if (scrollSentinelEl && savedInput.trim()) {
        onInputChange(savedInput)
      }
      setTimeout(() => {
        justSelectedRef.current = false
      }, 50)
    })
  }

  const handleClose = () => {
    if (!justSelectedRef.current && inputValue.trim()) {
      onInputChange('')
    }
  }

  const verticalContent
    = selectedTagItems.length > 0 ? (
      <FilterTagList items={selectedTagItems} onRemove={handleRemoveTag} disabled={disabled} />
    ) : null

  const hasResults = filteredOptions ? filteredOptions.length > 0 : (filteredGroups?.length ?? 0) > 0

  const renderOptionContent = (opt: FilterComboboxOption, selected: boolean) => {
    if (opt.sampleSvg) {
      return (
        <Listbox.TextOption selected={selected}>
          {/* eslint-disable-next-line react/no-danger -- SVG comes from our pre-rendered artifact, not user input */}
          <span className={styles.svgContainer} dangerouslySetInnerHTML={{ __html: opt.sampleSvg }} title={opt.label} />
        </Listbox.TextOption>
      )
    }
    return <Listbox.TextOption selected={selected}>{opt.label}</Listbox.TextOption>
  }

  return (
    <Combobox
      allowMultiple
      onClose={handleClose}
      activator={
        <Combobox.TextField
          label={label}
          value={inputValue}
          onChange={onInputChange}
          autoComplete="off"
          placeholder={placeholder}
          disabled={disabled}
          verticalContent={verticalContent}
          clearButton={selectedValues.length > 0}
          onClearButtonClick={onClear}
        />
      }
      maxHeight="200px"
    >
      {hasResults ? (
        <Listbox autoSelection={AutoSelection.None} onSelect={handleSelect}>
          {filteredOptions ? (
            <>
              {filteredOptions.map(item => (
                <Listbox.Option
                  key={item.value}
                  value={item.value}
                  selected={selectedValues.includes(item.value)}
                  accessibilityLabel={item.label}
                >
                  {renderOptionContent(item, selectedValues.includes(item.value))}
                </Listbox.Option>
              ))}
              {hasMoreOptions && (
                <Box padding="200">
                  <InlineStack align="center">
                    <Spinner accessibilityLabel="Loading more options" size="small" />
                  </InlineStack>
                </Box>
              )}
              <div ref={setScrollSentinelEl} />
            </>
          ) : (
            <>
              {filteredGroups?.map(group => (
                <Listbox.Section
                  key={group.groupLabel}
                  title={
                    <Box paddingBlock={'200'} paddingInline={'300'}>
                      <Text as="span" variant="bodyMd" fontWeight="medium">
                        {group.groupLabel}
                      </Text>
                    </Box>
                  }
                >
                  {group.options.map(opt => (
                    <Listbox.Option
                      key={opt.value}
                      value={opt.value}
                      selected={selectedValues.includes(opt.value)}
                      accessibilityLabel={opt.label}
                    >
                      {renderOptionContent(opt, selectedValues.includes(opt.value))}
                    </Listbox.Option>
                  ))}
                </Listbox.Section>
              ))}
              <div ref={setScrollSentinelEl} />
            </>
          )}
        </Listbox>
      ) : (
        <EmptySearchResult title="" description={`No results for "${inputValue}"`} />
      )}
    </Combobox>
  )
}
