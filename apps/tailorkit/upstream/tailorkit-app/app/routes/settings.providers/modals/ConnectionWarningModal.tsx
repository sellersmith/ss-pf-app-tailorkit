import { Modal, List, Text, BlockStack } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import withModalConditionalRendering from '~/bootstrap/hoc/withModalConditionalRendering'
import GetHelpMessage from '~/components/GetHelpMessage'

interface IConnectionWarningModalProps {
  active: boolean
  onClose: () => void
  onReviewConnection: () => void
}

/**
 * Modal component that displays a connection warning when the API token is deleted by the provider
 */
const ConnectionWarningModal = ({ active, onClose, onReviewConnection }: IConnectionWarningModalProps) => {
  const { t } = useTranslation()

  return (
    <Modal
      open={active}
      onClose={onClose}
      title={t('trouble-connecting')}
      primaryAction={{
        content: t('review-connection'),
        onAction: onReviewConnection,
      }}
      secondaryActions={[
        {
          content: t('cancel'),
          onAction: onClose,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="200">
          <Text as="p">{t('please-check-your-connection-details-and-try-again')}</Text>

          <List type="bullet">
            <List.Item>{t('api-token-is-entered-correctly')}</List.Item>
            <List.Item>{t('store-is-connected')}</List.Item>
            <List.Item>{t('internet-connection-is-stable')}</List.Item>
          </List>

          <GetHelpMessage
            t={t}
            showDivider={false}
            paddingBlock="0"
            paddingInline="0"
            onOpenChatBoxCallback={onClose}
          />
        </BlockStack>
      </Modal.Section>
    </Modal>
  )
}

export default withModalConditionalRendering(ConnectionWarningModal)
