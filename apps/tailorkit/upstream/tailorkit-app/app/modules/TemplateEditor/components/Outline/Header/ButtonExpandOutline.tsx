import { Button, Tooltip } from '@shopify/polaris'
import { TransferInIcon } from '@shopify/polaris-icons'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useChatBot } from '~/providers/ChatBotContext'
import { TEMPLATE_EDITOR_CTA_IDS } from '~/modules/TemplateEditor/constants'
import { toggleSidebar } from './ButtonCollapsibleOutline'

export default function ButtonExpandOutline() {
  const { t } = useTranslation()
  const { isOpen: isChatBotOpen } = useChatBot()

  const onClick = useCallback(() => toggleSidebar(true), [])

  if (isChatBotOpen) {
    return null
  }

  return (
    <Tooltip content={t('show-sidebar')}>
      <Button
        id={TEMPLATE_EDITOR_CTA_IDS.SHOW_SIDEBAR}
        variant={'secondary'}
        icon={TransferInIcon}
        onClick={onClick}
        aria-label={t('show-sidebar')}
      />
    </Tooltip>
  )
}
