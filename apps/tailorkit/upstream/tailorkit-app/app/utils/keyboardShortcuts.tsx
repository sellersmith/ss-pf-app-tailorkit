import { KeyboardKey } from '@shopify/polaris'
import type { TFunction } from 'i18next'
import type { KeyboardShortcutGroup } from '~/types/keyboardShortcuts'
import type { ReactNode } from 'react'

/**
 * Creates a keyboard shortcut component with KeyboardKey styling
 * @param keys Array of key names to display
 * @returns ReactNode with styled keyboard keys
 */
function createKeyboardShortcut(keys: string[]): ReactNode {
  return (
    <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
      {keys.map((key, index) => (
        <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
          <KeyboardKey size="small">{key}</KeyboardKey>
          {index < keys.length - 1 && <span style={{ fontSize: '12px', color: '#666' }}>+</span>}
        </span>
      ))}
    </span>
  )
}

/**
 * Creates a Mac keyboard shortcut with arrow keys using icons
 * @param modifiers Array of modifier key names
 * @param t Translation function
 * @returns ReactNode with Trans component and icons for Mac
 */
function createMacArrowKeyShortcut(modifiers: string[], t: TFunction): ReactNode {
  const macModifiers = modifiers.map(mod => (mod === 'Alt' ? '⌥' : mod === 'Ctrl' ? '⌃' : mod))

  return (
    <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
      {macModifiers.map((mod, index) => (
        <span key={mod} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
          <KeyboardKey size="small">{mod}</KeyboardKey>
          <span style={{ fontSize: '12px', color: '#666' }}>+</span>
        </span>
      ))}
      <KeyboardKey size="small">↑</KeyboardKey>
      <KeyboardKey size="small">↓</KeyboardKey>
      <KeyboardKey size="small">←</KeyboardKey>
      <KeyboardKey size="small">→</KeyboardKey>
    </span>
  )
}

/**
 * Creates a Windows keyboard shortcut with arrow keys using icons
 * @param modifiers Array of modifier key names
 * @param t Translation function
 * @returns ReactNode with Trans component and icons for Windows
 */
function createWinArrowKeyShortcut(modifiers: string[], t: TFunction): ReactNode {
  return (
    <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
      {modifiers.map((mod, index) => (
        <span key={mod} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
          <KeyboardKey size="small">{mod}</KeyboardKey>
          <span style={{ fontSize: '12px', color: '#666' }}>+</span>
        </span>
      ))}
      <KeyboardKey size="small">↑</KeyboardKey>
      <KeyboardKey size="small">↓</KeyboardKey>
      <KeyboardKey size="small">←</KeyboardKey>
      <KeyboardKey size="small">→</KeyboardKey>
    </span>
  )
}

/**
 * Creates a Mac keyboard shortcut with up/down arrow keys using icons
 * @param modifiers Array of modifier key names
 * @param t Translation function
 * @returns ReactNode with Trans component and icons for Mac
 */
function createMacUpDownArrowShortcut(modifiers: string[], t: TFunction): ReactNode {
  const macModifiers = modifiers.map(mod =>
    mod === 'Alt'
      ? '⌥'
      : mod === 'Ctrl'
        ? '⌃'
        : mod === 'Control'
          ? '⌃'
          : mod === 'Option'
            ? '⌥'
            : mod === 'Shift'
              ? '⇧'
              : mod
  )

  return (
    <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
      {macModifiers.map((mod, index) => (
        <span key={mod} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
          <KeyboardKey size="small">{mod}</KeyboardKey>
          <span style={{ fontSize: '12px', color: '#666' }}>+</span>
        </span>
      ))}
      <KeyboardKey size="small">↑</KeyboardKey>
      <span style={{ fontSize: '12px', color: '#666', margin: '0 1px' }}>/</span>
      <KeyboardKey size="small">↓</KeyboardKey>
    </span>
  )
}

/**
 * Creates a Windows keyboard shortcut with up/down arrow keys using icons
 * @param modifiers Array of modifier key names
 * @param t Translation function
 * @returns ReactNode with Trans component and icons for Windows
 */
function createWinUpDownArrowShortcut(modifiers: string[], t: TFunction): ReactNode {
  const winModifiers = modifiers.map(mod => (mod === 'Option' ? 'Alt' : mod === 'Control' ? 'Ctrl' : mod))

  return (
    <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
      {winModifiers.map((mod, index) => (
        <span key={mod} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
          <KeyboardKey size="small">{mod}</KeyboardKey>
          <span style={{ fontSize: '12px', color: '#666' }}>+</span>
        </span>
      ))}
      <KeyboardKey size="small">↑</KeyboardKey>
      <span style={{ fontSize: '12px', color: '#666', margin: '0 1px' }}>/</span>
      <KeyboardKey size="small">↓</KeyboardKey>
    </span>
  )
}

/**
 * Creates keyboard shortcuts configuration for canvas tools
 * @param t Translation function
 * @returns Array of keyboard shortcut groups
 */
export function createCanvasKeyboardShortcuts(t: TFunction): KeyboardShortcutGroup[] {
  return [
    {
      label: t('copy-paste'),
      items: [
        {
          action: t('copy-selected-layers'),
          mac_shortcut: createKeyboardShortcut(['⌘', 'C']),
          win_shortcut: createKeyboardShortcut(['Ctrl', 'C']),
        },
        {
          action: t('paste-copied-layers'),
          mac_shortcut: createKeyboardShortcut(['⌘', 'V']),
          win_shortcut: createKeyboardShortcut(['Ctrl', 'V']),
        },
        {
          action: t('copy-layer-style'),
          mac_shortcut: createKeyboardShortcut(['⌘', 'Shift', 'C']),
          win_shortcut: createKeyboardShortcut(['Ctrl', 'Shift', 'C']),
        },
        {
          action: t('paste-layer-style'),
          mac_shortcut: createKeyboardShortcut(['⌘', 'Shift', 'V']),
          win_shortcut: createKeyboardShortcut(['Ctrl', 'Shift', 'V']),
        },
      ],
      pinned: true,
    },
    {
      label: t('movement-positioning'),
      items: [
        {
          action: t('center-selected-layers'),
          mac_shortcut: createKeyboardShortcut(['⌃', '⌥', 'E']),
          win_shortcut: createKeyboardShortcut(['Ctrl', 'Alt', 'E']),
        },
        {
          action: t('move-layer-to-canvas-edge'),
          mac_shortcut: createMacArrowKeyShortcut(['Alt'], t),
          win_shortcut: createWinArrowKeyShortcut(['Alt'], t),
        },
        {
          action: t('move-layer-by-1px'),
          mac_shortcut: createMacArrowKeyShortcut([], t),
          win_shortcut: createWinArrowKeyShortcut([], t),
        },
      ],
    },
    {
      label: t('navigation-reordering'),
      items: [
        {
          action: t('move-multiple-layers-to-top-bottom'),
          mac_shortcut: createMacUpDownArrowShortcut(['Control', 'Option'], t),
          win_shortcut: createWinUpDownArrowShortcut(['Control', 'Alt'], t),
        },
        {
          action: t('reorder-multiple-layers-up-down'),
          mac_shortcut: createMacUpDownArrowShortcut(['Shift', 'Option'], t),
          win_shortcut: createWinUpDownArrowShortcut(['Shift', 'Alt'], t),
        },
        {
          action: t('switch-to-previous-next-layer'),
          mac_shortcut: createMacUpDownArrowShortcut(['Shift'], t),
          win_shortcut: createWinUpDownArrowShortcut(['Shift'], t),
        },
      ],
    },
    {
      label: t('selection-grouping'),
      items: [
        {
          action: t('delete-selected-layers'),
          mac_shortcut: <KeyboardKey size="small">Delete</KeyboardKey>,
          win_shortcut: <KeyboardKey size="small">Backspace</KeyboardKey>,
        },
        {
          action: t('select-all-layers'),
          mac_shortcut: createKeyboardShortcut(['⌘', 'A']),
          win_shortcut: createKeyboardShortcut(['Ctrl', 'A']),
        },
        {
          action: t('deselect-all-layers'),
          mac_shortcut: createKeyboardShortcut(['⌃', '⌥', 'D']),
          win_shortcut: createKeyboardShortcut(['Ctrl', 'Alt', 'D']),
        },
        {
          action: t('group-selected-layers'),
          mac_shortcut: createKeyboardShortcut(['⌃', '⌥', 'G']),
          win_shortcut: createKeyboardShortcut(['Ctrl', 'Alt', 'G']),
        },
        {
          action: t('ungroup-selected-layers'),
          mac_shortcut: createKeyboardShortcut(['⌃', '⌥', 'U']),
          win_shortcut: createKeyboardShortcut(['Ctrl', 'Alt', 'U']),
        },
      ],
    },
    {
      label: t('undo-redo'),
      items: [
        {
          action: t('undo-last-change-on-selected-layer'),
          mac_shortcut: createKeyboardShortcut(['⌘', 'Z']),
          win_shortcut: createKeyboardShortcut(['Ctrl', 'Z']),
        },
        {
          action: t('redo-last-undone-change-on-selected-layer'),
          mac_shortcut: createKeyboardShortcut(['⌘', 'Shift', 'Z']),
          win_shortcut: createKeyboardShortcut(['Ctrl', 'Shift', 'Z']),
        },
      ],
      pinned: true,
    },
  ]
}
