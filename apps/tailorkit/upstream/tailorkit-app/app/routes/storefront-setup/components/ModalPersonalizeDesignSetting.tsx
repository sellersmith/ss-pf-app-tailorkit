import { BlockStack, Checkbox, Text } from '@shopify/polaris'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Switch from '~/components/common/Switch'

interface ModalPersonalizeDesignValue {
  mobile: boolean
  desktop: boolean
  showAddToCart?: boolean
  showBuyItNow?: boolean
}

export default function ModalPersonalizeDesignSetting({
  value,
  isSaving,
  onChange,
}: {
  isSaving: boolean
  value: ModalPersonalizeDesignValue
  onChange: (modalPersonalizeDesign: ModalPersonalizeDesignValue) => void
}) {
  const { t } = useTranslation()

  const handleModalMobileEnabled = useCallback(async () => {
    const newValue = { ...value, mobile: !value.mobile }
    // Auto-enable "Add to cart" when any modal is enabled for the first time
    if (!value.mobile && !value.desktop && newValue.mobile) {
      newValue.showAddToCart = true
    }
    onChange(newValue)
  }, [onChange, value])

  const handleModalDesktopEnabled = useCallback(async () => {
    const newValue = { ...value, desktop: !value.desktop }
    // Auto-enable "Add to cart" when any modal is enabled for the first time
    if (!value.mobile && !value.desktop && newValue.desktop) {
      newValue.showAddToCart = true
    }
    onChange(newValue)
  }, [onChange, value])

  const handleAddToCartChange = useCallback(
    (checked: boolean) => {
      onChange({ ...value, showAddToCart: checked })
    },
    [onChange, value]
  )

  const handleBuyItNowChange = useCallback(
    (checked: boolean) => {
      onChange({ ...value, showBuyItNow: checked })
    },
    [onChange, value]
  )

  // Check if either mobile or desktop modal is enabled
  const isModalEnabled = value.mobile || value.desktop

  return (
    <BlockStack gap="400">
      <Text as="p" variant="bodyMd">
        {t('modal-personalize-design-description')}
      </Text>

      <BlockStack gap="300">
        <Switch
          label={t('enable-modal-on-mobile')}
          checked={value.mobile}
          disabled={isSaving}
          onInput={handleModalMobileEnabled}
        />

        <Switch
          label={t('enable-modal-on-desktop-tablet')}
          disabled={isSaving}
          checked={value.desktop}
          onInput={handleModalDesktopEnabled}
        />
      </BlockStack>

      {/* Button selection section - only show when modal is enabled */}
      {isModalEnabled && (
        <BlockStack gap="300">
          <Text as="h3" variant="bodyMd">
            {t('select-buttons-to-display-in-modal')}
          </Text>

          <BlockStack gap="200">
            <Checkbox
              label={t('add-to-cart')}
              checked={value.showAddToCart || false}
              onChange={handleAddToCartChange}
              disabled={isSaving}
            />

            <Checkbox
              label={t('buy-it-now')}
              checked={value.showBuyItNow || false}
              onChange={handleBuyItNowChange}
              disabled={isSaving}
            />
          </BlockStack>
        </BlockStack>
      )}
    </BlockStack>
  )
}
