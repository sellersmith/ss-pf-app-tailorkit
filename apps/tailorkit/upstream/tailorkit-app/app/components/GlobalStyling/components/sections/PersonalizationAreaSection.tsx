import { BlockStack, Icon, Text } from '@shopify/polaris'
import { TextBoldIcon, TextItalicIcon, TextUnderlineIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { Accordion } from '~/components/Accordion'
import Switch from '~/components/common/Switch'
import { MultipleButtonToggle } from '~/components/Button/MultipleButtonToggle'
import EditorColorPicker from '~/components/common/ColorPicker'
import { NumericSliderField } from '~/modules/TemplateEditor/elements/components/Text/Styling/Typography/NumericSliderField'
import type { PersonalizationAreaStyle } from '~/types/global-styling'

export interface PersonalizationAreaSectionProps {
  /** Current personalization area configuration */
  personalizationArea: PersonalizationAreaStyle
  /** Callback when personalization area changes */
  onPersonalizationAreaChange: (personalizationArea: PersonalizationAreaStyle) => void
}

/**
 * Personalization area styling section with auto-hide toggle, font settings, and background color
 */
export function PersonalizationAreaSection({
  personalizationArea,
  onPersonalizationAreaChange,
}: PersonalizationAreaSectionProps) {
  const { t } = useTranslation()

  return (
    <Accordion
      id="personalization-area"
      label={t('personalization-area')}
      tooltip={t('auto-hide-personalization-area-name-if-only-one')}
      open={false}
      content={
        <BlockStack gap="400">
          <Switch
            label={t('display-personalization-area')}
            checked={personalizationArea.enabled}
            onInput={() =>
              onPersonalizationAreaChange({
                ...personalizationArea,
                enabled: !personalizationArea.enabled,
              })
            }
          />

          {personalizationArea.enabled && (
            <>
              <BlockStack gap="100">
                <Text as="p" variant="bodyMd">
                  {t('font-color')}
                </Text>
                <EditorColorPicker
                  value={personalizationArea.color}
                  debounceMs={150}
                  onChange={v =>
                    onPersonalizationAreaChange({
                      ...personalizationArea,
                      color: v,
                    })
                  }
                />
              </BlockStack>

              <NumericSliderField
                label={t('font-size')}
                value={personalizationArea.fontSize}
                min={8}
                max={30}
                step={1}
                suffix="px"
                onChange={v =>
                  onPersonalizationAreaChange({
                    ...personalizationArea,
                    fontSize: v,
                  })
                }
              />

              <BlockStack gap="100">
                <Text as="p" variant="bodyMd">
                  {t('text-style')}
                </Text>
                <MultipleButtonToggle
                  multiple={true}
                  selected={personalizationArea.style || []}
                  options={[
                    { value: 'bold', label: <Icon source={TextBoldIcon} /> },
                    { value: 'italic', label: <Icon source={TextItalicIcon} /> },
                    { value: 'underline', label: <Icon source={TextUnderlineIcon} /> },
                  ]}
                  onClick={v =>
                    onPersonalizationAreaChange({
                      ...personalizationArea,
                      style: v,
                    })
                  }
                />
              </BlockStack>

              <BlockStack gap="100">
                <Text as="p" variant="bodyMd">
                  {t('background-color')}
                </Text>
                <EditorColorPicker
                  value={personalizationArea.backgroundColor}
                  debounceMs={150}
                  onChange={v =>
                    onPersonalizationAreaChange({
                      ...personalizationArea,
                      backgroundColor: v,
                    })
                  }
                />
              </BlockStack>

              <NumericSliderField
                label={t('corner-radius')}
                value={personalizationArea.borderRadius}
                min={0}
                max={30}
                step={1}
                suffix="px"
                onChange={v =>
                  onPersonalizationAreaChange({
                    ...personalizationArea,
                    borderRadius: v,
                  })
                }
              />
            </>
          )}
        </BlockStack>
      }
    />
  )
}
