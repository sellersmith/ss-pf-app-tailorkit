/**
 * Asset loading helpers for the fallback panel injector.
 *
 * Derives the extension CDN base URL from the tailorkit-helper.js script tag
 * and dynamically loads CSS/JS assets needed by the personalization panel.
 * All assets are loaded lazily — Konva is deferred until modal interaction.
 */

/** Derive the extension asset CDN base URL. Prefers the explicit data attribute set in app-embed.liquid. */
export function getAssetBaseUrl(): string {
  const helperScript = document.querySelector<HTMLScriptElement>('script[src*="tailorkit-helper"]')
  if (!helperScript) return ''

  // Prefer explicit attribute from Liquid's asset_url filter (most reliable)
  const explicit = helperScript.getAttribute('data-tailorkit-asset-base')
  if (explicit) return explicit

  // Fallback: derive from script src
  const src = helperScript.getAttribute('src') || ''
  return src.substring(0, src.lastIndexOf('/') + 1)
}

/** Load the main CSS stylesheet if not already present. */
export function loadFallbackCSS(assetBase: string): void {
  if (document.querySelector('link[href*="tailorkit.css"]')) return

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `${assetBase}tailorkit.css`
  document.head.appendChild(link)
}

/** Load the main JS bundle if not already present. Returns a Promise that resolves when loaded. */
export function loadFallbackMainJS(assetBase: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(
    'script[src*="tailorkit.js"]:not([src*="tailorkit-helper"])'
  )
  if (existing) return Promise.resolve()

  return loadScript(`${assetBase}tailorkit.js`)
}

/**
 * Lazy-load the Konva canvas bundle.
 * Called only when the modal opens to avoid blocking page performance.
 */
export function loadKonvaJS(assetBase: string): Promise<void> {
  if (document.querySelector('script[src*="tailorkit-konva.js"]')) return Promise.resolve()

  return loadScript(`${assetBase}tailorkit-konva.js`)
}

/**
 * Lazy-load the pinch-zoom script (mobile).
 * Called conditionally based on API response flags.
 */
export function loadPinchZoomJS(assetBase: string): Promise<void> {
  if (document.querySelector('script[src*="tailorkit-pinch-zoom.js"]')) return Promise.resolve()

  return loadScript(`${assetBase}tailorkit-pinch-zoom.js`)
}

/** Helper: inject a script tag and return a promise that resolves on load. */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`[TailorKit] Failed to load script: ${src}`))
    document.head.appendChild(script)
  })
}
