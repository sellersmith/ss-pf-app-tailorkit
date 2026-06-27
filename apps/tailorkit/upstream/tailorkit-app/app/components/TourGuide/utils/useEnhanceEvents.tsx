import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { TourGuideStep } from '../types'
import { DEFAULT_RECURSIVE_QUERY_COUNT, DEFAULT_RECURSIVE_QUERY_TIME } from '../constants'
import { sleep } from '~/utils/sleep'

/**
 * Enhance events for tour guide
 *
 * @param currentStep TourGuideStep
 * @param callback () => void
 * @returns {{ mountReady: boolean }} Whether onBeforeMount has completed
 */
export function useEnhanceEvents(currentStep: TourGuideStep, active: boolean, callback: () => void) {
  const recursiveQueryRef = useRef<number>(DEFAULT_RECURSIVE_QUERY_COUNT)
  const [mountReady, setMountReady] = useState(!currentStep?.onBeforeMount)

  // Delay execution of the second function to ensure the first function runs
  const handleAutoProgressive = useCallback(() => {
    setTimeout(() => {
      callback()
    }, 150)
  }, [callback])

  // Run onBeforeMount if it exists (support async), block positioning until done
  useLayoutEffect(() => {
    if (!currentStep || !active) return

    const { onBeforeMount } = currentStep

    if (!onBeforeMount) {
      setMountReady(true)
      return
    }

    setMountReady(false)

    // Await onBeforeMount before allowing positioning
    Promise.resolve(onBeforeMount())
      .then(() => setMountReady(true))
      .catch(err => {
        console.error(err)
        setMountReady(true) // Allow positioning even on error
      })
  }, [currentStep, active])

  // Enhance events for tour guide
  useEffect(() => {
    if (!currentStep) return

    const { element: elementSelector, autoProgressive, recursiveQuery } = currentStep

    if (!autoProgressive) return

    const selectors = typeof autoProgressive !== 'boolean' ? autoProgressive : [elementSelector]
    const elements: HTMLElement[] = []

    ;(async () => {
      // Add event listener for auto progressive
      for (const selector of selectors) {
        let element = document.querySelector(selector) as HTMLElement

        // Query element while it is not found and recursive query is enabled
        while (!element && recursiveQuery && recursiveQueryRef.current <= recursiveQuery) {
          element = document.querySelector(selector) as HTMLElement

          // Sleep for a while before querying again
          await sleep(DEFAULT_RECURSIVE_QUERY_TIME)

          // Increase recursive query count
          recursiveQueryRef.current++
        }

        // Reset recursive query count if element is found
        recursiveQueryRef.current = DEFAULT_RECURSIVE_QUERY_COUNT

        if (element) {
          elements.push(element)
          element.addEventListener('click', handleAutoProgressive)
        }
      }
    })()

    // Cleanup on dependency change or component unmount
    return () => {
      for (const element of elements) {
        element.removeEventListener('click', handleAutoProgressive)
      }
    }
  }, [currentStep, active, handleAutoProgressive])

  useEffect(() => {
    if (!currentStep) return

    const { disableUserScrollable } = currentStep

    if (!disableUserScrollable || !active) return

    const preventScroll = (e: Event) => e.preventDefault()
    const preventKeys = (e: KeyboardEvent) => {
      const keys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', ' ', 'Home', 'End']
      if (keys.includes(e.key)) {
        e.preventDefault()
      }
    }

    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'

    // Add event listeners
    window.addEventListener('wheel', preventScroll, { passive: false })
    window.addEventListener('touchmove', preventScroll, { passive: false })
    window.addEventListener('keydown', preventKeys)

    // Cleanup on unmount or re-enable
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      window.removeEventListener('wheel', preventScroll)
      window.removeEventListener('touchmove', preventScroll)
      window.removeEventListener('keydown', preventKeys)
    }
  }, [active, currentStep])

  return { mountReady }
}
