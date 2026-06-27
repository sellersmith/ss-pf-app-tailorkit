import { useCallback, useRef } from 'react'

interface CanvasConfig {
  useDevicePixelRatio?: boolean
  maxCanvasSize?: number
}

interface UseCanvasOperationsReturn {
  getOrCreateCanvas: (
    canvasRef: React.MutableRefObject<HTMLCanvasElement | null>,
    width: number,
    height: number
  ) => HTMLCanvasElement | null
  getOrCreateHDPICanvas: (
    canvasRef: React.MutableRefObject<HTMLCanvasElement | null>,
    width: number,
    height: number
  ) => HTMLCanvasElement | null
  getReusableTempCanvas: (width: number, height: number) => HTMLCanvasElement
  clearCanvas: (canvas: HTMLCanvasElement) => void
  cleanup: () => void
}

/**
 * Custom hook for optimized canvas operations and management
 * Provides reusable canvas instances and HDPI support
 */
export function useCanvasOperations(config: CanvasConfig = {}): UseCanvasOperationsReturn {
  const { useDevicePixelRatio = true, maxCanvasSize = 32767 } = config
  const devicePixelRatio = useDevicePixelRatio ? window.devicePixelRatio || 1 : 1

  // Reusable temporary canvas to avoid repeated creation
  const reusableTempCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const canvasPoolRef = useRef<HTMLCanvasElement[]>([])

  /**
   * Gets or creates a reusable canvas with specified dimensions
   */
  const getOrCreateCanvas = useCallback(
    (
      canvasRef: React.MutableRefObject<HTMLCanvasElement | null>,
      width: number,
      height: number
    ): HTMLCanvasElement | null => {
      // Input validation
      if (width <= 0 || height <= 0) {
        console.warn('Invalid canvas dimensions:', { width, height })
        return null
      }

      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas')
      }

      const canvas = canvasRef.current
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height

        // Clear canvas when dimensions change
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, width, height)
        }
      }

      return canvas
    },
    []
  )

  /**
   * Gets or creates a high-DPI canvas with specified dimensions
   */
  const getOrCreateHDPICanvas = useCallback(
    (
      canvasRef: React.MutableRefObject<HTMLCanvasElement | null>,
      width: number,
      height: number
    ): HTMLCanvasElement | null => {
      // Input validation
      if (width <= 0 || height <= 0) {
        console.warn('Invalid canvas dimensions:', { width, height })
        return null
      }

      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas')
      }

      const canvas = canvasRef.current
      const scaledWidth = width * devicePixelRatio
      const scaledHeight = height * devicePixelRatio

      // Validate scaled dimensions don't exceed browser limits
      if (scaledWidth > maxCanvasSize || scaledHeight > maxCanvasSize) {
        console.warn('Canvas dimensions exceed browser limits:', { scaledWidth, scaledHeight })
        // Fallback to unscaled canvas
        canvas.width = width
        canvas.height = height
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
        return canvas
      }

      // Update canvas dimensions if changed
      if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
        canvas.width = scaledWidth
        canvas.height = scaledHeight

        // Scale the canvas CSS size to maintain original display dimensions
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`

        // Scale the drawing context to match device pixel ratio
        const ctx = canvas.getContext('2d')
        if (ctx) {
          // Reset transform first to avoid compounding scales
          ctx.resetTransform()
          ctx.scale(devicePixelRatio, devicePixelRatio)
          ctx.clearRect(0, 0, width, height)
        }
      }

      return canvas
    },
    [devicePixelRatio, maxCanvasSize]
  )

  /**
   * Get a reusable temporary canvas for short-lived operations
   */
  const getReusableTempCanvas = useCallback((width: number, height: number): HTMLCanvasElement => {
    if (!reusableTempCanvasRef.current) {
      reusableTempCanvasRef.current = document.createElement('canvas')
    }

    const canvas = reusableTempCanvasRef.current
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    return canvas
  }, [])

  /**
   * Clear a canvas efficiently
   */
  const clearCanvas = useCallback((canvas: HTMLCanvasElement): void => {
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [])

  /**
   * Cleanup all canvas resources
   */
  const cleanup = useCallback((): void => {
    // Clear reusable temp canvas
    if (reusableTempCanvasRef.current) {
      clearCanvas(reusableTempCanvasRef.current)
      reusableTempCanvasRef.current = null
    }

    // Clear canvas pool
    canvasPoolRef.current.forEach(canvas => clearCanvas(canvas))
    canvasPoolRef.current = []
  }, [clearCanvas])

  return {
    getOrCreateCanvas,
    getOrCreateHDPICanvas,
    getReusableTempCanvas,
    clearCanvas,
    cleanup,
  }
}
