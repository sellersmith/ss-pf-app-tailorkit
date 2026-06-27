/**
 * SVG Browser Utilities
 *
 * Browser detection utilities for SVG filter workarounds.
 * Kept within the SVG library to avoid cross-bundle import issues.
 *
 * @module shared/libraries/svg
 */

/**
 * Detect iOS devices including iPads in desktop mode
 */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent

  // iPhone, iPad, iPod detection
  if (/iP(ad|hone|od)/.test(ua)) {
    return true
  }

  // iPad Pro in desktop mode detection using maxTouchPoints
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) {
    return true
  }

  return false
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
