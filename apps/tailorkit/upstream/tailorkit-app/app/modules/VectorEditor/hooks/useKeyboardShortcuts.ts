/**
 * useKeyboardShortcuts - Handles keyboard events for the editor
 */

import { useEffect, useCallback } from 'react'
import type { EditorMode, PathCommand } from '../types'

interface UseKeyboardShortcutsOptions {
  enabled?: boolean
  editorMode: EditorMode
  drawingPath: PathCommand[] | null
  canCopy?: boolean
  isExtendMode?: boolean
  onUndo: () => void
  onRedo: () => void
  onDelete: () => void
  onSetEditMode: () => void
  onSetDrawMode: () => void
  onCopy: () => void
  onCut: () => void
  onPaste: () => void
  onFinishDrawing: () => void
  onCancelDrawing: () => void
  onSelectAllNodes?: () => void
  onInvertSelection?: () => void
  onToggleNewSubpath?: () => void
  onExitExtendMode?: () => void
}

export function useKeyboardShortcuts({
  enabled = true,
  editorMode,
  drawingPath,
  canCopy,
  isExtendMode,
  onUndo,
  onRedo,
  onDelete,
  onSetEditMode,
  onSetDrawMode,
  onCopy,
  onCut,
  onPaste,
  onFinishDrawing,
  onCancelDrawing,
  onSelectAllNodes,
  onInvertSelection,
  onToggleNewSubpath,
  onExitExtendMode,
}: UseKeyboardShortcutsOptions): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return

      // Check if focus is on an input element (used for mode switching shortcuts)
      const activeElement = document.activeElement
      const isInputActive
        = activeElement instanceof HTMLInputElement
        || activeElement instanceof HTMLTextAreaElement
        || activeElement?.getAttribute('contenteditable') === 'true'

      // Alt/Option + E for Edit mode
      if (e.altKey && e.code === 'KeyE') {
        e.preventDefault()
        onSetEditMode()
      }

      // V for Edit mode (industry standard - Figma/Illustrator)
      // Only trigger if no modifiers are pressed and not typing in an input
      if (e.code === 'KeyV' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && !isInputActive) {
        e.preventDefault()
        onSetEditMode()
      }

      // Alt/Option + A for Add/Draw mode
      if (e.altKey && e.code === 'KeyA') {
        e.preventDefault()
        onSetDrawMode()
      }

      // P for Draw/Pen mode (industry standard - Figma/Illustrator)
      // Only trigger if no modifiers are pressed and not typing in an input
      if (e.code === 'KeyP' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && !isInputActive) {
        e.preventDefault()
        onSetDrawMode()
      }

      // Enter to finish drawing
      if (e.key === 'Enter' && editorMode === 'draw' && drawingPath && drawingPath.length >= 2) {
        e.preventDefault()
        onFinishDrawing()
      }

      // Esc to cancel drawing
      if (e.key === 'Escape' && editorMode === 'draw' && drawingPath) {
        e.preventDefault()
        onCancelDrawing()
      }

      // Escape or Enter to exit extend mode
      if ((e.key === 'Escape' || e.key === 'Enter') && isExtendMode && onExitExtendMode) {
        e.preventDefault()
        onExitExtendMode()
      }

      // Alt/Option + M for new subpath (draw mode only, when path has at least 1 point)
      if (e.altKey && e.code === 'KeyM' && editorMode === 'draw' && drawingPath && drawingPath.length >= 1) {
        e.preventDefault()
        onToggleNewSubpath?.()
      }

      // Check if focus is on an input element or there's text selection outside canvas
      // This allows browser's default copy/paste/cut/select-all to work in sidebars
      const activeEl = document.activeElement
      const isInputFocused
        = activeEl instanceof HTMLInputElement
        || activeEl instanceof HTMLTextAreaElement
        || activeEl?.getAttribute('contenteditable') === 'true'
      const hasTextSelection = (window.getSelection()?.toString().trim().length ?? 0) > 0

      // Delete or Backspace for delete (edit mode only)
      // Skip if input focused (let browser handle delete in text fields)
      if ((e.key === 'Delete' || e.key === 'Backspace') && editorMode === 'edit') {
        if (isInputFocused) return
        e.preventDefault()
        onDelete()
      }

      // Ctrl/Cmd + C for copy (edit mode only)
      // Skip if input focused or there's text selection (let browser handle it)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.code === 'KeyC' && editorMode === 'edit' && canCopy) {
        if (isInputFocused || hasTextSelection) return
        e.preventDefault()
        onCopy()
      }

      // Ctrl/Cmd + X for cut (edit mode only)
      // Skip if input focused or there's text selection (let browser handle it)
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyX' && editorMode === 'edit' && canCopy) {
        if (isInputFocused || hasTextSelection) return
        e.preventDefault()
        onCut()
      }

      // Ctrl/Cmd + V for paste (edit mode only)
      // Skip if input focused (let browser handle it)
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV' && editorMode === 'edit') {
        if (isInputFocused) return
        e.preventDefault()
        onPaste()
      }

      // Ctrl/Cmd + A for select all nodes (edit mode only)
      // Skip if input focused (let browser handle text selection)
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA' && editorMode === 'edit' && onSelectAllNodes) {
        if (isInputFocused) return
        e.preventDefault()
        onSelectAllNodes()
      }

      // Ctrl/Cmd + Z for undo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        onUndo()
      }

      // Ctrl/Cmd + Shift + Z for redo
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        onRedo()
      }

      // Ctrl/Cmd + Y for redo (alternative - Illustrator pattern)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.code === 'KeyY') {
        e.preventDefault()
        onRedo()
      }

      // Shift + I for invert selection (edit mode only)
      if (e.shiftKey && e.code === 'KeyI' && editorMode === 'edit' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        onInvertSelection?.()
      }
    },
    [
      enabled,
      editorMode,
      drawingPath,
      canCopy,
      isExtendMode,
      onSetEditMode,
      onSetDrawMode,
      onCopy,
      onCut,
      onPaste,
      onFinishDrawing,
      onCancelDrawing,
      onToggleNewSubpath,
      onExitExtendMode,
      onDelete,
      onUndo,
      onRedo,
      onSelectAllNodes,
      onInvertSelection,
    ]
  )

  useEffect(() => {
    if (!enabled) return

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, handleKeyDown])
}
