import type { IndexFiltersProps } from '@shopify/polaris'
import type { IRenderSortOptionsProps } from '../type'

// Define options for sorting templates
export function renderSortOptions(props: IRenderSortOptionsProps): IndexFiltersProps['sortOptions'] {
  const { t } = props

  return [
    { label: t('name'), value: 'name asc', directionLabel: t('a-z') },
    { label: t('name'), value: 'name desc', directionLabel: t('z-a') },
    { label: t('last-update'), value: 'updatedAt asc', directionLabel: t('oldest-first') },
    { label: t('last-update'), value: 'updatedAt desc', directionLabel: t('newest-first') },
  ]
}
