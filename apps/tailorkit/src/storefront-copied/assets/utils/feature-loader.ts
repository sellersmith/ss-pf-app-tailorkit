/**
 * Universal Feature Loader
 *
 * Provides a centralized, type-safe API for loading lazy-loaded feature modules.
 * Works in both storefront (IIFE) and admin (ESM) contexts.
 *
 * Loading Strategy:
 * - Storefront: Script injection + event waiting
 * - Admin: Dynamic import (caller provides the import function to avoid bundling issues)
 *
 * Usage:
 * ```typescript
 * // Storefront (automatic)
 * const konva = await loadFeature<KonvaFeatureModule>('konva')
 *
 * // Admin (with dynamic import callback)
 * const konva = await loadFeature<KonvaFeatureModule>('konva', {
 *   adminImport: () => import('../features/konva/index')
 * })
 * ```
 */

import type { BaseFeatureModule, FeatureConfig, FeatureName, FeatureModuleMap } from './feature-loader.types'

// ============================================================================
// Type-Safe Window Access
// ============================================================================

/**
 * Get a feature module from window by its key
 */
function getWindowFeature<T extends BaseFeatureModule>(windowKey: string): T | undefined {
  const value = (window as Record<string, unknown>)[windowKey]
  if (value && typeof value === 'object' && 'ready' in value) {
    return value as T
  }
  return undefined
}

/**
 * Set a feature module on window
 */
function setWindowFeature<T extends BaseFeatureModule>(windowKey: string, module: T): void {
  ;(window as Record<string, unknown>)[windowKey] = module
}

// ============================================================================
// Constants
// ============================================================================

/** Timeout for feature loading (15 seconds) */
const FEATURE_LOAD_TIMEOUT = 15000

/** Event prefix for feature ready events */
export const FEATURE_READY_EVENT_PREFIX = 'tailorkit:'

/** Legacy event name for Konva (backward compatibility) */
export const KONVA_READY_EVENT = 'tailorkit:konva-ready'

// ============================================================================
// Feature Registry
// ============================================================================

/**
 * Registry of all available features
 * This mirrors the features.config.js build configuration
 */
// PageFly app-platform generates feature bundles with the `pagefly-` prefix (see theme-surfaces.ts
// generatedName), so scriptName matches the materialized asset filenames.
const FEATURES: Record<FeatureName, FeatureConfig> = {
  konva: {
    name: 'konva',
    scriptName: 'pagefly-tailorkit-konva.js',
    windowKey: 'TailorKitKonva',
    readyEvent: 'tailorkit:konva-ready',
  },
  'pinch-zoom': {
    name: 'pinch-zoom',
    scriptName: 'pagefly-tailorkit-pinch-zoom.js',
    windowKey: 'TailorKitPinchZoom',
    readyEvent: 'tailorkit:pinch-zoom-ready',
  },
  'charm-builder': {
    name: 'charm-builder',
    scriptName: 'pagefly-tailorkit-charm-builder.js',
    windowKey: 'TailorKitCharmBuilder',
    readyEvent: 'tailorkit:charm-builder-ready',
  },
}

// ============================================================================
// Module State
// ============================================================================

/** Cached promises for each feature to prevent duplicate loading */
const featurePromises: Partial<Record<FeatureName, Promise<BaseFeatureModule>>> = {}

// ============================================================================
// Context Detection
// ============================================================================

/**
 * Check if we're running in storefront context
 * Storefront has pagefly-tailorkit.js loaded via the PageFly theme app-embed
 */
export function isStorefrontContext(): boolean {
  return typeof document !== 'undefined' && !!document.querySelector('script[src*="pagefly-tailorkit.js"]')
}

// ============================================================================
// Storefront Loading (Script Injection)
// ============================================================================

/**
 * Result of script injection attempt
 */
interface ScriptInjectionResult {
  /** Whether the script exists or was injected */
  success: boolean
  /** Whether this was a newly injected script (vs already existed) */
  isNewlyInjected: boolean
  /** The script element, if found or created */
  scriptElement?: HTMLScriptElement
}

/**
 * Inject a feature script if not already present
 */
function injectFeatureScript(config: FeatureConfig): ScriptInjectionResult {
  const scriptId = `tailorkit-${config.name}-script`

  // Check if script already exists by ID
  const existingById = document.getElementById(scriptId) as HTMLScriptElement | null
  if (existingById) {
    return { success: true, isNewlyInjected: false, scriptElement: existingById }
  }

  // Check if script exists by src (e.g., injected via Liquid template)
  const existingBySrc = document.querySelector(`script[src*="${config.scriptName}"]`) as HTMLScriptElement | null
  if (existingBySrc) {
    return { success: true, isNewlyInjected: false, scriptElement: existingBySrc }
  }

  // Try to find the asset URL from existing scripts
  const existingScript = document.querySelector('script[src*="pagefly-tailorkit.js"]')
  if (!existingScript) {
    console.warn(`[TailorKit] Could not find pagefly-tailorkit.js to derive ${config.scriptName} URL`)
    return { success: false, isNewlyInjected: false }
  }

  const baseUrl = (existingScript as HTMLScriptElement).src.replace('pagefly-tailorkit.js', '')
  const scriptUrl = `${baseUrl}${config.scriptName}`

  const script = document.createElement('script')
  script.id = scriptId
  script.src = scriptUrl
  document.head.appendChild(script)

  console.log(`[TailorKit] Dynamically injected ${config.scriptName}`)
  return { success: true, isNewlyInjected: true, scriptElement: script }
}

/**
 * Register a callback for when a feature loads
 */
function registerFeatureCallback(featureName: string, callback: (error?: Error) => void): void {
  window.__tailorkit_feature_callbacks__ = window.__tailorkit_feature_callbacks__ || {}
  window.__tailorkit_feature_callbacks__[featureName] = window.__tailorkit_feature_callbacks__[featureName] || []
  window.__tailorkit_feature_callbacks__[featureName].push(callback)
}

/** Polling interval for checking if module is ready (ms) */
const POLLING_INTERVAL = 100

/**
 * Load a feature via script injection (storefront context)
 */
function loadViaScriptInjection<T extends BaseFeatureModule>(config: FeatureConfig): Promise<T> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    const existing = getWindowFeature<T>(config.windowKey)
    if (existing?.ready) {
      resolve(existing)
      return
    }

    // Inject script if needed
    const injectionResult = injectFeatureScript(config)
    if (!injectionResult.success) {
      reject(new Error(`[TailorKit] Failed to inject ${config.scriptName}. Ensure tailorkit.js is loaded.`))
      return
    }

    let resolved = false
    let pollingId: ReturnType<typeof setInterval> | null = null

    const resolveAndCleanup = (error?: Error) => {
      if (resolved) return
      resolved = true
      clearTimeout(timeoutId)

      if (pollingId) {
        clearInterval(pollingId)
        pollingId = null
      }

      if (error) {
        reject(error)
        return
      }

      const module = getWindowFeature<T>(config.windowKey)
      if (module) {
        resolve(module)
      } else {
        reject(new Error(`[TailorKit] ${config.name} module loaded but not properly initialized.`))
      }
    }

    // Set timeout
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        if (pollingId) {
          clearInterval(pollingId)
          pollingId = null
        }
        reject(
          new Error(
            `[TailorKit] ${config.name} module failed to load within ${FEATURE_LOAD_TIMEOUT / 1000} seconds. `
              + `Check if ${config.scriptName} is being blocked or failed to download.`
          )
        )
      }
    }, FEATURE_LOAD_TIMEOUT)

    // Register callback
    registerFeatureCallback(config.name, resolveAndCleanup)

    // Also listen for the ready event
    document.addEventListener(config.readyEvent, () => resolveAndCleanup(), { once: true })

    const { scriptElement, isNewlyInjected } = injectionResult

    if (scriptElement) {
      // Add error handler to the script element
      const handleScriptError = () => {
        resolveAndCleanup(new Error(`[TailorKit] Failed to load ${config.scriptName}. Script encountered an error.`))
      }

      scriptElement.addEventListener('error', handleScriptError, { once: true })

      // For newly injected scripts, also listen for load event as a trigger to check
      if (isNewlyInjected) {
        scriptElement.addEventListener(
          'load',
          () => {
            // Script loaded, but module might need a moment to initialize
            // Give it a small delay then check
            setTimeout(() => {
              const module = getWindowFeature<T>(config.windowKey)
              if (module?.ready) {
                resolveAndCleanup()
              }
            }, 50)
          },
          { once: true }
        )
      } else {
        // Script already existed (e.g., from Liquid template with defer)
        // It may have already loaded and notified before we set up listeners
        // Poll for the window global as a fallback for Safari timing issues
        pollingId = setInterval(() => {
          const module = getWindowFeature<T>(config.windowKey)
          if (module?.ready) {
            resolveAndCleanup()
          }
        }, POLLING_INTERVAL)
      }
    }
  })
}

// ============================================================================
// Admin Loading (Dynamic Import via Callback)
// ============================================================================

/**
 * Load a feature via dynamic import (admin context)
 * The import function is provided by the caller to avoid bundling issues
 */
async function loadViaDynamicImport<T extends BaseFeatureModule>(
  config: FeatureConfig,
  importFn: () => Promise<Omit<T, 'ready'>>
): Promise<T> {
  try {
    const module = await importFn()

    // Create the feature module with ready flag
    const featureModule: T = {
      ...module,
      ready: true,
    } as T

    // Set on window for consistency with storefront
    setWindowFeature(config.windowKey, featureModule)

    console.log(`[TailorKit] ${config.name} module loaded via dynamic import (admin mode)`)

    return featureModule
  } catch (error) {
    console.error(`[TailorKit] Failed to load ${config.name} via dynamic import:`, error)
    throw new Error(`[TailorKit] Failed to load ${config.name} module via dynamic import.`)
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Options for loadFeature
 */
export interface LoadFeatureOptions<T extends BaseFeatureModule = BaseFeatureModule> {
  /**
   * Dynamic import function for admin context
   * Required when not in storefront context
   * Example: () => import('../features/konva/index')
   */
  adminImport?: () => Promise<Omit<T, 'ready'>>
}

/**
 * Load a feature module by name
 *
 * @param featureName - The feature to load (e.g., 'konva', 'pinch-zoom')
 * @param options - Optional loading options
 * @returns Promise resolving to the feature module
 *
 * @example
 * // Storefront - automatic script injection
 * const konva = await loadFeature<KonvaFeatureModule>('konva')
 *
 * @example
 * // Admin - with dynamic import
 * const konva = await loadFeature<KonvaFeatureModule>('konva', {
 *   adminImport: () => import('../features/konva/index')
 * })
 */
export function loadFeature<K extends FeatureName>(
  featureName: K,
  options?: LoadFeatureOptions<FeatureModuleMap[K]>
): Promise<FeatureModuleMap[K]>
export function loadFeature<T extends BaseFeatureModule>(
  featureName: FeatureName,
  options?: LoadFeatureOptions<T>
): Promise<T>
export function loadFeature<T extends BaseFeatureModule>(
  featureName: FeatureName,
  options: LoadFeatureOptions<T> = {}
): Promise<T> {
  const config = FEATURES[featureName]
  if (!config) {
    return Promise.reject(new Error(`[TailorKit] Unknown feature: ${featureName}`))
  }

  // Return cached promise if already loading/loaded
  if (featurePromises[featureName]) {
    return featurePromises[featureName] as Promise<T>
  }

  featurePromises[featureName] = (async (): Promise<T> => {
    try {
      // Check if already loaded on window
      const existing = getWindowFeature<T>(config.windowKey)
      if (existing?.ready) {
        return existing
      }

      // Choose loading strategy based on context
      if (isStorefrontContext()) {
        return loadViaScriptInjection<T>(config)
      }
      // Admin context - requires dynamic import callback
      if (!options.adminImport) {
        throw new Error(
          `[TailorKit] Cannot load ${featureName} in admin context without adminImport option. `
            + `Provide: { adminImport: () => import('../features/${featureName}/index') }`
        )
      }
      return loadViaDynamicImport<T>(config, options.adminImport)
    } catch (error) {
      // Clear cache on failure to allow retry
      delete featurePromises[featureName]
      throw error
    }
  })()

  return featurePromises[featureName] as Promise<T>
}

/**
 * Check if a feature is ready (synchronous)
 */
export function isFeatureReady(featureName: FeatureName): boolean {
  const config = FEATURES[featureName]
  if (!config) return false
  const module = getWindowFeature(config.windowKey)
  return module?.ready === true
}

/**
 * Get a feature module if ready, otherwise null (synchronous)
 */
export function getFeature<K extends FeatureName>(featureName: K): FeatureModuleMap[K] | null
export function getFeature<T extends BaseFeatureModule>(featureName: FeatureName): T | null
export function getFeature<T extends BaseFeatureModule>(featureName: FeatureName): T | null {
  const config = FEATURES[featureName]
  if (!config) return null
  const module = getWindowFeature<T>(config.windowKey)
  return module?.ready ? module : null
}

/**
 * Reset the loader state for a feature (allows retry after failure)
 */
export function resetFeatureLoader(featureName: FeatureName): void {
  delete featurePromises[featureName]
}

/**
 * Get feature configuration by name
 */
export function getFeatureConfig(featureName: FeatureName): FeatureConfig | null {
  return FEATURES[featureName] || null
}

// ============================================================================
// Feature Ready Notification (for feature modules to call)
// ============================================================================

/**
 * Notify that a feature is ready
 * Called by feature modules (e.g., konva/index.ts) when they initialize
 */
export function notifyFeatureReady<T extends BaseFeatureModule>(featureName: FeatureName, module: T): void {
  const config = FEATURES[featureName]
  if (!config) {
    console.warn(`[TailorKit] Unknown feature: ${featureName}`)
    return
  }

  // Idempotency check - prevent duplicate notifications
  const existing = getWindowFeature<T>(config.windowKey)
  if (existing?.ready) {
    console.warn(`[TailorKit] ${config.name} already notified as ready, ignoring duplicate call`)
    return
  }

  // Set on window
  setWindowFeature(config.windowKey, module)

  // Fire callbacks for this feature with error handling
  const callbackRegistry = window.__tailorkit_feature_callbacks__
  const callbacks = callbackRegistry?.[featureName]
  if (callbacks && callbackRegistry) {
    callbacks.forEach(cb => {
      try {
        cb()
      } catch (error) {
        console.error(`[TailorKit] Error in feature ready callback for ${featureName}:`, error)
      }
    })
    delete callbackRegistry[featureName]
  }

  // Dispatch ready event (SSR safety check)
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent(config.readyEvent))
  }

  console.log(`[TailorKit] ${config.name} module loaded`)
}
