import { Button, Tooltip, useBreakpoints } from '@shopify/polaris'
import { TransferOutIcon } from '@shopify/polaris-icons'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { CANVAS_TRANSMISSION_EVENTS } from '~/components/canvas/constants'
import { TEMPLATE_EDITOR_CTA_IDS } from '~/modules/TemplateEditor/constants'
import { useChatBot } from '~/providers/ChatBotContext'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { TemplateEditorStore } from '~/stores/modules/template'

export default function ButtonCollapsibleOutline() {
  const { t } = useTranslation()

  const { isCompactMode, isOpen } = useChatBot()
  const { lgDown } = useBreakpoints()

  const onClick = useCallback(() => {
    toggleSidebar(!TemplateEditorStore.getState().sidebarActive)
  }, [])

  if ((isCompactMode && lgDown) || isOpen) {
    return null
  }

  return (
    <Tooltip content={t('hide-sidebar')}>
      <Button id={TEMPLATE_EDITOR_CTA_IDS.HIDE_SIDEBAR} variant="secondary" icon={TransferOutIcon} onClick={onClick} />
    </Tooltip>
  )
}

export function toggleSidebar(visible: boolean) {
  TemplateEditorStore.dispatch({
    type: 'SET_SIDEBAR_ACTIVE',
    payload: { sidebarActive: visible },
    skipTrace: true,
  })

  setTimeout(() => {
    Transmitter.trigger(CANVAS_TRANSMISSION_EVENTS.UPDATE_CANVAS_DIMENSION)
  }, 50)
}
