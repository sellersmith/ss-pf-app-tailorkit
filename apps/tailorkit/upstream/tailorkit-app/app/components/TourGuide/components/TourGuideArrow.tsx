import React, { useCallback, useEffect, useRef, useState } from 'react'
import styles from '../styles.module.css'
import { calculateArrowPath, calculateArrowStartPosition } from '../utils/calculateArrowPath'
import type { ECardPlacement } from '../constants'
import { ARROW_SIZE_MAP, DEFAULT_ARROW_CONFIG } from '../constants'
import { sleep } from '~/utils/sleep'

export interface TourGuideArrowProps {
  /**
   * The target element selector to point to
   */
  targetSelector: string
  /**
   * Color of the arrow. Default is white
   */
  color?: string
  /**
   * Size of the arrow. Default is medium
   */
  size?: 'small' | 'medium' | 'large'
  /**
   * Animation duration in milliseconds. Default is 1000
   */
  animationDuration?: number
  /**
   * Whether to show the arrow. Default is true
   */
  visible?: boolean
  /**
   * Offset from target element in pixels. Default is [0, 0]
   */
  offset?: [number, number]
  /**
   * Custom class for styling
   */
  className?: string
  /**
   * Animation style. Default is 'bounce'
   */
  animationStyle?: 'bounce' | 'pulse' | 'draw'
  /**
   * Position of the arrow start point
   */
  startPosition?: 'bottom' | 'right' | 'left' | 'top' | 'auto'
  /**
   * Placement reference - syncs with card placement
   */
  placement?: ECardPlacement
  /**
   * Controls the intensity of the curve
   */
  curveIntensity?: number
}

const MAX_RECURSIVE_QUERY_COUNT = 100

/**
 * TourGuideArrow component displays an animated curved arrow
 * that points to a target element specified by selector.
 */
const TourGuideArrow: React.FC<TourGuideArrowProps> = ({
  targetSelector,
  color = DEFAULT_ARROW_CONFIG.color,
  size = DEFAULT_ARROW_CONFIG.size,
  animationDuration = DEFAULT_ARROW_CONFIG.animationDuration,
  visible = true,
  offset = DEFAULT_ARROW_CONFIG.offset,
  className = '',
  animationStyle = DEFAULT_ARROW_CONFIG.animationStyle,
  startPosition = DEFAULT_ARROW_CONFIG.startPosition,
  placement = DEFAULT_ARROW_CONFIG.placement,
  curveIntensity = DEFAULT_ARROW_CONFIG.curveIntensity,
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const arrowRef = useRef<SVGGElement>(null)
  const [pathData, setPathData] = useState<string>('')
  const [isAnimating, setIsAnimating] = useState(true)
  const recursiveQueryCount = useRef(0)

  // Calculate the path data for the arrow based on target element position
  const calculatePath = useCallback(async () => {
    if (!targetSelector) return ''

    const targetElement = document.querySelector(targetSelector) as HTMLElement

    // Recursively query the target element until it is found
    if (!targetElement) {
      while (recursiveQueryCount.current < MAX_RECURSIVE_QUERY_COUNT) {
        recursiveQueryCount.current++
        await sleep(100)

        return calculatePath()
      }

      return ''
    }

    // Reset recursive query count
    recursiveQueryCount.current = 0

    // Get target element position
    const targetRect = targetElement.getBoundingClientRect()
    const targetX = targetRect.left + targetRect.width / 2
    const targetY = targetRect.top + targetRect.height / 2
    const elementWidth = targetRect.width
    const elementHeight = targetRect.height

    // Calculate start position using our utility with compacted distance
    const [startX, startY] = calculateArrowStartPosition(targetX, targetY, elementWidth, elementHeight, startPosition)

    // Generate the path data using our utility with edge positioning
    const path = calculateArrowPath({
      startX,
      startY,
      targetX,
      targetY,
      elementWidth,
      elementHeight,
      placement,
      curveIntensity,
      offset,
    })

    setPathData(path)
    return path
  }, [targetSelector, startPosition, placement, curveIntensity, offset])

  // Create animation based on selected style
  const createAnimation = useCallback(() => {
    if (!arrowRef.current) return

    // Get the path element within the group
    const pathElement = arrowRef.current.querySelector('path')
    const markerElement = svgRef.current?.querySelector('marker')
    if (!pathElement || !markerElement) return

    // Reset animation
    arrowRef.current.style.animation = 'none'
    pathElement.style.animation = 'none'
    markerElement.style.animation = 'none'
    void pathElement.getBoundingClientRect() // Trigger reflow to reset animation

    // Get the total length of the path for drawing animation
    let pathLength = 1500
    try {
      pathLength = pathElement.getTotalLength() || 1500
    } catch (e) {
      // Some browsers might not support getTotalLength for paths
      console.warn('Could not get path length, using default value', e)
    }

    // Apply animation based on selected style
    switch (animationStyle) {
      case 'bounce':
        arrowRef.current.style.animation = `${styles.arrowBounce} ${animationDuration}ms ease-in-out infinite`
        break
      case 'pulse':
        arrowRef.current.style.animation = `${styles.arrowPulse} ${animationDuration}ms ease-in-out infinite`
        break
      case 'draw':
        // For 'draw' style, we need to set up stroke-dasharray on the path
        pathElement.style.strokeDasharray = `${pathLength}`
        pathElement.style.strokeDashoffset = `${pathLength}`
        pathElement.style.animation = `${styles.arrowDraw} ${animationDuration}ms linear forwards`
        markerElement.style.animation = `${styles.arrowDrawMarker} 300ms linear forwards`

        break
      default:
        arrowRef.current.style.animation = `${styles.arrowBounce} ${animationDuration}ms ease-in-out infinite`
    }
  }, [animationDuration, animationStyle])

  useEffect(() => {
    // Handle window resize
    const handleResize = () => {
      calculatePath()
    }

    // Observe the target element for position changes
    const targetElement = document.querySelector(targetSelector) as HTMLElement

    if (!targetElement) return

    const observer = new ResizeObserver(() => {
      calculatePath()
    })

    observer.observe(targetElement)

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      observer.disconnect()
    }
  }, [calculatePath, targetSelector])

  // Calculate path on mount and when targetSelector changes
  useEffect(() => {
    ;(async () => {
      await calculatePath()

      // Start animation
      setIsAnimating(true)
    })()

    const animationTimer = setTimeout(() => {
      createAnimation()
    }, 100)

    return () => {
      clearTimeout(animationTimer)
    }
  }, [calculatePath, createAnimation, targetSelector])

  // Observer target element for position changes
  useEffect(() => {
    const targetElement = document.querySelector(targetSelector) as HTMLElement
    if (!targetElement) return

    const observer = new ResizeObserver(() => {
      calculatePath()
    })

    observer.observe(targetElement)

    return () => {
      observer.disconnect()
    }
  }, [calculatePath, targetSelector])

  if (!visible || !pathData) return null

  const { strokeWidth } = ARROW_SIZE_MAP[size ?? 'medium']

  return (
    <svg
      ref={svgRef}
      className={`${styles.tourGuideArrow} ${className}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      </defs>

      {/* Path group for animation */}
      <g ref={arrowRef} style={{ opacity: isAnimating ? 1 : 0 }}>
        {/* Main curved path */}
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray="1, 0"
          markerEnd="url(#arrow)"
        />
      </g>
    </svg>
  )
}

export default TourGuideArrow
