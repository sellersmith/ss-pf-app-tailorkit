import type { TFunction } from 'i18next'
import { ChoiceList } from '@shopify/polaris'

export const renderFilters = ({ t }: { t: TFunction }) => [
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
          { label: t('draft'), value: 'draft' },
        ],
      },
    },
    shortcut: true,
  },
  {
    key: 'placement',
    label: t('placement'),
    filter: {
      Component: ChoiceList,
      props: {
        titleHidden: true,
        title: t('placement'),
        choices: [
          { label: t('product-page'), value: 'product_page' },
          { label: t('cart'), value: 'cart' },
        ],
      },
    },
    shortcut: true,
  },
]
