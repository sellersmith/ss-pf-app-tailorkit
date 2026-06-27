/**
 * TemplateManipulator — SVG overlay for interactively resizing, rotating, and
 * repositioning the template position on the composite mockup preview.
 *
 * Fires onChange during drag (throttled) for real-time composite updates,
 * and on pointer-up for the final committed position.
 *
 * All coordinates are in image-space pixels (matching the canvas viewBox).
 */

import { useCallback, useRef, useState } from 'react'
import type { TemplatePosition } from '../../types'

interface TemplateManipulatorProps {
  position: TemplatePosition
  canvasWidth: number
  canvasHeight: number
  /** Current zoom level — kept for interface compat; internally viewport.scale is used */
  zoom: number
  /** Viewport transform to align SVG overlay with the canvas CSS transform */
  viewport: { scale: number; left: number; top: number }
  /** Called during drag (throttled) and on pointer-up with the position */
  onChange: (position: TemplatePosition) => void
  /** Notifies parent when a drag interaction starts (used to suppress canvas pan on mobile) */
  onDragStart?: () => void
  /** Notifies parent when a drag interaction ends */
  onDragEnd?: () => void
}

// Match InteractiveCanvas constants (constants.ts + canvasDrawing.ts)
const COLOR = '#0066ff'
const FILL = '#ffffff'
const HANDLE_PX = 12 // CANVAS_CONSTANTS.HANDLE_SIZE
const STROKE_PX = 2 // CANVAS_STYLES.HANDLE.LINE_WIDTH
const DASH_PX = 4
const ROT_OFFSET_PX = 25 // CANVAS_CONSTANTS.ROTATION_HANDLE_OFFSET
const ROT_RADIUS_PX = 7 // CANVAS_CONSTANTS.ROTATION_HANDLE_SIZE / 2
const ROT_STEM_PX = 1.5
const MIN_SIZE = 20

/** Throttle interval for real-time composite updates during drag (ms) */
const DRAG_UPDATE_INTERVAL = 50

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

/** Check if a handle is a corner handle (should preserve aspect ratio) */
function isCornerHandle(h: Handle): boolean {
  return h === 'nw' || h === 'ne' || h === 'se' || h === 'sw'
}

export default function TemplateManipulator({
  position,
  canvasWidth,
  canvasHeight,
  viewport,
  onChange,
  onDragStart,
  onDragEnd,
}: TemplateManipulatorProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{
    kind: 'move' | 'resize' | 'rotate'
    handle?: Handle
    startX: number
    startY: number
    startAngle?: number
    orig: TemplatePosition
  } | null>(null)

  // Throttle ref for real-time onChange during drag
  const lastUpdateRef = useRef(0)

  // Live position during drag — shows where the template will land
  const [livePos, setLivePos] = useState<TemplatePosition | null>(null)
  const pos = livePos ?? position

  const rot = pos.rotation ?? 0
  const s = viewport.scale || 1

  // All positions computed in display (container) space for direct SVG rendering.
  // This avoids a large CSS layout box (canvasWidth x canvasHeight px) that would
  // overflow and get clipped by the parent's overflow:hidden on mobile.
  const dx = viewport.left + pos.x * s
  const dy = viewport.top + pos.y * s
  const dw = pos.width * s
  const dh = pos.height * s
  const dcx = dx + dw / 2
  const dcy = dy + dh / 2
  const dRotX = dcx
  const dRotY = dy - ROT_OFFSET_PX

  /** Convert container-space pointer event to image-space coordinates */
  const toSvg = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const r = svg.getBoundingClientRect()
      const scale = viewport.scale || 1
      return {
        x: (e.clientX - r.left - viewport.left) / scale,
        y: (e.clientY - r.top - viewport.top) / scale,
      }
    },
    [viewport]
  )

  /** Compute resize from delta — corner handles preserve aspect ratio */
  const applyResize = (o: TemplatePosition, h: Handle, ddx: number, ddy: number): TemplatePosition => {
    let { x, y, width, height } = o

    if (isCornerHandle(h)) {
      // Corner handles: preserve aspect ratio
      const aspect = o.width / o.height

      // Determine the dominant axis based on which produces a larger relative change
      const absDx = Math.abs(ddx)
      const absDy = Math.abs(ddy)
      const useDx = absDx * o.height >= absDy * o.width

      if (useDx) {
        // Width-driven: compute height from width
        if (h === 'nw' || h === 'sw') {
          width = o.width - ddx
        } else {
          width = o.width + ddx
        }
        if (width < MIN_SIZE) width = MIN_SIZE
        height = width / aspect
        if (height < MIN_SIZE) {
          height = MIN_SIZE
          width = height * aspect
        }
      } else {
        // Height-driven: compute width from height
        if (h === 'nw' || h === 'ne') {
          height = o.height - ddy
        } else {
          height = o.height + ddy
        }
        if (height < MIN_SIZE) height = MIN_SIZE
        width = height * aspect
        if (width < MIN_SIZE) {
          width = MIN_SIZE
          height = width / aspect
        }
      }

      // Anchor position based on which corner is dragged
      if (h === 'nw') {
        x = o.x + o.width - width
        y = o.y + o.height - height
      } else if (h === 'ne') {
        y = o.y + o.height - height
      } else if (h === 'sw') {
        x = o.x + o.width - width
      }
      // 'se': x and y stay at original (top-left anchored)
    } else {
      // Edge handles: free-form single axis
      if (h === 'n') {
        y += ddy
        height -= ddy
      }
      if (h === 's') height += ddy
      if (h === 'w') {
        x += ddx
        width -= ddx
      }
      if (h === 'e') width += ddx

      if (width < MIN_SIZE) {
        width = MIN_SIZE
        if (h === 'w') x = o.x + o.width - MIN_SIZE
      }
      if (height < MIN_SIZE) {
        height = MIN_SIZE
        if (h === 'n') y = o.y + o.height - MIN_SIZE
      }
    }

    return { ...o, x, y, width, height }
  }

  const onDown = useCallback(
    (kind: 'move' | 'resize' | 'rotate', e: React.PointerEvent, handle?: Handle) => {
      e.stopPropagation()
      e.preventDefault()
      ;(e.target as Element).setPointerCapture(e.pointerId)
      const pt = toSvg(e)
      const orig = { ...position }
      let startAngle: number | undefined
      if (kind === 'rotate') {
        const ocx = orig.x + orig.width / 2
        const ocy = orig.y + orig.height / 2
        startAngle = Math.atan2(pt.y - ocy, pt.x - ocx) * (180 / Math.PI)
      }
      dragRef.current = { kind, handle, startX: pt.x, startY: pt.y, startAngle, orig }
      lastUpdateRef.current = 0
      onDragStart?.()
    },
    [position, toSvg, onDragStart]
  )

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const pt = toSvg(e)
      const ddx = pt.x - d.startX
      const ddy = pt.y - d.startY

      let newPos: TemplatePosition
      if (d.kind === 'move') {
        newPos = {
          ...d.orig,
          x: Math.max(0, Math.min(d.orig.x + ddx, canvasWidth - d.orig.width)),
          y: Math.max(0, Math.min(d.orig.y + ddy, canvasHeight - d.orig.height)),
        }
      } else if (d.kind === 'resize' && d.handle) {
        newPos = applyResize(d.orig, d.handle, ddx, ddy)
      } else if (d.kind === 'rotate' && d.startAngle !== undefined) {
        const ocx = d.orig.x + d.orig.width / 2
        const ocy = d.orig.y + d.orig.height / 2
        const angle = Math.atan2(pt.y - ocy, pt.x - ocx) * (180 / Math.PI)
        let newRot = ((((d.orig.rotation ?? 0) + angle - d.startAngle) % 360) + 360) % 360
        for (const snap of [0, 90, 180, 270]) {
          if (Math.abs(newRot - snap) < 3) {
            newRot = snap
            break
          }
        }
        newPos = { ...d.orig, rotation: Math.round(newRot * 10) / 10 }
      } else {
        return
      }

      setLivePos(newPos)

      // Throttled real-time composite update
      const now = Date.now()
      if (now - lastUpdateRef.current >= DRAG_UPDATE_INTERVAL) {
        lastUpdateRef.current = now
        onChange(newPos)
      }
    },
    [toSvg, canvasWidth, canvasHeight, onChange]
  )

  const onUp = useCallback(
    (e: React.PointerEvent) => {
      ;(e.target as Element).releasePointerCapture?.(e.pointerId)
      dragRef.current = null
      onDragEnd?.()
      if (livePos) {
        onChange(livePos)
        setLivePos(null)
      }
    },
    [livePos, onChange, onDragEnd]
  )

  // Handle positions in display (container) space
  const handles: { t: Handle; x: number; y: number; c: string }[] = [
    { t: 'nw', x: dx, y: dy, c: 'nwse-resize' },
    { t: 'n', x: dcx, y: dy, c: 'ns-resize' },
    { t: 'ne', x: dx + dw, y: dy, c: 'nesw-resize' },
    { t: 'e', x: dx + dw, y: dcy, c: 'ew-resize' },
    { t: 'se', x: dx + dw, y: dy + dh, c: 'nwse-resize' },
    { t: 's', x: dcx, y: dy + dh, c: 'ns-resize' },
    { t: 'sw', x: dx, y: dy + dh, c: 'nesw-resize' },
    { t: 'w', x: dx, y: dcy, c: 'ew-resize' },
  ]

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        touchAction: 'none',
        overflow: 'visible',
      }}
      onPointerMove={onMove}
      onPointerUp={onUp}
    >
      <g transform={`rotate(${rot} ${dcx} ${dcy})`}>
        {/* Bounding rectangle */}
        <rect
          x={dx}
          y={dy}
          width={dw}
          height={dh}
          fill="transparent"
          stroke={COLOR}
          strokeWidth={STROKE_PX}
          strokeDasharray={`${DASH_PX} ${DASH_PX}`}
          style={{ pointerEvents: 'all', cursor: 'move' }}
          onPointerDown={e => onDown('move', e)}
        />

        {/* Resize handles */}
        {handles.map(h => (
          <rect
            key={h.t}
            x={h.x - HANDLE_PX / 2}
            y={h.y - HANDLE_PX / 2}
            width={HANDLE_PX}
            height={HANDLE_PX}
            fill={FILL}
            stroke={COLOR}
            strokeWidth={STROKE_PX}
            style={{ pointerEvents: 'all', cursor: h.c }}
            onPointerDown={e => onDown('resize', e, h.t)}
          />
        ))}

        {/* Rotation stem — from top edge of top-center handle to rotation circle */}
        <line
          x1={dcx}
          y1={dy - HANDLE_PX / 2}
          x2={dRotX}
          y2={dRotY}
          stroke={COLOR}
          strokeWidth={ROT_STEM_PX}
          style={{ pointerEvents: 'none' }}
        />

        {/* Rotation handle — filled circle with inner white dot (donut) */}
        <circle
          cx={dRotX}
          cy={dRotY}
          r={ROT_RADIUS_PX}
          fill={FILL}
          stroke={COLOR}
          strokeWidth={STROKE_PX}
          style={{ pointerEvents: 'all', cursor: 'grab' }}
          onPointerDown={e => onDown('rotate', e)}
        />
        <circle cx={dRotX} cy={dRotY} r={ROT_RADIUS_PX * 0.4} fill={FILL} style={{ pointerEvents: 'none' }} />
      </g>
    </svg>
  )
}
