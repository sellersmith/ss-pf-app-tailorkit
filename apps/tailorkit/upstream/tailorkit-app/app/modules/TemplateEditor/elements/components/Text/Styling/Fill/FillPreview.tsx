/**
 * FillPreview - Preview thumbnail for a Paint fill
 *
 * Shows a visual preview of the fill:
 * - Solid: Color swatch
 * - Image: Thumbnail
 * - Gradient: Gradient preview
 *
 * @module TemplateEditor/elements/components/Text/Styling/Fill
 */

import type { Paint } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import {
  isSolidPaint,
  isImagePaint,
  isGradientPaint,
  getPrimaryColor,
} from 'extensions/tailorkit-src/src/shared/libraries/paint'

interface FillPreviewProps {
  /** The paint to preview */
  paint: Paint
  /** Size of the preview */
  size?: 'small' | 'medium' | 'large'
}

const SIZE_MAP = {
  small: 24,
  medium: 40,
  large: 60,
}

export function FillPreview({ paint, size = 'medium' }: FillPreviewProps) {
  const dimension = SIZE_MAP[size]

  // Solid color - simple color swatch
  if (isSolidPaint(paint)) {
    return (
      <div
        style={{
          borderRadius: 'var(--p-border-radius-100)',
          borderWidth: 'var(--p-border-width-025)',
          borderStyle: 'solid',
          borderColor: 'var(--p-color-border-subdued)',
          overflow: 'hidden',
          width: `${dimension}px`,
          height: `${dimension}px`,
          backgroundColor: paint.color,
          opacity: paint.opacity ?? 1,
          flexShrink: 0,
        }}
      />
    )
  }

  // Image - show thumbnail
  if (isImagePaint(paint)) {
    if (paint.imageRef) {
      return (
        <div
          style={{
            borderRadius: 'var(--p-border-radius-100)',
            borderWidth: 'var(--p-border-width-025)',
            borderStyle: 'solid',
            borderColor: 'var(--p-color-border-subdued)',
            overflow: 'hidden',
            width: `${dimension}px`,
            height: `${dimension}px`,
            flexShrink: 0,
          }}
        >
          <img
            src={paint.imageRef}
            alt="Fill preview"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: paint.opacity ?? 1,
            }}
          />
        </div>
      )
    }

    // No image - show placeholder
    return (
      <div
        style={{
          borderRadius: 'var(--p-border-radius-100)',
          borderWidth: 'var(--p-border-width-025)',
          borderStyle: 'solid',
          borderColor: 'var(--p-color-border-subdued)',
          overflow: 'hidden',
          width: `${dimension}px`,
          height: `${dimension}px`,
          backgroundColor: 'var(--p-color-bg-surface-secondary)',
          backgroundImage: `linear-gradient(
            45deg,
            var(--p-color-border-subdued) 25%,
            transparent 25%,
            transparent 75%,
            var(--p-color-border-subdued) 75%
          )`,
          backgroundSize: '8px 8px',
          flexShrink: 0,
        }}
      />
    )
  }

  // Gradient - show gradient preview
  if (isGradientPaint(paint)) {
    const gradientStops = paint.stops.map(stop => `${stop.color} ${stop.position * 100}%`).join(', ')

    let gradientStyle = ''

    switch (paint.type) {
      case 'GRADIENT_LINEAR': {
        const angle = paint.transform?.angle ?? 0
        gradientStyle = `linear-gradient(${angle}deg, ${gradientStops})`
        break
      }
      case 'GRADIENT_RADIAL':
        gradientStyle = `radial-gradient(circle, ${gradientStops})`
        break
      case 'GRADIENT_ANGULAR':
        gradientStyle = `conic-gradient(${gradientStops})`
        break
      case 'GRADIENT_DIAMOND':
        // Diamond is complex - fallback to radial
        gradientStyle = `radial-gradient(circle, ${gradientStops})`
        break
    }

    return (
      <div
        style={{
          borderRadius: 'var(--p-border-radius-100)',
          borderWidth: 'var(--p-border-width-025)',
          borderStyle: 'solid',
          borderColor: 'var(--p-color-border-subdued)',
          overflow: 'hidden',
          width: `${dimension}px`,
          height: `${dimension}px`,
          background: gradientStyle,
          opacity: paint.opacity ?? 1,
          flexShrink: 0,
        }}
      />
    )
  }

  // Fallback - show primary color
  return (
    <div
      style={{
        borderRadius: 'var(--p-border-radius-100)',
        borderWidth: 'var(--p-border-width-025)',
        borderStyle: 'solid',
        borderColor: 'var(--p-color-border-subdued)',
        overflow: 'hidden',
        width: `${dimension}px`,
        height: `${dimension}px`,
        backgroundColor: getPrimaryColor(paint),
        flexShrink: 0,
      }}
    />
  )
}
