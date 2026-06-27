import { Box, InlineStack, Tag, Text, TextField } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { AccordionList } from '~/components/Accordion'
import { MAX_LENGTH_PROMPT, TONE_TYPE } from '../../constants'
import { useMemo } from 'react'

interface DescriptionSectionProps {
  prompt: string
  placeholder: string
  mainTextLabel: string | React.ReactNode
  placeholderMainTextLabel?: string
  onChangeImagePrompt: (value: string) => void
  selectedEffectName?: string
  hasVariables?: boolean
}

export function DescriptionSection({
  prompt,
  placeholder,
  mainTextLabel,
  placeholderMainTextLabel,
  onChangeImagePrompt,
  selectedEffectName,
  hasVariables = false,
}: DescriptionSectionProps) {
  const { t } = useTranslation()

  // Show Tag when effect is selected
  const showTag = !!selectedEffectName

  const items = useMemo(
    () => [
      {
        open: hasVariables,
        rememberState: false,
        id: 'description',
        label: (
          <Text as="h3" variant="bodyMd" fontWeight="semibold">
            {mainTextLabel || t('what-would-you-like-to-create')}
          </Text>
        ),
        content: (
          <>
            {showTag && (
              <Box paddingBlockEnd="200">
                <InlineStack gap="100">
                  <Tag>{selectedEffectName}</Tag>
                </InlineStack>
              </Box>
            )}
            <TextField
              value={prompt}
              onChange={onChangeImagePrompt}
              placeholder={
                showTag
                  ? t('add-additional-details-optional')
                  : placeholder || placeholderMainTextLabel || t('placeholder-topic')
              }
              autoComplete="off"
              label={mainTextLabel || t('what-would-you-like-to-create')}
              labelHidden={true}
              maxLength={MAX_LENGTH_PROMPT[TONE_TYPE.IMAGE]}
              multiline={showTag ? 3 : 7}
              autoSize={false}
              showCharacterCount
              maxHeight={'320px'}
            />
          </>
        ),
      },
    ],
    [
      hasVariables,
      mainTextLabel,
      onChangeImagePrompt,
      placeholder,
      placeholderMainTextLabel,
      prompt,
      selectedEffectName,
      showTag,
      t,
    ]
  )

  return (
    <AccordionList
      key={hasVariables ? 'description-section-has-variables' : 'description-section-no-variables'}
      hideDivider={true}
      paddingBlockEnd="0"
      style={{ margin: '0 -0.75rem' }}
      items={items}
    />
  )
}
