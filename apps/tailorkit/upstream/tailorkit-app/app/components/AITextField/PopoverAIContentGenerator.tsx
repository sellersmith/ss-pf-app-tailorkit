import type { TextFieldProps } from '@shopify/polaris'
import {
  BlockStack,
  Box,
  Button,
  ButtonGroup,
  InlineStack,
  OptionList,
  Scrollable,
  Text,
  TextField,
  Tooltip,
} from '@shopify/polaris'
import { AdjustIcon } from '@shopify/polaris-icons'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AiCreditExhaustedBanner } from '~/components/common/AiCreditExhaustedBanner'
import { useAiCreditsStatus } from '~/hooks/useAiCreditsStatus'
import { showGenericErrorToast } from '~/utils/toastEvents'
import styles from './style.module.css'
import { AI_ASSISTANT_SUGGESTION_ACTION } from '~/routes/api.ai-assistant.suggestion/constants'
import type { ChatModel } from 'openai/resources/chat/chat.mjs'
import DOMPurify from 'dompurify'
import { PopoverToneSelector } from './PopoverToneSelector'
import { MAX_LENGTH_PROMPT, TEXT_TONE_KEY, TEXT_TONE_OPTIONS_MAP, TONE_TYPE } from './constants'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { localStorage } from 'extensions/tailorkit-src/src/assets/utils/localStorage'
import { authenticatedFetch } from '~/shopify/fns.client'

interface PopoverAIContentGeneratorProps {
  title: string
  value?: TextFieldProps['value']
  mainTextLabel: string
  placeholderMainTextLabel?: string
  optionalTextLabel: string
  placeholderOptionalTextLabel?: string
  allowMultipleOptions?: boolean
  disabledMainText?: boolean
  defaultOpenOptionSettings?: boolean
  disabledOptionSettings?: boolean
  showInstruction?: boolean
  optionResponseQuantity?: number
  metadata?: Record<string, any>
  model?: ChatModel
  containHTMLTags?: boolean
  maxContentLength?: number
  promptPrefix?: string
  contentWrapper?: null | ((content: string) => React.ReactNode)
  onSelectOptionAfterGenerating: (options: string[]) => void
  onTogglePopoverActive?: () => void
}

export default function PopoverAIContentGenerator(props: PopoverAIContentGeneratorProps) {
  const {
    title,
    value,
    mainTextLabel,
    placeholderMainTextLabel,
    optionalTextLabel,
    placeholderOptionalTextLabel,
    allowMultipleOptions,
    disabledMainText = false,
    defaultOpenOptionSettings = false,
    disabledOptionSettings = false,
    optionResponseQuantity = 5,
    metadata,
    model = 'gpt-4.1-nano',
    maxContentLength,
    containHTMLTags = false,
    promptPrefix = '',
    showInstruction = true,
    onSelectOptionAfterGenerating,
    onTogglePopoverActive,
    contentWrapper = (content: string) => (
      <Text variant="bodyMd" as="span" tone="success">
        {content}
      </Text>
    ),
  } = props

  const { t } = useTranslation()
  const { hasCredits } = useAiCreditsStatus()
  const [isOpenOptionSettings, setIsOpenOptionSettings] = useState(defaultOpenOptionSettings)

  const [topic, setTopic] = useState('')
  const [instructions, setInstructions] = useState('')
  const [tone, setTone] = useState(TEXT_TONE_OPTIONS_MAP[TEXT_TONE_KEY.EXPERT].value)
  const [generating, setGenerating] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [selectedOption, setSelectedOption] = useState<string[]>([])
  const [isFocused, setIsFocused] = useState(false)

  const toggleOptionSettings = useCallback(() => setIsOpenOptionSettings(!isOpenOptionSettings), [isOpenOptionSettings])
  const handleTopicChange = useCallback((value: string) => setTopic(value), [])
  const handleInstructionsChange = useCallback((value: string) => setInstructions(value), [])
  const handleToneChange = useCallback((value: string) => setTone(value), [])

  const handleGenerate = useCallback(async () => {
    try {
      setGenerating(true)

      // Clear selected option
      setSelectedOption([])
      setSuggestions([])

      const responseData = await authenticatedFetch('/api/ai-assistant/suggestion', {
        method: 'POST',
        body: JSON.stringify({
          action: AI_ASSISTANT_SUGGESTION_ACTION.GENERATE_CONTENT,
          tone,
          initialContent: value,
          mainTextLabel,
          topic: `${promptPrefix} ${topic}`,
          optionalTextLabel,
          instructions,
          optionResponseQuantity,
          metadata,
          model: model,
          containHTMLTags,
          maxContentLength,
        }),
      })

      if (!responseData?.success) {
        throw new Error(responseData?.message || 'Generation failed')
      }

      const contents = responseData.contents || []
      // Sanitize content immediately when received from the API
      const sanitizedContents = contents.map((content: string) => DOMPurify.sanitize(content))
      setSuggestions(sanitizedContents)
    } catch (error) {
      console.error(error)
      showGenericErrorToast()
    } finally {
      setGenerating(false)
    }
  }, [
    containHTMLTags,
    instructions,
    mainTextLabel,
    maxContentLength,
    metadata,
    model,
    optionResponseQuantity,
    optionalTextLabel,
    promptPrefix,
    tone,
    topic,
    value,
  ])

  const { trackEvent } = useEventsTracking()

  const handleSelectOptionAfterGenerating = useCallback(() => {
    onSelectOptionAfterGenerating(selectedOption)

    // Close popover
    onTogglePopoverActive?.()

    trackEvent(EVENTS_TRACKING.BUILD_WITH_AI, {
      options: selectedOption,
      feature: 'ai_gen_text_select',
    })

    // Track the time when user use AI feature
    localStorage.setItem('TLK_USE_AI_FEATURE_AT', Date.now().toString())
  }, [onSelectOptionAfterGenerating, onTogglePopoverActive, selectedOption, trackEvent])

  const disabledGenerate = useMemo(() => {
    return !hasCredits || (!topic && !instructions)
  }, [hasCredits, topic, instructions])

  useEffect(() => {
    // Add Enter key listener if any text fields are focused
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && isFocused && !disabledGenerate) {
        handleGenerate()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [disabledGenerate, isFocused, handleGenerate])

  return (
    <div style={{ width: 'fit-content', minWidth: '320px' }}>
      <BlockStack>
        <Box padding="300" background="bg-surface-secondary">
          <Text variant="headingMd" as="h2" fontWeight="medium">
            {title}
          </Text>
        </Box>

        <Box padding="300">
          <BlockStack gap="300">
            {!hasCredits && <AiCreditExhaustedBanner />}

            {!disabledMainText && (
              <TextField
                value={topic}
                onChange={handleTopicChange}
                placeholder={placeholderMainTextLabel || t('placeholder-topic')}
                autoComplete="off"
                label={mainTextLabel}
                maxLength={MAX_LENGTH_PROMPT[TONE_TYPE.TEXT]}
                showCharacterCount
                multiline
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              />
            )}

            {isOpenOptionSettings && (
              <Fragment>
                {value && (
                  <BlockStack gap="100">
                    <Text variant="bodyMd" as="span">
                      {t('current-content')}
                    </Text>
                    <TextField
                      value={value}
                      label={t('current-content')}
                      multiline
                      maxHeight={'50px'}
                      labelHidden
                      autoComplete="off"
                      disabled
                    />
                  </BlockStack>
                )}
                <TextField
                  value={instructions}
                  onChange={handleInstructionsChange}
                  placeholder={placeholderOptionalTextLabel || t('placeholder-instructions')}
                  autoComplete="off"
                  label={optionalTextLabel}
                  maxLength={100}
                  showCharacterCount
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                />
              </Fragment>
            )}

            <InlineStack gap="400" align="space-between" blockAlign="end">
              <PopoverToneSelector
                toneType="text"
                selectedTone={tone}
                defaultSelectedKey={TEXT_TONE_KEY.EXPERT}
                handleToneChange={handleToneChange}
              />
              <ButtonGroup>
                {showInstruction && (
                  <Tooltip content={t('special-instructions')}>
                    <Button
                      variant={isOpenOptionSettings ? 'plain' : 'secondary'}
                      disabled={disabledOptionSettings}
                      onClick={toggleOptionSettings}
                      icon={AdjustIcon}
                    />
                  </Tooltip>
                )}
                {!suggestions.length && (
                  <Button disabled={disabledGenerate} variant="primary" onClick={handleGenerate} loading={generating}>
                    {t('generate')}
                  </Button>
                )}
              </ButtonGroup>
            </InlineStack>

            {!!suggestions.length && (
              <BlockStack gap="200">
                <Scrollable shadow style={{ height: '200px' }}>
                  <div className={styles.OptionListWrapper}>
                    <OptionList
                      title={t('suggestions')}
                      onChange={setSelectedOption}
                      allowMultiple={allowMultipleOptions}
                      options={suggestions.map(suggestion => ({
                        value: suggestion,
                        // Content is already sanitized when received from API
                        label:
                          contentWrapper && typeof contentWrapper === 'function' ? (
                            contentWrapper(suggestion)
                          ) : (
                            // eslint-disable-next-line react/no-danger
                            <div dangerouslySetInnerHTML={{ __html: suggestion }} />
                          ),
                      }))}
                      selected={selectedOption}
                    />
                  </div>
                </Scrollable>
                <InlineStack gap="100" align="end">
                  <Button disabled={disabledGenerate} variant="secondary" onClick={handleGenerate} loading={generating}>
                    {t('re-generate')}
                  </Button>
                  <Button
                    variant="primary"
                    disabled={!selectedOption.length}
                    onClick={handleSelectOptionAfterGenerating}
                  >
                    {t('select')}
                  </Button>
                </InlineStack>
              </BlockStack>
            )}
          </BlockStack>
        </Box>
      </BlockStack>
    </div>
  )
}
