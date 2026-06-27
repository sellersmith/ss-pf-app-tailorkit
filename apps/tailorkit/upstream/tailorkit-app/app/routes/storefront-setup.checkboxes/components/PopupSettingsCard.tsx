import { Card, BlockStack, Text, Checkbox, TextField } from '@shopify/polaris'
import { ClientOnly } from 'remix-utils/client-only'
import { useTranslation } from 'react-i18next'
import { RichTextEditor } from '~/components/.client/RichTextEditor'
import type { Popup } from '~/types/checkbox'
import { buildDynamicToolbarConfig } from './richTextToolbarConfig'

interface PopupSettingsCardProps {
  popup: Popup
  onPopupChange: (popup: Partial<Popup>) => void
}

export default function PopupSettingsCard({ popup, onPopupChange }: PopupSettingsCardProps) {
  const { t } = useTranslation()

  const toolbarConfig = buildDynamicToolbarConfig(t, 'popup-heading-toolbar')

  return (
    <Card roundedAbove="sm">
      <BlockStack gap="300">
        <Text as="h3" variant="headingMd">
          {t('popup')}
        </Text>

        <Checkbox
          label={t('show-popup')}
          checked={popup.showPopup}
          onChange={checked => onPopupChange({ showPopup: checked })}
        />

        {popup.showPopup && (
          <BlockStack gap="400">
            <TextField
              label={t('heading')}
              value={popup.heading}
              onChange={value => onPopupChange({ heading: value })}
              autoComplete="off"
              placeholder={t('popup-heading-placeholder')}
            />

            <ClientOnly fallback={null}>
              {() => (
                <RichTextEditor
                  label={t('description')}
                  value={popup.description}
                  onChange={(value: string) => onPopupChange({ description: value })}
                  toolbarConfig={toolbarConfig}
                  plainTextPaste
                  placeholder={t('popup-description-placeholder')}
                />
              )}
            </ClientOnly>
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  )
}
