import { BlockStack, Text, TextField } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { AccordionList } from '~/components/Accordion'
import PromptPresets from '~/modules/PromptPresets'
import { MAX_LENGTH_PROMPT, TONE_TYPE } from '../../constants'
import type { PromptPresetItem } from '~/api/services/prompt-presets'

interface CreativeToolsAccordionProps {
  // Quick prompts / Description
  allowCustomerToUseQuickPrompts: boolean
  enabledQuickPrompts?: string[]
  prompt: string
  placeholder: string
  mainTextLabel: string | React.ReactNode
  placeholderMainTextLabel?: string
  itemsPerRow: number
  onChangeImagePrompt: (value: string) => void
  onChangeQuickPrompt: (name: string[], instruction?: string[]) => void
  filterQuickPrompts: (items: PromptPresetItem[]) => PromptPresetItem[]
}

export function CreativeToolsAccordion({
  allowCustomerToUseQuickPrompts,
  enabledQuickPrompts,
  prompt,
  placeholder,
  mainTextLabel,
  placeholderMainTextLabel,
  itemsPerRow,
  onChangeImagePrompt,
  onChangeQuickPrompt,
  filterQuickPrompts,
}: CreativeToolsAccordionProps) {
  const { t } = useTranslation()

  const items = [
    // Description with quick prompts
    ...(allowCustomerToUseQuickPrompts && (enabledQuickPrompts === undefined || enabledQuickPrompts.length > 0)
      ? [
          {
            open: false,
            rememberState: false,
            id: 'description',
            label: (
              <Text as="h3" variant="bodyMd" fontWeight="semibold">
                {mainTextLabel || t('what-would-you-like-to-create')}
              </Text>
            ),
            content: (
              <BlockStack gap="100">
                <TextField
                  value={prompt}
                  onChange={onChangeImagePrompt}
                  placeholder={placeholder || placeholderMainTextLabel || t('placeholder-topic')}
                  autoComplete="off"
                  label={mainTextLabel || t('what-would-you-like-to-create')}
                  labelHidden={true}
                  maxLength={MAX_LENGTH_PROMPT[TONE_TYPE.IMAGE]}
                  multiline={7}
                  autoSize={false}
                  showCharacterCount
                  maxHeight={'320px'}
                />
                <PromptPresets
                  viewAll={true}
                  layout="carousel"
                  type="quick_prompt"
                  itemsPerRow={itemsPerRow}
                  label={t('need-inspiration-try-these')}
                  onSelect={onChangeQuickPrompt}
                  filterItems={filterQuickPrompts}
                />
              </BlockStack>
            ),
          },
        ]
      : []),
  ]

  if (items.length === 0) return null

  return <AccordionList hideDivider={true} paddingBlockEnd="0" style={{ margin: '0 -0.75rem' }} items={items} />
}
