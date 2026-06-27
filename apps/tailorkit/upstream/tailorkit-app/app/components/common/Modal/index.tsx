import type { MODAL_ID } from '~/constants/modal'

interface IModalProps {
  id: MODAL_ID
  title: string
  primaryAction: () => unknown
  primaryLabel: string
  message?: string
}

export default function Modal(props: IModalProps) {
  const { id, title, primaryAction, primaryLabel, message } = props
  return (
    <ui-modal id={id}>
      <p style={{ padding: '16px' }}>{message}</p>

      <ui-title-bar title={title}>
        <button variant="primary" onClick={primaryAction}>
          {primaryLabel}
        </button>
        <button
          onClick={() => {
            ;(document.getElementById(id) as any)?.hide()
          }}
        >
          Cancel
        </button>
      </ui-title-bar>
    </ui-modal>
  )
}
