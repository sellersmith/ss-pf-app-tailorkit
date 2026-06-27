import { ChoiceList } from '@shopify/polaris'
import type { IRenderFiltersProps } from '../type'

// Create filters for template listing
export function renderFilters(props: IRenderFiltersProps) {
  const { t } = props

  const filters = [
    {
      key: 'status',
      label: t('status'),
      filter: {
        Component: ChoiceList,
        props: {
          titleHidden: true,
          title: t('status'),
          choices: [
            { label: t('active'), value: 'active' },
            { label: t('inactive'), value: 'inactive' },
          ],
        },
      },
      shortcut: true,
    },
  ]

  return filters
}
