import { BlockStack, Box, Icon, InlineStack, Text, Tooltip } from '@shopify/polaris'
import { InfoIcon } from '@shopify/polaris-icons'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { PopoverAIImageGenerator } from '~/components/AITextField/PopoverAIImageGenerator'
import { useAiCreditsStatus } from '~/hooks/useAiCreditsStatus'
import { useElementActions } from '~/modules/TemplateEditor/components/Editor/hooks/useElementActions'
import type { IImageQuery } from '~/types/shopify-files'
import { TemplateEditorStore } from '~/stores/modules/template'
import { consumePendingImagePostAddActions } from './stores/pending-image-actions-store'
import { applyImagePostAddActions } from './utils/apply-image-post-add-actions'
import { ToolPanelWrapper } from '../components/ToolPanelWrapper'

interface IAIImageToolPanelProps {}

/**
 * AI Image Tool Panel - Integrated AI image generation in the sidebar.
 * After image generation, consumes any pending post-add actions from
 * Elements panel presets (e.g. "AI effects for sellers").
 */
export default function AIImageToolPanel(_props: IAIImageToolPanelProps) {
  const { t } = useTranslation()
  const { handleSelectAIImages } = useElementActions()
  const { hasCredits } = useAiCreditsStatus()

  // Wrap handleSelectAIImages to consume and apply pending post-add actions
  const handleSelectAIImagesWithActions = useCallback(
    (files: IImageQuery[], options?: any) => {
      handleSelectAIImages(files, options)

      const pendingActions = consumePendingImagePostAddActions()
      if (!pendingActions) return

      // Get the newly created layer store directly (prepended at index 0)
      const newLayerStore = TemplateEditorStore.getState().extractedLayerStores[0]
      const firstImage = files[0]
      applyImagePostAddActions(
        pendingActions,
        newLayerStore,
        firstImage?.image?.width && firstImage?.image?.height
          ? { width: firstImage.image.width, height: firstImage.image.height }
          : undefined
      )
    },
    [handleSelectAIImages]
  )

  return (
    <ToolPanelWrapper>
      <Box paddingInline="300">
        <BlockStack gap="200">
          <PopoverAIImageGenerator
            noScroll
            aiEffectsLayout="categorized"
            showAIEffectsSearch={true}
            forceUseAIEffects={true}
            disabledGenerate={!hasCredits}
            mainTextLabel={
              <Box paddingBlockStart={'200'}>
                <InlineStack gap={'050'} wrap={false} blockAlign="center">
                  <Text variant="bodyMd" as="p" fontWeight="semibold">
                    {t('description')}
                  </Text>
                  <Tooltip
                    content={t(
                      'if-using-a-reference-image-describe-only-what-to-change-or-add-be-specific-and-use-no-extra-objects-to-avoid-unwanted-details'
                    )}
                  >
                    <Icon source={InfoIcon} tone="subdued" />
                  </Tooltip>
                </InlineStack>
              </Box>
            }
            placeholderMainTextLabel={t('type-your-idea-or-click-a-quick-prompt-below-to-save-time')}
            showRatioSelector={true}
            onSelectImages={handleSelectAIImagesWithActions as unknown as (files: IImageQuery[], options?: any) => void}
          />
        </BlockStack>
      </Box>
    </ToolPanelWrapper>
  )
}
