import { Box, InlineStack, Icon, Text, BlockStack } from '@shopify/polaris'
import { MagicIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'

export function BannerAIAnnouncement() {
  const { t } = useTranslation()

  return (
    <Box background="bg-surface-info" padding="300" borderRadius="300" shadow="100">
      <BlockStack gap={'200'}>
        <div style={{ color: '#005BD3' }}>
          <InlineStack wrap={false} gap="200" blockAlign="center">
            <Box>
              <Icon source={MagicIcon} />
            </Box>
            <Text as="h3" variant="headingMd" fontWeight="semibold">
              {t('personalized-images-by-your-buyers')}
            </Text>
          </InlineStack>
        </div>

        <Text as="p" variant="bodyMd">
          {t('now-you-can-let-buyers')}
        </Text>
        <Text as="p" variant="bodyMd">
          📤 {t('upload-their-own-images')}
        </Text>
        <Text as="p" variant="bodyMd">
          🤖 {t('or-generate-images-with-ai')}
        </Text>
        <Text as="p" variant="bodyMd" fontWeight="medium">
          👉 {t('try-it-now-by-creating-a-new-or-editing-an-existing-option-set')}
        </Text>
      </BlockStack>
    </Box>
  )
}
