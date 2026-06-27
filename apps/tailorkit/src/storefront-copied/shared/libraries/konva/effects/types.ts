// Framework-agnostic effect types to compose visual effects for text

export type EffectType = 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR' | 'NOISE'

export type BaseEffectConfig = {
  _id?: string
  type: EffectType
  visible?: boolean
}

/**
 * Relative shadow positioning based on font size
 * Enables scale-independent effects that look consistent at any font size
 *
 * @example
 * // Shadow at 45° (down-right), 10% of font size away, 5% blur
 * relative: { direction: 45, distancePercent: 10, radiusPercent: 5 }
 */
export type RelativeShadowPosition = {
  direction: number // 0-360 degrees (0=right, 90=down, 180=left, 270=up)
  distancePercent: number // 0-200% of fontSize for shadow distance
  radiusPercent: number // 0-100% of fontSize for blur radius
}

export type DropShadowConfig = BaseEffectConfig & {
  type: 'DROP_SHADOW'
  color: string
  offsetX: number
  offsetY: number
  radius: number
  spread?: number
  opacity?: number
  blendMode?: GlobalCompositeOperation | 'NORMAL'
  showBehindNode?: boolean
  relative?: RelativeShadowPosition
}

export type InnerShadowConfig = BaseEffectConfig & {
  type: 'INNER_SHADOW'
  color: string
  offsetX: number
  offsetY: number
  radius: number
  spread?: number
  opacity?: number
  blendMode?: GlobalCompositeOperation | 'NORMAL'
  relative?: RelativeShadowPosition
}

export type LayerBlurConfig = BaseEffectConfig & {
  type: 'LAYER_BLUR'
  radius: number
}

export type BackgroundBlurConfig = BaseEffectConfig & {
  type: 'BACKGROUND_BLUR'
  radius: number
}

export type NoiseConfig = BaseEffectConfig & {
  type: 'NOISE'
  density: number
  size: number
  color?: string
  opacity?: number
  blendMode?: GlobalCompositeOperation | 'NORMAL'
}

export type EffectConfig = DropShadowConfig | InnerShadowConfig | LayerBlurConfig | BackgroundBlurConfig | NoiseConfig
