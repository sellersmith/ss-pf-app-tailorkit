import { BlockStack, Box, Card, Icon, InlineStack, Popover, Text } from '@shopify/polaris'
import { MagicIcon } from '@shopify/polaris-icons'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PopoverAIImageGenerator } from '~/components/AITextField/PopoverAIImageGenerator'
import { useAiCreditsStatus } from '~/hooks/useAiCreditsStatus'
import type { GenerativeOptions } from '~/modules/TemplateEditor/components/Editor/utils/elementCreators'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '~/modules/TemplateEditor/constants'
import type { IImageQuery } from '~/types/shopify-files'

interface BuildOptionSetImageWithAIProps {
  disabled?: boolean
  generativeOptions?: GenerativeOptions
  onSelectImages: (mediaFiles: IImageQuery[]) => void
}

export default function BuildOptionSetImageWithAI(props: BuildOptionSetImageWithAIProps) {
  const { disabled, onSelectImages, generativeOptions } = props
  const { t } = useTranslation()
  const { hasCredits } = useAiCreditsStatus()

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
          <Box>
            <Icon source={MagicIcon} tone="success" />
          </Box>
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
      preventCloseOnChildOverlayClick
      preferredPosition="above"
      zIndexOverride={998}
      fullHeight
      fluidContent
      onClose={togglePopoverActive}
    >
      <Popover.Pane>
        <BlockStack>
          <PopoverAIImageGenerator
            title={t('generate-ai-options')}
            forceUseAIEffects={true}
            mainTextLabel={t('prompt-your-image-with-ai')}
            placeholderMainTextLabel={t('hint-prompt-your-image-with-ai')}
            layout="popover"
            disabledGenerate={!hasCredits}
            onSelectImages={onSelectImages}
            generativeOptions={generativeOptions}
          />
        </BlockStack>
      </Popover.Pane>
    </Popover>
  )
}
