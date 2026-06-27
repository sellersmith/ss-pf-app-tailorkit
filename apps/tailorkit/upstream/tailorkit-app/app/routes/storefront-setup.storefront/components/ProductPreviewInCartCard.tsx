import { BlockStack, Button, Card, InlineStack, Text } from '@shopify/polaris'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { InstallAppEmbedActivator } from '~/components/InstallAppEmbedActivator'
import SettingLayout from '~/routes/settings/components/SettingLayout'
import VideoLearnMoreModal from '~/routes/storefront-setup/components/VideoLearnMoreModal'

const YOUTUBE_URL = 'https://www.youtube.com/watch?v=l_BkjL1enU4'

interface ProductPreviewInCartCardProps {
  appConfig: any
  revalidate: () => void
}

export default function ProductPreviewInCartCard({ appConfig, revalidate }: ProductPreviewInCartCardProps) {
  const { t } = useTranslation()
  const [videoModalOpen, setVideoModalOpen] = useState(false)
  const toggleVideoModal = useCallback(() => setVideoModalOpen(prev => !prev), [])

  return (
    <SettingLayout title={t('product-preview-in-cart')}>
      <Card>
        <BlockStack gap="400">
          <Text as="p" variant="bodyMd" tone="subdued">
            {t('enable-theme-extension-to-unlock-this-feature')}{' '}
            <Button variant="plain" onClick={toggleVideoModal}>
              {t('learn-more')}
            </Button>
          </Text>
          <InlineStack align="end">
            <InstallAppEmbedActivator appConfig={appConfig} revalidate={revalidate} showDescription={false} />
          </InlineStack>
        </BlockStack>
      </Card>
      <VideoLearnMoreModal youtubeUrl={YOUTUBE_URL} open={videoModalOpen} onClose={toggleVideoModal} />
    </SettingLayout>
  )
}
