import { Box, Button, InlineStack } from '@shopify/polaris'
import { XIcon, ChatIcon } from '@shopify/polaris-icons'
import { useChatBot } from '~/providers/ChatBotContext'
import styles from '../../AIChat/styles.module.css'
import { useTranslation } from 'react-i18next'
import UsageSegment from './UsageSegment'
import { lazy, Suspense, useCallback } from 'react'

// Lazy load the ConversationHistory component
const ConversationHistory = lazy(() =>
  import('./ConversationHistory').then(module => ({
    default: module.ConversationHistory,
  }))
)

export const ChatBotHeader = () => {
  const { closeChatBot, addConversation, setDynamicSuggestions } = useChatBot()
  const { t } = useTranslation()

  const handleNewConversation = useCallback(() => {
    addConversation()
    setDynamicSuggestions([])
  }, [addConversation, setDynamicSuggestions])

  return (
    <div className={styles.ChatBoxHeader}>
      <Box
        paddingBlock={'200'}
        paddingInline={'200'}
        borderColor="border"
        borderWidth="025"
        borderInlineStartWidth="0"
        borderInlineEndWidth="0"
        borderBlockStartWidth="0"
      >
        <div style={{ maxHeight: '28px', overflow: 'hidden' }}>
          <InlineStack align="space-between" blockAlign="center">
            {/* Left: New conversation button */}
            <InlineStack gap={'100'} blockAlign="center">
              <Button variant="plain" onClick={handleNewConversation} icon={ChatIcon}>
                {t('new-conversation')}
              </Button>
            </InlineStack>

            {/* Right: History + Usage + Close */}
            <InlineStack blockAlign="center" gap={'100'}>
              <Suspense fallback={null}>
                <ConversationHistory />
              </Suspense>
              <UsageSegment />
              <Button icon={XIcon} variant="plain" onClick={closeChatBot} accessibilityLabel={t('close')} />
            </InlineStack>
          </InlineStack>
        </div>
      </Box>
    </div>
  )
}
