/**
 * Magic Wand selection tool for MockupWizard.
 *
 * Uses OpenCV.js (running in a Web Worker) flood fill + contour detection
 * to convert a single tap into a vector path (VectorShape).
 *
 * Two modes: 'add' expands the selection, 'remove' subtracts from it.
 * All OpenCV operations happen off the main thread — no UI freezing.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type { PathCommand } from '~/modules/VectorEditor/utils/svg'
import type { VectorShape } from '../types'
import { computePathBoundingBox, serializePathCommandsToD } from '../utils/vectorPathUtils'
import { loadOpenCV, getOpenCVState, detectRegion } from '../utils/opencvLoader'
import { MAGIC_WAND_CONSTANTS } from '../constants'

interface UseMagicWandToolOptions {
  /** Whether the magic wand tool is currently active */
  isActive: boolean
  /** The full-size HTMLImageElement loaded on the canvas */
  image: HTMLImageElement | null
  /** Transform canvas pixel coords to image coords */
  transformCanvasToImage: (x: number, y: number) => { x: number; y: number }
  /** Callback when a vector shape is produced */
  onShapeComplete: (shape: VectorShape) => void
}

export function useMagicWandTool({
  isActive,
  image,
  transformCanvasToImage,
  onShapeComplete,
}: UseMagicWandToolOptions) {
  const [tolerance, setTolerance] = useState<number>(MAGIC_WAND_CONSTANTS.DEFAULT_TOLERANCE)
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [cvReady, setCvReady] = useState(getOpenCVState().state === 'ready')
  const [error, setError] = useState<string | null>(null)

  // Store last tap point for re-running on tolerance change
  const lastTapRef = useRef<{ imageX: number; imageY: number } | null>(null)
  // Debounce timer for tolerance slider
  const toleranceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Overlay data for visual preview
  const [overlayPath, setOverlayPath] = useState<PathCommand[] | null>(null)

  // Ensure OpenCV worker is ready when tool first becomes active
  useEffect(() => {
    if (!isActive) return
    if (getOpenCVState().state === 'ready') {
      setCvReady(true)
      return
    }

    setIsLoading(true)
    setError(null)
    loadOpenCV()
      .then(() => {
        setCvReady(true)
        setIsLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setIsLoading(false)
      })
  }, [isActive])

  // Clear overlay when tool deactivates
  useEffect(() => {
    if (!isActive) {
      setOverlayPath(null)
      lastTapRef.current = null
      // reset state
    }
  }, [isActive])

  /**
   * Run async detection at given image coordinates and tolerance.
   * @param additive — when true, merge the new region with the existing overlay
   */
  const runDetection = useCallback(
    async (imageX: number, imageY: number, tol: number, additive = false) => {
      if (!image) return
      setIsProcessing(true)
      try {
        const commands = await detectRegion(image, imageX, imageY, tol)
        if (additive && commands) {
          setOverlayPath(prev => (prev ? [...prev, ...commands] : commands))
        } else {
          setOverlayPath(commands)
        }
      } catch {
        if (!additive) setOverlayPath(null)
      } finally {
        setIsProcessing(false)
      }
    },
    [image]
  )

  /**
   * Handle a tap/click on the canvas when magic wand is active.
   * Each tap replaces the overlay with the new detected region.
   */
  const handleTap = useCallback(
    (canvasX: number, canvasY: number) => {
      if (!isActive || !cvReady || !image) return

      const { x: imgX, y: imgY } = transformCanvasToImage(canvasX, canvasY)
      lastTapRef.current = { imageX: imgX, imageY: imgY }

      runDetection(imgX, imgY, tolerance, false)
    },
    [isActive, cvReady, image, transformCanvasToImage, runDetection, tolerance]
  )

  /**
   * Confirm the current overlay selection — create a VectorShape.
   */
  const confirmSelection = useCallback(() => {
    if (!overlayPath || overlayPath.length < 3) return

    const bbox = computePathBoundingBox(overlayPath)
    const pathD = serializePathCommandsToD(overlayPath)

    const vectorShape: VectorShape = {
      type: 'vector',
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
      pathCommands: overlayPath,
      pathD,
      source: 'manual',
    }

    onShapeComplete(vectorShape)
    setOverlayPath(null)
    lastTapRef.current = null
  }, [overlayPath, onShapeComplete])

  /**
   * Cancel / discard the current overlay.
   */
  const cancelSelection = useCallback(() => {
    setOverlayPath(null)
    lastTapRef.current = null
  }, [])

  /**
   * Update tolerance and re-run detection at the last tap point (debounced).
   */
  const updateTolerance = useCallback(
    (newTolerance: number) => {
      setTolerance(newTolerance)

      if (toleranceTimerRef.current) {
        clearTimeout(toleranceTimerRef.current)
      }

      toleranceTimerRef.current = setTimeout(() => {
        const tap = lastTapRef.current
        if (!tap || !cvReady || !image) return
        runDetection(tap.imageX, tap.imageY, newTolerance)
      }, MAGIC_WAND_CONSTANTS.TOLERANCE_DEBOUNCE_MS)
    },
    [cvReady, image, runDetection]
  )

  /**
   * Render the magic wand overlay on the canvas.
   */
  const renderOverlay = useCallback(
    (ctx: CanvasRenderingContext2D, transformImageToCanvas: (x: number, y: number) => { x: number; y: number }) => {
      if (!overlayPath || overlayPath.length < 3) return

      ctx.beginPath()
      for (const cmd of overlayPath) {
        const p = transformImageToCanvas(cmd.x, cmd.y)
        if (cmd.type === 'M') {
          ctx.moveTo(p.x, p.y)
        } else if (cmd.type === 'L') {
          ctx.lineTo(p.x, p.y)
        } else if (cmd.type === 'C' && cmd.cp1 && cmd.cp2) {
          const c1 = transformImageToCanvas(cmd.cp1.x, cmd.cp1.y)
          const c2 = transformImageToCanvas(cmd.cp2.x, cmd.cp2.y)
          ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p.x, p.y)
        } else if (cmd.type === 'Z') {
          ctx.closePath()
        }
      }

      ctx.fillStyle = MAGIC_WAND_CONSTANTS.OVERLAY_FILL
      ctx.fill()

      ctx.strokeStyle = MAGIC_WAND_CONSTANTS.OVERLAY_STROKE
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.stroke()
      ctx.setLineDash([])
    },
    [overlayPath]
  )

  return {
    isLoading,
    isProcessing,
    cvReady,
    error,
    tolerance,
    hasOverlay: overlayPath !== null,
    overlayPath,
    handleTap,
    confirmSelection,
    cancelSelection,
    updateTolerance,

    renderOverlay,
  }
}
