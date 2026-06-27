/**
 * Icon loader that fetches SVG icons from CDN URLs provided by Shopify Liquid
 * This reduces JS bundle size by loading icons as external assets
 */

export interface IconUrls {
  undo: string
  redo: string
  reset: string
  rotateLeft: string
  rotateRight: string
  zoomIn: string
  zoomOut: string
  removeBg: string
  removedBg: string
  close: string
  send: string
  stop: string
  magic: string
  spinner: string
  error: string
  arrowDown: string
  check: string
  select: string
  info: string
  rotate: string
  upload: string
  aiGenerate: string
  autoFit: string
}

export type IconName = keyof IconUrls

// Cache for fetched SVG content (keyed by URL)
const svgCache = new Map<string, string>()

// Cache for fetched SVG content (keyed by icon name for sync access)
const iconNameCache = new Map<IconName, string>()

// Promise cache for in-flight requests
const fetchPromiseCache = new Map<string, Promise<string>>()

// Track if all icons have been preloaded
let allIconsPreloaded = false

/**
 * Get icon URLs from the Liquid-generated JSON script tag
 */
export function getIconUrls(): IconUrls | null {
  const scriptEl = document.getElementById('tailorkit-icon-urls')
  if (!scriptEl?.textContent) return null

  try {
    return JSON.parse(scriptEl.textContent) as IconUrls
  } catch {
    console.error('[TailorKit] Failed to parse icon URLs')
    return null
  }
}

/**
 * Fetch SVG content from URL with caching
 */
export async function fetchSvgContent(url: string): Promise<string> {
  // Return cached content if available
  if (svgCache.has(url)) {
    return svgCache.get(url)!
  }

  // Return existing promise if request is in-flight
  if (fetchPromiseCache.has(url)) {
    return fetchPromiseCache.get(url)!
  }

  // Create new fetch promise
  const fetchPromise = fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to fetch SVG: ${response.status}`)
      }
      return response.text()
    })
    .then(svgContent => {
      svgCache.set(url, svgContent)
      fetchPromiseCache.delete(url)
      return svgContent
    })
    .catch(error => {
      fetchPromiseCache.delete(url)
      console.error(`[TailorKit] Failed to load icon from ${url}:`, error)
      return ''
    })

  fetchPromiseCache.set(url, fetchPromise)
  return fetchPromise
}

/**
 * Get icon SVG content by name (async)
 */
export async function getIcon(name: IconName): Promise<string> {
  // Return from name cache if available
  if (iconNameCache.has(name)) {
    return iconNameCache.get(name)!
  }

  const urls = getIconUrls()
  if (!urls || !urls[name]) {
    console.warn(`[TailorKit] Icon URL not found for: ${name}`)
    return ''
  }

  const svgContent = await fetchSvgContent(urls[name])
  iconNameCache.set(name, svgContent)
  return svgContent
}

/**
 * Get icon SVG content by name (sync) - returns empty string if not preloaded
 * Use preloadAllIcons() or preloadIcons() first to ensure icons are available
 */
export function getIconSync(name: IconName): string {
  return iconNameCache.get(name) || ''
}

/**
 * Get icon URL by name (for use in img src)
 */
export function getIconUrl(name: IconName): string | null {
  const urls = getIconUrls()
  return urls?.[name] || null
}

/**
 * Preload multiple icons for better performance
 */
export async function preloadIcons(names: IconName[]): Promise<void> {
  const urls = getIconUrls()
  if (!urls) return

  await Promise.all(
    names.map(async name => {
      const url = urls[name]
      if (url) {
        const svgContent = await fetchSvgContent(url)
        iconNameCache.set(name, svgContent)
      }
    })
  )
}

/**
 * Preload all icons at once - call this early in app initialization
 * After this, getIconSync() will return the correct SVG content
 */
export async function preloadAllIcons(): Promise<void> {
  if (allIconsPreloaded) return

  const urls = getIconUrls()
  if (!urls) return

  const names = Object.keys(urls) as IconName[]
  await preloadIcons(names)
  allIconsPreloaded = true
}

/**
 * Check if all icons have been preloaded
 */
export function areIconsPreloaded(): boolean {
  return allIconsPreloaded
}

/**
 * Create an img element with the icon URL
 */
export function createIconImg(name: IconName, className?: string): HTMLImageElement | null {
  const url = getIconUrl(name)
  if (!url) return null

  const img = document.createElement('img')
  img.src = url
  img.alt = name
  if (className) img.className = className
  return img
}

/**
 * Insert SVG content into an element
 */
export async function insertIconInto(element: HTMLElement, name: IconName): Promise<void> {
  const svgContent = await getIcon(name)
  if (svgContent) {
    element.innerHTML = svgContent
  }
}
