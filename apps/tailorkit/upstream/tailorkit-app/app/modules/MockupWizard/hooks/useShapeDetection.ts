import { useCallback } from 'react'
import type { DetectedShape } from '../types'
import { detectShapes, findLargestShape } from '../utils/shapeDetection'

/**
 * Simplified hook for one-time shape detection and auto-creation
 */
export function useShapeDetection() {
  /**
   * Detect shapes and return the largest one for auto-creation
   */
  const detectAndGetLargestShape = useCallback((image: HTMLImageElement): DetectedShape | null => {
    try {
      const { shapes } = detectShapes(image)
      return findLargestShape(shapes)
    } catch (error) {
      console.error('❌ Shape detection failed:', error)
      return null
    }
  }, [])

  return {
    detectAndGetLargestShape,
  }
}
