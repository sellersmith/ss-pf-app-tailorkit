import { Text, InlineStack, OptionList, Scrollable, Spinner, Box, BlockStack, Icon } from '@shopify/polaris'
import { SearchIcon } from '@shopify/polaris-icons'
import type { OptionDescriptor } from '@shopify/polaris/build/ts/src/types'
import { useTranslation } from 'react-i18next'
import { type IConversationInput } from '~/routes/api.ai-assistant/constants'

interface ScrollableConversationHistoryProps {
  conversations: OptionDescriptor[]
  currentConversation: IConversationInput
  loadConversationById: (id: string) => Promise<void>
  fetchingNextPage: boolean
  loading: boolean
  handleScrollToBottom: () => void
}

const ScrollableConversationHistory = (props: ScrollableConversationHistoryProps) => {
  const { conversations, currentConversation, loadConversationById, fetchingNextPage, loading, handleScrollToBottom }
    = props
  const { t } = useTranslation()

  if (conversations.length === 0) {
    return (
      <Box padding="200">
        <BlockStack gap="200" align="center" inlineAlign="center">
          <Icon source={SearchIcon} />

          <Text variant="headingMd" as="h6">
            {t('no-conversation-found')}
          </Text>

          <Text variant="bodyMd" as="p">
            {t('try-changing-the-search-term')}
          </Text>
        </BlockStack>
      </Box>
    )
  }

  return (
    <Scrollable style={{ height: '220px' }} onScrolledToBottom={handleScrollToBottom}>
      <OptionList
        onChange={async conversationId => {
          const id = conversationId[0]
          await loadConversationById(id)
        }}
        options={conversations}
        selected={[currentConversation.id]}
        verticalAlign="center"
      />
      {(fetchingNextPage || loading) && (
        <InlineStack align="center">
          <Spinner size="small" />
        </InlineStack>
      )}
    </Scrollable>
  )
}

export default ScrollableConversationHistory
