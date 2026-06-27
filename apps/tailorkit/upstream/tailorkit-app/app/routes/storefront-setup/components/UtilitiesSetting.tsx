import { BlockStack, Collapsible, Divider, Text, TextField } from '@shopify/polaris'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Switch from '~/components/common/Switch'

interface PreviewZoomValue {
  enabled: boolean
  showIndicator: boolean
}

interface ConfirmationCheckboxValue {
  enabled: boolean
  message: string
}

export interface UtilitiesSettingValue {
  previewZoom: PreviewZoomValue
  confirmationCheckbox: ConfirmationCheckboxValue
  undoRedo: boolean
}

interface UtilitiesSettingProps {
  isSaving: boolean
  value: UtilitiesSettingValue
  onChange: (utilities: UtilitiesSettingValue) => void
}

const DEFAULT_CONFIRMATION_MESSAGE = "I've reviewed my personalization and ready to proceed"

export default function UtilitiesSetting({ value, isSaving, onChange }: UtilitiesSettingProps) {
  const { t } = useTranslation()

  // Preview Zoom handlers
  const handleZoomEnabledChange = useCallback(() => {
    onChange({
      ...value,
      previewZoom: { ...value.previewZoom, enabled: !value.previewZoom.enabled },
    })
  }, [onChange, value])

  const handleIndicatorChange = useCallback(() => {
    onChange({
      ...value,
      previewZoom: { ...value.previewZoom, showIndicator: !value.previewZoom.showIndicator },
    })
  }, [onChange, value])

  // Confirmation Checkbox handlers
  const handleConfirmationEnabledChange = useCallback(() => {
    onChange({
      ...value,
      confirmationCheckbox: {
        ...value.confirmationCheckbox,
        enabled: !value.confirmationCheckbox.enabled,
      },
    })
  }, [onChange, value])

  const handleConfirmationMessageChange = useCallback(
    (message: string) => {
      onChange({
        ...value,
        confirmationCheckbox: { ...value.confirmationCheckbox, message },
      })
    },
    [onChange, value]
  )

  // // Undo/Redo handler
  // const handleUndoRedoChange = useCallback(() => {
  //   onChange({ ...value, undoRedo: !value.undoRedo })
  // }, [onChange, value])

  const handleConfirmationMessageBlur = useCallback(() => {
    if (!value.confirmationCheckbox.message?.trim()) {
      onChange({
        ...value,
        confirmationCheckbox: { ...value.confirmationCheckbox, message: DEFAULT_CONFIRMATION_MESSAGE },
      })
    }
  }, [onChange, value])

  return (
    <BlockStack gap="400">
      {/* Preview Zoom Section */}
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm" fontWeight="semibold">
          {t('preview-zoom')}
        </Text>
        <Text as="p" variant="bodyMd">
          {t('allow-customers-to-zoom-the-product-preview-for-a-closer-look-at-their-personalization')}
        </Text>

        <BlockStack gap="200">
          <Switch
            label={t('enable-preview-zoom')}
            checked={value.previewZoom.enabled}
            disabled={isSaving}
            onInput={handleZoomEnabledChange}
          />

          <Collapsible open={value.previewZoom.enabled} id="zoom-indicator-collapsible">
            <Switch
              label={t('show-zoom-indicator-on-first-visit')}
              checked={value.previewZoom.showIndicator}
              disabled={isSaving}
              onInput={handleIndicatorChange}
            />
          </Collapsible>
        </BlockStack>
      </BlockStack>

      <Divider borderColor="border" borderWidth="025" />

      {/* Confirmation Checkbox Section */}
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm" fontWeight="semibold">
          {t('confirmation-checkbox')}
        </Text>
        <Text as="p" variant="bodyMd">
          {t('require-customers-to-check-a-confirmation-box-before-adding-to-cart-or-checking-out')}
        </Text>

        <BlockStack gap="200">
          <Switch
            label={t('enable-confirmation-checkbox')}
            checked={value.confirmationCheckbox.enabled}
            disabled={isSaving}
            onInput={handleConfirmationEnabledChange}
          />

          <Collapsible open={value.confirmationCheckbox.enabled} id="confirmation-message-collapsible">
            <TextField
              label={t('checkbox-message')}
              value={value.confirmationCheckbox.message ?? ''}
              onChange={handleConfirmationMessageChange}
              onBlur={handleConfirmationMessageBlur}
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

      {/* Undo/Redo Section */}
      {/* <Divider borderColor="border" borderWidth="025" />
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm" fontWeight="semibold">
          {t('undo-redo')}
        </Text>
        <Text as="p" variant="bodyMd">
          {t('allow-customers-to-undo-and-redo-their-personalization')}
        </Text>

        <Switch
          label={t('enable-undo-redo')}
          checked={value.undoRedo}
          disabled={isSaving}
          onInput={handleUndoRedoChange}
        />
      </BlockStack> */}
    </BlockStack>
  )
}

export { DEFAULT_CONFIRMATION_MESSAGE }
