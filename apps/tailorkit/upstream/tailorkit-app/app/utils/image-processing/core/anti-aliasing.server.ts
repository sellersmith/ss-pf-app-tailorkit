/**
 * Universal Anti-Aliasing Utility for Image Processing
 *
 * Provides enhanced, reusable anti-aliasing functionality for all image processing operations
 * including background removal, mask creation, and other transparency effects.
 *
 * @author TailorKit Team
 * @version 1.0.0 - Universal anti-aliasing with adaptive smoothness
 */

/**
 * Anti-aliasing configuration options
 */
export interface AntiAliasingOptions {
  /** Smoothness level preset */
  smoothnessLevel: 'minimal' | 'moderate' | 'maximum' | 'custom'
  /** Custom feather radius (overrides smoothness level) */
  featherRadius?: number
  /** Enable multi-pass progressive smoothing */
  multiPass?: boolean
  /** Scale feather radius with image size */
  adaptiveRadius?: boolean
  /** Blending curve type */
  blendingCurve?: 'linear' | 'smoothstep' | 'gaussian' | 'cosine'
  /** Edge preservation factor (0-1, higher preserves more edges) */
  edgePreservation?: number
  /** Progress callback */
  onProgress?: (message: string, progress: number) => void
}

/**
 * Default anti-aliasing options - optimized for high-quality results
 */
const DEFAULT_OPTIONS: Required<AntiAliasingOptions> = {
  smoothnessLevel: 'maximum',
  featherRadius: 0, // Will be calculated based on smoothness level
  multiPass: true,
  adaptiveRadius: true,
  blendingCurve: 'gaussian',
  edgePreservation: 0.6,
  onProgress: () => {},
}

/**
 * Calculate adaptive feather radius based on image size and smoothness level
 */
function calculateAdaptiveFeatherRadius(
  smoothnessLevel: string,
  imageWidth: number,
  imageHeight: number,
  customRadius?: number
): number {
  if (customRadius && customRadius > 0) {
    return customRadius
  }

  // Base radius scales with image size (larger images need larger radius)
  const imageSize = Math.sqrt(imageWidth * imageHeight)
  const baseRadius = Math.max(1, Math.sqrt(imageSize) / 200)

  // Smoothness level multipliers
  const multipliers = {
    minimal: 1.0, // For engraving/precision work
    moderate: 2.5, // For general use
    maximum: 4.5, // For photographic/smooth results
    custom: 2.5, // Default fallback
  }

  const multiplier = multipliers[smoothnessLevel as keyof typeof multipliers] || multipliers.moderate
  return Math.max(1, Math.round(baseRadius * multiplier))
}

/**
 * Apply blending curve to fade ratio
 */
function applyBlendingCurve(fadeRatio: number, curve: string): number {
  switch (curve) {
    case 'linear':
      return fadeRatio

    case 'smoothstep':
      // Enhanced smoothstep for more natural transitions
      return fadeRatio * fadeRatio * (3 - 2 * fadeRatio)

    case 'gaussian':
      // Gaussian-like falloff for very smooth transitions
      return Math.exp(-2 * Math.pow(1 - fadeRatio, 2))

    case 'cosine':
      // Cosine interpolation for smooth curves
      return (1 - Math.cos(fadeRatio * Math.PI)) / 2

    default:
      return fadeRatio * fadeRatio * (3 - 2 * fadeRatio) // Default to smoothstep
  }
}

/**
 * Single-pass anti-aliasing implementation
 */
function applySinglePassAntiAliasing(
  pixels: Uint8Array,
  backgroundMask: Uint8Array,
  width: number,
  height: number,
  featherRadius: number,
  blendingCurve: string,
  edgePreservation: number,
  onProgress?: (message: string, progress: number) => void
): Uint8Array {
  const processedPixels = new Uint8Array(pixels)
  const totalPixels = width * height
  let processedCount = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = y * width + x
      const alphaIndex = pixelIndex * 4 + 3

      if (backgroundMask[pixelIndex] === 1) {
        // This pixel is marked for removal
        processedPixels[alphaIndex] = 0
      } else {
        // Check if this pixel is near a background edge for feathering
        let minDistanceToBackground = featherRadius + 1

        for (let dy = -featherRadius; dy <= featherRadius; dy++) {
          for (let dx = -featherRadius; dx <= featherRadius; dx++) {
            const checkX = x + dx
            const checkY = y + dy

            if (checkX >= 0 && checkX < width && checkY >= 0 && checkY < height) {
              const checkIndex = checkY * width + checkX
              if (backgroundMask[checkIndex] === 1) {
                const distance = Math.sqrt(dx * dx + dy * dy)
                minDistanceToBackground = Math.min(minDistanceToBackground, distance)
              }
            }
          }
        }

        // Apply distance-based alpha blending for smooth edges
        if (minDistanceToBackground <= featherRadius) {
          const originalAlpha = processedPixels[alphaIndex]
          const fadeRatio = minDistanceToBackground / featherRadius

          // Apply blending curve
          const smoothFade = applyBlendingCurve(fadeRatio, blendingCurve)

          // Apply edge preservation
          const preservedFade = smoothFade * (1 - edgePreservation) + edgePreservation

          const newAlpha = Math.round(originalAlpha * preservedFade)
          processedPixels[alphaIndex] = Math.max(0, Math.min(255, newAlpha))
        }
      }

      processedCount++

      // Report progress every 5% of pixels
      if (onProgress && processedCount % Math.floor(totalPixels * 0.05) === 0) {
        const progress = Math.round((processedCount / totalPixels) * 100)
        onProgress(`Anti-aliasing: ${progress}% complete`, 70 + progress * 0.2)
      }
    }
  }

  return processedPixels
}

/**
 * Multi-pass progressive anti-aliasing for extra smooth results
 */
function applyMultiPassAntiAliasing(
  pixels: Uint8Array,
  backgroundMask: Uint8Array,
  width: number,
  height: number,
  featherRadius: number,
  blendingCurve: string,
  edgePreservation: number,
  onProgress?: (message: string, progress: number) => void
): Uint8Array {
  const processedPixels = new Uint8Array(pixels)

  // Progressive passes with decreasing radius and intensity
  const passes = [
    { radius: featherRadius, intensity: 1.0 },
    { radius: Math.max(1, Math.floor(featherRadius * 0.7)), intensity: 0.6 },
    { radius: Math.max(1, Math.floor(featherRadius * 0.4)), intensity: 0.3 },
  ]

  for (let pass = 0; pass < passes.length; pass++) {
    const { radius, intensity } = passes[pass]

    if (onProgress) {
      onProgress(`Multi-pass anti-aliasing: Pass ${pass + 1}/${passes.length}`, 70 + (pass / passes.length) * 25)
    }

    // Apply single pass with current radius and intensity
    const passResult = applySinglePassAntiAliasing(
      processedPixels,
      backgroundMask,
      width,
      height,
      radius,
      blendingCurve,
      edgePreservation * intensity
    )

    // Blend result with previous pass
    for (let i = 3; i < processedPixels.length; i += 4) {
      // Only process alpha channel
      const originalAlpha = processedPixels[i]
      const newAlpha = passResult[i]

      // Weighted blend based on intensity
      processedPixels[i] = Math.round(originalAlpha * (1 - intensity * 0.3) + newAlpha * (intensity * 0.3))
    }
  }

  return processedPixels
}

/**
 * Universal anti-aliasing function for all image processing operations
 *
 * @param pixels - RGBA pixel data
 * @param backgroundMask - Binary mask (1 = background, 0 = keep)
 * @param width - Image width
 * @param height - Image height
 * @param options - Anti-aliasing configuration
 * @returns Processed pixel data with smooth edges
 */
export function applyAntiAliasing(
  pixels: Uint8Array,
  backgroundMask: Uint8Array,
  width: number,
  height: number,
  options: Partial<AntiAliasingOptions> = {}
): Uint8Array {
  const config = { ...DEFAULT_OPTIONS, ...options }

  if (config.onProgress) {
    config.onProgress('Starting anti-aliasing...', 60)
  }

  // Calculate effective feather radius
  const featherRadius = config.adaptiveRadius
    ? calculateAdaptiveFeatherRadius(config.smoothnessLevel, width, height, config.featherRadius)
    : config.featherRadius || 2

  if (config.onProgress) {
    config.onProgress(`Using feather radius: ${featherRadius}px`, 65)
  }

  // Apply anti-aliasing based on configuration
  if (config.multiPass && config.smoothnessLevel === 'maximum') {
    return applyMultiPassAntiAliasing(
      pixels,
      backgroundMask,
      width,
      height,
      featherRadius,
      config.blendingCurve,
      config.edgePreservation,
      config.onProgress
    )
  }
  return applySinglePassAntiAliasing(
    pixels,
    backgroundMask,
    width,
    height,
    featherRadius,
    config.blendingCurve,
    config.edgePreservation,
    config.onProgress
  )
}

/**
 * Preset configurations for common use cases
 */
export const ANTI_ALIASING_PRESETS = {
  /** For engraving/cutting applications requiring crisp edges */
  ENGRAVING: {
    smoothnessLevel: 'minimal' as const,
    blendingCurve: 'linear' as const,
    edgePreservation: 0.9,
  },

  /** For general image processing with balanced smoothness */
  GENERAL: {
    smoothnessLevel: 'moderate' as const,
    blendingCurve: 'smoothstep' as const,
    edgePreservation: 0.7,
  },

  /** For photographic content requiring maximum smoothness */
  PHOTOGRAPHIC: {
    smoothnessLevel: 'maximum' as const,
    blendingCurve: 'gaussian' as const,
    edgePreservation: 0.5,
    multiPass: true,
  },

  /** For high-quality mockup processing */
  MOCKUP: {
    smoothnessLevel: 'moderate' as const,
    blendingCurve: 'cosine' as const,
    edgePreservation: 0.6,
  },
} as const

/**
 * Convenience function to get preset configuration
 */
export function getAntiAliasingPreset(preset: keyof typeof ANTI_ALIASING_PRESETS): Partial<AntiAliasingOptions> {
  return ANTI_ALIASING_PRESETS[preset]
}
