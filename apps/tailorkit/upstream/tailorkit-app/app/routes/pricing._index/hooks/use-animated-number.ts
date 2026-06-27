/**
 * Hook that animates a number from its previous value to the target value.
 * Creates a "counting up" dopamine effect when dollar amounts change.
 */

import { useEffect, useRef, useState } from 'react'

const ANIMATION_DURATION_MS = 400

export function useAnimatedNumber(target: number): { value: number; isAnimating: boolean } {
  const [display, setDisplay] = useState(target)
  const [isAnimating, setIsAnimating] = useState(false)
  const prevRef = useRef(target)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const from = prevRef.current
    prevRef.current = target

    if (from === target) return

    const diff = target - from
    const startTime = performance.now()
    setIsAnimating(true)

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / ANIMATION_DURATION_MS, 1)
      // Ease-out cubic for a satisfying deceleration
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = from + diff * eased

      setDisplay(Math.round(current * 100) / 100)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setDisplay(target)
        setIsAnimating(false)
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [target])

  return { value: display, isAnimating }
}
