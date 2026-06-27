import { useCallback } from 'react'
import type { DetectedShape } from '../types'
import { detectShapes } from '../utils/shapeDetection'

/**
 * Hook for detecting and auto-creating all distinct image details
 */
export function useShapeDetection() {
  /**
   * Detect all distinct image details and return them as shape selections
   */
  const detectAndCreateAllShapes = useCallback((image: HTMLImageElement): DetectedShape[] => {
    try {
      const { shapes } = detectShapes(image)
      return shapes
    } catch (error) {
      console.error('❌ useShapeDetection: Shape detection failed:', error)
      return []
    }
  }, [])

  return {
    detectAndCreateAllShapes,
  }
}
