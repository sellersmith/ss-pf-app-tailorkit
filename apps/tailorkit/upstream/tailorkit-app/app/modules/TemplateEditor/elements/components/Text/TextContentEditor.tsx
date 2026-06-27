import { useCallback, useEffect, useState } from 'react'
import { BlockStack, Box } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import AITextField from '~/components/AITextField'
import PopoverAIContentGenerator from '~/components/AITextField/PopoverAIContentGenerator'
import Switch from '~/components/common/Switch'
import { MAXIMUM_CHARACTER_UTF_16_COUNT } from '~/constants/text-field'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '~/modules/TemplateEditor/constants'
import { applyStyleCase } from 'extensions/tailorkit-src/src/assets/utils/render-text-layer-to-data-source'
import { useDebouncedCallback } from '~/utils/hooks/useDebouncedCallback'

interface TextContentEditorProps {
  content: string
  styleCase?: string
  autoFitToContainer: boolean
  onContentChange: (value: string) => void
  onAutoFitChange: () => void
  onStretchBoxToFit: () => void
  renderTextEffects?: () => React.ReactNode
}

export function TextContentEditor(props: TextContentEditorProps) {
  const {
    content,
    styleCase,
    autoFitToContainer,
    onContentChange,
    onAutoFitChange,
    onStretchBoxToFit,
    renderTextEffects,
  } = props

  const { t } = useTranslation()

  // Local state for immediate input updates
  const [localContent, setLocalContent] = useState(content)

  // Sync local state when external content changes (e.g., from AI generation)
  useEffect(() => {
    setLocalContent(content)
  }, [content])

  // Debounced callback for expensive state update
  const debouncedContentChange = useDebouncedCallback((value: string) => {
    onContentChange(value)
  }, 200)

  const handleChange = useCallback(
    (value: string) => {
      // Apply style case transformation
      const transformedValue = applyStyleCase(value, styleCase)

      // Update local state immediately for responsive input
      setLocalContent(transformedValue)

      // Debounce the expensive parent state update
      debouncedContentChange(transformedValue)
    },
    [styleCase, debouncedContentChange]
  )

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const value = e?.target?.value || ''
      const transformedValue = applyStyleCase(value, styleCase)

      // Ensure final value is saved on blur
      onContentChange(transformedValue)
    },
    [styleCase, onContentChange]
  )

  const togglePopoverActive = useCallback(() => {
    Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.TOGGLE_POPOVER_AI_CONTENT_GENERATOR_ACTIVE)
  }, [])

  const onSelectOptionAfterGenerating = useCallback(
    (options: string[]) => {
      const value = options[0]
      setLocalContent(value)
      onContentChange(value)

      // Stretch box to fit after AI generation
      setTimeout(() => {
        onStretchBoxToFit()
      }, 0)
    },
    [onContentChange, onStretchBoxToFit]
  )

  return (
    <BlockStack gap="200">
      <Box paddingInlineEnd="200">
        <AITextField
          id="text-content__text-field"
          maxLength={MAXIMUM_CHARACTER_UTF_16_COUNT}
          autoComplete="off"
          showCharacterCount
          value={localContent}
          label={t('create-your-content')}
          labelHidden
          placeholder={t('input-your-content')}
          type="text"
          multiline
          maxHeight="100px"
          popoverContent={
            <PopoverAIContentGenerator
              title={t('generate-content')}
              value={localContent}
              mainTextLabel={t('what-is-this-text-about')}
              optionalTextLabel={t('special-instructions-optional')}
              maxContentLength={MAXIMUM_CHARACTER_UTF_16_COUNT}
              onSelectOptionAfterGenerating={onSelectOptionAfterGenerating}
              onTogglePopoverActive={togglePopoverActive}
            />
          }
          onBlur={handleBlur}
          onChange={handleChange}
        />
      </Box>

      <Box paddingInlineEnd="200">
        <Switch
          accessibilityLabel={t('auto-fit-text-to-container')}
          label={t('auto-fit-text-to-container')}
          checked={autoFitToContainer}
          onInput={onAutoFitChange}
        />
      </Box>
      {renderTextEffects?.()}
    </BlockStack>
  )
}
