import type { Browser } from 'puppeteer'
import puppeteer from 'puppeteer'

/**
 * Browser Pool Configuration
 * Limits concurrent Chrome instances to prevent resource exhaustion
 * Each request gets a fresh browser to avoid stale connection issues
 *
 * Note: This uses module-level state which persists across requests in a long-running server.
 * This is intentional for connection pooling but may reset during hot module reloading in dev.
 */
const MAX_CONCURRENT_BROWSERS = 5 // 8GB server: 5 browsers × ~500MB = 2.5GB, leaving room for app + OS
const ACQUIRE_TIMEOUT_MS = 120000 // Max wait time to acquire a browser slot

let activeBrowserCount = 0
let pendingAcquisitions = 0 // Track slots being acquired to prevent race conditions
const waitingQueue: Array<() => void> = []

/**
 * Get browser launch arguments optimized for server environment
 */
function getBrowserArgs(): string[] {
  return [
    '--disable-gpu', // Disables GPU hardware acceleration
    '--no-sandbox', // Disables the sandbox (use cautiously)
    '--disable-setuid-sandbox', // Disables setuid sandbox
    '--disable-dev-shm-usage', // Prevents /dev/shm usage for shared memory
    '--disable-extensions', // Disables all extensions
    '--disable-infobars', // Removes Chrome automation infobar
    '--incognito', // Launches in incognito mode
    '--disable-blink-features=AutomationControlled', // Mimics a real browser
    '--no-zygote', // Disables the zygote process for memory savings
    '--no-first-run', // Skips the first run tasks
    '--disable-background-networking', // Disables background networking
    '--disable-background-timer-throttling', // Disables throttling of timers in the background
    '--disable-client-side-phishing-detection', // Disables phishing detection
    '--disable-default-apps', // Disables default apps
    '--disable-popup-blocking', // Disables the popup blocking
    '--disable-renderer-backgrounding', // Prevents backgrounding renderers
    '--disable-sync', // Disables syncing to a Google account
    '--disable-translate', // Disables Google Translate
    '--mute-audio', // Mutes any audio for efficiency
  ]
}

/**
 * Wait for a browser slot to become available and reserve it atomically
 * This prevents race conditions where multiple requests pass the check simultaneously
 */
async function waitForSlot(timeoutMs: number): Promise<void> {
  // Check if slot is available (accounting for pending acquisitions)
  if (activeBrowserCount + pendingAcquisitions < MAX_CONCURRENT_BROWSERS) {
    pendingAcquisitions++ // Reserve slot immediately to prevent race condition
    return
  }

  // Log when requests start queuing (helps with debugging)
  console.log('[BrowserPool] At capacity, queuing request', getPoolStats())

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const index = waitingQueue.indexOf(resolver)
      if (index > -1) {
        waitingQueue.splice(index, 1)
      }
      reject(new Error('Timeout waiting for browser slot'))
    }, timeoutMs)

    const resolver = () => {
      clearTimeout(timeout)
      pendingAcquisitions++ // Reserve slot when notified
      resolve()
    }

    waitingQueue.push(resolver)
  })
}

/**
 * Release a browser slot and notify waiting requests
 */
function releaseSlot(): void {
  activeBrowserCount--

  // Notify next waiting request
  if (waitingQueue.length > 0) {
    const next = waitingQueue.shift()
    if (next) next()
  }
}

/**
 * Acquire a fresh browser instance
 * Will wait if at max capacity, up to ACQUIRE_TIMEOUT_MS
 */
export async function acquireBrowser(): Promise<Browser> {
  // Wait for a slot if at capacity (slot is reserved in waitForSlot)
  await waitForSlot(ACQUIRE_TIMEOUT_MS)

  // Convert pending to active (slot was reserved in waitForSlot)
  pendingAcquisitions--
  activeBrowserCount++

  try {
    // Create a fresh browser each time to avoid stale connection issues
    const browser = await puppeteer.launch({
      headless: true,
      args: getBrowserArgs(),
    })

    return browser
  } catch (error) {
    // Release slot if browser creation fails
    releaseSlot()
    console.error('[BrowserPool] Failed to launch browser:', error)
    throw error
  }
}

/**
 * Release a browser and close it
 * Always closes the browser since we create fresh ones each time
 */
export async function releaseBrowser(browser: Browser): Promise<void> {
  try {
    // Close all pages first
    if (browser.connected) {
      const pages = await browser.pages().catch(() => [])
      await Promise.all(pages.map(page => page.close().catch(() => {})))

      // Close the browser
      await browser.close().catch(() => {})
    }
  } catch (error) {
    // Log errors in non-production for debugging
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[BrowserPool] Error closing browser:', error)
    }
  } finally {
    // Always release the slot
    releaseSlot()
  }
}

/**
 * Get current pool statistics
 * Useful for monitoring and debugging
 */
export function getPoolStats(): { active: number; pending: number; waiting: number; max: number } {
  return {
    active: activeBrowserCount,
    pending: pendingAcquisitions,
    waiting: waitingQueue.length,
    max: MAX_CONCURRENT_BROWSERS,
  }
}
