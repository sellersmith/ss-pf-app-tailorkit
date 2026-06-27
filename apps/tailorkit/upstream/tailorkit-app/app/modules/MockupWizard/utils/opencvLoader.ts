/**
 * Magic Wand Web Worker Manager
 *
 * Manages a Web Worker that runs pure-JS flood fill + contour detection.
 * No OpenCV dependency — instant ready, zero loading time.
 *
 * API:
 *   preloadOpenCV()  — start the worker (instant, no heavy loading)
 *   loadOpenCV()     — ensure worker is ready (returns a promise)
 *   detectRegion()   — run flood fill detection (async, off main thread)
 *   getOpenCVState() — current state
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { PathCommand } from '~/modules/VectorEditor/utils/svg'
import { MAGIC_WAND_CONSTANTS, AUTO_DETECT_CONSTANTS } from '../constants'

const WORKER_PATH = '/assets/opencv-worker.js'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

let state: LoadState = 'idle'
let worker: Worker | null = null
let loadPromise: Promise<void> | null = null
let loadError: string | null = null

/** Pending detection request — only one at a time */
let pendingDetection: {
  resolve: (commands: PathCommand[] | null) => void
} | null = null

/** Pending mask contour requests — keyed by requestId */
const pendingMaskContours: Map<string, (commands: PathCommand[] | null) => void> = new Map()
let maskContourRequestCounter = 0

export function getOpenCVState(): { state: LoadState; error: string | null } {
  return { state, error: loadError }
}

/**
 * Start the worker early so it's ready when the user activates magic wand.
 */
export function preloadOpenCV(): void {
  if (state !== 'idle') return
  loadOpenCV().catch(() => {
    /* preload failure is non-fatal */
  })
}

/**
 * Ensure the Web Worker is created and ready.
 */
export function loadOpenCV(): Promise<void> {
  if (state === 'ready') return Promise.resolve()
  if (state === 'loading' && loadPromise) return loadPromise

  state = 'loading'
  loadError = null

  loadPromise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (state !== 'ready') {
        state = 'error'
        loadError = 'Worker timed out'
        loadPromise = null
        reject(new Error(loadError))
      }
    }, 10_000)

    try {
      worker = new Worker(WORKER_PATH)
    } catch (e) {
      clearTimeout(timeout)
      state = 'error'
      loadError = 'Failed to create Worker'
      loadPromise = null
      reject(new Error(loadError))
      return
    }

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data

      if (msg.type === 'ready') {
        clearTimeout(timeout)
        state = 'ready'
        resolve()
        return
      }

      if (msg.type === 'error') {
        clearTimeout(timeout)
        state = 'error'
        loadError = msg.message
        loadPromise = null
        reject(new Error(msg.message))
        return
      }

      if (msg.type === 'result') {
        if (pendingDetection) {
          const { resolve: res } = pendingDetection
          pendingDetection = null
          res(msg.commands ?? null)
        }
      }

      if (msg.type === 'mask-contour-result') {
        const pending = pendingMaskContours.get(msg.requestId)
        if (pending) {
          pendingMaskContours.delete(msg.requestId)
          pending(msg.commands ?? null)
        }
      }
    }

    worker.onerror = err => {
      clearTimeout(timeout)
      state = 'error'
      loadError = err.message || 'Worker failed'
      loadPromise = null
      reject(new Error(loadError))
    }

    worker.postMessage({ type: 'init' })
  })

  return loadPromise
}

/**
 * Run flood fill detection in the Web Worker.
 * Extracts pixel data from the image, sends to worker for off-thread processing.
 */
export function detectRegion(
  image: HTMLImageElement,
  tapImageX: number,
  tapImageY: number,
  tolerance: number
): Promise<PathCommand[] | null> {
  if (state !== 'ready' || !worker) {
    return Promise.resolve(null)
  }

  // Cancel any pending detection
  if (pendingDetection) {
    pendingDetection.resolve(null)
    pendingDetection = null
  }

  // Extract pixel data on main thread (fast — canvas draw + getImageData)
  const fullW = image.naturalWidth || image.width
  const fullH = image.naturalHeight || image.height
  const offscreen = new OffscreenCanvas(fullW, fullH)
  const ctx = offscreen.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  ctx.drawImage(image, 0, 0, fullW, fullH)
  const imageData = ctx.getImageData(0, 0, fullW, fullH)

  return new Promise<PathCommand[] | null>(resolve => {
    pendingDetection = { resolve }

    // Transfer the pixel buffer to the worker (zero-copy)
    worker!.postMessage(
      {
        type: 'detect',
        pixels: imageData.data,
        width: fullW,
        height: fullH,
        tapX: tapImageX,
        tapY: tapImageY,
        tolerance,
        constants: {
          MAX_DOWNSAMPLE_SIZE: MAGIC_WAND_CONSTANTS.MAX_DOWNSAMPLE_SIZE,
          MIN_CONTOUR_AREA: MAGIC_WAND_CONSTANTS.MIN_CONTOUR_AREA,
          APPROX_EPSILON_FACTOR: MAGIC_WAND_CONSTANTS.APPROX_EPSILON_FACTOR,
        },
      },
      [imageData.data.buffer]
    )
  })
}

/**
 * Extract a vector path from a binary alpha mask image.
 * Sends the mask to the worker for off-thread processing.
 *
 * @param maskImageData  Single-channel alpha mask (Uint8ClampedArray, 1 byte per pixel)
 * @param width          Mask width in pixels
 * @param height         Mask height in pixels
 */
export function contourFromMask(
  maskImageData: Uint8ClampedArray,
  width: number,
  height: number
): Promise<PathCommand[] | null> {
  if (state !== 'ready' || !worker) {
    return Promise.resolve(null)
  }

  const requestId = `mcr-${++maskContourRequestCounter}`

  return new Promise<PathCommand[] | null>(resolve => {
    pendingMaskContours.set(requestId, resolve)

    // Transfer the buffer to the worker (zero-copy)
    const buffer = maskImageData.buffer.slice(0)
    worker!.postMessage(
      {
        type: 'contour-from-mask',
        pixels: new Uint8ClampedArray(buffer),
        width,
        height,
        epsilon: AUTO_DETECT_CONSTANTS.CONTOUR_EPSILON_FACTOR,
        requestId,
      },
      [buffer]
    )

    // Safety timeout
    setTimeout(() => {
      if (pendingMaskContours.has(requestId)) {
        pendingMaskContours.delete(requestId)
        resolve(null)
      }
    }, 10_000)
  })
}
