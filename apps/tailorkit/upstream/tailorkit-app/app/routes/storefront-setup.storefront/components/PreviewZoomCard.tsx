import { BlockStack, Card, Collapsible, Text } from '@shopify/polaris'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Switch from '~/components/common/Switch'
import SettingLayout from '~/routes/settings/components/SettingLayout'

interface PreviewZoomValue {
  enabled: boolean
  showIndicator: boolean
}

interface PreviewZoomCardProps {
  isSaving: boolean
  value: PreviewZoomValue
  onChange: (value: PreviewZoomValue) => void
}

export default function PreviewZoomCard({ isSaving, value, onChange }: PreviewZoomCardProps) {
  const { t } = useTranslation()

  const handleZoomEnabledChange = useCallback(() => {
    onChange({ ...value, enabled: !value.enabled })
  }, [onChange, value])

  const handleIndicatorChange = useCallback(() => {
    onChange({ ...value, showIndicator: !value.showIndicator })
  }, [onChange, value])

  return (
    <SettingLayout title={t('preview-zoom')}>
      <Card>
        <BlockStack gap="400">
          <Text as="p" variant="bodyMd" tone="subdued">
            {t('allow-customers-to-zoom-the-product-preview-for-a-closer-look-at-their-personalization')}
          </Text>
          <BlockStack gap="200">
            <Switch
              label={t('enable-preview-zoom')}
              checked={value.enabled}
              disabled={isSaving}
              onInput={handleZoomEnabledChange}
            />
            <Collapsible open={value.enabled} id="zoom-indicator-collapsible">
              <Switch
                label={t('show-zoom-indicator-on-first-visit')}
                checked={value.showIndicator}
                disabled={isSaving}
                onInput={handleIndicatorChange}
              />
            </Collapsible>
          </BlockStack>
        </BlockStack>
      </Card>
    </SettingLayout>
  )
}
