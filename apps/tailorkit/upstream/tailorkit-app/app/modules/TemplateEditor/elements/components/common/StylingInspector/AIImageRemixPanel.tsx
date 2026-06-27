import { BlockStack, Icon, InlineStack, Text, Tooltip } from '@shopify/polaris'
import { InfoIcon } from '@shopify/polaris-icons'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReferenceImage } from '~/components/AITextField/AIImageGenerator/types'
import { PopoverAIImageGenerator } from '~/components/AITextField/PopoverAIImageGenerator'
import { useAiCreditsStatus } from '~/hooks/useAiCreditsStatus'
import { useElementActions } from '~/modules/TemplateEditor/components/Editor/hooks/useElementActions'
import type { GenerativeOptions } from '~/modules/TemplateEditor/components/Editor/utils/elementCreators'
import type { IImageQuery } from '~/types/shopify-files'

interface AIImageRemixPanelProps {
  imageUrl?: string
}

export function AIImageRemixPanel({ imageUrl }: AIImageRemixPanelProps) {
  const { t } = useTranslation()
  const { handleSelectAIImages } = useElementActions()
  const { hasCredits } = useAiCreditsStatus()

  // Pre-populate reference image with the current selected image
  const initialReferenceImages = useMemo<ReferenceImage[]>(() => {
    if (!imageUrl) return []
    return [
      {
        name: 'current-image.png',
        size: 0,
        type: 'image/png',
        url: imageUrl,
      },
    ]
  }, [imageUrl])

  const onSelectImages = useCallback(
    (mediaFiles: IImageQuery[], generativeOptions?: GenerativeOptions) => {
      handleSelectAIImages(mediaFiles, generativeOptions, { autoSelect: false })
    },
    [handleSelectAIImages]
  )

  return (
    <BlockStack gap="200">
      <PopoverAIImageGenerator
        mainTextLabel={
          <InlineStack gap={'050'} wrap={false} blockAlign="center">
            <Text variant="bodyMd" as="p" fontWeight="semibold">
              {t('description')}
            </Text>
            <Tooltip
              content={t(
                'describe-what-changes-you-want-to-make-to-this-image-be-specific-about-style-colors-or-modifications'
              )}
            >
              <Icon source={InfoIcon} tone="subdued" />
            </Tooltip>
          </InlineStack>
        }
        placeholderMainTextLabel={t('describe-how-to-remix-this-image')}
        allowCustomerToUseReferenceImage={true}
        initialReferenceImages={initialReferenceImages}
        forceUseAIEffects={true}
        aiEffectsLayout="categorized"
        disabledGenerate={!hasCredits}
        onSelectImages={onSelectImages}
      />
    </BlockStack>
  )
}
