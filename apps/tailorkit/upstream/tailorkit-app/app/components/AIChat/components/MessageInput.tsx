import MagicTextField from '../../MagicTextField'
import styles from '../styles.module.css'
import { useTranslation } from 'react-i18next'
import { useChatBot } from '~/providers/ChatBotContext'
import { useCallback, useEffect, useRef, useState } from 'react'
import { type ISuggestion } from '../constants'
import { Box, InlineStack, Spinner, Tag, Text } from '@shopify/polaris'
import type { TemplateMentionData } from '~/hooks/useTemplateMention'
import type { FileAttachment } from '../fns'
import { withMentionCard, type WithMentionInjectedProps } from './MentionCard/withMentionCard'
import { useLocation } from '@remix-run/react'
import { isOnboardingRoute } from '~/utils/shopify'
import PlusMenuPopover from './PlusMenuPopover'
import SkillsList from './SkillsList'
import { SKILL_PREFIX, type SkillDefinition } from '../skills/definitions'

interface MessageInputProps extends WithMentionInjectedProps {
  handleKeyDown: (e: React.KeyboardEvent) => void
  renderSendButton: () => React.ReactNode
  onSuggestionClick: (suggestion: ISuggestion) => void
  baseSuggestion: ISuggestion | null
  showPopover?: boolean
  // Mention-enhanced props (from HOC)
  value: string
  onChange: (value: string) => void
  // Selected template chip props
  selectedTemplates?: TemplateMentionData[]
  onClearSelectedTemplate?: (cardId?: string) => void
  // Selected layer chip props
  selectedLayer?: { templateId: string; layerId: string; layerName: string; cardId: string } | null
  onClearSelectedLayer?: () => void
  // Image-attachment props
  attachedFiles?: FileAttachment[]
  onFilesPick?: (files: File[]) => void
  onRemoveFile?: (url: string) => void
  isUploadingFiles?: boolean
}

const FILE_ACCEPT = 'image/png,image/jpeg,image/webp'

// const POPOVER_AI_SUGGESTION_HEIGHT = 220
const SLOW_TYPING_THRESHOLD = 400 // Milliseconds between keystrokes
const SLOW_TYPING_THRESHOLD_COUNT = 3
const TYPING_COUNT_THRESHOLD = SLOW_TYPING_THRESHOLD_COUNT

function MessageInput(props: MessageInputProps) {
  const {
    handleKeyDown,
    renderSendButton,
    value,
    onChange,
    mentionButton,
    selectedTemplates,
    onClearSelectedTemplate,
    attachedFiles,
    onFilesPick,
    onRemoveFile,
    isUploadingFiles,
  } = props

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  /** Open native picker from the + menu's Files action */
  const handleFilesMenuClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length && onFilesPick) onFilesPick(Array.from(e.target.files))
      e.target.value = ''
    },
    [onFilesPick]
  )

  const { t } = useTranslation()
  const { suggestOptions } = useChatBot()

  const lastKeyPressTime = useRef<number | null>(null)
  const slowTypingCount = useRef(0)
  const typingCount = useRef(0)
  const submitTime = useRef<number | null>(null)

  // Skills menu state — shows when user types "/" at position 0
  const [showSkillsList, setShowSkillsList] = useState(false)
  const [skillFilter, setSkillFilter] = useState('')
  const skillsKeyDownRef = useRef<((e: React.KeyboardEvent) => void) | null>(null)

  /** Handle skill selection from SkillsList or PlusMenuPopover */
  const handleSkillSelect = useCallback(
    (skill: SkillDefinition) => {
      onChange(`${SKILL_PREFIX}${skill.command} `)
      setShowSkillsList(false)
      setSkillFilter('')
    },
    [onChange]
  )

  /** Open SkillsList from + menu */
  const handleSkillsMenuClick = useCallback(() => {
    onChange(SKILL_PREFIX)
    setShowSkillsList(true)
    setSkillFilter('')
  }, [onChange])

  /** Open MentionCard from + menu (trigger existing @ mention flow) */
  const handleMentionMenuClick = useCallback(() => {
    // Trigger the existing mention system by simulating @ input
    onChange(`${value}@`)
  }, [onChange, value])

  // const getSuggestFeature = useCallback((_suggestionId: string) => {
  //   const suggestionFeature = SUGGESTIONS.find(suggestion => suggestion.id === _suggestionId)
  //   return suggestionFeature
  // }, [])

  // const suggestions = useMemo(() => {
  //   if (!suggestOptions?.options) return []

  //   return suggestOptions.options.map(option => {
  //     const suggestionFeature = getSuggestFeature(option)

  //     return {
  //       id: option,
  //       label: suggestionFeature ? t(suggestionFeature.label) : option,
  //       content: suggestionFeature ? suggestionFeature.content : option,
  //     }
  //   })
  // }, [getSuggestFeature, suggestOptions.options, t])

  /**
   * Handles the input change event
   * @param value - The input value
   */
  const onInputChangeHandler = useCallback(
    (newValue: string) => {
      onChange(newValue)

      // Detect "/" at position 0 for skills menu.
      // Only show when typing the command (no space yet = still selecting skill).
      // Once there's a space, user is typing the full message — hide skills list.
      if (newValue.startsWith(SKILL_PREFIX) && !newValue.includes(' ')) {
        const filterText = newValue.slice(1)
        setSkillFilter(filterText)
        setShowSkillsList(true)
      } else {
        if (showSkillsList) {
          setShowSkillsList(false)
          setSkillFilter('')
        }
      }

      const now = Date.now()
      typingCount.current++

      // If the user has already typed more than 2 times, we should not show the suggestions
      if (typingCount.current > TYPING_COUNT_THRESHOLD * 2) {
        return
      }

      if (lastKeyPressTime.current !== null) {
        const timeBetweenKeystrokes = now - lastKeyPressTime.current

        if (timeBetweenKeystrokes > SLOW_TYPING_THRESHOLD) {
          // Only increment slow typing count if user is typing slowly and the typing count is less than the threshold
          if (value.length <= SLOW_TYPING_THRESHOLD_COUNT && typingCount.current < TYPING_COUNT_THRESHOLD) {
            slowTypingCount.current++
          }
        } else {
          slowTypingCount.current = 0 // Reset if user starts typing faster
        }
      }
      lastKeyPressTime.current = now

      if (slowTypingCount.current >= SLOW_TYPING_THRESHOLD_COUNT) {
        // Only show popover if user types slowly multiple times
        // setPopoverActive(true)
      } else {
        // setPopoverActive(false)
      }
    },
    [onChange, value.length, showSkillsList]
  )

  const onKeyDownHandler = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        // Close skills list on submit
        setShowSkillsList(false)
        setSkillFilter('')

        // Reset slow typing count if user hits Enter
        slowTypingCount.current = 0

        // Reset typing count if user hits Enter
        typingCount.current = 0

        // Mark the time when user hits Enter
        submitTime.current = Date.now()
      }

      // Delegate arrow/enter/escape to SkillsList when open (prevents message submit)
      if (showSkillsList && skillsKeyDownRef.current) {
        const skillsKeys = ['ArrowDown', 'ArrowUp', 'Enter', 'Escape']
        if (skillsKeys.includes(e.key)) {
          skillsKeyDownRef.current(e)
          return
        }
      }

      handleKeyDown(e)
    },
    [handleKeyDown, showSkillsList]
  )

  /**
   * Handles the suggestion click event
   * @param suggestion - The suggestion to be clicked
   */
  // const onSuggestionClickHandler = useCallback(
  //   (suggestion: ISuggestion) => {
  //     const suggestFeature = getSuggestFeature(suggestion.id)
  //     const _suggestion = suggestFeature || (baseSuggestion && { ...suggestion, id: baseSuggestion.id })

  //     if (_suggestion) {
  //       onSuggestionClick(_suggestion)
  //       setPopoverActive(false)
  //     }
  //   },
  //   [getSuggestFeature, baseSuggestion, onSuggestionClick]
  // )

  const actionsField = (
    <Box paddingInline={'200'}>
      <InlineStack align="space-between">
        <InlineStack gap={'200'}>
          <PlusMenuPopover
            onSkillsClick={handleSkillsMenuClick}
            onMentionClick={handleMentionMenuClick}
            onFilesClick={onFilesPick ? handleFilesMenuClick : undefined}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept={FILE_ACCEPT}
            multiple
            style={{ display: 'none' }}
            onChange={handleFileInputChange}
          />
          {mentionButton}
        </InlineStack>
        {renderSendButton()}
      </InlineStack>
    </Box>
  )

  const inputField = (
    <div onKeyDown={onKeyDownHandler} onClick={() => {} /*setPopoverActive(false)*/}>
      <MagicTextField
        ariaLabel={t('elva-ai-assistant-input')}
        placeholder={t('enter-a-prompt-for-elva')}
        autoFocus
        rows={1}
        value={value}
        onChange={onInputChangeHandler}
        actionsField={actionsField}
        headerContent={(() => {
          const hasTemplates = Boolean(selectedTemplates?.length)
          const hasLayer = Boolean(props.selectedLayer)
          const hasFiles = Boolean(attachedFiles?.length)
          if (!hasTemplates && !hasLayer && !hasFiles && !isUploadingFiles) return undefined
          return (
            <>
              {selectedTemplates?.map(t => (
                <Tag key={t.cardId} onRemove={() => onClearSelectedTemplate?.(t.cardId)}>
                  {t.name}
                </Tag>
              ))}
              {props.selectedLayer ? (
                <Tag
                  key={`${props.selectedLayer.cardId}:${props.selectedLayer.layerId}`}
                  onRemove={props.onClearSelectedLayer}
                >
                  {props.selectedLayer.layerName}
                </Tag>
              ) : null}
              {attachedFiles?.map(f => (
                <Tag key={f.url} onRemove={() => onRemoveFile?.(f.url)}>
                  {`📎 ${f.name}`}
                </Tag>
              ))}
              {isUploadingFiles ? (
                <Box
                  key="__uploading__"
                  paddingBlock="100"
                  paddingInline="200"
                  background="bg-surface-secondary"
                  borderRadius="100"
                >
                  <InlineStack gap="150" blockAlign="center">
                    <Spinner size="small" accessibilityLabel={t('uploading')} />
                    <Text as="span" variant="bodySm" tone="subdued">
                      {t('uploading-image')}
                    </Text>
                  </InlineStack>
                </Box>
              ) : null}
            </>
          )
        })()}
      />
    </div>
  )

  useEffect(() => {
    const isSlowTyping = slowTypingCount.current >= SLOW_TYPING_THRESHOLD_COUNT || slowTypingCount.current === 0
    const isTypingCountLow = typingCount.current <= TYPING_COUNT_THRESHOLD || typingCount.current === 0

    if (isSlowTyping && isTypingCountLow) {
      // If the user has already submitted the message in the last 2 seconds, we should not show the suggestions
      if (submitTime.current && Date.now() - submitTime.current < 2_000) {
        // Reset the submit time
        submitTime.current = null

        return
      }

      // setPopoverActive(Boolean(suggestOptions?.options?.length))
    }
  }, [suggestOptions?.options])

  return (
    <div className={styles.ChatBoxFooterTextField}>
      {showSkillsList && (
        <Box paddingBlockEnd="100">
          <SkillsList
            filter={skillFilter}
            onSelect={handleSkillSelect}
            onClose={() => {
              setShowSkillsList(false)
              setSkillFilter('')
            }}
            onKeyDown={handler => {
              skillsKeyDownRef.current = handler
            }}
          />
        </Box>
      )}
      {inputField}
    </div>
  )
}

// Create mention-enhanced version of MessageInput (module-scoped to avoid remounts)
const EnhancedMessageInput = withMentionCard<MessageInputProps>(MessageInput, {
  triggers: ['@'],
  position: 'relative',
  zIndex: 1000,
  // Temporarily hide the mention button in the chat input
  showMentionButton: false,
  defaultAllowMultiple: false,
  mode: 'templates',
  hidden: typeof window !== 'undefined' && window.location.href.includes('onboarding'),
})

const EnhancedMessageInputExport = (props: MessageInputProps) => {
  const location = useLocation()
  const isOnboarding = isOnboardingRoute(location.search)

  return <EnhancedMessageInput {...props} mentionOptions={{ hidden: isOnboarding }} />
}

export default EnhancedMessageInputExport
