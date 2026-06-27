/**
 * Memory Debug Overlay for iOS
 *
 * Creates an on-screen overlay showing real-time memory stats.
 * Useful for debugging memory issues on iOS where DevTools disconnect on crash.
 *
 * Usage:
 *   import { createMemoryDebugOverlay } from './memory-debug-overlay'
 *   const debug = createMemoryDebugOverlay()
 *   debug.show()
 *
 *   // In render function:
 *   debug.trackRender(imageWidth, imageHeight)
 *
 *   // To hide:
 *   debug.hide()
 *
 * @module shared/utils/memory-debug-overlay
 */

import { isIOS } from '../../assets/utils/devices'
import { getRenderCacheSize } from '../libraries/svg/svg-render-cache'
import { getFontCacheSize } from '../libraries/svg/svg-font-manager'

interface MemoryStats {
  renderCount: number
  cacheHits: number
  cacheMisses: number
  totalImageBytes: number
  peakImageBytes: number
  lastRenderTime: number
  renderCacheSize: number
  fontCacheSize: number
  fps: number
}

interface MemoryDebugOverlay {
  show: () => void
  hide: () => void
  trackRender: (width: number, height: number, cacheHit: boolean) => void
  trackCacheEviction: () => void
  reset: () => void
  getStats: () => MemoryStats
}

let overlayElement: HTMLDivElement | null = null
let statsInterval: ReturnType<typeof setInterval> | null = null
let frameCount = 0
let lastFpsTime = Date.now()

const stats: MemoryStats = {
  renderCount: 0,
  cacheHits: 0,
  cacheMisses: 0,
  totalImageBytes: 0,
  peakImageBytes: 0,
  lastRenderTime: 0,
  renderCacheSize: 0,
  fontCacheSize: 0,
  fps: 0,
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`
}

function createOverlayElement(): HTMLDivElement {
  const div = document.createElement('div')
  div.id = 'memory-debug-overlay'
  div.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.85);
    color: #0f0;
    font-family: monospace;
    font-size: 11px;
    padding: 8px 12px;
    border-radius: 6px;
    z-index: 999999;
    pointer-events: none;
    white-space: pre;
    line-height: 1.4;
    min-width: 180px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  `
  return div
}

function updateOverlay(): void {
  if (!overlayElement) return

  // Calculate FPS
  frameCount++
  const now = Date.now()
  const elapsed = now - lastFpsTime
  if (elapsed >= 1000) {
    stats.fps = Math.round((frameCount * 1000) / elapsed)
    frameCount = 0
    lastFpsTime = now
  }

  // Update cache sizes
  try {
    stats.renderCacheSize = getRenderCacheSize()
    stats.fontCacheSize = getFontCacheSize()
  } catch {
    // Functions might not be available
  }

  const hitRate = stats.renderCount > 0
    ? Math.round((stats.cacheHits / stats.renderCount) * 100)
    : 0

  // Color code based on memory usage
  const memColor = stats.totalImageBytes > 50 * 1024 * 1024 ? '#f00'
                   : stats.totalImageBytes > 30 * 1024 * 1024 ? '#ff0' : '#0f0'

  overlayElement.innerHTML = `
<span style="color:#fff;font-weight:bold">iOS Memory Debug</span>
─────────────────
Renders: ${stats.renderCount} (${stats.fps} fps)
Cache: ${stats.cacheHits}/${stats.renderCount} (${hitRate}%)
<span style="color:${memColor}">Memory: ${formatBytes(stats.totalImageBytes)}</span>
Peak: ${formatBytes(stats.peakImageBytes)}
─────────────────
Render$: ${stats.renderCacheSize}/15
Font$: ${stats.fontCacheSize}
─────────────────
<span style="color:#888">Drag slider to test</span>
  `.trim()
}

/**
 * Create a memory debug overlay instance
 */
export function createMemoryDebugOverlay(): MemoryDebugOverlay {
  return {
    show() {
      if (typeof document === 'undefined') return

      // Remove existing overlay
      const existing = document.getElementById('memory-debug-overlay')
      if (existing) existing.remove()

      // Create new overlay
      overlayElement = createOverlayElement()
      document.body.appendChild(overlayElement)

      // Start update interval
      if (statsInterval) clearInterval(statsInterval)
      statsInterval = setInterval(updateOverlay, 100)

      // Initial update
      updateOverlay()

      console.log('[MemoryDebug] Overlay shown')
    },

    hide() {
      if (overlayElement) {
        overlayElement.remove()
        overlayElement = null
      }
      if (statsInterval) {
        clearInterval(statsInterval)
        statsInterval = null
      }
      console.log('[MemoryDebug] Overlay hidden')
    },

    trackRender(width: number, height: number, cacheHit: boolean) {
      stats.renderCount++
      if (cacheHit) {
        stats.cacheHits++
      } else {
        stats.cacheMisses++
        // Each pixel = 4 bytes (RGBA)
        const imageBytes = width * height * 4
        stats.totalImageBytes += imageBytes
        if (stats.totalImageBytes > stats.peakImageBytes) {
          stats.peakImageBytes = stats.totalImageBytes
        }
      }
      stats.lastRenderTime = Date.now()

      // Log every 50 renders
      if (stats.renderCount % 50 === 0) {
        console.log('[MemoryDebug]', {
          renders: stats.renderCount,
          memory: formatBytes(stats.totalImageBytes),
          peak: formatBytes(stats.peakImageBytes),
          cacheSize: stats.renderCacheSize,
        })
      }
    },

    trackCacheEviction() {
      // Rough estimate: evicted image releases memory
      // This is approximate since we don't know the exact size
      const avgImageSize = stats.renderCount > 0
        ? stats.totalImageBytes / Math.max(1, stats.cacheMisses)
        : 500 * 1024 // 500KB default estimate
      stats.totalImageBytes = Math.max(0, stats.totalImageBytes - avgImageSize)
    },

    reset() {
      stats.renderCount = 0
      stats.cacheHits = 0
      stats.cacheMisses = 0
      stats.totalImageBytes = 0
      stats.peakImageBytes = 0
      stats.lastRenderTime = 0
      console.log('[MemoryDebug] Stats reset')
    },

    getStats() {
      return { ...stats }
    },
  }
}

// Global singleton for easy access
let globalDebugOverlay: MemoryDebugOverlay | null = null

/**
 * Get or create the global debug overlay instance
 */
export function getMemoryDebugOverlay(): MemoryDebugOverlay {
  if (!globalDebugOverlay) {
    globalDebugOverlay = createMemoryDebugOverlay()
  }
  return globalDebugOverlay
}

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).__memoryDebug = {
    show: () => getMemoryDebugOverlay().show(),
    hide: () => getMemoryDebugOverlay().hide(),
    reset: () => getMemoryDebugOverlay().reset(),
    stats: () => getMemoryDebugOverlay().getStats(),
  }

  // Auto-show on iOS in development
  if (isIOS() && process.env.NODE_ENV === 'development') {
    // Delay to ensure DOM is ready
    setTimeout(() => {
      console.log('[MemoryDebug] iOS detected - type __memoryDebug.show() to enable overlay')
    }, 2000)
  }
}
