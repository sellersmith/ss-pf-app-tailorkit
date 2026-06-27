import isEqual from 'lodash/isEqual'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * Interface defining the keyboard state values
 * @interface IKeyboardState
 */
interface IKeyboardState {
  /** Whether the Alt key is currently pressed */
  isAltPressed: boolean
  /** Whether the Control/Command key is currently pressed */
  isCtrlPressed: boolean
  /** Whether the Shift key is currently pressed */
  isShiftPressed: boolean
  /** Whether the Space key is currently pressed */
  isSpacePressed: boolean
}

/**
 * Default keyboard state values
 */
const defaultKeyboardState: IKeyboardState = {
  isAltPressed: false,
  isCtrlPressed: false,
  isShiftPressed: false,
  isSpacePressed: false,
}

/**
 * Context for sharing keyboard state across components
 * @type {React.Context<IKeyboardState>}
 */
export const KeyboardContext = createContext<IKeyboardState>(defaultKeyboardState)

/**
 * Props for the KeyboardProvider component
 * @interface IKeyboardProviderProps
 */
interface IKeyboardProviderProps {
  /** Child components that will have access to the keyboard context */
  children: ReactNode
}

/**
 * Provider component that tracks and shares keyboard state
 * @component
 * @param {IKeyboardProviderProps} props - Component props
 * @returns {JSX.Element} Provider wrapped around children
 */
export function KeyboardProvider({ children }: IKeyboardProviderProps) {
  const [keyboardState, setKeyboardState] = useState<IKeyboardState>(defaultKeyboardState)

  /**
   * Check if the keyboard state has changed
   * Only update the keyboard state if the state has changed
   * This is to prevent unnecessary re-renders
   * @param {KeyboardEvent} e - Keyboard event
   * @returns {boolean} True if the keyboard state has changed, false otherwise
   */
  const isChangeKeyboardState = useCallback(
    (e: KeyboardEvent, isSpacePressed: boolean) => {
      return !isEqual(keyboardState, {
        ...keyboardState,
        isAltPressed: e.altKey,
        isCtrlPressed: e.ctrlKey || e.metaKey,
        isShiftPressed: e.shiftKey,
        isSpacePressed,
      })
    },
    [keyboardState]
  )

  /**
   * Check if the focus is on an input or textarea
   * and disable the keyboard event state to prevent re-render when typing
   * @param {KeyboardEvent} e - Keyboard event
   * @returns {boolean} True if the focus is on an input or textarea, false otherwise
   */
  const isFocusOnInput = useCallback((e: KeyboardEvent) => {
    return e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
  }, [])

  /**
   * Check if the keyboard state should be evaluated
   * @param {KeyboardEvent} e - Keyboard event
   * @returns {boolean} True if the keyboard state should be evaluated, false otherwise
   */
  const shouldEvaluateKeyboardState = useCallback(
    (e: KeyboardEvent, isSpacePressed: boolean) => {
      const isChange = isChangeKeyboardState(e, isSpacePressed)
      const isFocusOnInputField = isFocusOnInput(e)

      return isChange && !isFocusOnInputField
    },
    [isFocusOnInput, isChangeKeyboardState]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isSpacePressed = e.key === ' '

      // Compare the current state with the previous state
      const shouldEvaluate = shouldEvaluateKeyboardState(e, isSpacePressed)

      if (!shouldEvaluate) return

      setKeyboardState(pre => ({
        ...pre,
        isAltPressed: e.altKey,
        isCtrlPressed: e.ctrlKey || e.metaKey,
        isShiftPressed: e.shiftKey,
        isSpacePressed,
      }))

      // Prevent default browser behavior for Alt key
      if (e.key === 'Alt') {
        e.preventDefault()
      }
    },
    [shouldEvaluateKeyboardState]
  )

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      const isSpacePressed = false
      // Compare the current state with the previous state
      const shouldEvaluate = shouldEvaluateKeyboardState(e, isSpacePressed)

      if (!shouldEvaluate) return

      setKeyboardState(prev => ({
        ...prev,
        isAltPressed: e.altKey,
        isCtrlPressed: e.ctrlKey || e.metaKey,
        isShiftPressed: e.shiftKey,
        isSpacePressed,
      }))
    },
    [shouldEvaluateKeyboardState]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [handleKeyDown, handleKeyUp])

  return <KeyboardContext.Provider value={keyboardState}>{children}</KeyboardContext.Provider>
}

/**
 * Custom hook to access keyboard state
 * @returns {IKeyboardState} Current keyboard state
 * @throws {Error} If used outside of KeyboardProvider
 */
export function useKeyboardState() {
  const context = useContext(KeyboardContext)
  if (context === undefined) {
    throw new Error('useKeyboardState must be used within a KeyboardProvider')
  }
  return context
}
