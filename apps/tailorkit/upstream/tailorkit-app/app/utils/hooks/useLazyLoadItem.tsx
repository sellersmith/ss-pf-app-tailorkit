import { useState, useEffect, useRef } from 'react'

/**
 * useLazyLoad Hook
 * @param {number} delay - The simulated delay in milliseconds for loading (default: 1000ms)
 * @param {Object} options - Intersection Observer options
 * @returns {Object} - { ref, isVisible, isLoading }
 */
const useLazyLoadItem = (delay = 1000, options = { threshold: 0.1 }) => {
  const [isVisible, setIsVisible] = useState(false) // Tracks if the item is in the viewport
  const [isLoading, setIsLoading] = useState(true) // Tracks if the content is still loading
  const ref = useRef(null) // Ref for the DOM element

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true) // Set visible when the element enters the viewport
      } else {
        setIsVisible(false) // Reset when it leaves the viewport
      }
    }, options)

    const refCurrent = ref.current

    if (refCurrent) {
      observer.observe(refCurrent)
    }

    return () => {
      if (refCurrent) observer.unobserve(refCurrent)
    }
  }, [options])

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => setIsLoading(false), delay) // Simulate loading delay
      return () => clearTimeout(timer)
    }
  }, [isVisible, delay])

  return { ref, isVisible, isLoading }
}

export default useLazyLoadItem
