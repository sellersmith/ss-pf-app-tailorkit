import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getShopifyThumbnail } from '~/utils/loadImage'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING, EVENTS_PARAMETERS_NAME } from '~/bootstrap/constants/eventsTracking'
import { uuid } from '~/utils/uuid'
import type { PromptPresetItem } from './types'
import { PromptPresetsService } from '~/api/services/prompt-presets'
import type { PromptPresetType } from '~/api/services/prompt-presets'

/**
 * Options for configuring the usePromptPresets hook.
 */
interface UsePromptPresetsOptions {
  /** The type of prompt presets to fetch (e.g., 'quick-prompt', 'style') */
  type: PromptPresetType
  /** Layout identifier used for analytics tracking */
  layout: string
  /** Whether multiple presets can be selected simultaneously */
  multiple: boolean
  /** Whether at least one preset must always be selected */
  required: boolean
  /** Whether to toggle thumbnail image on mouse hover */
  toggleThumbnailOnMouseOver: boolean
  /** Initially selected preset(s) - can be a single name or array of names */
  selected?: string | string[]
  /** Optional function to filter the fetched preset items */
  filterItems?: (items: PromptPresetItem[]) => PromptPresetItem[]
  /** Callback fired when selection changes, receives selected names and their instructions */
  onSelect?: (itemName: string[], instruction?: string[]) => void
}

/**
 * Hook for managing prompt preset selection with analytics tracking.
 *
 * Provides functionality for:
 * - Fetching and displaying prompt presets by type
 * - Single or multiple selection modes
 * - Search filtering and sorting (hot items first, then alphabetical)
 * - Thumbnail hover effects
 * - Analytics event tracking for views and selections
 *
 * @param options - Configuration options for the hook
 * @returns Object containing:
 *   - `isLoading` - Whether presets are being fetched
 *   - `presets` - All fetched preset items
 *   - `sortedPresets` - Filtered and sorted presets based on search query
 *   - `selectedPreset` - Array of currently selected preset names
 *   - `hoveredItem` - Name of currently hovered item (if hover effects enabled)
 *   - `searchQuery` - Current search filter value
 *   - `isAllSelected` - Whether all presets are selected
 *   - `isNoneSelected` - Whether no presets are selected
 *   - `handleItemClick` - Handler for preset item click/selection
 *   - `handleSelectAll` - Handler to select all presets
 *   - `handleDeselectAll` - Handler to deselect all (respects `required` option)
 *   - `handleMouseEnter` - Handler for mouse enter on preset item
 *   - `handleMouseLeave` - Handler for mouse leave on preset item
 *   - `handleSearchChange` - Handler for search input changes
 *   - `getThumbnailUrl` - Function to get optimized thumbnail URL for a preset
 *
 * @example
 * ```tsx
 * const {
 *   sortedPresets,
 *   selectedPreset,
 *   handleItemClick,
 *   isLoading,
 * } = usePromptPresets({
 *   type: 'quick-prompt',
 *   layout: 'grid',
 *   multiple: false,
 *   required: true,
 *   toggleThumbnailOnMouseOver: true,
 *   onSelect: (names, instructions) => {
 *     console.log('Selected:', names, instructions)
 *   },
 * })
 * ```
 */
export function usePromptPresets({
  type,
  layout,
  multiple,
  required,
  toggleThumbnailOnMouseOver,
  selected,
  filterItems,
  onSelect,
}: UsePromptPresetsOptions) {
  const { trackEvent } = useEventsTracking()

  // Session ID for correlating view/select events
  const sessionId = useMemo(() => `sess_${uuid()}`, [])
  const viewTrackedRef = useRef(false)
  const itemsLoadedTimeRef = useRef(0)

  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [presets, setPresets] = useState<PromptPresetItem[]>([])
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [selectedPreset, setSelectedPreset] = useState<string[]>(
    Array.isArray(selected) ? selected : selected ? [selected] : []
  )

  // Fetch presets
  const fetchPresets = useCallback(async () => {
    setIsLoading(true)
    try {
      const items = await PromptPresetsService.listByType(type)
      if (items) {
        const filteredItems = filterItems ? filterItems(items || []) : items || []
        setPresets(filteredItems)
      }
    } catch (error) {
      console.error('Failed to fetch prompt presets:', error)
    } finally {
      setIsLoading(false)
    }
  }, [filterItems, type])

  useEffect(() => {
    fetchPresets()
  }, [fetchPresets])

  // Sync selected prop with internal state
  useEffect(() => {
    if (onSelect && selected !== undefined) {
      setSelectedPreset(Array.isArray(selected) ? selected : selected ? [selected] : [])
    }
  }, [onSelect, selected, multiple])

  // Track view event when presets are loaded
  useEffect(() => {
    if (!isLoading && presets.length > 0 && !viewTrackedRef.current) {
      viewTrackedRef.current = true
      itemsLoadedTimeRef.current = Date.now()

      try {
        const batchId = `batch_${uuid()}`
        trackEvent(EVENTS_TRACKING.QUICK_PROMPT_VIEW, {
          [EVENTS_PARAMETERS_NAME.PROMPT_TYPE]: type,
          [EVENTS_PARAMETERS_NAME.PROMPT_COUNT]: presets.length,
          [EVENTS_PARAMETERS_NAME.SOURCE_COMPONENT]: `prompt_presets_${layout}`,
          [EVENTS_PARAMETERS_NAME.BATCH_ID]: batchId,
          [EVENTS_PARAMETERS_NAME.SESSION_ID]: sessionId,
        })
      } catch (e) {
        console.error('[TK Analytics] Failed to track QUICK_PROMPT_VIEW', e)
      }
    }
  }, [isLoading, presets, type, layout, sessionId, trackEvent])

  // Handle item click
  const handleItemClick = useCallback(
    (itemName: string, index?: number) => {
      let newSelection: string[]
      const isCurrentlySelected = selectedPreset.includes(itemName)
      const preset = presets.find(p => p.name === itemName)

      if (isCurrentlySelected) {
        newSelection = selectedPreset.filter(name => name !== itemName)
        if (required && newSelection.length === 0) {
          return // Don't allow deselecting the last item
        }
      } else {
        newSelection = multiple ? [...selectedPreset, itemName] : [itemName]

        // Track selection
        try {
          const timeToSelectSeconds = itemsLoadedTimeRef.current
            ? Math.round((Date.now() - itemsLoadedTimeRef.current) / 1000)
            : undefined

          trackEvent(EVENTS_TRACKING.QUICK_PROMPT_SELECT, {
            [EVENTS_PARAMETERS_NAME.PROMPT_NAME]: itemName,
            [EVENTS_PARAMETERS_NAME.PROMPT_ALIAS]: (preset as any)?.alias || '',
            [EVENTS_PARAMETERS_NAME.PROMPT_TYPE]: type,
            [EVENTS_PARAMETERS_NAME.SOURCE_COMPONENT]: `prompt_presets_${layout}`,
            [EVENTS_PARAMETERS_NAME.SESSION_ID]: sessionId,
            [EVENTS_PARAMETERS_NAME.SELECTION_POSITION]: index ?? 0,
            ...(timeToSelectSeconds !== undefined && {
              [EVENTS_PARAMETERS_NAME.TIME_TO_SELECT_SECONDS]: timeToSelectSeconds,
            }),
          })
        } catch (e) {
          console.error('[TK Analytics] Failed to track QUICK_PROMPT_SELECT', e)
        }
      }

      if (onSelect) {
        const instructions = newSelection.map(name => {
          const p = presets.find(pr => pr.name === name)
          return p?.description || p?.instruction
        })
        onSelect(newSelection, instructions as string[])
      }

      setSelectedPreset(newSelection)
    },
    [onSelect, presets, multiple, selectedPreset, required, trackEvent, type, layout, sessionId]
  )

  // Filter and sort presets
  const sortedPresets = useMemo(() => {
    const filtered = searchQuery
      ? presets.filter(
          p =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase())
            || p.instruction?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : presets

    return [...filtered].sort((a, b) => {
      if (a.hot && !b.hot) return -1
      if (!a.hot && b.hot) return 1
      return (a.ordering ?? 99) - (b.ordering ?? 99)
    })
  }, [presets, searchQuery])

  // Select all
  const handleSelectAll = useCallback(() => {
    const allNames = presets.map(p => p.name)
    setSelectedPreset(allNames)
    if (onSelect) {
      const instructions = allNames.map(name => {
        const preset = presets.find(p => p.name === name)
        return preset?.description || preset?.instruction
      })
      onSelect(allNames, instructions as string[])
    }
  }, [presets, onSelect])

  // Deselect all
  const handleDeselectAll = useCallback(() => {
    if (required && sortedPresets.length > 0) {
      const firstItem = sortedPresets[0]
      setSelectedPreset([firstItem.name])
      if (onSelect) {
        const instruction = firstItem.description || firstItem.instruction
        onSelect([firstItem.name], instruction ? [instruction as string] : [])
      }
    } else {
      setSelectedPreset([])
      if (onSelect) {
        onSelect([], [])
      }
    }
  }, [onSelect, required, sortedPresets])

  // Hover handlers
  const handleMouseEnter = useCallback(
    (itemName: string) => {
      if (toggleThumbnailOnMouseOver) {
        setHoveredItem(itemName)
      }
    },
    [toggleThumbnailOnMouseOver]
  )

  const handleMouseLeave = useCallback(() => {
    if (toggleThumbnailOnMouseOver) {
      setHoveredItem(null)
    }
  }, [toggleThumbnailOnMouseOver])

  // Get thumbnail URL
  const getThumbnailUrl = useCallback(
    (item: PromptPresetItem) => {
      const firstThumbnail = item.thumbnail?.[0]
      if (!firstThumbnail?.startsWith('https://')) {
        return null
      }

      if (!toggleThumbnailOnMouseOver || !item.thumbnail?.length) {
        return getShopifyThumbnail(firstThumbnail, 240)
      }

      const isHovered = hoveredItem === item.name
      const thumbnailIndex = isHovered && item.thumbnail?.length > 1 ? 1 : 0

      return getShopifyThumbnail(item.thumbnail[thumbnailIndex] || firstThumbnail, 240)
    },
    [toggleThumbnailOnMouseOver, hoveredItem]
  )

  // Search handler
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
  }, [])

  const isAllSelected = presets.length > 0 && selectedPreset.length === presets.length
  const isNoneSelected = selectedPreset.length === 0

  return {
    isLoading,
    presets,
    sortedPresets,
    selectedPreset,
    hoveredItem,
    searchQuery,
    isAllSelected,
    isNoneSelected,
    handleItemClick,
    handleSelectAll,
    handleDeselectAll,
    handleMouseEnter,
    handleMouseLeave,
    handleSearchChange,
    getThumbnailUrl,
  }
}
