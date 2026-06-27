import type { EffectConfig } from '~/modules/TemplateEditor/elements/effects/types'
import { resolveColor } from 'extensions/tailorkit-src/src/shared/libraries/konva/effects/utils'

/**
 * Determines shadow direction based on offset values
 * Returns one of 8 directions similar to Figma's approach
 */
export function getShadowDirection(offsetX: number, offsetY: number): string {
  const threshold = 2 // Threshold to determine if offset is significant

  const isTop = offsetY < -threshold
  const isBottom = offsetY > threshold
  const isLeft = offsetX < -threshold
  const isRight = offsetX > threshold

  // 8 directional cases
  if (isTop && isLeft) return 'top-left'
  if (isTop && isRight) return 'top-right'
  if (isBottom && isLeft) return 'bottom-left'
  if (isBottom && isRight) return 'bottom-right'
  if (isTop) return 'top'
  if (isBottom) return 'bottom'
  if (isLeft) return 'left'
  if (isRight) return 'right'

  // Center/no offset
  return 'center'
}

interface ShadowThumbnailProps {
  effect: EffectConfig
  textColor: string
}

/**
 * Generates a directional shadow thumbnail
 * Uses 8 directional indicators similar to Figma's approach
 */
export function ShadowThumbnail({ effect, textColor }: ShadowThumbnailProps) {
  if (effect.type !== 'DROP_SHADOW' && effect.type !== 'INNER_SHADOW') {
    return null
  }

  const e = effect as any
  const offsetX = e.offsetX ?? 0
  const offsetY = e.offsetY ?? 0
  const isInner = effect.type === 'INNER_SHADOW'
  const direction = getShadowDirection(offsetX, offsetY)

  // Consistent shadow color regardless of actual effect color
  const shadowColor = resolveColor(effect.color, textColor)

  // Map direction to CSS box-shadow for visual indicator
  const getDirectionalShadow = () => {
    const offset = '1px' // Using 1px offset like Figma

    if (isInner) {
      // Inner shadows
      switch (direction) {
        case 'top':
          return `inset 0 ${offset} 3px ${shadowColor}`
        case 'top-right':
          return `inset -${offset} ${offset} 3px ${shadowColor}`
        case 'right':
          return `inset -${offset} 0 3px ${shadowColor}`
        case 'bottom-right':
          return `inset -${offset} -${offset} 3px ${shadowColor}`
        case 'bottom':
          return `inset 0 -${offset} 3px ${shadowColor}`
        case 'bottom-left':
          return `inset ${offset} -${offset} 3px ${shadowColor}`
        case 'left':
          return `inset ${offset} 0 3px ${shadowColor}`
        case 'top-left':
          return `inset ${offset} ${offset} 3px ${shadowColor}`
        default:
          return `inset 0 0 3px ${shadowColor}`
      }
    } else {
      // Drop shadows
      switch (direction) {
        case 'top':
          return `0 -${offset} 4px ${shadowColor}`
        case 'top-right':
          return `${offset} -${offset} 4px ${shadowColor}`
        case 'right':
          return `${offset} 0 4px ${shadowColor}`
        case 'bottom-right':
          return `${offset} ${offset} 4px ${shadowColor}`
        case 'bottom':
          return `0 ${offset} 4px ${shadowColor}`
        case 'bottom-left':
          return `-${offset} ${offset} 4px ${shadowColor}`
        case 'left':
          return `-${offset} 0 4px ${shadowColor}`
        case 'top-left':
          return `-${offset} -${offset} 4px ${shadowColor}`
        default:
          return `0 0 3px ${shadowColor}`
      }
    }
  }

  return (
    <div
      style={{
        width: '24px',
        height: '24px',
        borderRadius: '4px',
        backgroundColor: '#FFFFFF',
        border: '1px solid #D1D1D1',
        boxShadow: getDirectionalShadow(),
        flexShrink: 0,
      }}
      aria-hidden="true"
      title={`${effect.type.replace('_', ' ').toLowerCase()} - ${direction}`}
    />
  )
}
