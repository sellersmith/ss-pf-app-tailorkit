import type { ReactNode } from 'react'
import { Popover } from '@shopify/polaris'

export interface StyleSettingPopoverProps {
  /** Controls the open state */
  active: boolean
  /** Called when popover requests close */
  onClose: () => void
  /** Button or control that toggles the popover */
  activator: ReactNode

  /** Popover content */
  children: ReactNode

  /** Preferred popover position */
  preferredPosition?: 'above' | 'below' | 'mostSpace'

  /** Optional z-index override to ensure visibility above canvas */
  zIndexOverride?: number

  /** Autofocus target when opening */
  autofocusTarget?: 'none' | 'first-node'
}

/**
 * Reusable Popover used for editing individual style settings (font, color, stroke, effects...).
 * - Controlled component: parent manages `active` and `onClose`.
 * - Uses Polaris Popover; content area is padded and optionally scrollable.
 */
export default function StyleSettingPopover(props: StyleSettingPopoverProps) {
  const {
    active,
    onClose,
    activator,

    children,
    preferredPosition = 'above',

    zIndexOverride = 1000,
    autofocusTarget = 'first-node',
  } = props

  return (
    <Popover
      active={active}
      activator={<div className="tlk-style-popover-activator">{activator}</div>}
      autofocusTarget={autofocusTarget}
      preferredPosition={preferredPosition}
      onClose={onClose}
      zIndexOverride={zIndexOverride}
    >
      {children}
    </Popover>
  )
}
