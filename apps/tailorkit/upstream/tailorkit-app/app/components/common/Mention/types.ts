import type React from 'react'

/**
 * Base item type for mention suggestions.
 */
export interface BaseMentionItem {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
  kind?: string
}

/**
 * Context information when a mention is active.
 */
export interface MentionContext {
  trigger: string
  query: string
  caretIndex: number
  triggerIndex: number
}

/**
 * Generic input component props that HOC expects to enhance.
 */
export interface InputComponentProps {
  value: string
  onChange: (value: string) => void
}

/**
 * A single mention source providing items and rendering behavior.
 */
export interface MentionSource<T extends BaseMentionItem = BaseMentionItem> {
  id: string
  title?: string
  allowMultiple?: boolean
  minChars?: number
  debounceMs?: number
  items?: T[]
  fetch?: (query: string, context: MentionContext) => Promise<T[]> | T[]
  renderItem?: (item: T, helpers: { select: (item: T) => void }) => React.ReactNode
  renderList?: (items: T[], helpers: { select: (item: T) => void; source: MentionSource<T> }) => React.ReactNode
  onItemSelect?: (item: T) => void
  emptyMessage?: string
  loading?: boolean
  errorMessage?: string
}

/**
 * Options for the reusable mention HOC.
 */
export interface WithMentionOptions<T extends BaseMentionItem = BaseMentionItem> {
  triggers?: string[]
  position?: 'absolute' | 'relative' | 'fixed'
  zIndex?: number
  // Button rendering
  showMentionButton?: boolean
  renderMentionButton?: (onClick: () => void, disabled: boolean, isActive: boolean) => React.ReactNode
  // Sources and behaviors
  mentionSources?: MentionSource<T>[]
  searchPlaceholder?: string
  // Controlled open state
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Props injected by the HOC into wrapped input components.
 */
export interface WithMentionInjectedProps<T extends BaseMentionItem = BaseMentionItem> {
  mentionButton?: React.ReactNode
  onMentionSelect?: (item: T, sourceId: string, context: MentionContext) => void
}
