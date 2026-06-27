import { OptionList, Scrollable } from '@shopify/polaris'
import type { OptionDescriptor } from '@shopify/polaris/build/ts/src/types'
import type { MCPToolNotificationMessage } from '~/routes/api.mcp.$tool/constants'

interface IScrollableNotificationsProps {
  currentNotificationViewed: MCPToolNotificationMessage | null
  notifications: OptionDescriptor[]
  loadNotificationViewed: (notificationId: string) => Promise<void>
}

const ScrollableNotifications = (props: IScrollableNotificationsProps) => {
  const { notifications, currentNotificationViewed, loadNotificationViewed } = props

  const handleScrollToBottom = () => {
    console.log('scroll to bottom')
  }

  return (
    <Scrollable style={{ height: '220px' }} onScrolledToBottom={handleScrollToBottom}>
      <OptionList
        onChange={async notificationId => {
          const id = notificationId[0]
          await loadNotificationViewed(id)
        }}
        options={notifications}
        selected={[currentNotificationViewed?._id || '']}
        verticalAlign="center"
      />
    </Scrollable>
  )
}

export default ScrollableNotifications
