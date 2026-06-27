/**
 * useAutoDetectTool — Auto-detect product boundary tool hook.
 *
 * Lifecycle: idle → downloading → initializing → inferring → contouring → preview → confirm/cancel
 *
 * Uses BiRefNet_lite (via autoDetectLoader) to segment the product image,
 * then converts the mask to a VectorShape via the opencv-worker contour extractor.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type { PathCommand } from '~/modules/VectorEditor/utils/svg'
import type { VectorShape } from '../types'
import { computePathBoundingBox, serializePathCommandsToD } from '../utils/vectorPathUtils'
import { loadModel, runInference, disposeModel, type ModelProgress } from '../utils/autoDetectLoader'
import { runServerInference } from '../utils/autoDetectServer'
import { loadOpenCV, contourFromMask } from '../utils/opencvLoader'
import { AUTO_DETECT_CONSTANTS } from '../constants'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AutoDetectPhase = 'idle' | 'downloading' | 'initializing' | 'inferring' | 'contouring' | 'preview' | 'error'

interface UseAutoDetectToolOptions {
  /** Whether auto-detect mode is currently active */
  isActive: boolean
  /** The loaded product image to run segmentation on */
  image: HTMLImageElement | null
  /** Transform image coords → canvas pixel coords (for overlay rendering) */
  transformImageToCanvas: (x: number, y: number) => { x: number; y: number }
  /** Callback when a detected shape is confirmed */
  onShapeComplete: (shape: VectorShape) => void
  /** When true, uses server-side background removal instead of client-side ONNX model */
  isMobileView?: boolean
}

interface UseAutoDetectToolReturn {
  phase: AutoDetectPhase
  progress: ModelProgress
  error: string | null
  hasPreview: boolean
  /** Alias for hasPreview — whether there is an overlay ready to confirm */
  hasOverlay: boolean
  overlayPath: PathCommand[] | null

  detect: () => void
  confirmSelection: () => void
  cancelSelection: () => void
  retry: () => void

  renderOverlay: (ctx: CanvasRenderingContext2D) => void
}

// ─── Default progress ─────────────────────────────────────────────────────────

const DEFAULT_PROGRESS: ModelProgress = { percent: 0, file: null, loaded: 0, total: 0 }

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAutoDetectTool({
  isActive,
  image,
  transformImageToCanvas,
  onShapeComplete,
  isMobileView = false,
}: UseAutoDetectToolOptions): UseAutoDetectToolReturn {
  const [phase, setPhase] = useState<AutoDetectPhase>('idle')
  const [progress, setProgress] = useState<ModelProgress>(DEFAULT_PROGRESS)
  const [error, setError] = useState<string | null>(null)
  const [overlayPath, setOverlayPath] = useState<PathCommand[] | null>(null)

  // Abort flag — set to true when tool deactivates mid-run
  const abortRef = useRef(false)

  // Stable refs so detect() doesn't go stale
  const imageRef = useRef(image)
  imageRef.current = image

  const transformRef = useRef(transformImageToCanvas)
  transformRef.current = transformImageToCanvas

  const onShapeCompleteRef = useRef(onShapeComplete)
  onShapeCompleteRef.current = onShapeComplete

  // ── Abort when tool deactivates ──────────────────────────────────────────
  useEffect(() => {
    if (!isActive) {
      abortRef.current = true
      setPhase('idle')
      setOverlayPath(null)
      setError(null)
      setProgress(DEFAULT_PROGRESS)
    } else {
      abortRef.current = false
    }
  }, [isActive])

  // ── Core detection pipeline ───────────────────────────────────────────────

  const detect = useCallback(async () => {
    const img = imageRef.current
    if (!img) {
      setPhase('error')
      setError('No product image loaded. Please select a product first.')
      return
    }
    // If already running, ignore the call silently
    if (phase !== 'idle' && phase !== 'error') return

    abortRef.current = false
    setError(null)
    setOverlayPath(null)

    try {
      // ── 1. Ensure opencv worker is ready (needed for contour step) ────────
      if (!abortRef.current) {
        setPhase('downloading')
        setProgress(DEFAULT_PROGRESS)
        await loadOpenCV()
      }
      if (abortRef.current) return

      // ── 2 & 3. Get segmentation mask ──────────────────────────────────────
      let inferResult
      if (isMobileView) {
        setPhase('inferring')
        inferResult = await runServerInference(img)
      } else {
        try {
          setPhase('initializing')
          const modelState = await loadModel({
            onProgress: p => {
              if (abortRef.current) return
              setPhase(prev => (prev === 'initializing' && p.percent > 0 ? 'downloading' : prev))
              setProgress(p)
            },
          })
          if (abortRef.current) return

          setPhase('inferring')
          const TIMEOUT_MS = AUTO_DETECT_CONSTANTS.INFERENCE_TIMEOUT_MS
          inferResult = await Promise.race([
            runInference(modelState, img),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Inference timed out')), TIMEOUT_MS)),
          ])
        } catch (clientErr) {
          console.warn('[AutoDetect] Client-side model failed, falling back to server:', clientErr)
          disposeModel()
          setPhase('inferring')
          inferResult = await runServerInference(img)
        }
      }
      if (abortRef.current) return

      // ── 4. Convert mask → contour via worker ──────────────────────────────
      setPhase('contouring')

      const commands = await contourFromMask(inferResult.mask, inferResult.width, inferResult.height)
      if (abortRef.current) return

      if (!commands || commands.length < 3) {
        setPhase('error')
        setError('Failed to detect product boundaries. Try the magic wand or draw manually.')
        return
      }

      // ── 5. Scale contour coords back to original image dimensions ─────────
      const scaleX = inferResult.originalWidth / inferResult.width
      const scaleY = inferResult.originalHeight / inferResult.height
      if (scaleX !== 1 || scaleY !== 1) {
        for (const cmd of commands) {
          cmd.x = Math.round(cmd.x * scaleX)
          cmd.y = Math.round(cmd.y * scaleY)
          if (cmd.cp) {
            cmd.cp.x = Math.round(cmd.cp.x * scaleX)
            cmd.cp.y = Math.round(cmd.cp.y * scaleY)
          }
          if (cmd.cp1) {
            cmd.cp1.x = Math.round(cmd.cp1.x * scaleX)
            cmd.cp1.y = Math.round(cmd.cp1.y * scaleY)
          }
          if (cmd.cp2) {
            cmd.cp2.x = Math.round(cmd.cp2.x * scaleX)
            cmd.cp2.y = Math.round(cmd.cp2.y * scaleY)
          }
        }
      }

      // ── 6. Show preview ───────────────────────────────────────────────────
      setOverlayPath(commands)
      setPhase('preview')
    } catch (err: unknown) {
      if (abortRef.current) return
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[AutoDetect] Detection failed:', err)
      if (!isMobileView) disposeModel()
      setPhase('error')
      setError(
        msg.includes('download') || msg.includes('fetch')
          ? 'Failed to download the detection model. Check your connection and try again.'
          : 'Failed to detect product boundaries. Try the magic wand or draw manually.'
      )
    }
  }, [phase, isMobileView]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Confirm ───────────────────────────────────────────────────────────────

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
      shapeId: `autodetect-${Date.now()}`,
    }

    onShapeCompleteRef.current(vectorShape)
    setOverlayPath(null)
    setPhase('idle')
    setProgress(DEFAULT_PROGRESS)
  }, [overlayPath])

  // ── Cancel ────────────────────────────────────────────────────────────────

  const cancelSelection = useCallback(() => {
    setOverlayPath(null)
    setPhase('idle')
    setError(null)
    setProgress(DEFAULT_PROGRESS)
  }, [])

  // ── Retry ─────────────────────────────────────────────────────────────────

  const retry = useCallback(() => {
    setPhase('idle')
    setError(null)
    setOverlayPath(null)
    setProgress(DEFAULT_PROGRESS)
    setTimeout(() => detect(), 0)
  }, [detect])

  // ── Overlay rendering ───────────────────────────────────────────────────

  const renderOverlay = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!overlayPath || overlayPath.length < 3) return

      const tfm = transformRef.current

      ctx.beginPath()
      for (const cmd of overlayPath) {
        const p = tfm(cmd.x, cmd.y)
        if (cmd.type === 'M') {
          ctx.moveTo(p.x, p.y)
        } else if (cmd.type === 'L') {
          ctx.lineTo(p.x, p.y)
        } else if (cmd.type === 'C' && cmd.cp1 && cmd.cp2) {
          const c1 = tfm(cmd.cp1.x, cmd.cp1.y)
          const c2 = tfm(cmd.cp2.x, cmd.cp2.y)
          ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p.x, p.y)
        } else if (cmd.type === 'Z') {
          ctx.closePath()
        }
      }

      ctx.fillStyle = AUTO_DETECT_CONSTANTS.OVERLAY_FILL
      ctx.fill()

      ctx.strokeStyle = AUTO_DETECT_CONSTANTS.OVERLAY_STROKE
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.stroke()
      ctx.setLineDash([])
    },
    [overlayPath]
  )

  return {
    phase,
    progress,
    error,
    hasPreview: overlayPath !== null && overlayPath.length >= 3,
    hasOverlay: overlayPath !== null && overlayPath.length >= 3,
    overlayPath,
    detect,
    confirmSelection,
    cancelSelection,
    retry,
    renderOverlay,
  }
}
