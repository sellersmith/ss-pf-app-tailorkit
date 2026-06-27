/**
 * useGuidelines - Hook for managing guidelines state
 *
 * Guidelines are temporary alignment aids that exist only during the editing session.
 * They are NOT persisted to localStorage or saved with the SVG.
 *
 * Guidelines can be:
 * - Created by dragging from rulers
 * - Repositioned by dragging
 * - Deleted by dragging off canvas or pressing Delete
 */

import { useState, useCallback } from 'react'
import type { Guideline } from '../types'

// Simple unique ID generator (avoids external dependency)
let guidelineIdCounter = 0
function generateGuidelineId(): string {
  return `guideline-${Date.now()}-${++guidelineIdCounter}`
}

/**
 * Hook for managing guidelines state (session only, not persisted)
 *
 * @returns Object with guidelines array and CRUD operations
 *
 * @example
 * const { guidelines, addGuideline, updateGuideline, removeGuideline } = useGuidelines()
 *
 * // Add a vertical guideline at x=100
 * addGuideline('x', 100)
 *
 * // Move a guideline
 * updateGuideline(id, 150)
 *
 * // Remove a guideline
 * removeGuideline(id)
 */
export function useGuidelines() {
  const [guidelines, setGuidelines] = useState<Guideline[]>([])

  /**
   * Add a new guideline
   * @param axis - 'x' for vertical guideline, 'y' for horizontal
   * @param position - Position in SVG coordinates
   * @returns The ID of the newly created guideline
   */
  const addGuideline = useCallback((axis: 'x' | 'y', position: number): string => {
    const id = generateGuidelineId()
    setGuidelines(prev => [...prev, { id, axis, position }])
    return id
  }, [])

  /**
   * Update the position of an existing guideline
   * @param id - Guideline ID
   * @param position - New position in SVG coordinates
   */
  const updateGuideline = useCallback((id: string, position: number) => {
    setGuidelines(prev => prev.map(g => (g.id === id ? { ...g, position } : g)))
  }, [])

  /**
   * Remove a guideline by ID
   * @param id - Guideline ID to remove
   */
  const removeGuideline = useCallback((id: string) => {
    setGuidelines(prev => prev.filter(g => g.id !== id))
  }, [])

  /**
   * Remove all guidelines
   */
  const clearGuidelines = useCallback(() => {
    setGuidelines([])
  }, [])

  /**
   * Get guidelines for a specific axis
   * @param axis - 'x' for vertical, 'y' for horizontal
   */
  const getGuidelinesByAxis = useCallback(
    (axis: 'x' | 'y'): Guideline[] => {
      return guidelines.filter(g => g.axis === axis)
    },
    [guidelines]
  )

  /**
   * Find a guideline by ID
   * @param id - Guideline ID
   */
  const findGuideline = useCallback(
    (id: string): Guideline | undefined => {
      return guidelines.find(g => g.id === id)
    },
    [guidelines]
  )

  return {
    guidelines,
    addGuideline,
    updateGuideline,
    removeGuideline,
    clearGuidelines,
    getGuidelinesByAxis,
    findGuideline,
  }
}

export type UseGuidelinesReturn = ReturnType<typeof useGuidelines>
