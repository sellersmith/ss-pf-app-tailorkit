import { Button } from '@shopify/polaris'
import { useLiveChat } from '~/utils/hooks/useLiveChat'
import { useTranslation } from 'react-i18next'
import { useCallback } from 'react'
import { useChatBot } from '~/providers/ChatBotContext'

export const NeedHumanSupportCard = () => {
  const { t } = useTranslation()
  const { openChatBotAndSendUserMessage } = useLiveChat()
  const { closeChatBot } = useChatBot()

  const handleOpenCrispChat = useCallback(() => {
    closeChatBot()
    setTimeout(() => {
      openChatBotAndSendUserMessage(t('i-need-to-talk-with-a-human'))
    }, 100)
  }, [openChatBotAndSendUserMessage, t, closeChatBot])

  return (
    <Button onClick={handleOpenCrispChat} variant="primary">
      {t('open-crisp-chat')}
    </Button>
  )
}
