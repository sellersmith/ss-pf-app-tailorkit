import { Modal } from '@shopify/polaris'
import type { TFunction } from 'i18next'
import { memo } from 'react'
import { KeyboardShortcutsTable } from '~/components/ui/KeyboardShortcutsTable'
import type { KeyboardShortcutGroup } from '~/types/keyboardShortcuts'

/**
 * KeyboardShortcutsModal - Shows the shortcuts table
 */
export const KeyboardShortcutsModal = memo(function KeyboardShortcutsModal(props: {
  open: boolean
  title: string
  onClose: () => void
  t: TFunction
  data: KeyboardShortcutGroup[]
}) {
  const { open, title, onClose, t, data } = props
  return (
    <Modal open={open} onClose={onClose} title={title} secondaryActions={[{ content: t('close'), onAction: onClose }]}>
      <Modal.Section>
        <KeyboardShortcutsTable t={t} data={data} showPlatformLabels={false} />
      </Modal.Section>
    </Modal>
  )
})
