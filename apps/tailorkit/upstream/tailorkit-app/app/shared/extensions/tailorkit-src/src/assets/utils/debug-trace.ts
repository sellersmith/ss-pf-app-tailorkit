/**
 * Lightweight sessionStorage debug tracer for ATC pipeline diagnosis.
 * Gated behind ?tlk_debug=1 query param. Zero-cost when disabled.
 *
 * Usage on storefront:
 *   1. Add ?tlk_debug=1 to product page URL
 *   2. Interact with customizer, click ATC
 *   3. On cart page, open DevTools → console
 *   4. Run: window.__tlk_traces()
 *   5. Run: window.__tlk_traces_clear() to reset
 */

const STORAGE_KEY = '__tlk_debug_trace'
const MAX_ENTRIES = 50
const DEBUG_PARAM = 'tlk_debug'
const SESSION_FLAG = '__tlk_debug_active'

/** Set to true to force debug mode on (bypass ?tlk_debug=1 requirement). Revert to false when done. */
const FORCE_DEBUG = false

interface TraceEntry {
  /** ISO timestamp */
  ts: string
  /** Checkpoint name */
  cp: string
  /** Arbitrary payload */
  data: unknown
}

// ─── Debug flag (cached per page load) ───────────────────────────────────────

let _enabled: boolean | null = null

export function isDebugEnabled(): boolean {
  if (_enabled !== null) return _enabled
  if (FORCE_DEBUG) { _enabled = true; return true }
  try {
    const params = new URLSearchParams(window.location.search)
    _enabled = params.get(DEBUG_PARAM) === '1'
    if (_enabled) {
      sessionStorage.setItem(SESSION_FLAG, '1')
    } else {
      // Check if previously activated in this session (survives navigation)
      _enabled = sessionStorage.getItem(SESSION_FLAG) === '1'
    }
  } catch {
    _enabled = false
  }
  return _enabled
}

// ─── Core trace writer ───────────────────────────────────────────────────────

/** Write a trace entry to sessionStorage ring buffer */
export function traceLog(checkpoint: string, data?: unknown): void {
  if (!isDebugEnabled()) return
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const entries: TraceEntry[] = raw ? JSON.parse(raw) : []

    entries.push({
      ts: new Date().toISOString(),
      cp: checkpoint,
      data: data ?? null,
    })

    // Ring buffer: evict oldest when over cap
    while (entries.length > MAX_ENTRIES) entries.shift()

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // sessionStorage full or unavailable — silent fail
  }
}

// ─── Console readers ─────────────────────────────────────────────────────────

function dumpTraces(): TraceEntry[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const entries: TraceEntry[] = raw ? JSON.parse(raw) : []
    if (entries.length === 0) {
      console.log('[TailorKit Debug] No traces found. Add ?tlk_debug=1 to product page URL.')
      return []
    }
    console.table(
      entries.map(e => ({
        time: e.ts,
        checkpoint: e.cp,
        data: typeof e.data === 'object' ? JSON.stringify(e.data) : e.data,
      }))
    )
    return entries
  } catch {
    console.error('[TailorKit Debug] Failed to read traces')
    return []
  }
}

function clearTraces(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(SESSION_FLAG)
    _enabled = null
    console.log('[TailorKit Debug] Traces cleared.')
  } catch {
    // ignore
  }
}

// ─── Passive XHR detection ──────────────────────────────────────────────────

/**
 * Install passive XHR detection for /cart/add.
 * Does NOT modify requests — only logs when XHR is used for cart operations.
 */
export function installXhrDetection(): void {
  if (!isDebugEnabled()) return
  try {
    const origOpen = XMLHttpRequest.prototype.open
    const xhrTargets = new WeakMap<XMLHttpRequest, { method: string; url: string }>()

    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      async_: boolean = true,
      username?: string | null,
      password?: string | null
    ) {
      const urlStr = typeof url === 'string' ? url : url.toString()
      if (urlStr.includes('/cart/add')) {
        xhrTargets.set(this, { method, url: urlStr })
        traceLog('XHR_CART_ADD_DETECTED', { method, url: urlStr })
      }
      return origOpen.call(this, method, url, async_, username, password)
    }

    const origSend = XMLHttpRequest.prototype.send
    XMLHttpRequest.prototype.send = function (body?: any) {
      const target = xhrTargets.get(this)
      if (target) {
        let bodyInfo: unknown = null
        if (body instanceof FormData) {
          const keys: string[] = []
          for (const [key] of body.entries()) keys.push(key)
          bodyInfo = { type: 'FormData', keys, keyCount: keys.length }
        } else if (typeof body === 'string') {
          try {
            const parsed = JSON.parse(body)
            const propKeys = parsed.properties ? Object.keys(parsed.properties) : []
            bodyInfo = { type: 'JSON', propKeys, propCount: propKeys.length }
          } catch {
            bodyInfo = { type: 'string', length: body.length, preview: body.slice(0, 200) }
          }
        } else {
          bodyInfo = { type: body?.constructor?.name || typeof body }
        }
        traceLog('XHR_CART_ADD_BODY', { ...target, body: bodyInfo })
      }
      return origSend.apply(this, [body])
    }

    traceLog('XHR_DETECTION_INSTALLED')
  } catch {
    // XHR patching failed — non-critical
  }
}

// ─── Global initialization ──────────────────────────────────────────────────

/**
 * Monitor all form[action*="/cart/add"] submit events.
 * Detects if the form actually submits natively or if theme JS bypasses it.
 */
export function installFormSubmitDetection(): void {
  if (!isDebugEnabled()) return
  try {
    // Capture phase to catch submit before any theme JS can preventDefault
    document.addEventListener('submit', (e: Event) => {
      const form = e.target as HTMLFormElement
      if (!form?.action?.includes('/cart/add')) return

      const hiddenInputs = form.querySelectorAll('input[data-name]')
      const allInputs = form.querySelectorAll('input')
      const propInputs = form.querySelectorAll('input[name^="properties["]')

      // Snapshot ALL /cart/add forms on the page at submit time
      const allCartForms = document.querySelectorAll('form[action*="/cart/add"]')
      const formSnapshots = Array.from(allCartForms).map((f, idx) => {
        const ff = f as HTMLFormElement
        const tlk = ff.querySelectorAll('input[data-name]')
        const props = ff.querySelectorAll('input[name^="properties["]')
        return {
          idx,
          action: ff.action,
          totalInputs: ff.querySelectorAll('input').length,
          tlkInputs: tlk.length,
          propertyInputs: props.length,
          isSubmitting: ff === form,
        }
      })

      traceLog('FORM_SUBMIT_FIRED', {
        action: form.action,
        method: form.method,
        totalInputs: allInputs.length,
        tlkInputs: hiddenInputs.length,
        propertyInputs: propInputs.length,
        propertyNames: Array.from(propInputs).map(i => (i as HTMLInputElement).name).slice(0, 30),
        defaultPrevented: e.defaultPrevented,
        allCartForms: formSnapshots,
      })
    }, true) // capture phase

    // Also listen in bubble phase to detect if preventDefault was called
    document.addEventListener('submit', (e: Event) => {
      const form = e.target as HTMLFormElement
      if (!form?.action?.includes('/cart/add')) return

      traceLog('FORM_SUBMIT_BUBBLE', {
        defaultPrevented: e.defaultPrevented,
      })
    }, false)

    traceLog('FORM_SUBMIT_DETECTION_INSTALLED')
  } catch {
    // non-critical
  }
}

/** Register window.__tlk_traces() and window.__tlk_traces_clear() + start XHR detection */
export function installDebugGlobals(): void {
  if (!isDebugEnabled()) return
  ;(window as any).__tlk_traces = dumpTraces
  ;(window as any).__tlk_traces_clear = clearTraces
  traceLog('DEBUG_SESSION_STARTED', {
    url: window.location.href,
    theme: (window as any).Shopify?.theme?.schema_name,
  })
}
