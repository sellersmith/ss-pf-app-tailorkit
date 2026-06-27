import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    clarity: {
      (method: 'set', key: string, value: string): void
      (method: 'identify', userId: string, sessionId?: string, pageId?: string, friendlyName?: string): void
      (method: 'consent'): void
      (method: 'upgrade', reason: string): void
      (method: 'event', eventName: string): void
      (method: 'stop'): void
      (method: 'start', options?: { content?: boolean; cookies?: boolean }): void
      q?: unknown[]
    }
  }
}

interface UseClarityOptions {
  /** Clarity project key */
  clarityKey: string
  /** Shop domain for user identification (e.g., "my-shop.myshopify.com") */
  shopDomain?: string | null
}

/**
 * Custom hook to inject the Microsoft Clarity script with SPA support and user identification.
 *
 * **Key features:**
 * - Injects Clarity script only once
 * - Automatically identifies user by shop domain for session grouping
 * - Handles SPA navigation (no session breaks on URL param changes)
 * - Clarity uses MutationObserver to track DOM changes
 *
 * **Known limitations:**
 * - Dynamic CSS/lazy-loaded styles may occasionally not be captured
 *
 * @param {UseClarityOptions} options - Configuration options
 *
 * @example
 * useClarity({ clarityKey: 'abc123', shopDomain: 'my-shop.myshopify.com' })
 */
export const useClarity = ({ clarityKey, shopDomain }: UseClarityOptions) => {
  const isScriptInjected = useRef(false)
  const isIdentified = useRef(false)

  // Inject Clarity script (once)
  useEffect(() => {
    if (typeof window === 'undefined' || !clarityKey || isScriptInjected.current) {
      if (!clarityKey) {
        console.warn('[Clarity Debug] No clarity key provided')
      }
      return
    }

    isScriptInjected.current = true
    ;(function (c, l, a, r, i, t, y) {
      // @ts-ignore - Clarity initialization pattern
      c[a]
        = c[a]
        || function () {
          // @ts-ignore
          ;(c[a].q = c[a].q || []).push(arguments)
        }
      // @ts-ignore
      t = l.createElement(r)
      // @ts-ignore
      t.async = 1
      // @ts-ignore
      t.src = `https://www.clarity.ms/tag/${i}`
      // @ts-ignore
      y = l.getElementsByTagName(r)[0]
      // @ts-ignore
      y.parentNode.insertBefore(t, y)
    })(window, document, 'clarity', 'script', clarityKey)
  }, [clarityKey])

  // Identify user by shop domain (once per session)
  useEffect(() => {
    if (!shopDomain || isIdentified.current) return

    // Wait for Clarity to be ready, then identify
    const identifyUser = () => {
      if (typeof window !== 'undefined' && window.clarity) {
        const shopName = shopDomain.replace('.myshopify.com', '')
        window.clarity('identify', shopDomain, undefined, undefined, shopName)
        isIdentified.current = true
      } else {
        console.warn('[Clarity Debug] Failed to identify - window.clarity not available')
      }
    }

    // Clarity may not be immediately available, retry with small delay
    const timeoutId = setTimeout(identifyUser, 500)
    return () => clearTimeout(timeoutId)
  }, [shopDomain])
}

/**
 * Utility to manually trigger Clarity events for important user actions.
 * Useful for tracking specific interactions that might span URL changes.
 *
 * @example
 * clarityEvent('tab-switch-design-to-mockup')
 */
export const clarityEvent = (eventName: string) => {
  if (typeof window !== 'undefined' && window.clarity) {
    window.clarity('event', eventName)
  }
}

/**
 * Mark current session as important to ensure full recording.
 * Clarity may prioritize and ensure complete capture of "upgraded" sessions.
 *
 * @param reason - Reason for upgrading (for internal tracking)
 *
 * @example
 * clarityUpgrade('user-in-editor')
 */
export const clarityUpgrade = (reason: string) => {
  if (typeof window !== 'undefined' && window.clarity) {
    window.clarity('upgrade', reason)
  }
}

/**
 * Utility to set custom tags for filtering sessions in Clarity dashboard.
 *
 * @example
 * claritySetTag('editor-mode', 'design')
 */
export const claritySetTag = (key: string, value: string) => {
  if (typeof window !== 'undefined' && window.clarity) {
    window.clarity('set', key, value)
  }
}

/**
 * Utility to identify user for better session grouping.
 *
 * @example
 * clarityIdentify('shop-domain', 'my-shop.myshopify.com')
 */
export const clarityIdentify = (userId: string, friendlyName?: string) => {
  if (typeof window !== 'undefined' && window.clarity) {
    window.clarity('identify', userId, undefined, undefined, friendlyName)
  }
}

/**
 * Stop the current Clarity recording session.
 * Use this before major navigation events in SPAs where Clarity might
 * incorrectly end the session.
 *
 * @example
 * clarityStop()
 */
export const clarityStop = () => {
  if (typeof window !== 'undefined' && window.clarity) {
    window.clarity('stop')
  }
}

/**
 * Start a new Clarity recording session.
 * Use this after major navigation events in SPAs to ensure recording continues.
 * Should be called after clarityStop() and after DOM has settled.
 *
 * @param options - Optional configuration for the new session
 * @param options.content - Whether to capture content (default: true)
 * @param options.cookies - Whether to use cookies for session tracking (default: true)
 *
 * @example
 * clarityStart()
 * clarityStart({ content: true, cookies: true })
 */
export const clarityStart = (options?: { content?: boolean; cookies?: boolean }) => {
  if (typeof window !== 'undefined' && window.clarity) {
    window.clarity('start', options ?? { content: true, cookies: true })
  }
}
