import { Banner } from '@shopify/polaris'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

function BannerFreeLimitOrdersEnded() {
  const { t } = useTranslation()

  const [activeBanner, setActiveBanner] = useState(true)

  return activeBanner ? (
    <Banner
      title={t('free-limit-orders-have-ended')}
      onDismiss={() => {
        setActiveBanner(pre => !pre)
      }}
    >
      <p>{t('free-limit-orders-have-ended-description')}</p>
    </Banner>
  ) : null
}

export default BannerFreeLimitOrdersEnded
