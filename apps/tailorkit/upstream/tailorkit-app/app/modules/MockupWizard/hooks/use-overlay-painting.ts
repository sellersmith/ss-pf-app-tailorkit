/**
 * useOverlayPainting — shared bitmap overlay painting hook.
 *
 * Provides freehand brush + eraser painting on an offscreen canvas at image resolution.
 * Used by: paint tool (standalone), auto-detect refinement, magic wand refinement.
 *
 * Data flow:
 *   User drags → drawStroke on offscreen canvas → renderOverlay on display canvas
 *   Confirm → extract mask → contourFromMask (OpenCV worker) → PathCommand[]
 */

import { useState, useCallback, useRef, useEffect, type Dispatch, type SetStateAction } from 'react'
import type { PathCommand } from '~/modules/VectorEditor/utils/svg'
import { loadOpenCV, contourFromMask } from '../utils/opencvLoader'
import { PAINT_CONSTANTS } from '../constants'

export interface UseOverlayPaintingOptions {
  imageWidth: number
  imageHeight: number
  isActive: boolean
  transformCanvasToImage: (cx: number, cy: number) => { x: number; y: number }
}

export interface UseOverlayPaintingReturn {
  mode: 'brush' | 'eraser'
  setMode: (m: 'brush' | 'eraser') => void
  brushSize: number
  setBrushSize: Dispatch<SetStateAction<number>>
  hasOverlay: boolean
  isPainting: boolean
  strokeVersion: number

  handlePointerDown: (canvasX: number, canvasY: number) => void
  handlePointerMove: (canvasX: number, canvasY: number) => void
  handlePointerUp: () => void

  renderOverlay: (ctx: CanvasRenderingContext2D, viewport: { scale: number; left: number; top: number }) => void
  renderCursor: (ctx: CanvasRenderingContext2D, canvasX: number, canvasY: number, viewport: { scale: number }) => void

  confirmAsVectorPath: () => Promise<PathCommand[] | null>
  clear: () => void
  loadMask: (maskData: Uint8ClampedArray, width: number, height: number) => void
  loadOverlayPath: (commands: PathCommand[]) => void
  exportMask: () => Uint8ClampedArray | null
}

export function useOverlayPainting({
  imageWidth,
  imageHeight,
  isActive,
  transformCanvasToImage,
}: UseOverlayPaintingOptions): UseOverlayPaintingReturn {
  const [mode, setMode] = useState<'brush' | 'eraser'>('brush')
  const [brushSize, setBrushSize] = useState<number>(PAINT_CONSTANTS.DEFAULT_BRUSH_SIZE)
  const [hasOverlay, setHasOverlay] = useState(false)
  const [isPainting, setIsPainting] = useState(false)
  /** Increments on every stroke to trigger canvas redraw */
  const [strokeVersion, setStrokeVersion] = useState(0)

  const offscreenRef = useRef<HTMLCanvasElement | null>(null)
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)
  const transformRef = useRef(transformCanvasToImage)
  transformRef.current = transformCanvasToImage

  // Create offscreen canvas when active with valid dimensions
  useEffect(() => {
    if (!isActive || !imageWidth || !imageHeight) {
      offscreenRef.current = null
      tempCanvasRef.current = null
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = imageWidth
    canvas.height = imageHeight
    offscreenRef.current = canvas

    const temp = document.createElement('canvas')
    temp.width = imageWidth
    temp.height = imageHeight
    tempCanvasRef.current = temp

    return () => {
      offscreenRef.current = null
      tempCanvasRef.current = null
    }
  }, [isActive, imageWidth, imageHeight])

  // Reset state when deactivated
  useEffect(() => {
    if (!isActive) {
      setHasOverlay(false)
      setIsPainting(false)
      lastPosRef.current = null
    }
  }, [isActive])

  /** Check if offscreen canvas has any non-transparent pixels (deferred to avoid blocking UI) */
  const checkHasPixels = useCallback(() => {
    requestIdleCallback(() => {
      const canvas = offscreenRef.current
      if (!canvas) {
        setHasOverlay(false)
        return
      }
      const ctx = canvas.getContext('2d')!
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) {
          setHasOverlay(true)
          return
        }
      }
      setHasOverlay(false)
    })
  }, [])

  /** Draw a brush stroke between two image-space points */
  const drawStroke = useCallback(
    (fromX: number, fromY: number, toX: number, toY: number) => {
      const ctx = offscreenRef.current?.getContext('2d')
      if (!ctx) return

      if (mode === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out'
      } else {
        ctx.globalCompositeOperation = 'source-over'
      }

      const r = brushSize / 2
      // Draw filled circle at endpoint
      ctx.beginPath()
      ctx.arc(toX, toY, r, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 255, 255, 1)'
      ctx.fill()

      // Connect from→to with a rounded line
      ctx.lineWidth = brushSize
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = 'rgba(255, 255, 255, 1)'
      ctx.beginPath()
      ctx.moveTo(fromX, fromY)
      ctx.lineTo(toX, toY)
      ctx.stroke()

      ctx.globalCompositeOperation = 'source-over'
      if (mode === 'brush') setHasOverlay(true)
    },
    [mode, brushSize]
  )

  const handlePointerDown = useCallback(
    (canvasX: number, canvasY: number) => {
      const { x, y } = transformRef.current(canvasX, canvasY)
      lastPosRef.current = { x, y }
      setIsPainting(true)

      // Draw initial dot
      const ctx = offscreenRef.current?.getContext('2d')
      if (!ctx) return
      if (mode === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out'
      } else {
        ctx.globalCompositeOperation = 'source-over'
      }
      ctx.beginPath()
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 255, 255, 1)'
      ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
      if (mode === 'brush') setHasOverlay(true)
    },
    [mode, brushSize]
  )

  const handlePointerMove = useCallback(
    (canvasX: number, canvasY: number) => {
      if (!isPainting || !lastPosRef.current) return
      const { x, y } = transformRef.current(canvasX, canvasY)
      drawStroke(lastPosRef.current.x, lastPosRef.current.y, x, y)
      lastPosRef.current = { x, y }
      setStrokeVersion(v => v + 1)
    },
    [isPainting, drawStroke]
  )

  const handlePointerUp = useCallback(() => {
    setIsPainting(false)
    lastPosRef.current = null
    if (mode === 'eraser') checkHasPixels()
  }, [mode, checkHasPixels])

  /** Render colored overlay onto display canvas */
  const renderOverlay = useCallback(
    (ctx: CanvasRenderingContext2D, viewport: { scale: number; left: number; top: number }) => {
      const offscreen = offscreenRef.current
      const temp = tempCanvasRef.current
      if (!offscreen || !temp) return

      const tempCtx = temp.getContext('2d')!
      tempCtx.clearRect(0, 0, temp.width, temp.height)

      // Fill with overlay color
      tempCtx.fillStyle = PAINT_CONSTANTS.OVERLAY_FILL
      tempCtx.fillRect(0, 0, temp.width, temp.height)

      // Mask: only show color where painted (white pixels)
      tempCtx.globalCompositeOperation = 'destination-in'
      tempCtx.drawImage(offscreen, 0, 0)
      tempCtx.globalCompositeOperation = 'source-over'

      ctx.drawImage(temp, viewport.left, viewport.top, temp.width * viewport.scale, temp.height * viewport.scale)
    },
    []
  )

  /** Render brush cursor preview */
  const renderCursor = useCallback(
    (ctx: CanvasRenderingContext2D, canvasX: number, canvasY: number, viewport: { scale: number }) => {
      const displayRadius = (brushSize / 2) * viewport.scale
      ctx.beginPath()
      ctx.arc(canvasX, canvasY, displayRadius, 0, Math.PI * 2)
      ctx.strokeStyle = mode === 'eraser' ? PAINT_CONSTANTS.CURSOR_ERASER_STROKE : PAINT_CONSTANTS.CURSOR_STROKE
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 3])
      ctx.stroke()
      ctx.setLineDash([])
    },
    [brushSize, mode]
  )

  /** Convert painted bitmap to vector path via OpenCV contour detection */
  const confirmAsVectorPath = useCallback(async (): Promise<PathCommand[] | null> => {
    const offscreen = offscreenRef.current
    if (!offscreen) return null

    // Ensure OpenCV is loaded
    await loadOpenCV()

    const ctx = offscreen.getContext('2d')!
    const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height)

    // Convert to single-channel mask (non-zero alpha = filled)
    const mask = new Uint8ClampedArray(offscreen.width * offscreen.height)
    for (let i = 0; i < mask.length; i++) {
      mask[i] = imageData.data[i * 4 + 3] > 0 ? 255 : 0
    }

    return contourFromMask(mask, offscreen.width, offscreen.height)
  }, [])

  /** Clear all painted data */
  const clear = useCallback(() => {
    const ctx = offscreenRef.current?.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    setHasOverlay(false)
    lastPosRef.current = null
  }, [])

  /** Load external mask data (for initializing from auto-detect/magic-wand overlay) */
  const loadMask = useCallback((maskData: Uint8ClampedArray, width: number, height: number) => {
    const canvas = offscreenRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Create RGBA ImageData from single-channel mask
    const rgba = new ImageData(width, height)
    for (let i = 0; i < maskData.length; i++) {
      if (maskData[i] > 0) {
        rgba.data[i * 4] = 255 // R
        rgba.data[i * 4 + 1] = 255 // G
        rgba.data[i * 4 + 2] = 255 // B
        rgba.data[i * 4 + 3] = 255 // A
      }
    }
    ctx.putImageData(rgba, 0, 0)
    setHasOverlay(true)
  }, [])

  /** Load overlay from PathCommand[] (rasterize vector overlay onto bitmap) */
  const loadOverlayPath = useCallback((commands: PathCommand[]) => {
    const canvas = offscreenRef.current
    if (!canvas || commands.length < 3) return
    const ctx = canvas.getContext('2d')!

    ctx.beginPath()
    for (const cmd of commands) {
      if (cmd.type === 'M') ctx.moveTo(cmd.x, cmd.y)
      else if (cmd.type === 'L') ctx.lineTo(cmd.x, cmd.y)
      else if (cmd.type === 'C' && cmd.cp1 && cmd.cp2) {
        ctx.bezierCurveTo(cmd.cp1.x, cmd.cp1.y, cmd.cp2.x, cmd.cp2.y, cmd.x, cmd.y)
      } else if (cmd.type === 'Z') ctx.closePath()
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 1)'
    ctx.fill()
    setHasOverlay(true)
  }, [])

  /** Export current mask as single-channel data */
  const exportMask = useCallback((): Uint8ClampedArray | null => {
    const canvas = offscreenRef.current
    if (!canvas) return null
    const ctx = canvas.getContext('2d')!
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const mask = new Uint8ClampedArray(canvas.width * canvas.height)
    for (let i = 0; i < mask.length; i++) {
      mask[i] = imageData.data[i * 4 + 3] > 0 ? 255 : 0
    }
    return mask
  }, [])

  return {
    mode,
    setMode,
    brushSize,
    setBrushSize,
    hasOverlay,
    isPainting,
    /** Increments on every stroke — use as redraw dependency */
    strokeVersion,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    renderOverlay,
    renderCursor,
    confirmAsVectorPath,
    clear,
    loadMask,
    loadOverlayPath,
    exportMask,
  }
}
