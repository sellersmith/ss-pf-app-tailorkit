import { BlockStack, Box, Text } from '@shopify/polaris'
import type { MCPToolNotificationMessage } from '~/routes/api.mcp.$tool/constants'
import MessageList from '../MessageList'
import type { IMessageInput } from '~/routes/api.ai-assistant/constants'
import { ConversationRole } from '~/enums/conversationMessage'

interface NotificationViewingProps {
  currentNotificationViewed: MCPToolNotificationMessage
}

export const NotificationViewing = (props: NotificationViewingProps) => {
  const { currentNotificationViewed } = props
  const { conversationTitle, promptRequest, message, timestamp, data } = currentNotificationViewed
  const assistantMessage = `${message}: ${JSON.stringify(data)}`
  const messagesList: IMessageInput[] = [
    {
      id: '1',
      content: promptRequest,
      role: ConversationRole.USER,
      feedback: null,
      timestamp: new Date(timestamp),
    },
    {
      id: '2',
      content: assistantMessage,
      role: ConversationRole.ASSISTANT,
      feedback: null,
      timestamp: new Date(timestamp),
    },
  ]

  return (
    <BlockStack>
      <Box padding={'300'}>
        <Text as="h3" variant="headingMd">
          {conversationTitle}
        </Text>
      </Box>
      <MessageList messages={messagesList} isLoading={false} streamingBlocks={[]} streamingMessage={''} />
    </BlockStack>
  )
}
