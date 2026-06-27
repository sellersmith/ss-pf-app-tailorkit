import { useMemo } from 'react'
import type { TFunction } from 'i18next'

export interface ClipboardMeta {
  hasElements: boolean
  hasStyle: boolean
}

interface Params {
  t: TFunction
  selectedIds: string[]
  clipboardMeta: ClipboardMeta
  copyElements: () => void
  pasteElements: () => void
  copyStyle: () => void
  pasteStyle: () => void
  exportLayers: () => void
  onClose: () => void
}

export function useContextMenuActions({
  t,
  selectedIds,
  clipboardMeta,
  copyElements,
  pasteElements,
  copyStyle,
  pasteStyle,
  exportLayers,
  onClose,
}: Params) {
  // Detect platform to show correct keyboard shortcut labels
  const isMacOS = useMemo(() => {
    if (typeof navigator === 'undefined') return false

    return /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  }, [])

  // Common shortcut labels
  const shortcutLabels = useMemo(
    () => ({
      copyElement: isMacOS ? '⌘  C' : 'Ctrl  C',
      pasteElement: isMacOS ? '⌘  V' : 'Ctrl  V',
      copyStyle: isMacOS ? '⌘ ⇧ C' : 'Ctrl ⇧ C',
      pasteStyle: isMacOS ? '⌘ ⇧ V' : 'Ctrl ⇧ V',
      exportLayers: isMacOS ? '⌘ ⇧ E' : 'Ctrl ⇧ E',
    }),
    [isMacOS]
  )

  // Build menu actions for Polaris ActionList
  const menuActions = useMemo(
    () => [
      {
        content: t('copy-element', 'Copy'),
        suffix: shortcutLabels.copyElement,
        onAction: () => {
          copyElements()
          onClose()
        },
        disabled: selectedIds.length === 0,
      },
      {
        content: t('paste-element', 'Paste'),
        suffix: shortcutLabels.pasteElement,
        onAction: () => {
          pasteElements()
          onClose()
        },
        disabled: !clipboardMeta.hasElements,
      },
      {
        content: t('copy-style', 'Copy style'),
        suffix: shortcutLabels.copyStyle,
        onAction: () => {
          copyStyle()
          onClose()
        },
        disabled: selectedIds.length !== 1,
      },
      {
        content: t('paste-style', 'Paste style'),
        suffix: shortcutLabels.pasteStyle,
        onAction: () => {
          pasteStyle()
          onClose()
        },
        disabled: selectedIds.length !== 1 || !clipboardMeta.hasStyle,
      },
      {
        content: selectedIds.length > 1 ? t('export-layers') : t('export-layer'),
        suffix: shortcutLabels.exportLayers,
        onAction: () => {
          exportLayers()
          // Note: Don't call onClose here - exportLayers handles the transition to popover
        },
        disabled: selectedIds.length === 0,
      },
    ],
    [
      clipboardMeta,
      copyElements,
      copyStyle,
      exportLayers,
      pasteElements,
      pasteStyle,
      onClose,
      selectedIds.length,
      shortcutLabels,
      t,
    ]
  )

  return menuActions
}
