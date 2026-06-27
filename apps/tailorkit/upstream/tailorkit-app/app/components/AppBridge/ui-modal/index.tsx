import { Modal, type ModalProps, TitleBar, type UIModalAttributes } from '@shopify/app-bridge-react'
import type { MouseEventHandler } from 'react'
import { useTranslation } from 'react-i18next'
import type { MODALS } from './constants'

interface IModal extends UIModalAttributes {
  id: string | ExtractStrings<typeof MODALS>
  title?: string
  primaryAction?: {
    onAction?: MouseEventHandler<HTMLButtonElement>
    disabled?: boolean
    tone?: 'critical' | undefined
    content: string
    loading?: boolean | string
  }
  secondaryAction?: {
    onAction?: MouseEventHandler<HTMLButtonElement>
    disabled?: boolean
    tone?: 'critical' | undefined
    content: string
  }
}

export default function ModalAppBridge({
  id,
  title,
  children,
  primaryAction,
  variant,
  secondaryAction,
  ...defaultModalAppBridgeProps
}: IModal & ModalProps) {
  const { t } = useTranslation()

  return (
    <Modal id={id} variant={variant || 'base'} {...defaultModalAppBridgeProps}>
      {children}
      {title && (
        <TitleBar title={t(title)}>
          {primaryAction && (
            <button
              variant="primary"
              onClick={primaryAction.onAction}
              disabled={primaryAction.disabled}
              tone={primaryAction.tone}
              loading={primaryAction.loading}
            >
              {primaryAction.content}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={e => {
                typeof secondaryAction.onAction === 'function' && secondaryAction.onAction(e)
              }}
              disabled={secondaryAction.disabled}
              tone={secondaryAction.tone}
            >
              {t(secondaryAction.content)}
            </button>
          )}
        </TitleBar>
      )}
    </Modal>
  )
}
