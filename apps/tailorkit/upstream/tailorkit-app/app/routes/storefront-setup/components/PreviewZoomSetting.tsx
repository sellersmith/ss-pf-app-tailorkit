import { BlockStack, Text } from '@shopify/polaris'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Switch from '~/components/common/Switch'

interface PreviewZoomSettingValue {
  enabled: boolean
  showIndicator: boolean
}

interface PreviewZoomSettingProps {
  isSaving: boolean
  value: PreviewZoomSettingValue
  onChange: (previewZoom: PreviewZoomSettingValue) => void
}

export default function PreviewZoomSetting({ value, isSaving, onChange }: PreviewZoomSettingProps) {
  const { t } = useTranslation()

  const handleEnabledChange = useCallback(() => {
    onChange({ ...value, enabled: !value.enabled })
  }, [onChange, value])

  const handleIndicatorChange = useCallback(() => {
    onChange({ ...value, showIndicator: !value.showIndicator })
  }, [onChange, value])

  return (
    <BlockStack gap="400">
      <Text as="p" variant="bodyMd">
        {t('allow-customers-to-zoom-the-product-preview-for-a-closer-look-at-their-personalization')}
      </Text>

      <BlockStack gap="300">
        <Switch
          label={t('enable-preview-zoom')}
          checked={value.enabled}
          disabled={isSaving}
          onInput={handleEnabledChange}
        />

        {value.enabled && (
          <Switch
            label={t('show-zoom-indicator-on-first-visit')}
            checked={value.showIndicator}
            disabled={isSaving}
            onInput={handleIndicatorChange}
          />
        )}
      </BlockStack>
    </BlockStack>
  )
}
