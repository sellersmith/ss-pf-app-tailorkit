import { BlockStack, Divider, Icon, Text } from '@shopify/polaris'
import { TextBoldIcon, TextItalicIcon, TextUnderlineIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { Accordion } from '~/components/Accordion'
import { MultipleButtonToggle } from '~/components/Button/MultipleButtonToggle'
import EditorColorPicker from '~/components/common/ColorPicker'
import { NumericSliderField } from '~/modules/TemplateEditor/elements/components/Text/Styling/Typography/NumericSliderField'
import type { OptionSetStyle } from '~/types/global-styling'

export interface OptionSetSectionProps {
  /** Current option set configuration */
  optionSet: OptionSetStyle
  /** Callback when option set changes */
  onOptionSetChange: (optionSet: OptionSetStyle) => void
}

/**
 * Option set styling section with label and option color/size settings
 */
export function OptionSetSection({ optionSet, onOptionSetChange }: OptionSetSectionProps) {
  const { t } = useTranslation()

  return (
    <Accordion
      id="option-set"
      label={t('option-set')}
      open={false}
      content={
        <BlockStack gap="400">
          <BlockStack gap="100">
            <Text as="p" variant="bodyMd">
              {t('storefront-label-color')}
            </Text>
            <EditorColorPicker
              value={optionSet.label.color}
              debounceMs={150}
              onChange={v =>
                onOptionSetChange({
                  ...optionSet,
                  label: { ...optionSet.label, color: v },
                })
              }
            />
          </BlockStack>

          <NumericSliderField
            label={t('storefront-label-size')}
            value={optionSet.label.size}
            min={8}
            max={30}
            step={1}
            suffix="px"
            onChange={v =>
              onOptionSetChange({
                ...optionSet,
                label: { ...optionSet.label, size: v },
              })
            }
          />

          <BlockStack gap="100">
            <Text as="p" variant="bodyMd">
              {t('label-style')}
            </Text>
            <MultipleButtonToggle
              multiple={true}
              selected={
                [
                  optionSet.label.bold ? 'bold' : null,
                  optionSet.label.italic ? 'italic' : null,
                  optionSet.label.underline ? 'underline' : null,
                ].filter(Boolean) as string[]
              }
              options={[
                { value: 'bold', label: <Icon source={TextBoldIcon} /> },
                { value: 'italic', label: <Icon source={TextItalicIcon} /> },
                { value: 'underline', label: <Icon source={TextUnderlineIcon} /> },
              ]}
              onClick={v =>
                onOptionSetChange({
                  ...optionSet,
                  label: {
                    ...optionSet.label,
                    bold: v.includes('bold'),
                    italic: v.includes('italic'),
                    underline: v.includes('underline'),
                  },
                })
              }
            />
          </BlockStack>

          <Divider />

          {/* Option border group */}
          <Text as="p" variant="bodyMd">
            {t('option-border')}
          </Text>

          <BlockStack gap="100">
            <Text as="p" variant="bodyMd">
              {t('active-color')}
            </Text>
            <EditorColorPicker
              value={optionSet.option.borderActiveColor}
              debounceMs={150}
              onChange={v =>
                onOptionSetChange({
                  ...optionSet,
                  option: { ...optionSet.option, borderActiveColor: v },
                })
              }
            />
          </BlockStack>

          <NumericSliderField
            label={t('corner-radius')}
            value={optionSet.option.borderRadius}
            min={0}
            max={30}
            step={1}
            suffix="px"
            onChange={v =>
              onOptionSetChange({
                ...optionSet,
                option: { ...optionSet.option, borderRadius: v },
              })
            }
          />
        </BlockStack>
      }
    />
  )
}
