import { useCallback, useEffect, useRef, useState } from 'react'

interface ResizableDividerProps {
  // Called with the horizontal delta moved since pointer down
  onResize: (deltaX: number) => void
  // Thickness in pixels of the divider bar
  thickness?: number
  // Accessible label
  ariaLabel?: string
}

/**
 * Vertical draggable divider for resizing horizontal panes.
 *
 * This component is stateless regarding the pane sizes; it only reports movement deltas
 * via onResize so parents can clamp/persist sizes as needed.
 */
const ResizableDivider = ({ onResize, thickness = 6, ariaLabel = 'Resize panel' }: ResizableDividerProps) => {
  const startXRef = useRef<number>(0)
  const isDraggingRef = useRef<boolean>(false)
  const [isActive, setIsActive] = useState<boolean>(false)

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!isDraggingRef.current) return
      const deltaX = event.clientX - startXRef.current
      startXRef.current = event.clientX
      onResize(deltaX)
    },
    [onResize]
  )

  const onPointerUp = useCallback(() => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    setIsActive(false)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }, [onPointerMove])

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      startXRef.current = event.clientX
      isDraggingRef.current = true
      setIsActive(true)
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
    },
    [onPointerMove, onPointerUp]
  )

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [onPointerMove, onPointerUp])

  return (
    <div
      role="separator"
      aria-label={ariaLabel}
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      style={{
        width: thickness,
        cursor: 'col-resize',
        userSelect: 'none',
        // Visual style kept minimal and inline to avoid external CSS per project guidelines
        background: isActive ? 'var(--p-color-bg-surface-hover)' : 'transparent',
        borderLeft: '1px solid var(--p-color-border-subdued)',
        borderRight: '1px solid var(--p-color-border-subdued)',
      }}
    />
  )
}

export default ResizableDivider
