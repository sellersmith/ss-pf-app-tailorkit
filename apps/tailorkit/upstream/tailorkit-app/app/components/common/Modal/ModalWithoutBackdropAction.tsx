import type { ModalProps } from '@shopify/polaris'
import { Modal } from '@shopify/polaris'
import { useEffect, useState } from 'react'

export function ModalWithoutBackdropAction(props: ModalProps) {
  const { open, onClose } = props

  const [preventCloseModal, setPreventCloseModal] = useState(false)

  function preventCloseModalWhenClickingBackdrop(e: MouseEvent) {
    const target = e.target as HTMLElement | null

    if (target && target.classList.contains('Polaris-Backdrop')) {
      setPreventCloseModal(true)
    } else {
      setPreventCloseModal(false)
    }
  }

  useEffect(() => {
    window.addEventListener('click', preventCloseModalWhenClickingBackdrop, {
      capture: true,
    })

    if (!open) {
      window.removeEventListener('click', preventCloseModalWhenClickingBackdrop)
    }

    return () => {
      window.removeEventListener('click', preventCloseModalWhenClickingBackdrop)
    }
  }, [open])

  return (
    <Modal
      {...props}
      onClose={() => {
        if (preventCloseModal) return

        onClose()
      }}
    >
      {props.children}
    </Modal>
  )
}
