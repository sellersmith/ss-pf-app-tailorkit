import { EmptySearchResult } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'

export const EmptySearchResultComp = () => {
  const { t } = useTranslation()

  return (
    <EmptySearchResult title={t('no-product-found')} withIllustration description={t('try-changing-the-search-term')} />
  )
}
