import { BlockStack, Button, Card, InlineStack, Text } from '@shopify/polaris'
import { EditIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { NavMenuItems } from '~/bootstrap/app-config'
import { useNavigateAppBridge } from '~/bootstrap/hooks/useNavigateAppBridge'
import SettingLayout from '~/routes/settings/components/SettingLayout'

export default function AIPersonalizationCard() {
  const { t } = useTranslation()
  const navigate = useNavigateAppBridge()

  return (
    <SettingLayout title={t('ai-effects')}>
      <Card>
        <BlockStack gap="400">
          <Text as="p" variant="bodyMd" tone="subdued">
            {t('ai-personalization-tools-description')}
          </Text>
          <InlineStack align="end">
            <Button icon={EditIcon} onClick={() => navigate(NavMenuItems.QUICK_PROMPTS)}>
              {t('manage-ai-effects')}
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>
    </SettingLayout>
  )
}
