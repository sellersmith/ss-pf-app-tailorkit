/**
 * ZoomWrapper - Preact wrapper using react-zoom-pan-pinch
 *
 * Wraps content with pinch-zoom, pan, and double-tap functionality
 * using CSS transforms (translate3d/scale3d) for GPU acceleration.
 *
 * This approach doesn't modify Konva internals - just wraps the container.
 */

import { h, ComponentChildren } from 'preact'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'

interface ZoomWrapperProps {
  children: ComponentChildren
  enabled?: boolean
  minScale?: number
  maxScale?: number
  doubleTapScale?: number
  onZoomChange?: (scale: number) => void
}

export function ZoomWrapper({
  children,
  enabled = true,
  minScale = 1,
  maxScale = 3,
  doubleTapScale = 2,
  onZoomChange,
}: ZoomWrapperProps) {
  console.log('[TailorKit] PinchZoom: ZoomWrapper', enabled, minScale, maxScale, doubleTapScale)
  // If disabled, just render children directly
  if (!enabled) {
    return <>{children}</>
  }

  return (
    <TransformWrapper
      initialScale={1}
      minScale={minScale}
      maxScale={maxScale}
      centerOnInit={true}
      doubleClick={{
        mode: 'toggle',
        step: doubleTapScale - 1, // step is added to current scale
      }}
      panning={{
        velocityDisabled: true, // Disable momentum scrolling for more control
      }}
      wheel={{
        disabled: true, // Disable mouse wheel zoom on storefront
      }}
      onTransformed={(ref, state) => {
        onZoomChange?.(state.scale)
      }}
    >
      <TransformComponent
        wrapperStyle={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
        contentStyle={{
          width: '100%',
          height: '100%',
        }}
      >
        {children}
      </TransformComponent>
    </TransformWrapper>
  )
}

export default ZoomWrapper
