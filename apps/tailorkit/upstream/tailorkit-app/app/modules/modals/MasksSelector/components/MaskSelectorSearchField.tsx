import type { AppliedFilterInterface, FiltersProps } from '@shopify/polaris'
import { ChoiceList, Filters } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { useCallback } from 'react'
import isEmpty from 'lodash/isEmpty'
import { MASK_RATIO_OPTIONS } from '../constants'

interface IMaskSelectorSearchFieldProps {
  queryString: string
  ratioSelected: string[]
  setQueryString: (queryString: string) => void
  setRatioSelected: (ratioSelected: string[]) => void
}

export function MaskSelectorSearchField(props: IMaskSelectorSearchFieldProps) {
  const { queryString, ratioSelected, setQueryString, setRatioSelected } = props
  const { t } = useTranslation()

  const handleSelectRatio = useCallback(
    (value: string[]) => {
      setRatioSelected(value)
    },
    [setRatioSelected]
  )

  const filters: FiltersProps['filters'] = [
    {
      key: 'mask-ratio',
      label: t('ratio'),
      pinned: true,
      filter: (
        <ChoiceList
          title="Ratio"
          titleHidden
          choices={MASK_RATIO_OPTIONS.map(option => ({
            label: t(option.labelKey),
            value: option.value,
          }))}
          selected={ratioSelected}
          onChange={handleSelectRatio}
          allowMultiple
        />
      ),
      shortcut: true,
    },
  ]

  /**
   * Generate applied filters based on current selections
   */
  const generateAppliedFilters = useCallback((): AppliedFilterInterface[] => {
    const appliedFilters: AppliedFilterInterface[] = []

    // Add ratio filter if any ratio is selected
    if (!isEmpty(ratioSelected)) {
      const ratioLabels = ratioSelected
        .map(val => {
          const ratioOption = MASK_RATIO_OPTIONS.find(option => option.value === val)
          return ratioOption ? t(ratioOption.labelKey) : val
        })
        .filter(Boolean)
        .join(', ')

      appliedFilters.push({
        key: 'mask-ratio',
        label: `${t('ratio')}: ${ratioLabels}`,
        onRemove: () => setRatioSelected([]),
      })
    }

    return appliedFilters
  }, [ratioSelected, setRatioSelected, t])

  /**
   * Clear all filters including search query
   */
  const handleFiltersClearAll = useCallback(() => {
    setQueryString('')
    setRatioSelected([])
  }, [setQueryString, setRatioSelected])

  return (
    <Filters
      queryValue={queryString}
      filters={filters}
      queryPlaceholder={t('search-masks')}
      appliedFilters={generateAppliedFilters()}
      onQueryChange={setQueryString}
      onQueryClear={() => setQueryString('')}
      onClearAll={handleFiltersClearAll}
      closeOnChildOverlayClick
    />
  )
}
