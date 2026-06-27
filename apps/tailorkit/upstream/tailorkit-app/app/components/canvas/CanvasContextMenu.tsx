import { useEffect, useRef, type ReactNode } from 'react'
import { ActionList, Popover } from '@shopify/polaris'

interface ICanvasContextMenuProps {
  open: boolean
  anchor: { x: number; y: number }
  onClose: () => void
  actions: {
    content: string
    onAction: () => void
    disabled?: boolean
    /** Optional suffix shown on the right-hand side of the item. Useful for keyboard shortcuts. */
    suffix?: ReactNode
  }[]
}

// Lightweight wrapper that places a Polaris Popover at an arbitrary screen coordinate
export default function CanvasContextMenu(props: ICanvasContextMenuProps) {
  const { open, anchor, onClose, actions } = props
  const activatorRef = useRef<HTMLDivElement>(null)

  // Close the menu when user clicks anywhere else or presses Escape
  useEffect(() => {
    if (!open) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  // Render hidden activator div at the click position
  const activator = (
    <div
      ref={activatorRef}
      style={{
        position: 'fixed',
        top: anchor.y,
        left: anchor.x,
        width: 0,
        height: 0,
        zIndex: 9999,
      }}
    />
  )

  return (
    <Popover
      active={open}
      activator={activator}
      onClose={onClose}
      preferredPosition="below"
      preventCloseOnChildOverlayClick
    >
      <ActionList items={actions} />
    </Popover>
  )
}
