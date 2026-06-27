import { Scrollable } from '@shopify/polaris'
import { useChatBot } from '~/providers/ChatBotContext'
import { useRootLoaderData } from '~/root'
import { AIChat } from '../AIChat'
import styles from './ChatBotDrawer.module.css'
import { ChatBotHeader } from './components/ChatBotHeader'

export const ChatBotDrawer = () => {
  const { shopData } = useRootLoaderData()
  const { isOpen } = useChatBot()

  const renderResult = (
    <div className={styles.drawer}>
      <div className={styles.drawerContent}>
        <ChatBotHeader />
        <Scrollable style={{ flex: 1, overscrollBehavior: 'contain' }} scrollbarWidth="none">
          {shopData && <AIChat isOpen={isOpen} shopData={shopData} />}
        </Scrollable>
      </div>
    </div>
  )

  return renderResult
}
