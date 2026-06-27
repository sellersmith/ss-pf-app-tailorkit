import { useEffect, type ComponentClass, type FunctionComponent } from 'react'

export type KeyPressContext = {
  keyCode: string
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}

export type KeyboardAction = {
  keyCode: string
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  preventDefault?: boolean
  stopPropagation?: boolean
  onAction: (context: KeyPressContext, e: KeyboardEvent) => void
}

export type WithKeyboardShortcutProps = any & {
  preventDefault?: boolean
  stopPropagation?: boolean
  keyboardActions?: KeyboardAction[]
  event?: 'keydown' | 'keyup' | 'keypress'
  verifyKeyboardAction?: (e: KeyboardEvent) => boolean
}

export default function withKeyboardShortcut(
  Component: FunctionComponent<WithKeyboardShortcutProps> | ComponentClass<WithKeyboardShortcutProps>
) {
  return function WithKeyboardShortcut(props: any) {
    const {
      event = 'keydown',
      keyboardActions = [],
      preventDefault = false,
      stopPropagation = false,
      verifyKeyboardAction,
    } = props

    useEffect(() => {
      function handleKeyPress(e: KeyboardEvent) {
        // Get event target
        const target = e.target as HTMLElement

        // Make sure users are not typing into an input field
        const htmlTag = target.nodeName.toLowerCase()

        const isEditable = target.isContentEditable
        const isInputFieldType = ['number', 'text'].includes(target.getAttribute('type') as string)
        const isInputField = htmlTag === 'input' && isInputFieldType
        const isIgnoredElement = ['select', 'textarea'].includes(htmlTag)

        // Get current text selection
        const textSelection = window.getSelection && window.getSelection()?.toString()

        // Verify keyboard action with the provided function
        const isVerificationFailed = typeof verifyKeyboardAction === 'function' && !verifyKeyboardAction(e)

        if (isEditable || isIgnoredElement || isInputField || textSelection || isVerificationFailed) {
          return
        }

        // Get pressed keys
        const keyCode = e.code
        const altKey = e.altKey
        const ctrlKey = e.ctrlKey
        const metaKey = e.metaKey
        const shiftKey = e.shiftKey

        // Get matched action
        const matchedAction = keyboardActions.find((a: KeyboardAction) => {
          // Check if keyCode matches
          if (a.keyCode !== keyCode) return false

          // Check modifier keys
          if (Boolean(a.altKey) !== Boolean(altKey)) return false
          if (Boolean(a.shiftKey) !== Boolean(shiftKey)) return false

          // Special handling for Ctrl/Cmd (Meta) keys
          // Match if either:
          // 1. Action specifies ctrlKey and user pressed ctrl (Windows/Linux)
          // 2. Action specifies metaKey and user pressed meta (macOS)
          // 3. Action specifies both and user pressed either
          const actionWantsCtrlOrMeta = Boolean(a.ctrlKey) || Boolean(a.metaKey)
          const userPressedCtrlOrMeta = Boolean(ctrlKey) || Boolean(metaKey)

          return actionWantsCtrlOrMeta === userPressedCtrlOrMeta
        })

        if (matchedAction) {
          const { onAction } = matchedAction

          if (typeof onAction === 'function') {
            ;(matchedAction.preventDefault ?? preventDefault) && e.preventDefault()
            ;(matchedAction.stopPropagation ?? stopPropagation) && e.stopPropagation()

            // Execute the callback action handle
            onAction({ keyCode, altKey, ctrlKey, metaKey, shiftKey }, e)
          }
        }
      }

      document.addEventListener(event, handleKeyPress)

      return () => document.removeEventListener(event, handleKeyPress)
    }, [event, keyboardActions, preventDefault, stopPropagation, verifyKeyboardAction])

    return <Component {...props} />
  }
}
