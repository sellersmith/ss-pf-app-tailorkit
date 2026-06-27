import { Button, Tooltip } from '@shopify/polaris'
import { ComposeIcon } from '@shopify/polaris-icons'
import { useChatBot } from '~/providers/ChatBotContext'
import { CHAT_BOT_DRAWER_TOOLTIP_Z_INDEX } from '~/components/ChatBotDrawer/constants'
import { useTranslation } from 'react-i18next'

export const AddConversation = () => {
  const { addConversation } = useChatBot()

  const { t } = useTranslation()

  return (
    <Tooltip content={t('add-new-conversation')} zIndexOverride={CHAT_BOT_DRAWER_TOOLTIP_Z_INDEX}>
      <div style={{ display: 'flex' }}>
        <Button icon={ComposeIcon} variant="monochromePlain" onClick={() => addConversation()} />
      </div>
    </Tooltip>
  )
}
