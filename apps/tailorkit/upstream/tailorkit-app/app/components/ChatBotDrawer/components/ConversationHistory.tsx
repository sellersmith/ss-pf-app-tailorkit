import { useCallback, useMemo, useState } from 'react'
import {
  Box,
  Button,
  InlineStack,
  Popover,
  Spinner,
  Bleed,
  BlockStack,
  Divider,
  TextField,
  Icon,
  Tooltip,
} from '@shopify/polaris'
import { ClockIcon, ComposeIcon, SearchIcon } from '@shopify/polaris-icons'
import { DEFAULT_CONVERSATION_PAGINATION, useChatBot } from '~/providers/ChatBotContext'
import { type IConversationInput } from '~/routes/api.ai-assistant/constants'
import { useTranslation } from 'react-i18next'
import ScrollableConversationHistory from './ScrollableConversationHistory'
import debounce from 'lodash/debounce'
import { DEBOUNCE_REQUEST_MAJOR } from '~/constants/debounce'
import { CHAT_BOT_DRAWER_TOOLTIP_Z_INDEX } from '../constants'

export const ConversationHistory = () => {
  const { t } = useTranslation()

  const [popoverActive, setPopoverActive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationsList, setConversationsList] = useState<IConversationInput[]>([])
  const [pagination, setPagination] = useState(DEFAULT_CONVERSATION_PAGINATION)
  const [currentPage, setCurrentPage] = useState(1)
  const [fetchingNextPage, setFetchingNextPage] = useState(false)

  const { currentConversation, loadConversations, loadConversationById, addConversation, setDynamicSuggestions }
    = useChatBot()

  const _conversations = useMemo(
    () =>
      conversationsList.map(conversation => ({
        label: conversation.title,
        value: conversation.id,
      })),
    [conversationsList]
  )

  const toggleConversationHistoryPopover = useCallback(async () => {
    setPopoverActive(!popoverActive)

    if (!popoverActive && conversationsList.length === 0) {
      setLoading(true)
      const { conversations, pagination } = await loadConversations()
      setConversationsList(conversations)
      setPagination(pagination)
      setLoading(false)
    }
  }, [conversationsList, loadConversations, popoverActive])

  const debouncedSearch = useMemo(
    () =>
      debounce(async (queryValue: string) => {
        try {
          setLoading(true)
          const { conversations, pagination } = await loadConversations({ query: queryValue.trim() })
          setConversationsList(conversations)
          setPagination(pagination)
        } finally {
          setLoading(false)
        }
      }, DEBOUNCE_REQUEST_MAJOR),
    [loadConversations]
  )

  /**
   * Handle search conversations
   * Debounce the search query to avoid unnecessary re-renders
   * @param queryValue - The query value
   */
  const handleSearchConversations = useCallback(
    async (queryValue: string) => {
      setSearchQuery(queryValue)

      // Debounce the search query to avoid unnecessary re-renders
      debouncedSearch(queryValue)
    },
    [debouncedSearch]
  )

  const handleScrollToBottom = useCallback(async () => {
    if (currentPage < pagination.pages) {
      setFetchingNextPage(true)
      const page = currentPage + 1
      const { conversations } = await loadConversations({ page })
      setConversationsList([...conversationsList, ...conversations])
      setCurrentPage(page)
      setFetchingNextPage(false)
    }
  }, [conversationsList, currentPage, loadConversations, pagination.pages])

  const onCreateNewConversation = useCallback(() => {
    // Create a new conversation
    addConversation()

    // Clear previous dynamic suggestions
    setDynamicSuggestions([])

    // Close the popover
    toggleConversationHistoryPopover()
  }, [addConversation, setDynamicSuggestions, toggleConversationHistoryPopover])

  const activator = (
    <Tooltip content={t('conversation-history')} zIndexOverride={CHAT_BOT_DRAWER_TOOLTIP_Z_INDEX}>
      <div style={{ display: 'flex' }}>
        <Box paddingBlockStart="100">
          <Button icon={ClockIcon} variant="monochromePlain" onClick={toggleConversationHistoryPopover} />
        </Box>
      </div>
    </Tooltip>
  )

  return (
    <Popover
      active={popoverActive}
      activator={activator}
      onClose={() => setPopoverActive(false)}
      preferredAlignment="right"
      zIndexOverride={1000}
    >
      <Popover.Pane sectioned minHeight="220px" maxHeight="320px">
        <Bleed marginInline={'300'}>
          <Box width="212px" minHeight="220px">
            <Box padding="150">
              <BlockStack gap="200">
                <Button
                  icon={ComposeIcon}
                  variant="monochromePlain"
                  onClick={onCreateNewConversation}
                  textAlign="start"
                  fullWidth
                >
                  {t('new-conversation')}
                </Button>

                <Divider borderColor="border" borderWidth="025" />

                <TextField
                  autoComplete="off"
                  label={t('search-conversation')}
                  labelHidden
                  value={searchQuery}
                  onChange={handleSearchConversations}
                  placeholder={t('search-conversation')}
                  prefix={<Icon source={SearchIcon} />}
                />
              </BlockStack>
            </Box>
            {loading && conversationsList.length === 0 ? (
              <Box width="100%" minHeight="100%">
                <InlineStack align="center" blockAlign="center">
                  <Spinner size="small" />
                </InlineStack>
              </Box>
            ) : (
              <BlockStack>
                <Divider borderColor="border" borderWidth="025" />

                <ScrollableConversationHistory
                  conversations={_conversations}
                  currentConversation={currentConversation}
                  loadConversationById={loadConversationById}
                  fetchingNextPage={fetchingNextPage}
                  loading={loading}
                  handleScrollToBottom={handleScrollToBottom}
                />
              </BlockStack>
            )}
          </Box>
        </Bleed>
      </Popover.Pane>
    </Popover>
  )
}
