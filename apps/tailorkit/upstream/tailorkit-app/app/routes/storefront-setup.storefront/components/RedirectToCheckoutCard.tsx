import { BlockStack, Card, Text } from '@shopify/polaris'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Switch from '~/components/common/Switch'
import SettingLayout from '~/routes/settings/components/SettingLayout'

interface RedirectToCheckoutValue {
  enabled: boolean
}

interface RedirectToCheckoutCardProps {
  isSaving: boolean
  value: RedirectToCheckoutValue
  onChange: (value: RedirectToCheckoutValue) => void
}

export default function RedirectToCheckoutCard({ isSaving, value, onChange }: RedirectToCheckoutCardProps) {
  const { t } = useTranslation()

  const handleToggle = useCallback(() => {
    onChange({ ...value, enabled: !value.enabled })
  }, [onChange, value])

  return (
    <SettingLayout title={t('direct-to-checkout-after-personalization')}>
      <Card>
        <BlockStack gap="400">
          <Text as="p" variant="bodyMd" tone="subdued">
            {t('send-customers-straight-to-checkout-after-they-finish-personalizing-instead-of-the-cart-page')}
          </Text>
          <Switch
            label={t('redirect-to-checkout-after-add-to-cart')}
            checked={value.enabled}
            disabled={isSaving}
            onInput={handleToggle}
          />
        </BlockStack>
      </Card>
    </SettingLayout>
  )
}
