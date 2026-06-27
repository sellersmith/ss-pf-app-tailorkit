import { Banner } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'

interface ConnectionLostBannerProps {
  onReconnect: () => void
}

export default function ConnectionLostBanner({ onReconnect }: ConnectionLostBannerProps) {
  const { t } = useTranslation()

  return (
    <Banner title={t('connection-lost')} tone="critical" action={{ content: t('reconnect'), onAction: onReconnect }}>
      <p>{t('shineon-connection-lost-please-re-enter-your-api-key-to-reconnect')}</p>
    </Banner>
  )
}
