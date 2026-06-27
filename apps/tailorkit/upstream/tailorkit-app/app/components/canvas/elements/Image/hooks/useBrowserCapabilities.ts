import { useCallback, useRef } from 'react'

interface BrowserCapabilities {
  cssFilter: boolean
  imageSmoothingQuality: boolean
}

interface UseBrowserCapabilitiesReturn {
  capabilities: BrowserCapabilities
  detectCapabilities: () => void
  supportsFeature: (feature: keyof BrowserCapabilities) => boolean
}

/**
 * Custom hook for detecting and caching browser capabilities
 * Optimizes feature detection by caching results
 */
export function useBrowserCapabilities(): UseBrowserCapabilitiesReturn {
  // Cache browser capabilities to avoid repeated detection
  const capabilitiesRef = useRef<BrowserCapabilities | null>(null)

  /**
   * Detect and cache browser capabilities for canvas optimization
   */
  const detectCapabilities = useCallback((): void => {
    if (capabilitiesRef.current !== null) return

    try {
      const testCanvas = document.createElement('canvas')
      const ctx = testCanvas.getContext('2d')

      if (ctx) {
        capabilitiesRef.current = {
          cssFilter: (() => {
            try {
              ctx.filter = 'blur(1px)'
              return ctx.filter === 'blur(1px)'
            } catch {
              return false
            }
          })(),
          imageSmoothingQuality: 'imageSmoothingQuality' in ctx,
        }
      } else {
        capabilitiesRef.current = {
          cssFilter: false,
          imageSmoothingQuality: false,
        }
      }
    } catch (error) {
      console.warn('Failed to detect browser capabilities:', error)
      capabilitiesRef.current = {
        cssFilter: false,
        imageSmoothingQuality: false,
      }
    }
  }, [])

  /**
   * Check if a specific feature is supported
   */
  const supportsFeature = useCallback(
    (feature: keyof BrowserCapabilities): boolean => {
      if (capabilitiesRef.current === null) {
        detectCapabilities()
      }
      return capabilitiesRef.current?.[feature] ?? false
    },
    [detectCapabilities]
  )

  // Get current capabilities (detect if not already done)
  const capabilities: BrowserCapabilities = (() => {
    if (capabilitiesRef.current === null) {
      detectCapabilities()
    }
    return capabilitiesRef.current ?? { cssFilter: false, imageSmoothingQuality: false }
  })()

  return {
    capabilities,
    detectCapabilities,
    supportsFeature,
  }
}
