import type { ReactNode } from 'react'

/**
 * Represents a keyboard shortcut item
 */
export interface KeyboardShortcutItem {
  /** The action description */
  action: string | ReactNode
  /** Mac-specific keyboard shortcut */
  mac_shortcut: string | ReactNode
  /** Windows/Linux keyboard shortcut */
  win_shortcut: string | ReactNode
}

/**
 * Represents a group of keyboard shortcuts
 */
export interface KeyboardShortcutGroup {
  /** Group label */
  label: string
  /** Array of shortcut items in this group */
  items: KeyboardShortcutItem[]
  /** Whether the group is pinned on a specific page */
  pinned?: boolean
}

/**
 * Platform-specific shortcut display options
 */
export type Platform = 'mac' | 'windows' | 'linux'

/**
 * Processed shortcut item for display
 */
export interface ProcessedShortcutItem {
  /** The action description */
  action: string | ReactNode
  /** Platform-appropriate shortcut */
  shortcut: string | ReactNode
  /** Platform identifier for styling purposes */
  platform: Platform
}

/**
 * Processed shortcut group for display
 */
export interface ProcessedShortcutGroup {
  /** Group label */
  label: string
  /** Array of processed shortcut items */
  items: ProcessedShortcutItem[]
}
