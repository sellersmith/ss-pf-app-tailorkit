import { BlockStack, Box, Button, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { useCallback, useState } from 'react'
import { ELayerType } from '~/types/psd'
import AITextField from '~/components/AITextField'
import { MAXIMUM_CHARACTER_UTF_16_COUNT } from '~/constants/text-field'
import PopoverAIContentGenerator from '~/components/AITextField/PopoverAIContentGenerator'
import { Transmitter } from '~/shared/extensions/tailorkit-src/src/assets/libraries/transmitter'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '~/modules/TemplateEditor/constants'
import { DEFAULT_TEXT_CONTENT } from '~/constants/inspector/text'
import { PlusIcon } from '@shopify/polaris-icons'
import { useElementActions } from '../../../Editor/hooks/useElementActions'
import BestForYouCliparts from './components/BestForYouCliparts'
import ClipartList from './components/ClipartList'
import { ClickContext } from '~/models/ClipartClickEvent'

interface ITextToolPanelProps {}

// Stable categories to avoid re-renders of ClipartList while typing
const FONT_COMBINATION_CATEGORIES: string[] = ['Font combinations']

/**
 * Text Tool Panel - Add text elements to the template
 */
export default function TextToolPanel(props: ITextToolPanelProps) {
  const { addElements } = useElementActions()
  const { t } = useTranslation()
  const [textContent, setTextContent] = useState(DEFAULT_TEXT_CONTENT)

  const togglePopoverActive = useCallback(() => {
    Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.TOGGLE_POPOVER_AI_CONTENT_GENERATOR_ACTIVE)
  }, [])

  const onSelectOptionAfterGenerating = useCallback(
    (options: string[]) => {
      setTextContent(options[0])
      togglePopoverActive()
    },
    [togglePopoverActive]
  )

  const handleAddText = useCallback(() => {
    addElements(ELayerType.TEXT, null, undefined, { content: textContent } as any)
  }, [addElements, textContent])

  return (
    <BlockStack gap="400">
      {/* Content Section */}
      <Box padding="400">
        <BlockStack gap="300">
          <AITextField
            id="text-add-content__text-field"
            maxLength={MAXIMUM_CHARACTER_UTF_16_COUNT}
            autoComplete="off"
            showCharacterCount
            value={textContent}
            label={t('create-your-content')}
            labelHidden
            placeholder={t('input-your-content')}
            type="text"
            multiline
            maxHeight="100px"
            popoverContent={
              <PopoverAIContentGenerator
                title={t('generate-content')}
                value={textContent}
                mainTextLabel={t('what-is-this-text-about')}
                optionalTextLabel={t('special-instructions-optional')}
                maxContentLength={MAXIMUM_CHARACTER_UTF_16_COUNT}
                onSelectOptionAfterGenerating={onSelectOptionAfterGenerating}
                onTogglePopoverActive={togglePopoverActive}
              />
            }
            onBlur={e => setTextContent((e?.target as HTMLInputElement)?.value)}
            onChange={setTextContent}
          />
          <Button onClick={handleAddText} icon={PlusIcon} variant="primary" fullWidth>
            {t('add-text')}
          </Button>
          {/* Best for you - AI suggested font combinations based on product */}
          <BlockStack gap="200">
            <BestForYouCliparts />
          </BlockStack>
          <BlockStack gap="200">
            <Text as="h4" variant="headingSm">
              {t('font-combination')}
            </Text>
            <ClipartList
              trackingContext={ClickContext.EDITOR_TEXT_PANEL_FONTS_COMBINED}
              categories={FONT_COMBINATION_CATEGORIES}
              columns={2}
              gapPx={8}
              showTitle={false}
              showTitleOnHover={true}
              lazy={true}
              emptyStateMessage={t('no-font-combinations-found')}
            />
          </BlockStack>
        </BlockStack>
      </Box>
    </BlockStack>
  )
}
