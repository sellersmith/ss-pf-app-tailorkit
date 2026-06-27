import type { AppliedFilterInterface } from '@shopify/polaris'
import { ChoiceList, Filters } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CLIPART_SOURCE_LABEL, CLIPART_SOURCE_OPTIONS } from '../constants'
import isEmpty from 'lodash/isEmpty'
import type { TEMPLATE_TYPE } from '~/routes/api.templates/constants'
import { TemplatesService } from '~/api/services/templates'

interface IClipartFilterProps {
  queryString: string
  clipartSource: TEMPLATE_TYPE[]
  defaultClipartSource?: TEMPLATE_TYPE
  setQueryString: (queryString: string) => void
  setClipartSource: (clipartSource: TEMPLATE_TYPE[]) => void
  categories?: string[]
  setCategories?: (categories: string[]) => void
  hideCategories?: boolean
}

export function ClipartFilter(props: IClipartFilterProps) {
  const {
    queryString,
    clipartSource,
    defaultClipartSource,
    setQueryString,
    setClipartSource,
    categories = [],
    setCategories,
    hideCategories = false,
  } = props
  const { t } = useTranslation()

  const handleSelectClipartSource = useCallback((value: TEMPLATE_TYPE[]) => setClipartSource(value), [setClipartSource])

  const capitalizeFirst = useCallback((value: string): string => {
    if (!value) return value
    return value.charAt(0).toUpperCase() + value.slice(1)
  }, [])

  const [allCategories, setAllCategories] = useState<string[]>([])
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { categories: cats } = await TemplatesService.listClipartCategories()
        if (mounted) setAllCategories(cats)
      } catch (e) {
        // noop
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const handleSelectCategories = useCallback(
    (value: string[]) => {
      setCategories?.(value)
    },
    [setCategories]
  )

  const categoryChoices = useMemo(
    () => allCategories.map(c => ({ label: capitalizeFirst(c), value: c })),
    [allCategories, capitalizeFirst]
  )

  const filters = useMemo(() => {
    const arr: any[] = []

    if (!defaultClipartSource) {
      arr.push({
        key: 'clipart-source',
        label: t('clipart-source'),
        filter: (
          <ChoiceList
            title="Clipart source"
            titleHidden
            choices={CLIPART_SOURCE_OPTIONS.map(option => ({
              label: capitalizeFirst(t(option.label)),
              value: option.value,
            }))}
            selected={clipartSource}
            onChange={handleSelectClipartSource}
            allowMultiple
          />
        ),
        shortcut: true,
        pinned: true,
      })
    }

    if (!hideCategories) {
      arr.push({
        key: 'categories',
        label: t('categories'),
        filter: (
          <ChoiceList
            title="Categories"
            titleHidden
            choices={categoryChoices}
            selected={categories}
            onChange={handleSelectCategories}
            allowMultiple
          />
        ),
        shortcut: true,
        pinned: true,
      })
    }

    return arr
  }, [
    categoryChoices,
    categories,
    clipartSource,
    defaultClipartSource,
    handleSelectCategories,
    t,
    handleSelectClipartSource,
    hideCategories,
    capitalizeFirst,
  ])

  const generateAppliedFilters = useCallback((): AppliedFilterInterface[] => {
    const applied: AppliedFilterInterface[] = []
    if (!isEmpty(clipartSource)) {
      applied.push({
        key: 'clipart-source',
        label: clipartSource.length
          ? `${t('clipart-source')} ${clipartSource
              .map(val => capitalizeFirst(t((CLIPART_SOURCE_LABEL as any)[val])))
              .join(', ')}`
          : '',
        onRemove: () => setClipartSource([]),
      })
    }
    if (!hideCategories && !isEmpty(categories)) {
      applied.push({
        key: 'categories',
        label: `${t('categories')} ${categories.map(capitalizeFirst).join(', ')}`,
        onRemove: () => setCategories?.([]),
      })
    }
    return applied
  }, [categories, clipartSource, setCategories, setClipartSource, t, hideCategories, capitalizeFirst])

  const handleFiltersClearAll = useCallback(() => {
    setQueryString('')
    setClipartSource([])
    setCategories?.([])
  }, [setCategories, setClipartSource, setQueryString])

  return (
    <Filters
      queryValue={queryString}
      filters={filters}
      queryPlaceholder={t('search-cliparts')}
      appliedFilters={generateAppliedFilters()}
      onQueryChange={setQueryString}
      onQueryClear={() => setQueryString('')}
      onClearAll={handleFiltersClearAll}
      closeOnChildOverlayClick
    />
  )
}
