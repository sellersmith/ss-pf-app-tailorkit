import { useCallback, useMemo, useState } from 'react'
import type { GoogleFontsLanguage } from '../types'
import type { GoogleFontsFiltersValue } from '../GoogleFontsFilters'
import type { FilterComboboxOption } from '../components/FilterCombobox'

export interface UseLanguageFilterOptions {
  languages: GoogleFontsLanguage[]
  value: GoogleFontsFiltersValue
  onChange: (value: GoogleFontsFiltersValue) => void
}

export function useLanguageFilter({ languages, value, onChange }: UseLanguageFilterOptions) {
  const [query, setQuery] = useState('')

  const labelMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const lang of languages) {
      map.set(lang.id, lang.name)
    }
    return map
  }, [languages])

  const subsetKeysByLanguageId = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const lang of languages) {
      map.set(lang.id, lang.subsetKeys)
    }
    return map
  }, [languages])

  const options: FilterComboboxOption[] = useMemo(
    () =>
      languages.map(lang => ({
        value: lang.id,
        label: labelMap.get(lang.id) || lang.name,
      })),
    [languages, labelMap]
  )

  const selectedValues = useMemo(() => value.languageIds || [], [value.languageIds])

  const computeSubsetKeys = useCallback(
    (languageIds: string[]) => {
      const union = new Set<string>()
      for (const id of languageIds) {
        const subsets = subsetKeysByLanguageId.get(id) || []
        for (const s of subsets) {
          union.add(s)
        }
      }
      return [...union]
    },
    [subsetKeysByLanguageId]
  )

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(selectedValues)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      const nextArr = [...next]
      onChange({
        ...value,
        languageIds: nextArr,
        subsetKeys: computeSubsetKeys(nextArr),
      })
      setQuery('')
    },
    [selectedValues, value, onChange, computeSubsetKeys]
  )

  const remove = useCallback(
    (id: string) => {
      const next = selectedValues.filter(x => x !== id)
      onChange({
        ...value,
        languageIds: next,
        subsetKeys: computeSubsetKeys(next),
      })
    },
    [selectedValues, value, onChange, computeSubsetKeys]
  )

  const clear = useCallback(() => {
    onChange({
      ...value,
      languageIds: [],
      subsetKeys: [],
    })
    setQuery('')
  }, [value, onChange])

  const handleSelect = useCallback(
    (selected: string[]) => {
      const id = selected[0] || null
      const languageIds = id ? [id] : []
      onChange({
        ...value,
        languageIds,
        subsetKeys: computeSubsetKeys(languageIds),
      })
    },
    [value, onChange, computeSubsetKeys]
  )

  return {
    query,
    setQuery,
    labelMap,
    options,
    selectedValues,
    toggle,
    remove,
    clear,
    handleSelect,
    count: selectedValues.length,
  }
}
