import { BlockStack, Box, ChoiceList, Icon, InlineStack, Modal, Text } from '@shopify/polaris'
import { useModal } from '~/utils/hooks/useModal'
import { MODAL_ID } from '~/constants/modal'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { LightbulbIcon } from '@shopify/polaris-icons'
import { useLiveChat } from '~/utils/hooks/useLiveChat'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'

export default function ModalAskWhyOnlySaveNotPublish() {
  const { t } = useTranslation()
  const { state, closeModal } = useModal()
  const { openChatBotAndSendUserMessage } = useLiveChat()
  const { trackEvent } = useEventsTracking()

  const modalAskWhyOnlySaveNotPublishActive = state[MODAL_ID.ASK_WHY_ONLY_SAVE_NOT_PUBLISH_MODAL]?.active
  const [selectedOption, setSelectedOption] = useState<string[]>([])
  const options = [
    { value: 'option-1', label: t('i-m-not-sure-how-to-publish-it-can-you-guide-me') },
    { value: 'option-2', label: t('can-you-explain-how-publishing-this-product-will-affect-my-store') },
    { value: 'option-3', label: t('my-designs-aren-t-ready-to-publish-can-you-help-me-improve-them') },
    { value: 'option-4', label: t('i-don-t-have-good-mockups-yet-can-you-help-me-create-better-ones') },
    { value: 'option-5', label: t('i-m-having-an-issue-when-publishing-can-you-help-me-fix-it') },
  ]

  const handleChange = (value: string[]) => {
    setSelectedOption(value || [])
  }

  const handleContactSupport = () => {
    closeModal(MODAL_ID.ASK_WHY_ONLY_SAVE_NOT_PUBLISH_MODAL)
    const userMessage = selectedOption[0] ? options.find(option => option.value === selectedOption[0])?.label : ''

    if (userMessage) {
      openChatBotAndSendUserMessage(userMessage)
    }
  }

  const handleCloseModal = () => {
    closeModal(MODAL_ID.ASK_WHY_ONLY_SAVE_NOT_PUBLISH_MODAL)
    trackEvent(EVENTS_TRACKING.USER_ONLY_TEST)
  }

  return (
    <Modal
      open={modalAskWhyOnlySaveNotPublishActive}
      onClose={() => closeModal(MODAL_ID.ASK_WHY_ONLY_SAVE_NOT_PUBLISH_MODAL)}
      title={t('why-haven-t-you-published-your-product-yet')}
      secondaryActions={[
        {
          content: t('i-m-testing'),
          onAction: handleCloseModal,
        },
      ]}
      primaryAction={{
        disabled: !selectedOption.length,
        content: t('contact-support'),
        onAction: handleContactSupport,
      }}
    >
      <Modal.Section>
        <BlockStack gap="200">
          <ChoiceList
            title={t('tell-us-what-s-holding-you-back-we-re-here-to-help')}
            choices={options}
            selected={selectedOption}
            onChange={handleChange}
          />
          <InlineStack gap="200" align="start" wrap={false}>
            <Box>
              <Icon source={LightbulbIcon} tone="subdued" />
            </Box>
            <Text as="p" variant="bodyMd" tone="subdued">
              {t('publish-more-products-to-boost-revenue-and-unlock-exclusive-sales-tips-discounts-and-templates')}
            </Text>
          </InlineStack>
        </BlockStack>
      </Modal.Section>
    </Modal>
  )
}
