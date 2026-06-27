import type { AppliedFilterInterface, FiltersProps } from '@shopify/polaris'
import { ChoiceList, Filters } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { useCallback } from 'react'
import isEmpty from 'lodash/isEmpty'
import { FONT_SOURCE_LABEL, FONT_SOURCE_OPTIONS } from '../constants'

interface IFontSelectorSearchFieldProps {
  queryString: string
  fontSource: string[]
  setQueryString: (queryString: string) => void
  setFontSource: (fontSource: string[]) => void
}

export function FontSelectorSearchField(props: IFontSelectorSearchFieldProps) {
  const { queryString, fontSource, setQueryString, setFontSource } = props
  const { t } = useTranslation()

  const handleSelectFontSource = useCallback(
    (value: string[]) => {
      setFontSource(value)
    },
    [setFontSource]
  )

  const filters: FiltersProps['filters'] = [
    {
      key: 'all-fonts',
      label: t('all-fonts'),
      pinned: true,
      filter: (
        <ChoiceList
          title="Font source"
          titleHidden
          choices={FONT_SOURCE_OPTIONS.map(option => ({
            label: t(option.labelKey),
            value: option.value,
          }))}
          selected={fontSource}
          onChange={handleSelectFontSource}
          allowMultiple
        />
      ),
      shortcut: true,
    },
  ]

  const generateAppliedFilters = useCallback((): AppliedFilterInterface[] => {
    if (!isEmpty(fontSource)) {
      return [
        {
          key: 'all-fonts',
          label: fontSource.length
            ? `${t('all-fonts')} ${fontSource.map(val => t(FONT_SOURCE_LABEL[val])).join(', ')}`
            : '',
          onRemove: () => setFontSource([]),
        },
      ]
    }

    return []
  }, [fontSource, setFontSource, t])

  const handleFiltersClearAll = useCallback(() => {
    setQueryString('')
    setFontSource([])
  }, [setFontSource, setQueryString])

  return (
    <Filters
      queryValue={queryString}
      filters={filters}
      queryPlaceholder={t('search-fonts')}
      appliedFilters={generateAppliedFilters()}
      onQueryChange={setQueryString}
      onQueryClear={() => setQueryString('')}
      onClearAll={handleFiltersClearAll}
      closeOnChildOverlayClick
    />
  )
}
