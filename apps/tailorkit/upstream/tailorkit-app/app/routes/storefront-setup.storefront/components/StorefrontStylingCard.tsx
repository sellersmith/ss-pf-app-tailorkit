import { BlockStack, Button, Card, InlineStack, Text } from '@shopify/polaris'
import { EditIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { NavMenuItems } from '~/bootstrap/app-config'
import { useNavigateAppBridge } from '~/bootstrap/hooks/useNavigateAppBridge'
import SettingLayout from '~/routes/settings/components/SettingLayout'

export default function StorefrontStylingCard() {
  const { t } = useTranslation()
  const navigate = useNavigateAppBridge()

  return (
    <SettingLayout title={t('personalization-box-styling')}>
      <Card>
        <BlockStack gap="400">
          <Text as="p" variant="bodyMd" tone="subdued">
            {t('style-your-personalization-box-to-match-your-brand-and-boost-conversions')}
          </Text>
          <InlineStack align="end">
            <Button icon={EditIcon} onClick={() => navigate(NavMenuItems.STOREFRONT_SETUP_STYLING)}>
              {t('customize-box-styling')}
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>
    </SettingLayout>
  )
}
