import { Button, Tooltip } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { useWhatsNewContext } from '../providers/WhatsNewProvider'
import { useModal } from '~/utils/hooks/useModal'
import { MODAL_ID } from '~/constants/modal'

/**
 * Alert icon component with badge showing unread count
 * Displays "What's new" button with badge (shows "9+" if count > 9)
 */
export function WhatsNewAlertIcon() {
  const { t } = useTranslation()
  const { unreadCount } = useWhatsNewContext()
  const { openModal } = useModal()

  const handleClick = () => {
    openModal(MODAL_ID.WHATS_NEW_MODAL, {})
  }

  const badgeCount = unreadCount > 9 ? '9+' : unreadCount > 0 ? unreadCount.toString() : undefined

  return (
    <Tooltip content={t('check-out-the-latest-trends-promotions-and-new-features-that-help-you-sell-better')}>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <Button onClick={handleClick}>{t('what-s-new')}</Button>
        {badgeCount !== undefined && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              transform: 'translate(50%, -50%)',
            }}
          >
            <span
              style={{
                cursor: 'pointer',
                backgroundColor: 'var(--p-color-bg-fill-success)',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 12,
              }}
            >
              {badgeCount}
            </span>
          </div>
        )}
      </div>
    </Tooltip>
  )
}
