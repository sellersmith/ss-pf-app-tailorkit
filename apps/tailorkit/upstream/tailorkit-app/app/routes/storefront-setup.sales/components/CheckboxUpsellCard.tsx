import { Badge, BlockStack, Button, Card, InlineStack, Text } from '@shopify/polaris'
import { PlusIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { NavMenuItems } from '~/bootstrap/app-config'
import { useNavigateAppBridge } from '~/bootstrap/hooks/useNavigateAppBridge'
import SettingLayout from '~/routes/settings/components/SettingLayout'

interface CheckboxUpsellCardProps {
  isCheckboxOnboardingCompleted: boolean
}

export default function CheckboxUpsellCard({ isCheckboxOnboardingCompleted }: CheckboxUpsellCardProps) {
  const { t } = useTranslation()
  const navigate = useNavigateAppBridge()

  const handleClick = () => {
    navigate(
      isCheckboxOnboardingCompleted
        ? NavMenuItems.STOREFRONT_SETUP_CHECKBOXES
        : NavMenuItems.STOREFRONT_SETUP_CHECKBOXES_ONBOARDING
    )
  }

  return (
    <SettingLayout title={t('smart-upsell-and-cross-sell')}>
      <Card>
        <BlockStack gap="400">
          <InlineStack gap="200">
            <Text as="p" variant="bodyMd" tone="subdued">
              {t('boost-average-order-value-by-showing-personalized-add-on-products')}
            </Text>
            <Badge tone="info">{t('new-feature')}</Badge>
          </InlineStack>

          <InlineStack align="end">
            <Button icon={PlusIcon} onClick={handleClick}>
              {t('add-add-on-products')}
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>
    </SettingLayout>
  )
}
