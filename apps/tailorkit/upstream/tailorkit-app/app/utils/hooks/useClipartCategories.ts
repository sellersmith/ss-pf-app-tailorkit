import { useEffect, useMemo, useState } from 'react'
import { TemplatesService } from '~/api/services/templates'

// Stable empty array to prevent unnecessary re-renders
const EMPTY_ARRAY: string[] = []

/**
 * Hook to load clipart categories (optionally with AI suggestion) and manage tab selection.
 * Returns normalized selection as a list of selected category strings (empty means 'all').
 */
export function useClipartCategories(options?: { withAISuggestion?: boolean; withUserCliparts?: boolean }) {
  const withAISuggestion = options?.withAISuggestion ?? true
  const withUserCliparts = options?.withUserCliparts ?? true

  const [categories, setCategories] = useState<string[]>([])
  const [selectedTab, setSelectedTab] = useState(0)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { categories: cats, suggestedCategory } = await TemplatesService.listClipartCategories(
          withAISuggestion,
          withUserCliparts
        )
        if (!mounted) return
        setCategories(cats || [])

        if (suggestedCategory && cats && cats.length > 0) {
          const allTabs = [{ id: 'all' }, ...cats.map(c => ({ id: c }))]
          const idx = allTabs.findIndex(tab => tab.id === suggestedCategory)
          if (idx > 0) setSelectedTab(idx)
        }
      } catch {
        // noop
      } finally {
        if (mounted) setIsInitializing(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [withAISuggestion, withUserCliparts])

  const selectedCategories = useMemo(() => {
    if (selectedTab === 0) return EMPTY_ARRAY
    const cat = categories[selectedTab - 1]
    return cat ? [cat] : EMPTY_ARRAY
  }, [categories, selectedTab])

  return {
    categories,
    selectedTab,
    setSelectedTab,
    selectedCategories,
    isInitializing,
  }
}

export type UseClipartCategoriesReturn = ReturnType<typeof useClipartCategories>
