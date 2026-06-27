import { useCallback, useEffect, useState } from 'react'

interface UseResizablePaneOptions {
  /** Initial width in pixels */
  initialWidth: number
  /** Minimum width in pixels */
  minWidth: number
  /** Maximum width in pixels */
  maxWidth: number
  /** LocalStorage key to persist the width */
  storageKey?: string
}

interface UseResizablePaneReturn {
  /** Current width in pixels */
  width: number
  /** Handler for resize delta changes (called by ResizableDivider) */
  onResizeDelta: (deltaX: number) => void
  /** Set width directly */
  setWidth: (width: number) => void
  /** Reset to initial width */
  reset: () => void
}

/**
 * Custom hook for managing resizable pane state with persistence.
 *
 * This hook handles:
 * - Width state management with min/max constraints
 * - localStorage persistence (optional)
 * - Delta-based resize operations for use with ResizableDivider
 *
 * @example
 * ```tsx
 * const { width, onResizeDelta } = useResizablePane({
 *   initialWidth: 360,
 *   minWidth: 280,
 *   maxWidth: 480,
 *   storageKey: 'MY_PANEL_WIDTH'
 * })
 *
 * return (
 *   <div style={{ width: `${width}px` }}>
 *     <ResizableDivider onResize={onResizeDelta} />
 *     <PanelContent />
 *   </div>
 * )
 * ```
 */
export function useResizablePane({
  initialWidth,
  minWidth,
  maxWidth,
  storageKey,
}: UseResizablePaneOptions): UseResizablePaneReturn {
  const [width, setWidthState] = useState<number>(() => {
    if (!storageKey || typeof window === 'undefined') {
      return initialWidth
    }

    const saved = Number(localStorage.getItem(storageKey))
    return Number.isFinite(saved) && saved > 0 ? saved : initialWidth
  })

  // Persist width changes to localStorage
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, String(width))
    }
  }, [width, storageKey])

  const setWidth = useCallback(
    (newWidth: number) => {
      const clampedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth)
      setWidthState(clampedWidth)
    },
    [minWidth, maxWidth]
  )

  const onResizeDelta = useCallback(
    (deltaX: number) => {
      setWidthState(prev => {
        const newWidth = prev + deltaX
        return Math.min(Math.max(newWidth, minWidth), maxWidth)
      })
    },
    [minWidth, maxWidth]
  )

  const reset = useCallback(() => {
    setWidth(initialWidth)
  }, [initialWidth, setWidth])

  return {
    width,
    onResizeDelta,
    setWidth,
    reset,
  }
}
