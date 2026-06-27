import type { TFunction } from 'i18next'
import type { IndexFiltersProps } from '@shopify/polaris'

export const renderSortOptions = ({ t }: { t: TFunction }): IndexFiltersProps['sortOptions'] => [
  { label: t('name'), value: 'title asc', directionLabel: t('a-z') },
  { label: t('name'), value: 'title desc', directionLabel: t('z-a') },
  { label: t('last-updated'), value: 'updatedAt asc', directionLabel: t('oldest-first') },
  { label: t('last-updated'), value: 'updatedAt desc', directionLabel: t('newest-first') },
]
