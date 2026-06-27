import { Icon, InlineStack, Text, Tooltip, useBreakpoints } from '@shopify/polaris'
import { InfoIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { PopoverAIImageGenerator } from '~/components/AITextField/PopoverAIImageGenerator'
import { useElementActions } from '~/modules/TemplateEditor/components/Editor/hooks/useElementActions'
import type { IImageQuery } from '~/types/shopify-files'

interface AIImageInspectorPanelProps {
  // No element-specific requirements to generate images
}

export function AIImageInspectorPanel(_: AIImageInspectorPanelProps) {
  const { t } = useTranslation()
  const { mdDown } = useBreakpoints()
  const { handleSelectAIImages } = useElementActions()

  return (
    <PopoverAIImageGenerator
      contentHeight={`calc(100vh - ${mdDown ? 97 : 142}px)`}
      mainTextLabel={
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
      }
      placeholderMainTextLabel={t('type-your-idea-or-click-a-quick-prompt-below-to-save-time')}
      onSelectImages={handleSelectAIImages as unknown as (files: IImageQuery[], options?: any) => void}
    />
  )
}
