/**
 * Storefront browsing tool for Elva AI.
 * Visits merchant's store via headless Puppeteer to verify TailorKit installation,
 * customizer rendering, and diagnose display issues.
 */

import { acquirePage, releasePage } from '~/services/storefront-browser/browser-pool.server'
import { analyzeScreenshot } from './analyze-screenshot.server'

export interface BrowseResult {
  url: string
  pageTitle: string
  appBlockInstalled: boolean
  customizerVisible: boolean
  consoleErrors: string[]
  screenshotAnalysis: string
  recommendations: string[]
}

/** Rate limiter: conversationId → count per hour */
const browseRateLimits = new Map<string, { count: number; resetAt: number }>()
const MAX_BROWSES_PER_HOUR = 3

/**
 * Validate URL belongs to merchant's store domain.
 * Prevents SSRF by only allowing the merchant's own domain.
 */
function validateStoreUrl(url: string, storeDomain: string): boolean {
  try {
    const parsed = new URL(url)
    const normalizedDomain = storeDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
    // Exact domain match
    if (parsed.hostname === normalizedDomain) return true
    // Exact myshopify.com match
    const shopMatch = normalizedDomain.match(/^([\w-]+)\.myshopify\.com/)
    if (shopMatch && parsed.hostname === `${shopMatch[1]}.myshopify.com`) return true
    return false
  } catch {
    return false
  }
}

/**
 * Browse a merchant's storefront and return diagnostic findings.
 * Requires shopData for domain validation.
 */
export async function browseStorefront(args: {
  productUrl?: string
  shopData: any
  conversationId?: string
}): Promise<string> {
  const { productUrl, shopData, conversationId } = args
  const storeDomain = shopData?.shopConfig?.domain

  if (!storeDomain) {
    return 'Unable to determine store URL. Please provide your store domain.'
  }

  // Rate limit
  if (conversationId) {
    const now = Date.now()
    const entry = browseRateLimits.get(conversationId)
    if (entry && now < entry.resetAt && entry.count >= MAX_BROWSES_PER_HOUR) {
      return 'Browse limit reached (3 per hour). Please describe the issue in text.'
    }
    if (!entry || now >= entry.resetAt) {
      browseRateLimits.set(conversationId, { count: 1, resetAt: now + 3600000 })
    } else {
      entry.count++
    }
  }

  // Resolve target URL
  const targetUrl = productUrl || `https://${storeDomain}`

  // Validate URL belongs to this merchant
  if (productUrl && !validateStoreUrl(productUrl, storeDomain)) {
    return `URL does not match your store domain (${storeDomain}). Please provide a URL from your store.`
  }

  const page = await acquirePage()
  const consoleErrors: string[] = []

  try {
    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text()
        if (!text.includes('favicon') && !text.includes('analytics')) {
          consoleErrors.push(text.slice(0, 200))
        }
      }
    })

    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 15000 })

    // Extract page state
    const pageState = await page.evaluate(() => ({
      pageTitle: document.title,
      hasAppBlock: !!(
        document.querySelector('[data-tailorkit]') || document.querySelector('[data-app-block-tailorkit]')
      ),
      hasCustomizer: !!(
        document.querySelector('.tailorkit-customizer')
        || document.querySelector('#tailorkit-root')
        || document.querySelector('[class*="emtlkit"]')
      ),
      hasAppEmbed: document.documentElement.innerHTML.includes('tailorkit'),
      isPasswordProtected: !!document.querySelector('form[action*="password"]'),
    }))

    if (pageState.isPasswordProtected) {
      return (
        `Your store (${targetUrl}) is password-protected. I cannot verify the storefront while the password page is active. `
        + 'Please temporarily disable it or check from within your Shopify admin.'
      )
    }

    // Take screenshot for visual analysis
    const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 50, encoding: 'base64' })
    const screenshotDataUrl = `data:image/jpeg;base64,${screenshotBuffer}`

    let screenshotAnalysis = ''
    try {
      screenshotAnalysis = await analyzeScreenshot(screenshotDataUrl, 'Verify TailorKit installation')
    } catch {
      screenshotAnalysis = 'Screenshot taken but visual analysis unavailable.'
    }

    // Build recommendations
    const recommendations: string[] = []
    if (!pageState.hasAppEmbed && !pageState.hasAppBlock) {
      recommendations.push(
        'TailorKit app block not found. Add it via: Shopify Admin → Online Store → Customize → App embeds → Enable TailorKit.'
      )
    }
    if (pageState.hasAppBlock && !pageState.hasCustomizer) {
      recommendations.push(
        'App block is installed but customizer is not rendering. '
          + 'Check if the product has an active TailorKit integration (Template → Integrate → Publish).'
      )
    }
    if (consoleErrors.length > 0) {
      recommendations.push(`Found ${consoleErrors.length} console error(s) on the page.`)
    }
    if (pageState.hasCustomizer) {
      recommendations.push('TailorKit customizer is visible and appears to be working.')
    }

    const result: BrowseResult = {
      url: targetUrl,
      pageTitle: pageState.pageTitle,
      appBlockInstalled: pageState.hasAppBlock || pageState.hasAppEmbed,
      customizerVisible: pageState.hasCustomizer,
      consoleErrors: consoleErrors.slice(0, 5),
      screenshotAnalysis,
      recommendations,
    }

    return JSON.stringify(result)
  } catch (error: any) {
    if (error.name === 'TimeoutError') {
      return `Page took too long to load (${targetUrl}). The store may be slow or temporarily unavailable.`
    }
    console.error('[browse-storefront] Error:', error.message)
    return `Failed to browse ${targetUrl}: ${error.message}`
  } finally {
    await releasePage(page)
  }
}
