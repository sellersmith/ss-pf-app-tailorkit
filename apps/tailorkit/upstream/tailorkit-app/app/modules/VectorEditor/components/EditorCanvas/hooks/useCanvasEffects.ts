/**
 * Canvas Effects Hook
 * Handles resize observer, RAF cleanup, and key state tracking
 */

import { useEffect, useState, useRef } from 'react'

export interface CanvasSize {
  width: number
  height: number
}

export interface UseCanvasEffectsProps {
  containerRef: React.RefObject<HTMLDivElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  interactionCanvasRef: React.RefObject<HTMLCanvasElement | null>
  editorMode: 'select' | 'edit' | 'draw'
  selectedPathIndex: number | null
}

export interface UseCanvasEffectsReturn {
  canvasSize: CanvasSize
  dprRef: React.RefObject<number>
  isAltKeyPressed: boolean
  isShiftKeyPressed: boolean
  hasInteracted: boolean
  setHasInteracted: (value: boolean) => void
  rafIdRef: React.RefObject<number | null>
  needsRenderRef: React.RefObject<boolean>
}

export function useCanvasEffects({
  containerRef,
  canvasRef,
  interactionCanvasRef,
  editorMode,
  selectedPathIndex,
}: UseCanvasEffectsProps): UseCanvasEffectsReturn {
  // Canvas size state
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 800, height: 600 })

  // Device pixel ratio for HiDPI/retina display support
  const dprRef = useRef(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)

  // RAF batching for smooth rendering
  const rafIdRef = useRef<number | null>(null)
  const needsRenderRef = useRef(false)

  // Mobile hint state - tracks if user has interacted to auto-hide hints
  const [hasInteracted, setHasInteracted] = useState(false)

  // Key state for node insertion (Option/Alt key)
  const [isAltKeyPressed, setIsAltKeyPressed] = useState(false)

  // Key state for additive selection (Shift key)
  const [isShiftKeyPressed, setIsShiftKeyPressed] = useState(false)

  // Resize observer with HiDPI support
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width
        const newHeight = entry.contentRect.height
        setCanvasSize({
          width: newWidth,
          height: newHeight,
        })

        // Update canvas buffer sizes for HiDPI displays
        const dpr = window.devicePixelRatio || 1
        dprRef.current = dpr

        // Update background canvas
        const canvas = canvasRef.current
        if (canvas) {
          canvas.width = newWidth * dpr
          canvas.height = newHeight * dpr
        }

        // Update interaction canvas
        const interactionCanvas = interactionCanvasRef.current
        if (interactionCanvas) {
          interactionCanvas.width = newWidth * dpr
          interactionCanvas.height = newHeight * dpr
        }
        // Note: CSS size is set via className, not style
      }
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [containerRef, canvasRef, interactionCanvasRef])

  // Cleanup RAF on unmount
  useEffect(() => {
    const currentRafId = rafIdRef.current
    return () => {
      if (currentRafId) {
        cancelAnimationFrame(currentRafId)
      }
    }
  }, [])

  // Track Alt/Option key for node insertion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        setIsAltKeyPressed(true)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey) {
        setIsAltKeyPressed(false)
      }
    }

    const handleBlur = () => {
      setIsAltKeyPressed(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  // Track Shift key for additive selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey) {
        setIsShiftKeyPressed(true)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.shiftKey) {
        setIsShiftKeyPressed(false)
      }
    }

    const handleBlur = () => {
      setIsShiftKeyPressed(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  // Reset hasInteracted when editor mode changes
  useEffect(() => {
    setHasInteracted(false)
  }, [editorMode])

  // Add wheel event listener to prevent browser zoom
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const wheelHandler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
      }
    }

    canvas.addEventListener('wheel', wheelHandler, { passive: false })

    return () => {
      canvas.removeEventListener('wheel', wheelHandler)
    }
  }, [canvasRef])

  return {
    canvasSize,
    dprRef,
    isAltKeyPressed,
    isShiftKeyPressed,
    hasInteracted,
    setHasInteracted,
    rafIdRef,
    needsRenderRef,
  }
}
