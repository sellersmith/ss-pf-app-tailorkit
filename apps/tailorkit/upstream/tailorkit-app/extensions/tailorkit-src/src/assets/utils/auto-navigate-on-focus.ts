/**
 * Auto-navigate the product gallery to a target image position when the customer
 * interacts with a TailorKit personalizer.
 *
 * Why this exists:
 *   When merchants pin the live preview to a non-default image (e.g. image 2 in
 *   Dawn's slider or Modular's slideshow), the preview lives on a slide that is
 *   hidden or off-viewport by default. The customer wouldn't see their
 *   personalization unless they manually navigate to that slide. This handler
 *   programmatically navigates when the customer first interacts.
 *
 * Trigger: first `focusin` or `click` anywhere inside the TailorKit personalizer
 *   surface (inline content, customizer content, or any element with an
 *   `emtlkit-*` / `tailorkit-*` class).
 *
 * Navigation strategy (ordered by reliability):
 *  1. Dawn-style <media-gallery> with `setActiveMedia(mediaId)` — call directly.
 *  2. Theme thumbnail strip — click the Nth thumbnail.
 *  3. Slider "next" button — click it (position - 1) times as last resort.
 *
 * The handler runs on every focus/click, but SKIPS navigation when the
 * customer is already on the target slide — only brings them back when
 * they have navigated away to a different image.
 */

import { SLIDE_CONTAINER_SELECTORS } from '../constants/theme-selectors'

/** Common thumbnail selectors across themes (ordered by specificity). */
const THUMBNAIL_SELECTORS: string[] = [
  '.product-single__media-thumb', // Modular, Habitat
  '.product__media-toggle', // Dawn family (older)
  '.thumbnail-list__item', // Dawn (newer) + forks
  '.product-gallery__thumbnail-item', // Prestige, Impact, Atlantic
  '.product-images__thumb', // Habitat (alt)
  '.product-gallery--thumbnail', // Empire
  '[data-thumbnail]', // Generic data-attribute
]

/** Common "next slide" button selectors used by slider-based themes. */
const NEXT_BUTTON_SELECTORS: string[] = [
  '.slider-button--next', // Dawn slider-component
  '[name="next"]', // Dawn (by button name)
  '.flickity-button.next', // Flickity themes (Impulse, Warehouse)
  '.product__images__slider-next', // Modular/Presidio (custom)
  '[data-slide-next]', // Generic
]

/** Media-gallery web component with `setActiveMedia` support (Dawn-style). */
interface MediaGalleryElement extends HTMLElement {
  setActiveMedia?: (mediaId: string, prevent?: boolean) => void
}

/** 1-based position of a slide inside its parent (used as fallback to find media id). */
function findSlideAtPosition(position: number): Element | null {
  for (const sel of SLIDE_CONTAINER_SELECTORS) {
    const nodes = document.querySelectorAll(sel)
    if (nodes.length >= position) return nodes[position - 1]
  }
  return null
}

/**
 * Active-slide indicator classes used by slideshow/carousel themes.
 * When a slide has one of these classes, it is the currently-displayed one
 * regardless of its computed rendered dimensions. Flickity ships `is-selected`,
 * Dawn uses `is-active`, Splide uses `is-active` + `is-visible`.
 */
const ACTIVE_SLIDE_CLASSES = ['is-selected', 'is-active', 'active']

/**
 * Check whether the target slide is already the currently-displayed one.
 *
 * Avoids redundant navigation jumps when the customer is already at the
 * configured position (e.g. they scrolled to image 2 manually, then clicked
 * the personalizer input — we shouldn't re-trigger gallery movement).
 *
 * Detection strategy (first match wins):
 *  1. Explicit "hidden" signals on target slide (display:none / media--hidden /
 *     aria-hidden) → NOT at position.
 *  2. Any sibling slide has an active-indicator class (.is-selected / .is-active):
 *     the carousel theme is using class-based active tracking (e.g. Flickity);
 *     "at position" = target slide carries that class. Rect-based check is
 *     unreliable here because carousels keep all slides rendered (translated
 *     off-screen) so every slide has non-zero dimensions.
 *  3. Fallback: non-zero rendered dimensions → likely visible/active.
 */
function isAlreadyAtPosition(position: number): boolean {
  const slide = findSlideAtPosition(position)
  if (!slide) return false

  // Explicit hidden signals on the target slide
  const style = getComputedStyle(slide)
  if (style.display === 'none' || style.visibility === 'hidden') return false
  if (slide.classList.contains('media--hidden')) return false // Modular slideshow
  if (slide.getAttribute('aria-hidden') === 'true') return false

  // Carousel themes (Flickity, Splide, etc.) keep all slides rendered, so use
  // the active-indicator class on the visible slide. If any sibling slide has
  // the class, the theme uses class-based active tracking — trust it absolutely.
  // Scoped to direct siblings to avoid false positives from unrelated UI.
  const parentChildren = slide.parentElement?.children
  const anySiblingActive
    = parentChildren && [...parentChildren].some(s => ACTIVE_SLIDE_CLASSES.some(cls => s.classList.contains(cls)))
  if (anySiblingActive) {
    return ACTIVE_SLIDE_CLASSES.some(cls => slide.classList.contains(cls))
  }

  // Non-carousel fallback: use rendered dimensions
  const rect = (slide as HTMLElement).getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

/**
 * Extract the Shopify media id (full or numeric) from a slide element.
 * Dawn's `setActiveMedia` accepts the FULL id that is stored on the <li> element.
 */
function getSlideMediaId(slide: Element): string | null {
  return slide.getAttribute('data-media-id') || slide.getAttribute('data-id')
}

/**
 * Navigate via Dawn's <media-gallery data-section-id="…"> `setActiveMedia()` method.
 * @returns true if navigation succeeded.
 */
function tryDawnMediaGalleryNavigation(position: number): boolean {
  const gallery = document.querySelector('media-gallery') as MediaGalleryElement | null
  if (!gallery || typeof gallery.setActiveMedia !== 'function') return false

  const slide = findSlideAtPosition(position)
  if (!slide) return false

  const mediaId = getSlideMediaId(slide)
  if (!mediaId) return false

  try {
    gallery.setActiveMedia(mediaId)
    return true
  } catch (e) {
    // Rare: theme may have a customised media-gallery that throws for our input.
    // Log at debug level so developers can track down regressions without spamming
    // production consoles.
    console.debug('[TailorKit] Dawn media gallery navigation failed:', e)
    return false
  }
}

/**
 * Navigate by clicking the Nth theme thumbnail (Modular, Habitat, Prestige, etc.).
 * @returns true if navigation attempt was made.
 */
function tryThumbnailNavigation(position: number): boolean {
  for (const selector of THUMBNAIL_SELECTORS) {
    const thumbs = document.querySelectorAll(selector)
    if (thumbs.length >= position) {
      const thumb = thumbs[position - 1]
      const clickable = thumb.querySelector('a, button') || thumb
      ;(clickable as HTMLElement).click()
      return true
    }
  }
  return false
}

/**
 * Navigate a Flickity carousel via keyboard arrow keys.
 *
 * Why this exists:
 *   Modular 3.2.0 (and other themes that bundle Flickity without exposing its
 *   constructor globally) ignore programmatic clicks on thumbnail anchors and
 *   on the cell itself — Flickity's drag/tap handler only reacts to a real,
 *   trusted pointer gesture with matching pointer IDs. Click, PointerEvent
 *   and MouseEvent dispatches were all observed to leave the carousel frozen
 *   on throwingdoubles.com (Modular).
 *
 *   Flickity's accessibility plugin, however, listens for `keydown` Arrow*
 *   events on the flickity-enabled element and calls `this.next()` / `this.previous()`
 *   internally. Synthetic KeyboardEvents ARE honored, even when `isTrusted=false`,
 *   so we can walk the carousel one cell at a time.
 *
 * Strategy:
 *   1. Find the slide at the requested 1-based position.
 *   2. Walk up the DOM to the `.flickity-enabled` container.
 *   3. Compute delta from the currently-active sibling (via the active-class
 *      check used elsewhere in this module) to the target index.
 *   4. Focus the container and fire ArrowRight/ArrowLeft `delta` times.
 *
 * @returns true if we found a Flickity container and dispatched at least one
 *   key event. Returns false when no Flickity container exists or the active
 *   cell can't be resolved, letting the caller fall through to the next
 *   strategy (e.g. slider "next" button).
 */
function tryFlickityKeyboardNavigation(position: number): boolean {
  const targetSlide = findSlideAtPosition(position)
  if (!targetSlide) return false

  // Walk up to the nearest flickity-enabled ancestor.
  let flickity: HTMLElement | null = targetSlide as HTMLElement
  while (flickity && !flickity.classList.contains('flickity-enabled')) {
    flickity = flickity.parentElement
  }
  if (!flickity) return false

  // Siblings = all cells in the same carousel. indexOf gives us the
  // 0-based Flickity cell index (which matches what next()/previous() step through).
  const siblings = Array.from(targetSlide.parentElement?.children || [])
  const targetIndex = siblings.indexOf(targetSlide)
  if (targetIndex < 0) return false

  const currentIndex = siblings.findIndex(sib => ACTIVE_SLIDE_CLASSES.some(cls => sib.classList.contains(cls)))
  if (currentIndex < 0) return false

  const delta = targetIndex - currentIndex
  if (delta === 0) return true // Already at target — treat as success, skip fallbacks.

  const key = delta > 0 ? 'ArrowRight' : 'ArrowLeft'
  const keyCode = delta > 0 ? 39 : 37
  const steps = Math.abs(delta)

  // Focus is required on some browsers for keydown to reach Flickity's
  // accessibility handler. Modular exposes tabindex="0" on the slider so focus
  // succeeds; themes without it may still receive the bubbled event.
  //
  // IMPORTANT: Save and restore the buyer's original active element around the
  // focus + dispatch. Without restoration, the very interaction that triggered
  // auto-navigate (clicking a text input, pressing a radio/swatch) loses focus
  // to the gallery container, forcing the buyer to click the input a second
  // time before they can type. Observed as a real UX regression on Modular.
  const prevActive = document.activeElement as HTMLElement | null

  try {
    flickity.focus({ preventScroll: true })
  } catch {
    // preventScroll not supported everywhere; fall back silently.
    flickity.focus()
  }

  for (let i = 0; i < steps; i++) {
    flickity.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, keyCode, bubbles: true, cancelable: true }))
  }

  // Restore focus so the buyer can keep typing / interacting without a second click.
  // Guard against cases where prevActive was the flickity container itself (rare) or
  // has been detached from the DOM by the navigation (also rare).
  if (prevActive && prevActive !== flickity && typeof prevActive.focus === 'function' && prevActive.isConnected) {
    try {
      prevActive.focus({ preventScroll: true })
    } catch {
      prevActive.focus()
    }
  }
  return true
}

/**
 * Last-resort: click the "next" slider button (position - 1) times.
 * Useful for themes that don't expose thumbnails (some minimal Dawn variants).
 * @returns true if we found and clicked a next button.
 */
function tryNextButtonNavigation(position: number): boolean {
  for (const selector of NEXT_BUTTON_SELECTORS) {
    const btn = document.querySelector(selector) as HTMLButtonElement | null
    if (btn && !btn.disabled) {
      const clicks = Math.max(0, position - 1)
      for (let i = 0; i < clicks; i++) btn.click()
      return clicks > 0
    }
  }
  return false
}

/**
 * Try every navigation strategy in order; returns true on first success.
 *
 * Order matters:
 *  1. Dawn's setActiveMedia — most reliable when the component is present.
 *  2. Flickity keyboard — preferred for any carousel nested under a
 *     `.flickity-enabled` container (Modular, Impulse, Warehouse, etc.).
 *     Runs BEFORE thumbnail click because programmatic thumbnail clicks on
 *     Flickity themes are silently swallowed (Flickity's tap detector only
 *     trusts real pointer gestures), which would make `tryThumbnailNavigation`
 *     return "success" without the slider actually moving. Gating on the
 *     `.flickity-enabled` ancestor keeps non-Flickity themes unaffected: this
 *     strategy returns false and we fall through.
 *  3. Thumbnail click — non-Flickity themes where thumbnails are plain anchors
 *     wired through isTrusted-agnostic handlers.
 *  4. Slider "next" button — last-resort for themes that expose neither
 *     thumbnails nor an accessible Flickity container.
 */
function navigateToPosition(position: number): boolean {
  return (
    tryDawnMediaGalleryNavigation(position)
    || tryFlickityKeyboardNavigation(position)
    || tryThumbnailNavigation(position)
    || tryNextButtonNavigation(position)
  )
}

/**
 * Does the focused/clicked element belong to a TailorKit personalizer surface?
 *
 * We can't rely on only querying `tailorkit-product-personalizer` children — some
 * personalizer UI (e.g. option-set drawers, color pickers) is rendered OUTSIDE
 * the web component via portals or sibling containers. We widen detection to
 * any element carrying TailorKit-prefixed classes/attributes.
 */
function isPersonalizerSurface(target: HTMLElement): boolean {
  return Boolean(
    target.closest(
      [
        'tailorkit-product-personalizer',
        'tailorkit-product-personalizer-customizer',
        '[class*="emtlkit"]',
        '[class*="tailorkit"]',
        '[data-tailorkit]',
      ].join(',')
    )
  )
}

/**
 * Bind a navigation handler on the given container that fires on every
 * focus/click into the personalizer surface.
 *
 * Listens to BOTH `focusin` (text inputs) and `click` (radio buttons, color
 * swatches, image options) so any customer interaction with the personalizer
 * triggers the jump to the configured image position.
 *
 * @param container Element scope to watch (typically `document`).
 * @param position 1-based image position to navigate to.
 * @returns A cleanup function that detaches listeners and clears the
 *   de-duplication registry entry for this container. Call on personalizer
 *   teardown / re-init to prevent handler accumulation in long-lived SPA
 *   sessions. Calling the returned function is idempotent — redundant calls
 *   are harmless no-ops.
 */
export function bindAutoNavigateOnFocus(container: Element | Document, position: number): () => void {
  const noop = () => {}
  if (!Number.isFinite(position) || position < 1) return noop

  // Single-registration guard: pages with multiple personalizer instances (multi-variant,
  // cross-product modals, variant re-render) must not compound document-level listeners.
  // Keyed per-container so separate modals can still register their own handlers.
  const registry = ((window as unknown as { __tailorkit__?: Record<string, unknown> }).__tailorkit__
    = (window as unknown as { __tailorkit__?: Record<string, unknown> }).__tailorkit__ || {})
  const boundSet = (registry['autoNavBoundContainers'] as Set<unknown>) || new Set<unknown>()
  if (boundSet.has(container)) return noop
  boundSet.add(container)
  registry['autoNavBoundContainers'] = boundSet

  const handler = (event: Event) => {
    const target = event.target as HTMLElement | null
    if (!target) return
    if (!isPersonalizerSurface(target)) return
    // Skip if already at target slide — avoids hijacking the gallery when the
    // customer has already navigated to (or stayed on) the configured image.
    if (isAlreadyAtPosition(position)) return
    navigateToPosition(position)
  }

  container.addEventListener('focusin', handler as EventListener)
  // Capture phase on click so we catch it before theme handlers stop propagation.
  container.addEventListener('click', handler as EventListener, true)

  let detached = false
  return () => {
    if (detached) return
    detached = true
    container.removeEventListener('focusin', handler as EventListener)
    container.removeEventListener('click', handler as EventListener, true)
    boundSet.delete(container)
  }
}
