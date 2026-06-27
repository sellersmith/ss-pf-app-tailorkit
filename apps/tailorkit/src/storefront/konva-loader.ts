import type Konva from 'konva'

const TAILORKIT_CONFIG_ID = 'tailorkit-storefront-config'
const DEFAULT_KONVA_CDN_URL = 'https://cdn.jsdelivr.net/npm/konva@10.0.12/konva.min.js'
const DEFAULT_KONVA_FALLBACK_URLS = ['https://unpkg.com/konva@10.0.12/konva.min.js']

export type TailorKitKonvaGlobal = typeof Konva

interface TailorKitStorefrontConfig {
  propertyPrefix?: string
  konva?: {
    mode?: string
    url?: string
    fallbackUrls?: string[]
  }
}

declare global {
  interface Window {
    Konva?: TailorKitKonvaGlobal
    TailorKitStorefront?: {
      loadKonva(): Promise<TailorKitKonvaGlobal>
    }
  }
}

export function readTailorKitStorefrontConfig(): TailorKitStorefrontConfig {
  const configText = document.getElementById(TAILORKIT_CONFIG_ID)?.textContent || '{}'
  try {
    return JSON.parse(configText)
  } catch {
    return {}
  }
}

function uniqueUrls(urls: string[]): string[] {
  return [...new Set(urls.map(url => url.trim()).filter(Boolean))]
}

function readKonvaCdnUrls(config: TailorKitStorefrontConfig): string[] {
  const primaryUrl = typeof config.konva?.url === 'string' ? config.konva.url : DEFAULT_KONVA_CDN_URL
  const fallbackUrls = Array.isArray(config.konva?.fallbackUrls) ? config.konva.fallbackUrls : DEFAULT_KONVA_FALLBACK_URLS

  return uniqueUrls([primaryUrl, ...fallbackUrls])
}

function loadScriptOnce(src: string): Promise<TailorKitKonvaGlobal> {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
  if (existing) {
    if (window.Konva) return Promise.resolve(window.Konva)

    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => {
        if (!window.Konva) {
          existing.remove()
          reject(new Error('TailorKit Konva CDN loaded but window.Konva is missing'))
          return
        }
        resolve(window.Konva)
      })
      existing.addEventListener('error', () => {
        existing.remove()
        reject(new Error(`Cannot load TailorKit Konva CDN asset: ${src}`))
      })
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => {
      if (!window.Konva) {
        script.remove()
        reject(new Error('TailorKit Konva CDN loaded but window.Konva is missing'))
        return
      }
      resolve(window.Konva)
    }
    script.onerror = () => {
      script.remove()
      reject(new Error(`Cannot load TailorKit Konva CDN asset: ${src}`))
    }
    document.head.appendChild(script)
  })
}

async function loadScriptWithFallback(urls: string[]): Promise<TailorKitKonvaGlobal> {
  let lastError: unknown

  for (const url of urls) {
    try {
      return await loadScriptOnce(url)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Cannot load TailorKit Konva CDN asset')
}

export function loadTailorKitKonva(): Promise<TailorKitKonvaGlobal> {
  if (window.Konva) return Promise.resolve(window.Konva)

  const config = readTailorKitStorefrontConfig()
  return loadScriptWithFallback(readKonvaCdnUrls(config))
}
