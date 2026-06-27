import type { TailorKitProductPersonalizer } from '../types/product-personalizer'
import { waitForElement } from './helpers'
import { loadFeature } from './feature-loader'
import type { KonvaFeatureModule } from './feature-loader.types'
import { resolveFeaturedImageContainerSelector } from './resolve-featured-container'
import { DEFAULT_APP_BLOCK_INSTALLATION_SETTINGS } from '../constants/app-block'
import { isIOS } from './devices'
import { SAFE_CANVAS_PIXELS_IOS, SAFE_CANVAS_PIXELS_DEFAULT } from '../constants/canvas'
import { FEATURE_FLAGS } from '../constants/feature-flags'
import { removeThemeZoom } from './theme-zoom-remover'
import { bindAutoNavigateOnFocus } from './auto-navigate-on-focus'
import { DEFAULT_FEATURED_IMAGE_POSITION, parseFeaturedImagePosition } from './parse-featured-image-position'
// NOTE: StorefrontInteractiveCanvasManager is NOT imported statically here.
// It lives inside tailorkit-konva.js (feature bundle) so that it shares the
// single Konva instance from that bundle. We get it from konvaModule at runtime
// after loadFeature('konva') resolves. See feature-loader.types.ts + features/konva/index.ts.

/**
 * Initialize the canvas for a product personalizer element
 * @param element - The TailorKitProductPersonalizer element
 * @returns A promise that resolves when the canvas is initialized
 */
export const initCanvas = async (element: TailorKitProductPersonalizer): Promise<void> => {
  const elementProductPersonalizer = element.productPersonalizer
  const isModalInstance = checkIsModalInstance(element)

  // Create unique container IDs to prevent conflicts between modal and main contexts
  const containerIdSuffix = isModalInstance ? '-modal' : '-main'
  const containerId = `canvas-container-${elementProductPersonalizer.i}${containerIdSuffix}`

  // Clean up any existing containers for this specific context
  const existingContainer = document.querySelector(`#${containerId}`)
  if (existingContainer) {
    existingContainer.remove()
  }

  // Also clean up any containers that might have been created without the suffix
  const legacyContainer = document.querySelector(`#canvas-container-${elementProductPersonalizer.i}`)
  if (legacyContainer && !legacyContainer.id.includes('-modal') && !legacyContainer.id.includes('-main')) {
    legacyContainer.remove()
  }

  // Create new container with unique ID
  const container = document.createElement('div')
  container.setAttribute('id', containerId)

  try {
    const selector = getFeaturedImageContainerSelector(element)
    // Wait for the featured image container to appear
    // Use a sensible default timeout (10s) or a custom one from settings
    const [targetContainer, konvaModule] = await Promise.all([
      waitForElement(selector, element.settings.containerWaitTimeout || 10_000).then(el => {
        return el
      }),
      loadFeature<KonvaFeatureModule>('konva'),
    ])

    // Set initial container styles
    container.style.width = '100%'
    container.style.height = '100%'
    container.style.position = 'relative'
    container.style.display = 'flex'
    container.style.alignItems = 'center'
    container.style.justifyContent = 'center'
    // Ensure canvas container sits above any theme overlay elements.
    // .product__media can have position:absolute pseudo-elements or sibling overlays
    // with implicit stacking context that capture pointer events before they reach Konva.
    container.style.zIndex = '1'

    targetContainer.appendChild(container)

    // ── Prevent theme modal/lightbox from opening on canvas click ─────────
    // Shopify themes wrap product media in <modal-opener> or similar elements
    // that open zoom/lightbox modals on click. Two approaches combined:
    // 1. stopPropagation on canvas container prevents bubbling to ancestor handlers
    // 2. Remove/disable sibling elements (buttons, icons) that sit outside the
    //    container but are positioned over the image area
    //
    // IMPORTANT: On mobile with interactive layers, touchmove/touchend must NOT be
    // stopped unconditionally here. Konva Transformer registers window.addEventListener
    // ('touchmove'/'touchend') inside its _handleMouseDown to handle resize/rotate anchors.
    // An unconditional stop at this container level would prevent those events from ever
    // reaching window, breaking resize/rotate on mobile.
    // The mobile-touch-relay.ts module handles touchmove/touchend conditionally instead:
    //   - regular drag → stopPropagation at konvaContent level (before reaching container)
    //   - transformer anchor drag → no stop → events reach window → Transformer fires
    // Pre-scan layer integrations for any layer the merchant explicitly opted into
    // Buyer Interaction (movable/resizable/rotatable === true). Match the same
    // capability-aware bypass that layer-renderer.ts applies, so the interactive
    // canvas manager is instantiated whenever any downstream call to
    // setNextLayerInteractive() will fire.
    const hasExplicitBuyerInteraction = ((elementProductPersonalizer.lis as Array<any>) || []).some((li: any) =>
      ((li?.data?.ls as Array<any>) || []).some(
        (layer: any) => layer?.ss?.movable === true || layer?.ss?.resizable === true || layer?.ss?.rotatable === true
      )
    )
    const hasInteractiveLayers
      = FEATURE_FLAGS.LAYER_INTERACTION || FEATURE_FLAGS.CHARM_BUILDER_STOREFRONT || hasExplicitBuyerInteraction
    const isTouchDevice = 'ontouchstart' in window
    const stopBubble = (e: Event) => e.stopPropagation()
    const eventsToStop
      = isTouchDevice && hasInteractiveLayers
        ? ['mousedown', 'pointerdown', 'click', 'touchstart']
        : ['mousedown', 'pointerdown', 'click', 'touchstart', 'touchmove', 'touchend']
    for (const evt of eventsToStop) {
      container.addEventListener(evt, stopBubble, false)
    }

    // Remove theme-specific zoom/lightbox trigger elements that overlay the product image.
    // These sit outside our canvas container, so stopPropagation alone can't block them.
    // Uses theme detection to handle Dawn, Craft, Horizon, Prestige, Spotlight patterns.
    removeThemeZoom()

    const canvasWidth = elementProductPersonalizer.pi?.w || 0
    const canvasHeight = elementProductPersonalizer.pi?.h || 0

    const basePixels = canvasWidth * canvasHeight

    // With 2x pixelRatio, total pixels = width * height * 4 (2^2)
    const pixelsAt2x = basePixels * 4
    const maxPixels = isIOS() ? SAFE_CANVAS_PIXELS_IOS : SAFE_CANVAS_PIXELS_DEFAULT

    // Cap devicePixelRatio at 2 on iOS. Safari iOS has a hard canvas-area limit
    // (~67M pixels / 8192x8192). iPhone retina reports dpr=3, and multiplying by 2
    // would yield 6x → basePixels*36 which exceeds limit for normal templates
    // (e.g. 1500x1500 → 81M, canvas blanks out, ATC flow breaks).
    // Matches existing codebase convention: konva/image/renderer.ts maxDpr = 2 on iOS.
    const effectiveDpr = isIOS() ? Math.min(window.devicePixelRatio, 2) : window.devicePixelRatio

    // Use 2x if safe, otherwise stick with default (1x)
    let targetRatio = effectiveDpr * (pixelsAt2x <= maxPixels ? 2 : 1)

    // iOS hard-limit guard for oversized templates (defense-in-depth).
    // The threshold check above uses SAFE_CANVAS_PIXELS_IOS as a heuristic but
    // does not guarantee (basePixels * targetRatio²) stays under Safari's fixed
    // ~67M canvas-area limit. Clamp ratio down when a very large template would
    // still overshoot (e.g. 5000x5000+).
    if (isIOS() && basePixels > 0) {
      const IOS_CANVAS_HARD_LIMIT = 67_000_000
      const maxSafeRatio = Math.sqrt(IOS_CANVAS_HARD_LIMIT / basePixels)
      targetRatio = Math.max(1, Math.min(targetRatio, maxSafeRatio))
    }

    const { KonvaCanvasManager, StorefrontInteractiveCanvasManager } = konvaModule

    // Use interactive canvas manager when ANY interactive feature is enabled:
    // - LAYER_INTERACTION: all template layers become interactive (move/resize/rotate)
    // - CHARM_BUILDER_STOREFRONT: charm layers need interactive drag-to-swap
    // The interactive manager is required for charm interaction even when LAYER_INTERACTION is off,
    // because charm registerCharmInteractive() duck-types for setNextLayerInteractive().

    const canvasManagerConfig = {
      width: canvasWidth,
      height: canvasHeight,
      containerId: container.id,
      printAreaId: elementProductPersonalizer.i,
      autoResize: true,
      pixelRatio: targetRatio,
    }

    if (hasInteractiveLayers) {
      // Use interactive canvas manager from konvaModule — shares the same Konva instance
      // as KonvaCanvasManager (both live in tailorkit-konva.js), preventing dual-instance conflict.
      const interactiveManager = new StorefrontInteractiveCanvasManager(canvasManagerConfig)
      interactiveManager.initInteractiveMode(container)
      element.canvasManager = interactiveManager as unknown as typeof element.canvasManager
    } else {
      const canvasManager = new KonvaCanvasManager(canvasManagerConfig)
      element.canvasManager = canvasManager
    }

    // Auto-navigate the gallery to the configured image position when the
    // customer focuses on the personalizer. Inline mode only — modal mode
    // already shows preview in its own container.
    if (!isModalInstance) {
      setupAutoNavigateOnFocus(element)
    }
  } catch (error) {
    // Clean up the container if initialization failed
    container.remove()
  }
}

/**
 * Wire up auto-navigate behavior if the merchant has both:
 *  - Set `featured_image_position` to a non-default value (> 1)
 *  - Enabled `auto_navigate_on_focus`
 *
 * Without auto-navigate, customers wouldn't see their personalization land on
 * the configured image (e.g. image 2) until they manually clicked its thumbnail.
 */
function setupAutoNavigateOnFocus(element: TailorKitProductPersonalizer): void {
  const settings = element.settings || {}
  const position = parseFeaturedImagePosition(settings.featured_image_position)
  if (!position || position <= DEFAULT_FEATURED_IMAGE_POSITION) return
  if (!settings.auto_navigate_on_focus) return

  // Dispose any prior binding on this element (variant re-render, modal re-open)
  // before registering a fresh one. Prevents the document-level registry from
  // retaining stale handlers across personalizer lifecycle events.
  const existingCleanup = (element as unknown as { _autoNavCleanup?: () => void })._autoNavCleanup
  if (existingCleanup) existingCleanup()

  // Bind on document so we catch focus events regardless of personalizer DOM nesting.
  const cleanup = bindAutoNavigateOnFocus(document, position)
  ;(element as unknown as { _autoNavCleanup?: () => void })._autoNavCleanup = cleanup
}

export function checkIsModalInstance(element: TailorKitProductPersonalizer) {
  const hasModalInstance = element.hasAttribute('data-modal-instance')
  return hasModalInstance
}

/**
 * Get the featured image container selector for a modal instance
 * @param element - The TailorKitProductPersonalizer element
 * @returns The featured image container selector
 */
export function getFeaturedImageContainerSelector(element: TailorKitProductPersonalizer) {
  const isModalInstance = checkIsModalInstance(element)

  if (isModalInstance) {
    // Use the modal's own container directly for consistent sizing
    // This prevents theme-specific CSS from affecting canvas dimensions
    return `.emtlkit-modal__product-image-container`
  }

  // Optional 1-based image position from merchant settings — when > 1, resolver
  // targets that specific slide and bypasses visibility check (for slideshow themes)
  const position = parseFeaturedImagePosition(element.settings.featured_image_position)

  return resolveFeaturedImageContainerSelector(
    element.settings.featured_image_container_selector,
    DEFAULT_APP_BLOCK_INSTALLATION_SETTINGS.featured_image_container_selector,
    position
  )
}
