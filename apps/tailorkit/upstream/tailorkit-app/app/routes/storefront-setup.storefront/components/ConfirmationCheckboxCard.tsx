import { BlockStack, Card, Collapsible, Text, TextField } from '@shopify/polaris'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Switch from '~/components/common/Switch'
import SettingLayout from '~/routes/settings/components/SettingLayout'

const DEFAULT_CONFIRMATION_MESSAGE = "I've reviewed my personalization and ready to proceed"

interface ConfirmationCheckboxValue {
  enabled: boolean
  message: string
}

interface ConfirmationCheckboxCardProps {
  isSaving: boolean
  value: ConfirmationCheckboxValue
  onChange: (value: ConfirmationCheckboxValue) => void
}

export default function ConfirmationCheckboxCard({ isSaving, value, onChange }: ConfirmationCheckboxCardProps) {
  const { t } = useTranslation()

  const handleEnabledChange = useCallback(() => {
    onChange({ ...value, enabled: !value.enabled })
  }, [onChange, value])

  const handleMessageChange = useCallback(
    (message: string) => {
      onChange({ ...value, message })
    },
    [onChange, value]
  )

  const handleMessageBlur = useCallback(() => {
    if (!value.message?.trim()) {
      onChange({ ...value, message: DEFAULT_CONFIRMATION_MESSAGE })
    }
  }, [onChange, value])

  return (
    <SettingLayout title={t('confirmation-checkbox')}>
      <Card>
        <BlockStack gap="400">
          <Text as="p" variant="bodyMd" tone="subdued">
            {t('require-customers-to-check-a-confirmation-box-before-adding-to-cart-or-checking-out')}
          </Text>
          <BlockStack gap="200">
            <Switch
              label={t('enable-confirmation-checkbox')}
              checked={value.enabled}
              disabled={isSaving}
              onInput={handleEnabledChange}
            />
            <Collapsible open={value.enabled} id="confirmation-message-collapsible">
              <TextField
                label={t('checkbox-message')}
                value={value.message ?? ''}
                onChange={handleMessageChange}
                onBlur={handleMessageBlur}
                disabled={isSaving}
                autoComplete="off"
                placeholder={DEFAULT_CONFIRMATION_MESSAGE}
                maxLength={100}
                showCharacterCount
                helpText={t('this-message-will-be-displayed-next-to-the-confirmation-checkbox-on-the-product-page')}
              />
            </Collapsible>
          </BlockStack>
        </BlockStack>
      </Card>
    </SettingLayout>
  )
}

export { DEFAULT_CONFIRMATION_MESSAGE }
