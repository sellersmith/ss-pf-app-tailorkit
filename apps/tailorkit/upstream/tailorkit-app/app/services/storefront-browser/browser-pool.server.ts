/**
 * Singleton Puppeteer browser pool for storefront verification.
 * Reuses a single browser instance with per-page isolation.
 * Max 2 concurrent pages to prevent memory issues.
 */

import puppeteer from 'puppeteer'
import type { Browser, Page } from 'puppeteer'

let browser: Browser | null = null
let activePages = 0
const MAX_CONCURRENT_PAGES = 2
const PAGE_TIMEOUT_MS = 15_000

/** Launch or return existing singleton browser */
async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
      ],
    })

    return browser
  } catch (error) {
    console.error('[browser-pool] Failed to launch browser:', error)
    throw new Error('Browser initialization failed')
  }
}

/**
 * Acquire a new page with standard defaults.
 * Throws if concurrency limit reached.
 */
export async function acquirePage(): Promise<Page> {
  if (activePages >= MAX_CONCURRENT_PAGES) {
    throw new Error('Browser pool at capacity. Try again shortly.')
  }

  const b = await getBrowser()
  const page = await b.newPage()
  activePages++

  await page.setViewport({ width: 1280, height: 720 })
  page.setDefaultTimeout(PAGE_TIMEOUT_MS)
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  )

  return page
}

/** Safely close a page and decrement counter */
export async function releasePage(page: Page): Promise<void> {
  try {
    if (!page.isClosed()) await page.close()
  } catch {
    // Page may already be closed — ignore
  } finally {
    activePages = Math.max(0, activePages - 1)
  }
}

// Graceful shutdown
function cleanup() {
  browser?.close().catch(() => {})
  browser = null
  activePages = 0
}

process.on('beforeExit', cleanup)
process.on('SIGTERM', cleanup)
process.on('SIGINT', cleanup)
