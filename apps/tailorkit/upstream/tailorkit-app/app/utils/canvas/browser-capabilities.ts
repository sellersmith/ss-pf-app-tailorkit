/**
 * Browser capabilities detection utilities for canvas optimization
 */

export interface BrowserCapabilities {
  cssFilter: boolean | null
  imageSmoothingQuality: boolean | null
}

/**
 * Detect and cache browser capabilities for canvas optimization
 * @returns Object containing browser capability flags
 */
export function detectBrowserCapabilities(): BrowserCapabilities {
  const capabilities: BrowserCapabilities = {
    cssFilter: null,
    imageSmoothingQuality: null,
  }

  try {
    const testCanvas = document.createElement('canvas')
    const ctx = testCanvas.getContext('2d')

    if (ctx) {
      capabilities.cssFilter = 'filter' in ctx
      capabilities.imageSmoothingQuality = 'imageSmoothingQuality' in ctx
    } else {
      capabilities.cssFilter = false
      capabilities.imageSmoothingQuality = false
    }
  } catch (e) {
    capabilities.cssFilter = false
    capabilities.imageSmoothingQuality = false
  }

  return capabilities
}

/**
 * Creates a cached version of browser capabilities detection
 * @returns Function that returns cached capabilities
 */
export function createBrowserCapabilitiesCache() {
  let cache: BrowserCapabilities | null = null

  return function getCachedCapabilities(): BrowserCapabilities {
    if (cache === null) {
      cache = detectBrowserCapabilities()
    }
    return cache
  }
}
