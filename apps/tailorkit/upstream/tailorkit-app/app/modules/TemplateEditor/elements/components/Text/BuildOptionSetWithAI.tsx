import { Icon, InlineStack, Text, Popover, Card } from '@shopify/polaris'
import { MagicIcon } from '@shopify/polaris-icons'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PopoverAIContentGenerator from '~/components/AITextField/PopoverAIContentGenerator'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '~/modules/TemplateEditor/constants'

interface BuildTextOptionSetWithAIProps {
  disabled?: boolean
  maxContentLength?: number
  metadata?: Record<string, any>
  onSelectOptionAfterGenerating: (options: string[]) => void
}

export default function BuildTextOptionSetWithAI(props: BuildTextOptionSetWithAIProps) {
  const { disabled, onSelectOptionAfterGenerating, maxContentLength, metadata } = props
  const { t } = useTranslation()

  const [popoverActive, setPopoverActive] = useState(false)

  const togglePopoverActive = useCallback(() => {
    if (disabled) return

    setPopoverActive(popoverActive => !popoverActive)
  }, [disabled])

  const activator = (
    <Card padding="0">
      <button
        className={`Polaris-Button Polaris-Button--fullWidth Polaris-Button--textAlignCenter ${disabled ? 'Polaris-Button--disabled' : ''}`}
        style={{
          padding: '8px',
          backgroundColor: disabled ? 'var(--p-color-bg-fill-disabled)' : 'var(--p-color-bg-surface-success)',
        }}
        onClick={togglePopoverActive}
      >
        <InlineStack align="center" blockAlign="center" gap={'050'}>
          <Icon source={MagicIcon} tone="success" />
          <Text variant="bodyMd" as="span" tone={disabled ? 'subdued' : 'success'} fontWeight="medium">
            {t('generate-ai-options')}
          </Text>
        </InlineStack>
      </button>
    </Card>
  )

  useEffect(() => {
    if (popoverActive) {
      Transmitter.listen(
        TEMPLATE_EDITOR_TRANSMISSION_EVENTS.TOGGLE_POPOVER_AI_CONTENT_GENERATOR_ACTIVE,
        togglePopoverActive
      )
    }

    return () => {
      Transmitter.remove(
        TEMPLATE_EDITOR_TRANSMISSION_EVENTS.TOGGLE_POPOVER_AI_CONTENT_GENERATOR_ACTIVE,
        togglePopoverActive
      )
    }
  }, [popoverActive, togglePopoverActive])

  return (
    <Popover
      active={popoverActive}
      activator={activator}
      autofocusTarget="first-node"
      preferredPosition="above"
      onClose={togglePopoverActive}
      zIndexOverride={1000}
    >
      <PopoverAIContentGenerator
        title={t('generate-ai-options')}
        mainTextLabel={t('which-content-are-these-options-for')}
        placeholderMainTextLabel={t('placeholder-option-set-suggestion')}
        optionalTextLabel={t('special-instructions-optional')}
        placeholderOptionalTextLabel={t('placeholder-option-set-special-instructions-optional')}
        allowMultipleOptions
        metadata={metadata}
        maxContentLength={maxContentLength}
        model="gpt-4o-mini"
        promptPrefix={t('generate-options-about-prefix')}
        onSelectOptionAfterGenerating={onSelectOptionAfterGenerating}
      />
    </Popover>
  )
}
