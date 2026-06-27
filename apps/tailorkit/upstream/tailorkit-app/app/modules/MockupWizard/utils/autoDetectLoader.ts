/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auto-detect model loader singleton.
 *
 * Uses briaai/RMBG-1.4 for foreground segmentation with WASM proxy worker
 * (env.backends.onnx.wasm.proxy = true) to run ONNX inference off the main thread.
 *
 * Usage:
 *   const state = await loadModel({ onProgress: p => console.log(p.percent) })
 *   const result = await runInference(state, imageElement)
 *   // result.mask is a Uint8ClampedArray (single-channel, 0 or 255 per pixel)
 */

import { env, AutoModel, AutoProcessor, RawImage } from '@huggingface/transformers'

// ─── Constants ───────────────────────────────────────────────────────────────

/** Use RMBG-1.4 — proven to work in BackgroundRemovalService across all browsers */
const MODEL_ID = 'briaai/RMBG-1.4'

/** Max input dimension — downsample larger images before inference for speed */
const MAX_INPUT_SIZE = 1024

/** Processor config matching BackgroundRemovalService.getProcessorConfig() */
const PROCESSOR_CONFIG = {
  do_normalize: true,
  do_pad: false,
  do_rescale: true,
  do_resize: true,
  image_mean: [0.5, 0.5, 0.5],
  feature_extractor_type: 'ImageFeatureExtractor',
  image_std: [1, 1, 1],
  resample: 2,
  rescale_factor: 0.00392156862745098,
  size: { width: 1024, height: 1024 },
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModelProgress {
  /** Overall progress 0-100 */
  percent: number
  /** Which file is currently downloading */
  file: string | null
  /** Bytes downloaded */
  loaded: number
  /** Total bytes expected (0 if unknown) */
  total: number
}

export interface AutoDetectModelState {
  model: any
  processor: any
  isInitialized: boolean
}

export interface InferenceResult {
  mask: Uint8ClampedArray
  /** Mask dimensions (may be downsampled) */
  width: number
  height: number
  /** Original image dimensions for scaling contour coordinates back */
  originalWidth: number
  originalHeight: number
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _singleton: AutoDetectModelState | null = null
let _loadPromise: Promise<AutoDetectModelState> | null = null

// ─── Device helpers ───────────────────────────────────────────────────────────

export function getDeviceMemoryMB(): number | null {
  const mem = (navigator as any).deviceMemory
  if (typeof mem === 'number') return mem * 1024
  return null
}

export async function checkWebGPUSupport(): Promise<boolean> {
  if (!('gpu' in navigator)) return false
  try {
    const adapter = await (navigator as any).gpu.requestAdapter()
    if (!adapter) return false
    const device = await adapter.requestDevice()
    return !!device
  } catch {
    return false
  }
}

export async function isModelCached(): Promise<boolean> {
  if (!('caches' in window)) return false
  try {
    const cacheNames = await caches.keys()
    return cacheNames.some(k => k.toLowerCase().includes('transformers'))
  } catch {
    return false
  }
}

// ─── Model loading ────────────────────────────────────────────────────────────

/**
 * Load segmentation model (singleton — loads once, reuses on subsequent calls).
 * Configures WASM proxy to run ONNX inference in a Web Worker automatically.
 */
export async function loadModel(callbacks?: {
  onProgress?: (progress: ModelProgress) => void
}): Promise<AutoDetectModelState> {
  // Return cached singleton
  if (_singleton?.isInitialized) return _singleton
  // Join in-flight load
  if (_loadPromise) return _loadPromise

  _loadPromise = (async (): Promise<AutoDetectModelState> => {
    // Configure Transformers.js environment
    env.allowLocalModels = false
    // Run ONNX inference in a built-in Web Worker to keep the main thread responsive
    if (env.backends?.onnx?.wasm) {
      env.backends.onnx.wasm.proxy = true
    }

    const progressCallback = (info: any) => {
      if (!callbacks?.onProgress) return
      callbacks.onProgress({
        percent: typeof info.progress === 'number' ? info.progress : 0,
        file: info.file ?? null,
        loaded: info.loaded ?? 0,
        total: info.total ?? 0,
      })
    }

    // Don't hardcode device — let the library auto-detect the best available backend
    // (WebGPU → WASM fallback). Hardcoding 'wasm' prevents fallback and causes
    // "no available backend found" errors when WASM files fail to load.
    const model = await AutoModel.from_pretrained(MODEL_ID, {
      progress_callback: progressCallback,
    })

    const processor = await AutoProcessor.from_pretrained(MODEL_ID, {
      config: PROCESSOR_CONFIG,
    })

    const result: AutoDetectModelState = {
      model,
      processor,
      isInitialized: true,
    }

    _singleton = result
    _loadPromise = null
    return result
  })()

  return _loadPromise
}

// ─── Inference ────────────────────────────────────────────────────────────────

/**
 * Run segmentation inference on an image element.
 * Downsamples to MAX_INPUT_SIZE before inference for speed.
 * Returns a binary mask at the downsampled resolution + original dimensions for scaling.
 */
export async function runInference(state: AutoDetectModelState, image: HTMLImageElement): Promise<InferenceResult> {
  const { model, processor } = state
  if (!model || !processor) throw new Error('Auto-detect model not initialized')

  // Downsample large images before passing to the model
  const origW = image.naturalWidth || image.width
  const origH = image.naturalHeight || image.height
  const maxDim = Math.max(origW, origH)
  const scale = maxDim > MAX_INPUT_SIZE ? MAX_INPUT_SIZE / maxDim : 1
  const targetW = Math.round(origW * scale)
  const targetH = Math.round(origH * scale)

  let img: any
  if (scale < 1) {
    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(image, 0, 0, targetW, targetH)
    img = await RawImage.fromURL(canvas.toDataURL('image/png'))
  } else {
    img = await RawImage.fromURL(image.src)
  }

  // Pre-process
  const { pixel_values } = await processor(img)

  // Inference — runs in WASM proxy worker (off main thread)
  const { output } = await model({ input: pixel_values })

  // Post-process mask at downsampled resolution
  const maskImg = await RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(targetW, targetH)

  // Threshold: >127 → 255, else → 0
  const binary = new Uint8ClampedArray(maskImg.width * maskImg.height)
  for (let i = 0; i < binary.length; i++) {
    binary[i] = maskImg.data[i] > 127 ? 255 : 0
  }

  return { mask: binary, width: targetW, height: targetH, originalWidth: origW, originalHeight: origH }
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

export function disposeModel(): void {
  if (_singleton?.model?.dispose) {
    try {
      _singleton.model.dispose()
    } catch {
      /* ignore */
    }
  }
  _singleton = null
  _loadPromise = null
}
