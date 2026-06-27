import { useCallback, useMemo, useState } from 'react'
import type { GoogleFontsStyleGroup } from '../types'
import type { GoogleFontsFiltersValue } from '../GoogleFontsFilters'
import type { FilterComboboxGroup, FilterComboboxOption } from '../components/FilterCombobox'
import { useIncrementalOptions } from '../components/FilterCombobox'

export interface UseStyleFilterOptions {
  styles: GoogleFontsStyleGroup[]
  value: GoogleFontsFiltersValue
  onChange: (value: GoogleFontsFiltersValue) => void
}

export function useStyleFilter({ styles, value, onChange }: UseStyleFilterOptions) {
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<string>('Seasonal')

  const labelMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const group of styles) {
      for (const opt of group.options) {
        map.set(opt.tagPath, opt.label)
      }
    }
    return map
  }, [styles])

  const flatOptions: FilterComboboxOption[] = useMemo(
    () =>
      styles.flatMap(group =>
        group.options.map(opt => ({
          value: opt.tagPath,
          label: opt.label,
        }))
      ),
    [styles]
  )

  const groups: FilterComboboxGroup[] = useMemo(
    () =>
      styles.map(group => ({
        groupLabel: group.label,
        options: group.options.map(opt => ({
          value: opt.tagPath,
          label: opt.label,
          sampleSvg: opt.sampleSvg,
        })),
      })),
    [styles]
  )

  const selectedValues = value.styleTagPaths

  const toggle = useCallback(
    (tagPath: string) => {
      const next = new Set(value.styleTagPaths)
      if (next.has(tagPath)) {
        next.delete(tagPath)
      } else {
        next.add(tagPath)
      }
      onChange({ ...value, styleTagPaths: [...next] })
      setQuery('')
    },
    [value, onChange]
  )

  const remove = useCallback(
    (tagPath: string) => {
      onChange({
        ...value,
        styleTagPaths: value.styleTagPaths.filter(x => x !== tagPath),
      })
    },
    [value, onChange]
  )

  const clear = useCallback(() => {
    onChange({ ...value, styleTagPaths: [] })
    setQuery('')
  }, [value, onChange])

  const handleChange = useCallback(
    (nextSelected: string[]) => {
      onChange({ ...value, styleTagPaths: nextSelected })
    },
    [value, onChange]
  )

  // Tab-based filter support
  const allTabOptions = useMemo(() => {
    const group = groups.find(g => g.groupLabel === activeTab)
    return group?.options || []
  }, [groups, activeTab])

  const {
    visibleItems: currentTabOptions,
    hasMore,
    loadMore,
  } = useIncrementalOptions({
    items: allTabOptions,
    query,
    getLabel: item => item.label,
  })

  const currentTabSelectedCount = useMemo(() => {
    const tabValues = new Set(allTabOptions.map(opt => opt.value))
    return selectedValues.filter(v => tabValues.has(v)).length
  }, [allTabOptions, selectedValues])

  const tabs = useMemo(
    () =>
      groups.map(g => ({
        id: g.groupLabel,
        content: g.groupLabel,
      })),
    [groups]
  )

  const selectAllInTab = useCallback(() => {
    const newSelected = new Set(selectedValues)
    currentTabOptions.forEach(opt => newSelected.add(opt.value))
    onChange({ ...value, styleTagPaths: [...newSelected] })
  }, [currentTabOptions, selectedValues, value, onChange])

  const deselectAllInTab = useCallback(() => {
    const visibleValues = new Set(currentTabOptions.map(opt => opt.value))
    const newSelected = selectedValues.filter(v => !visibleValues.has(v))
    onChange({ ...value, styleTagPaths: newSelected })
  }, [currentTabOptions, selectedValues, value, onChange])

  return {
    // Existing
    query,
    setQuery,
    labelMap,
    flatOptions,
    groups,
    selectedValues,
    toggle,
    remove,
    clear,
    handleChange,
    count: selectedValues.length,
    // New for tabs
    activeTab,
    setActiveTab,
    tabs,
    currentTabOptions,
    currentTabSelectedCount,
    selectAllInTab,
    deselectAllInTab,
    hasMore,
    loadMore,
  }
}
