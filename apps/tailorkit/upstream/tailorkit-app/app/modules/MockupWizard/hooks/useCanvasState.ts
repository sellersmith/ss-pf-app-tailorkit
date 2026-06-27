import { useState, useRef, useEffect, useCallback } from 'react'

/**
 * Hook for managing canvas state and image loading.
 * Drawing logic has been extracted to useShapeDrawingTool.
 */
export function useCanvasState(imageUrl: string, onError?: (error: string) => void) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const [imageLoaded, setImageLoaded] = useState(false)
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  /**
   * Get canvas context
   */
  const getCanvasContext = useCallback(() => {
    return canvasRef.current?.getContext('2d') || null
  }, [])

  /**
   * Get canvas coordinates from mouse event.
   * Scales from CSS pixel space to canvas internal pixel space to handle any
   * mismatch between the canvas display size and its internal resolution.
   */
  const getCanvasCoordinates = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return null

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = Math.round((event.clientX - rect.left) * scaleX)
    const y = Math.round((event.clientY - rect.top) * scaleY)

    return { x, y }
  }, [])

  /**
   * Load and render image to canvas
   */
  useEffect(() => {
    if (!imageUrl || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      setImage(img)
      setImageLoaded(true)
    }
    img.onerror = () => {
      onErrorRef.current?.('Failed to load image')
    }
    img.src = imageUrl

    return () => {
      img.src = ''
      img.onload = null
      img.onerror = null
      setImage(null)
    }
  }, [imageUrl])

  /**
   * Get image dimensions
   */
  const imageDimensions = image ? { width: image.width, height: image.height } : null

  return {
    // Refs
    canvasRef,
    containerRef,

    // State
    imageLoaded,
    image,
    imageDimensions,

    // Utilities
    getCanvasContext,
    getCanvasCoordinates,
  }
}
