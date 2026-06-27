import { BlockStack, Icon, Text, TextField } from '@shopify/polaris'
import { TextBoldIcon, TextItalicIcon, TextUnderlineIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { Accordion } from '~/components/Accordion'
import { MultipleButtonToggle } from '~/components/Button/MultipleButtonToggle'
import EditorColorPicker from '~/components/common/ColorPicker'
import { NumericSliderField } from '~/modules/TemplateEditor/elements/components/Text/Styling/Typography/NumericSliderField'
import type { TextStyleConfig } from '~/types/global-styling'

export interface HeadingSectionProps {
  /** Current heading configuration */
  heading: TextStyleConfig
  /** Callback when heading changes */
  onHeadingChange: (heading: TextStyleConfig) => void
}

/**
 * Heading styling section with text, font size, color, and text styling options
 */
export function HeadingSection({ heading, onHeadingChange }: HeadingSectionProps) {
  const { t } = useTranslation()

  return (
    <Accordion
      id="heading"
      label={t('heading')}
      open={false}
      content={
        <BlockStack gap="400">
          <TextField
            label={t('heading-text')}
            autoComplete="off"
            value={heading.text}
            showCharacterCount
            maxLength={100}
            onChange={v => onHeadingChange({ ...heading, text: v })}
          />

          <NumericSliderField
            label={t('font-size')}
            value={heading.fontSize}
            min={8}
            max={30}
            step={1}
            suffix="px"
            onChange={v => onHeadingChange({ ...heading, fontSize: v })}
          />

          <BlockStack gap="100">
            <Text as="p" variant="bodyMd">
              {t('text-style')}
            </Text>
            <MultipleButtonToggle
              multiple={true}
              selected={heading.style || []}
              options={[
                { value: 'bold', label: <Icon source={TextBoldIcon} /> },
                { value: 'italic', label: <Icon source={TextItalicIcon} /> },
                { value: 'underline', label: <Icon source={TextUnderlineIcon} /> },
              ]}
              onClick={v => onHeadingChange({ ...heading, style: v })}
            />
          </BlockStack>

          <BlockStack gap="100">
            <Text as="p" variant="bodyMd">
              {t('font-color')}
            </Text>
            <EditorColorPicker
              value={heading.color}
              debounceMs={150}
              onChange={v => onHeadingChange({ ...heading, color: v })}
            />
          </BlockStack>
        </BlockStack>
      }
    />
  )
}
