import type { MODAL_ID } from '~/constants/modal'
import type { UIModalAttributes } from '@shopify/app-bridge-types'
import { useCallback, useEffect } from 'react'

interface IModalComponentProps extends UIModalAttributes {
  id: MODAL_ID
  titleBar: string
  children?: React.ReactNode
  onHide?: () => void
  onShow?: () => void
}

export function ModalComponent(props: IModalComponentProps) {
  const { id, variant, src, titleBar, children, onHide, onShow } = props

  const onHideModal = useCallback(() => {
    onHide && onHide()
  }, [onHide])

  const onShowModal = useCallback(() => {
    onShow && onShow()
  }, [onShow])

  useEffect(() => {
    document.getElementById(id)?.addEventListener('hide', onHideModal)
    document.getElementById(id)?.addEventListener('show', onShowModal)

    return () => {
      document.getElementById(id)?.removeEventListener('hide', onShowModal)
      document.getElementById(id)?.removeEventListener('show', onShowModal)
    }
  }, [id, onHideModal, onShowModal])

  return (
    <div style={{ display: 'none' }}>
      <ui-modal id={id} variant={variant} src={src}>
        <ui-title-bar title={titleBar}>{children}</ui-title-bar>
      </ui-modal>
    </div>
  )
}

ModalComponent.PrimaryButton = PrimaryButton
ModalComponent.SecondaryButton = SecondaryButton

interface ButtonProps
  extends React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement> {
  label: string
}

function PrimaryButton(props: ButtonProps) {
  const { label, ...otherProps } = props
  return (
    <button variant="primary" {...otherProps}>
      {label}
    </button>
  )
}

function SecondaryButton(props: ButtonProps) {
  const { label, ...otherProps } = props

  return <button {...otherProps}>{label}</button>
}
