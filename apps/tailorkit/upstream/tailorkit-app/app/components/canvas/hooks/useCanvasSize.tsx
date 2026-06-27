import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { useEffect, useRef, useState } from 'react'
import { CHAT_BOX_ANIMATION_DURATION } from '~/components/AIChat/constants'
import { CANVAS_TRANSMISSION_EVENTS } from '~/components/canvas/constants'
import { useChatBot } from '~/providers/ChatBotContext'
import type { Dimension } from '~/types/template'
import useCanvasDimension from '~/utils/hooks/useCanvasDimension'

/**
 * @description Get the size of the canvas using ResizeObserver to watch the container directly
 * @param {string} id - The id of the canvas container element
 * @param {Object} dimensions - Fallback dimensions for the canvas
 * @returns {Object} The current dimensions of the canvas container
 */
export function useCanvasSize(id: string, dimensions?: Dimension): Dimension {
  const { isOpen } = useChatBot()
  const { widthByPixels, heightByPixels } = useCanvasDimension()

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const [dimension, setDimension] = useState({ width: 0, height: 0 })

  useEffect(() => {
    function updateDimension() {
      const canvasContainer = document.getElementById(id)
      const newWidth = canvasContainer?.clientWidth || dimensions?.width || 0
      const newHeight = canvasContainer?.clientHeight || dimensions?.height || 0

      setDimension(prev => {
        if (prev.width === newWidth && prev.height === newHeight) return prev
        return { width: newWidth, height: newHeight }
      })
    }

    // Set up ResizeObserver to watch canvas container
    function setupResizeObserver() {
      const canvasContainer = document.getElementById(id)

      if (canvasContainer && window.ResizeObserver) {
        resizeObserverRef.current = new ResizeObserver(entries => {
          // Use requestAnimationFrame to avoid ResizeObserver loop limit exceeded error
          requestAnimationFrame(() => {
            for (const entry of entries) {
              const { width, height } = entry.contentRect
              const newWidth = width || dimensions?.width || 0
              const newHeight = height || dimensions?.height || 0
              setDimension(prev => {
                if (prev.width === newWidth && prev.height === newHeight) return prev
                return { width: newWidth, height: newHeight }
              })
            }
          })
        })

        resizeObserverRef.current.observe(canvasContainer)
      }
    }

    // Listen to transmission events for manual updates
    Transmitter.listen(CANVAS_TRANSMISSION_EVENTS.UPDATE_CANVAS_DIMENSION, updateDimension)

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Wait for chat box animation to complete, then set up observer
    timeoutRef.current = setTimeout(() => {
      updateDimension()
      setupResizeObserver()
    }, CHAT_BOX_ANIMATION_DURATION)

    return () => {
      // Clean up timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Clean up ResizeObserver
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }

      // Clean up transmission event listener
      Transmitter.remove(CANVAS_TRANSMISSION_EVENTS.UPDATE_CANVAS_DIMENSION, updateDimension)
    }
  }, [id, isOpen, widthByPixels, heightByPixels, dimensions])

  return dimension
}
