import { EmptySearchResult } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'

interface IEmptySearchMarkup {
  resourceName: string
  description?: string
}

function EmptySearchMarkup({ resourceName, description }: IEmptySearchMarkup) {
  const { t } = useTranslation()

  return (
    <div className="emtlkit--d-flex emtlkit--flex-center emtlkit--flex-justify-center h-100">
      <EmptySearchResult
        title={t(`no-${resourceName}-found`)}
        withIllustration
        description={description || t('try-changing-the-search-term')}
      />
    </div>
  )
}

export default EmptySearchMarkup
