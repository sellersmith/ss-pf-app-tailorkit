import { BlockStack, Box, Button, Icon, InlineStack, Text } from '@shopify/polaris'
import { EyeCheckMarkIcon, LayoutBuyButtonVerticalIcon, StoreManagedIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { useCallback, useMemo } from 'react'
import { useLiveChat } from '~/utils/hooks/useLiveChat'
import { useStore } from '~/libs/external-store'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { useIsUnifiedEditor } from '~/hooks/useIsUnifiedEditor'

/**
 * Review criterion for design guidelines
 */
interface ReviewCriterion {
  icon: any
  title: string
  description: string
}

/**
 * ReadyToPublishPanel
 *
 * Displays design review guidelines and provides access to TailorKit expert support.
 * Shows three key criteria: Clarity, Balance, and Overall Appeal.
 * Opens Crisp chat with pre-filled message when user requests expert help.
 */
export default function ReadyToPublishPanel() {
  const { t } = useTranslation()
  const { openChatBotAndSendUserMessage } = useLiveChat()

  const isUnifiedEditor = useIsUnifiedEditor()

  // For unified editor: get product title from integration store
  const productTitle = useStore(IntegrationStore, state => {
    if (!isUnifiedEditor) return ''

    // Get first variant from integration
    const variants = state.variants || []
    if (variants.length > 0 && variants[0].product?.title) {
      return variants[0].product.title
    }

    return ''
  })

  const reviewCriteria: ReviewCriterion[] = useMemo(
    () => [
      {
        icon: EyeCheckMarkIcon,
        title: t('clarity'),
        description: t('make-sure-text-and-images-are-easy-to-see-and-understand'),
      },
      {
        icon: LayoutBuyButtonVerticalIcon,
        title: t('balance'),
        description: t('check-that-the-design-feels-well-placed-and-not-overcrowded'),
      },
      {
        icon: StoreManagedIcon,
        title: t('overall-appeal'),
        description: t('ensure-the-product-looks-clean-polished-and-gift-ready'),
      },
    ],
    [t]
  )

  const handleAskExpert = useCallback(() => {
    const message = t('i-want-to-get-expert-feedback-on-my-design-for-product-producttitle', {
      productTitle,
    })
    openChatBotAndSendUserMessage(message)
    // Panel stays open - user explicitly requested this
  }, [openChatBotAndSendUserMessage, productTitle, t])

  return (
    <Box padding="300" paddingBlockStart={'200'}>
      <BlockStack gap="300">
        {/* Introduction text */}
        <Text as="p" variant="bodyMd">
          {t(
            'reviewing-your-design-carefully-before-publishing-helps-ensure-it-looks-clear-polished-and-ready-for-buyers'
          )}
        </Text>

        {/* Review criteria */}
        <BlockStack gap="300">
          {reviewCriteria.map((criterion, index) => (
            <InlineStack key={index} gap="100" blockAlign="start" wrap={false}>
              <Box>
                <Icon source={criterion.icon} tone="base" />
              </Box>
              <BlockStack gap="100">
                <Text as="h3" variant="bodyMd" fontWeight="semibold">
                  {criterion.title}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {criterion.description}
                </Text>
              </BlockStack>
            </InlineStack>
          ))}
        </BlockStack>

        {/* Support section */}
        <BlockStack gap="200">
          <Text as="p" variant="bodyMd">
            {t('if-you-need-detailed-feedback-while-reviewing-click-button-below-for-extra-support')}
          </Text>
          <Button variant="primary" onClick={handleAskExpert} fullWidth>
            {t('ask-tailorkit-expert')}
          </Button>
        </BlockStack>
      </BlockStack>
    </Box>
  )
}
