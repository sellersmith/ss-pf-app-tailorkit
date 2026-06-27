import { BlockStack, Box, InlineStack, Text } from '@shopify/polaris'
import { useGoogleFontsFiltersData } from './useGoogleFontsFiltersData'
import { FilterCombobox, FilterTabs } from './components'
import { useStyleFilter, useLanguageFilter } from './hooks'
import { useTranslation } from 'react-i18next'
import { useCallback, useRef } from 'react'

export interface GoogleFontsFiltersValue {
  styleTagPaths: string[]
  /**
   * Selected language IDs from googlefonts/lang repository.
   * These match the Google Fonts website language filter.
   */
  languageIds?: string[]
  /**
   * Derived subset keys used for filtering Google Fonts (`font.subsets` intersection).
   * This is computed in the UI from selected languages.
   */
  subsetKeys?: string[]
  /**
   * @deprecated Legacy single-select key (kept for backward compatibility).
   */
  countryLanguageKey?: string | null
  /**
   * @deprecated Legacy multi-select country-language keys.
   */
  countryLanguageKeys?: string[]
}

export interface GoogleFontsFiltersProps {
  value: GoogleFontsFiltersValue
  onChange: (value: GoogleFontsFiltersValue) => void
  disabled?: boolean
  /** Locale used for display names (defaults to `navigator.language` / `en`). */
  locale?: string
  /** Total number of fonts matching current filters */
  totalFilteredFonts?: number
  /** Whether fonts are currently being loaded/filtered */
  isLoadingFonts?: boolean
  /** Callback when any filter popover active state changes */
  onFilterPopoverActiveChange?: (isActive: boolean) => void
}

export function GoogleFontsFilters(props: GoogleFontsFiltersProps) {
  const { value, onChange, disabled, totalFilteredFonts, isLoadingFonts, onFilterPopoverActiveChange } = props
  const { styles, languages, loading } = useGoogleFontsFiltersData()
  const { t } = useTranslation()
  const styleFilter = useStyleFilter({ styles, value, onChange })
  const languageFilter = useLanguageFilter({ languages, value, onChange })

  // Track which popovers are currently active
  const activePopoversRef = useRef<Set<string>>(new Set())

  const handlePopoverActiveChange = useCallback(
    (popoverId: string, isActive: boolean) => {
      const hadActivePopovers = activePopoversRef.current.size > 0

      if (isActive) {
        activePopoversRef.current.add(popoverId)
      } else {
        activePopoversRef.current.delete(popoverId)
      }

      const hasActivePopovers = activePopoversRef.current.size > 0

      // Only notify parent if the overall state changed
      if (hadActivePopovers !== hasActivePopovers) {
        onFilterPopoverActiveChange?.(hasActivePopovers)
      }
    },
    [onFilterPopoverActiveChange]
  )

  const showDisabled = Boolean(disabled || loading)
  const hasActiveFilters = value.styleTagPaths.length > 0 || (value.languageIds && value.languageIds.length > 0)

  return (
    <Box paddingBlockStart="200">
      <BlockStack gap="300">
        <FilterCombobox
          label={t('font-language')}
          placeholder={t('select-language')}
          inputValue={languageFilter.query}
          onInputChange={languageFilter.setQuery}
          selectedValues={languageFilter.selectedValues}
          onToggle={languageFilter.toggle}
          onClear={languageFilter.clear}
          disabled={showDisabled}
          options={languageFilter.options}
          labelMap={languageFilter.labelMap}
          onActiveStateChange={isActive => handlePopoverActiveChange('language', isActive)}
        />

        <FilterTabs
          label={t('font-style')}
          placeholder={t('search-styles')}
          inputValue={styleFilter.query}
          onInputChange={styleFilter.setQuery}
          selectedValues={styleFilter.selectedValues}
          onToggle={styleFilter.toggle}
          onClear={styleFilter.clear}
          disabled={showDisabled}
          tabs={styleFilter.tabs}
          activeTab={styleFilter.activeTab}
          onTabChange={styleFilter.setActiveTab}
          currentTabOptions={styleFilter.currentTabOptions}
          currentTabSelectedCount={styleFilter.currentTabSelectedCount}
          onSelectAllInTab={styleFilter.selectAllInTab}
          onDeselectAllInTab={styleFilter.deselectAllInTab}
          labelMap={styleFilter.labelMap}
          onActiveStateChange={isActive => handlePopoverActiveChange('style', isActive)}
          hasMore={styleFilter.hasMore}
          onLoadMore={styleFilter.loadMore}
        />

        {totalFilteredFonts !== undefined && hasActiveFilters && (
          <InlineStack align="start">
            <Text as="span" variant="bodySm" tone="subdued">
              {isLoadingFonts ? t('filtering-fonts') : t('count-fonts-found', { count: totalFilteredFonts })}
            </Text>
          </InlineStack>
        )}
      </BlockStack>
    </Box>
  )
}
