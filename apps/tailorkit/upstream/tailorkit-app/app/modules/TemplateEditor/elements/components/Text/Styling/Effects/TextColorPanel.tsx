import { BlockStack, Text } from '@shopify/polaris'
import { useCallback } from 'react'
import EditorColorPicker from '~/components/common/ColorPicker'
import { DEFAULT_TEXT_COLOR } from '~/constants/inspector/text'
import type TemplateElement from '../../..'
import { DEBOUNCE_REQUEST_MINOR } from '~/constants/debounce'

interface TextColorPanelProps {
  element: TemplateElement<any, any>
  t: (key: string) => string
}

export function TextColorPanel({ element, t }: TextColorPanelProps) {
  const settings = element?.state?.settings || {}

  const onChangeTextColor = useCallback(
    (color: string) => {
      // Use the same logic as the Text component
      const currentSettings = element.state.settings || {}
      element.setData(
        {
          settings: {
            ...currentSettings,
            textColor: color,
            ...(currentSettings.neonMode === 'inverse' && { strokeColor: color }),
          },
        },
        ''
      )
    },
    [element]
  )

  return (
    <BlockStack gap={'150'}>
      <Text as="p" variant="bodyMd">
        {t('text-color')}
      </Text>
      <EditorColorPicker
        id="text-color"
        placeholder={DEFAULT_TEXT_COLOR}
        value={settings.textColor || DEFAULT_TEXT_COLOR}
        preferredPosition="below"
        showInPopover={false}
        width="100%"
        debounceMs={DEBOUNCE_REQUEST_MINOR}
        onChange={onChangeTextColor}
      />
    </BlockStack>
  )
}
