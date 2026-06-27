import { BlockStack, InlineStack, Text } from '@shopify/polaris'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Switch from '~/components/common/Switch'

export default function PersonalizerProductEnabler({
  value,
  isSaving,
  onChange,
}: {
  value: boolean
  isSaving: boolean
  onChange: (isEnabled: boolean) => void
}) {
  const { t } = useTranslation()

  const togglePersonalizerProduct = useCallback(async () => {
    onChange(!value)
  }, [onChange, value])

  return (
    <BlockStack>
      <InlineStack align="space-between">
        <Switch
          label={t('enable-ai-smart-personalization')}
          checked={value}
          disabled={isSaving}
          onInput={togglePersonalizerProduct}
          accessibilityLabel={t('enable-ai-smart-personalization')}
        />
      </InlineStack>

      <Text variant="bodyMd" as="dd" tone="subdued">
        {t('let-buyers-personalize-products-with-ai-suggestions')}
      </Text>
    </BlockStack>
  )
}
