import { Button, Box, Tooltip, Popover, Bleed, Text } from '@shopify/polaris'
import { CHAT_BOT_DRAWER_TOOLTIP_Z_INDEX } from '../../constants'
import { useTranslation } from 'react-i18next'
import { useCallback, useMemo, useState } from 'react'
import { NotificationIcon } from '@shopify/polaris-icons'
import { NotificationCount } from './NotificationCount'
import { useChatBot } from '~/providers/ChatBotContext'
import ScrollableNotifications from './ScrollableNotifications'

export const Notifications = () => {
  const { t } = useTranslation()
  const { mcpToolExecutedNotifications, currentNotificationViewed, loadNotificationViewed } = useChatBot()
  const [popoverActive, setPopoverActive] = useState(false)

  const notifications = useMemo(
    () =>
      mcpToolExecutedNotifications.map(notification => ({
        label: notification.conversationTitle,
        value: notification._id,
      })),
    [mcpToolExecutedNotifications]
  )

  const togglePopover = useCallback(() => {
    setPopoverActive(prev => !prev)
  }, [])

  const activator = (
    <Tooltip content={t('notifications')} zIndexOverride={CHAT_BOT_DRAWER_TOOLTIP_Z_INDEX}>
      <div style={{ position: 'relative' }}>
        <Box paddingBlockStart="100">
          <Button icon={NotificationIcon} variant="monochromePlain" onClick={togglePopover} />
        </Box>
        <NotificationCount
          styles={{
            zIndex: CHAT_BOT_DRAWER_TOOLTIP_Z_INDEX,
            fontSize: 8,
            height: 12,
            transform: 'none',
          }}
        />
      </div>
    </Tooltip>
  )

  return (
    <Popover
      active={popoverActive}
      activator={activator}
      onClose={() => setPopoverActive(false)}
      preferredAlignment="left"
      zIndexOverride={1000}
    >
      {notifications.length === 0 ? (
        <Box paddingBlock={'1200'} paddingInline={'400'}>
          <Text variant="bodyMd" as="p" alignment="center">
            {t('there-are-no-notifications')}
          </Text>
        </Box>
      ) : (
        <Popover.Pane sectioned minHeight="220px" maxHeight="320px">
          <Bleed marginInline={'300'}>
            <Box width="212px" minHeight="220px">
              <ScrollableNotifications
                currentNotificationViewed={currentNotificationViewed}
                notifications={notifications}
                loadNotificationViewed={loadNotificationViewed}
              />
            </Box>
          </Bleed>
        </Popover.Pane>
      )}
    </Popover>
  )
}
