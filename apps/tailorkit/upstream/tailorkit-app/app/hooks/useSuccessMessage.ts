import { useLayoutEffect, useRef } from 'react'

// Note: DEFAULT_SUCCESS_MESSAGE removed - now using persistent AI messages

/**
 * Custom hook to handle auto-opening chat bot
 * Detects 'showSuccessMessage' URL parameter and opens chat bot once
 * Note: Temporary message creation removed in favor of persistent AI messages
 */
export function useSuccessMessage() {
  // Disable auto-open via URL param. Keep hook for API compatibility.
  const successMessageProcessed = useRef(false)

  useLayoutEffect(() => {
    // no-op: do not auto-open AI chat based on URL params
    successMessageProcessed.current = true
  }, [])

  return {
    isProcessed: successMessageProcessed.current,
  }
}
