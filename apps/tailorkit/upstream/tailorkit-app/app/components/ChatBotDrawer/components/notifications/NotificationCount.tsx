import { useChatBot } from '~/providers/ChatBotContext'

export const NotificationCount = ({ styles }: { styles?: React.CSSProperties }) => {
  const { mcpToolExecutedNotificationsCount } = useChatBot()

  if (mcpToolExecutedNotificationsCount === 0) return null

  return (
    <span
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        background: 'var(--p-color-bg-fill-magic)',
        color: '#fff',
        borderRadius: '50%',
        minWidth: 12,
        height: 18,
        fontSize: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        transform: 'translate(50%,-50%)',
        zIndex: 1000,
        ...styles,
      }}
    >
      {mcpToolExecutedNotificationsCount}
    </span>
  )
}
