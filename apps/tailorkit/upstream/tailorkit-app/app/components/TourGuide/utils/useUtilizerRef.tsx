import type { MutableRefObject } from 'react'
import { useCallback, useRef } from 'react'

interface UtilizerRef {
  intervalRef: MutableRefObject<NodeJS.Timeout | string | number | undefined>
  animationTimeoutRef: MutableRefObject<NodeJS.Timeout | string | number | undefined>
  recursiveTimeoutRef: MutableRefObject<NodeJS.Timeout | string | number | undefined>
  tourActiveChangeRef: MutableRefObject<number>
  clearIntervalRef: () => void
  clearAnimationTimeoutRef: () => void
  clearRecursiveTimeoutRef: () => void
  setTourActiveChangeRef: (value: number) => void
}

/**
 * Use Utilizer Ref for tour guide
 *
 * @returns {
 * intervalRef: MutableRefObject<NodeJS.Timeout | string | number | undefined>,
 * animationTimeoutRef: MutableRefObject<NodeJS.Timeout | string | number | undefined>,
 * recursiveTimeoutRef: MutableRefObject<NodeJS.Timeout | string | number | undefined>,
 * clearIntervalRef: () => void,
 * clearAnimationTimeoutRef: () => void,
 * clearRecursiveTimeoutRef: () => void
 * }
 */
export function useUtilizerRef(): UtilizerRef {
  const intervalRef = useRef<NodeJS.Timeout | string | number | undefined>(undefined)
  const animationTimeoutRef = useRef<NodeJS.Timeout | string | number | undefined>(undefined)
  const recursiveTimeoutRef = useRef<NodeJS.Timeout | string | number | undefined>(undefined)
  const tourActiveChangeRef = useRef<number>(0)

  const clearIntervalRef = useCallback(() => {
    clearTimeout(intervalRef.current)
  }, [])

  const clearAnimationTimeoutRef = useCallback(() => {
    clearTimeout(animationTimeoutRef.current)
  }, [])

  const clearRecursiveTimeoutRef = useCallback(() => {
    clearTimeout(recursiveTimeoutRef.current)
  }, [])

  const setTourActiveChangeRef = useCallback((value: number) => {
    tourActiveChangeRef.current = value
  }, [])

  return {
    intervalRef,
    animationTimeoutRef,
    recursiveTimeoutRef,
    tourActiveChangeRef,
    clearIntervalRef,
    clearAnimationTimeoutRef,
    clearRecursiveTimeoutRef,
    setTourActiveChangeRef,
  }
}
