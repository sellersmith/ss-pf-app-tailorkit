import { useCallback, useMemo, useRef, useState } from 'react'
import type { MentionContext } from './types'

/**
 * Headless manager for mention trigger detection and caret handling.
 */
export function useMentionManager(options?: {
  triggers?: string[]
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const triggers = useMemo(() => options?.triggers ?? ['@'], [options?.triggers])

  const containerRef = useRef<HTMLDivElement | null>(null)
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isControlled = typeof options?.isOpen === 'boolean'
  const isOpen = isControlled ? Boolean(options?.isOpen) : uncontrolledOpen
  const activeTriggerRef = useRef<string | null>(null)
  const contextRef = useRef<MentionContext | null>(null)
  const savedCursorPosition = useRef<number>(0)
  const lastInputTimestamp = useRef<number>(0)

  const setOpen = useCallback(
    (next: boolean) => {
      if (isControlled) {
        options?.onOpenChange?.(next)
      } else {
        setUncontrolledOpen(next)
      }
    },
    [isControlled, options]
  )

  const saveCursor = useCallback((valueLength: number) => {
    const textarea = containerRef.current?.querySelector('textarea')
    if (textarea) {
      savedCursorPosition.current = textarea.selectionStart ?? valueLength
    }
  }, [])

  const setNextCursorPosition = useCallback((position: number) => {
    savedCursorPosition.current = Math.max(0, position)
  }, [])

  const restoreCursor = useCallback(() => {
    const textarea = containerRef.current?.querySelector('textarea')
    if (textarea) {
      const position = savedCursorPosition.current
      textarea.setSelectionRange(position, position)
      textarea.focus()
    }
  }, [])

  const parseContext = useCallback(
    (value: string, caretIndex: number): MentionContext | null => {
      if (caretIndex < 0 || caretIndex > value.length) return null
      // Find the nearest trigger to the left of caret
      let nearestIndex = -1
      let matchedTrigger: string | null = null
      for (const trigger of triggers) {
        const idx = value.lastIndexOf(trigger, caretIndex - 1)
        if (idx !== -1 && idx > nearestIndex) {
          nearestIndex = idx
          matchedTrigger = trigger
        }
      }
      if (nearestIndex === -1 || !matchedTrigger) return null

      // Ensure there's no whitespace/newline between trigger and caret
      const slice = value.slice(nearestIndex + matchedTrigger.length, caretIndex)
      if (/\s/.test(slice)) return null

      return {
        trigger: matchedTrigger,
        query: slice,
        caretIndex,
        triggerIndex: nearestIndex,
      }
    },
    [triggers]
  )

  const getTextareaCaret = useCallback((): number | null => {
    const textarea = containerRef.current?.querySelector('textarea')
    if (!textarea) return null
    return textarea.selectionStart ?? null
  }, [])

  const onChangeWrapper = useCallback(
    (value: string, originalOnChange: (v: string) => void) => {
      originalOnChange(value)
      lastInputTimestamp.current = Date.now()
      const caret = getTextareaCaret()
      if (caret === null) return
      const parsed = parseContext(value, caret)
      if (parsed) {
        activeTriggerRef.current = parsed.trigger
        contextRef.current = parsed
        setOpen(true)
      } else if (activeTriggerRef.current) {
        // Close if previously open due to trigger typing
        setOpen(false)
        activeTriggerRef.current = null
        contextRef.current = null
      }
    },
    [getTextareaCaret, parseContext, setOpen]
  )

  const cleanup = useCallback((value: string): string => {
    const ctx = contextRef.current
    if (!ctx) return value
    const { triggerIndex, caretIndex } = ctx
    const after = value.slice(caretIndex)
    const before = value.slice(0, triggerIndex)
    return `${before}${after}`
  }, [])

  const getContext = useCallback(() => contextRef.current, [])

  const open = useCallback(() => {
    setOpen(true)
  }, [setOpen])

  const close = useCallback(() => {
    setOpen(false)
    activeTriggerRef.current = null
    contextRef.current = null
  }, [setOpen])

  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node
  }, [])

  const getActivatorProps = useCallback(
    (style?: React.CSSProperties) => ({
      ref: setContainerRef,
      style,
    }),
    [setContainerRef]
  )

  return {
    // state
    isOpen,
    activeTrigger: activeTriggerRef.current,
    context: contextRef.current,
    // actions
    open,
    close,
    saveCursor,
    setNextCursorPosition,
    restoreCursor,
    onChangeWrapper,
    cleanup,
    getContext,
    getActivatorProps,
  }
}

export type UseMentionManagerReturn = ReturnType<typeof useMentionManager>
