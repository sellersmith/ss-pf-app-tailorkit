export function isMobile() {
  // Method 1: User Agent detection (most common)
  const userAgent = navigator.userAgent || navigator.vendor || window.opera

  // Check for mobile patterns in user agent
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i

  if (mobileRegex.test(userAgent)) {
    return true
  }

  // Method 2: Screen width check (fallback)
  if (window.innerWidth <= 768) {
    return true
  }

  // Method 3: Touch capability check
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    return true
  }

  return false
}

/**
 * iOS Safari has stricter limits for offscreen canvas size used by Konva cache
 * We dynamically compute a safe pixelRatio per cached node to stay under limits
 *
 * Detects iOS devices including iPads in desktop mode using maxTouchPoints API
 */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent

  // iPhone, iPad, iPod detection
  if (/iP(ad|hone|od)/.test(ua)) {
    return true
  }

  // iPad Pro in desktop mode detection using maxTouchPoints
  // iPad Pro has maxTouchPoints > 1 even in desktop mode
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) {
    return true
  }

  return false
}

export function getDeviceType() {
  const ua = navigator.userAgent
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'Tablet'
  }
  if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|Opera M(obi|ini)/.test(ua)) {
    return 'Mobile'
  }
  return 'Desktop'
}

/**
 * Detect Safari browser (both macOS and iOS)
 *
 * Safari has limitations with large SVG filter operations.
 * Used to apply workarounds for filter rendering issues.
 */
export function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent

  // Safari detection: has Safari in UA but NOT Chrome/Chromium
  // Chrome includes "Safari" in its UA, so we must exclude it
  const isSafariBrowser = /Safari/.test(ua) && !/Chrome|Chromium|CriOS/.test(ua)

  return isSafariBrowser || isIOS()
}
