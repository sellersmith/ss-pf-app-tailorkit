import { useEffect, useState } from 'react'

export interface ClipboardMeta {
  hasElements: boolean
  hasStyle: boolean
}

/**
 * Detects whether the user clipboard currently holds TailorKit elements or style JSON.
 * The detection runs only when `enabled` is `true` (e.g., context-menu is open).
 */
export function useClipboardMeta(enabled: boolean): ClipboardMeta {
  const [meta, setMeta] = useState<ClipboardMeta>({ hasElements: false, hasStyle: false })

  useEffect(() => {
    if (!enabled) return

    async function evaluateClipboard() {
      try {
        const text = await navigator.clipboard.readText()
        let hasElements = false
        let hasStyle = false

        try {
          const data = JSON.parse(text)
          if (Array.isArray(data) && data[0]?._id) {
            hasElements = true
          }
          if (!Array.isArray(data) && typeof data === 'object' && data.__tlkStyle__) {
            hasStyle = true
          }
        } catch (_) {
          // Not JSON – ignore
        }

        setMeta({ hasElements, hasStyle })
      } catch (_) {
        setMeta({ hasElements: false, hasStyle: false })
      }
    }

    evaluateClipboard()
  }, [enabled])

  return meta
}
