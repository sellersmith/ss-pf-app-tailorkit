/* eslint-disable max-lines -- Web Component covers many concerns (render,
   bind, save/resume, image upload, ATC). Splitting into helper modules is
   tracked separately; for now, the cohesive class is more readable than
   cross-file fragmentation. */
import { PROPERTY_PREFIX } from '../constants'
import { uploadImageToServer } from '../handlers/event-handlers/image-editor/upload-service'
import { parseBulkConfig } from '../libraries/bulk-store'
import { translate } from '../libraries/translation'
import { type BulkDraft, clearDraft, loadDraft, saveDraft } from '../utils/bulk-draft-store'
import { buildBulkCartPayload, type BulkUnitInput } from '../utils/build-bulk-cart-payload'
import { canFitBulkInCart, dispatchCartRefreshEvents, postBulkCartAdd } from '../utils/cart-add-fetch-bulk'
import { escapeHtml, generateUuid } from '../utils/dom-helpers'
import { BulkAtcBridge } from './bulk-theme-atc-bridge'

/** i18n helper that always escapes the resolved text before injecting into innerHTML. */
const tHtml = (key: string, fallback: string, replacements?: Record<string, string>): string =>
  escapeHtml(translate(key, fallback, replacements))

/**
 * Per-unit text personalization input collected from the bulk drawer UI.
 * Maps each text-type fieldset (identified by printAreaId + layerId + optionId)
 * to the unit's value.
 */
interface UnitTextValues {
  [key: string]: string
}

/** Personalizable fieldset descriptor: text or image. v2 phase 2 supports both. */
type FieldKind = 'text' | 'image'
interface PersonalizableField {
  kind: FieldKind
  fieldsetId: string
  printAreaId: string
  layerId: string
  label: string
}

/** Per-unit uploaded image map keyed by `${unitIndex}:${printAreaId}:${layerId}`. */
interface UploadedImage {
  url: string
  name: string
  /**
   * The option id that the customizer assigned to this upload after
   * setLayerImage routed through processUploadedImage. Cart properties
   * include it under `selectedOptionId` so the cart UI can resolve which
   * option was chosen. Empty string when the customizer lacks
   * setLayerImage (older theme cache) — cart still shows image via
   * settings.image.imageSrc.
   */
  optionId?: string
  /**
   * The display label of the fieldset this image belongs to (e.g.
   * "Upload your image"). Captured at upload time so the bulk submit
   * can override the Shopify cart UI's display property — Shopify hides
   * any property whose key starts with `_`, so the technical key
   * `_PF_<uuid>_<uuid>` is invisible to the customer and the cart only
   * shows the label-keyed property emitted by FormManager. Without
   * mirroring our per-unit override into the label key too, every
   * line item would display the single-mode base value.
   */
  displayLabel?: string
}

/** UI tunables. Centralized so tests + future tuning land in one place. */
const PANEL_ID = 'tlk-bulk-panel'
/** Minimum quantity that meaningfully needs bulk personalization (single units handled by single-mode). */
const MIN_QUANTITY = 2
/** Default starting quantity when opening the drawer. */
const DEFAULT_QUANTITY = 2
/** Wait window after success before /cart redirect, gives theme drawer time to react to cart-refresh events. */
const CART_REDIRECT_DELAY_MS = 800
/** Opt-out attribute: merchants can set this on the element to keep customer on the same page after success. */
const SKIP_REDIRECT_ATTR = 'data-tlk-skip-redirect'

/**
 * <tailorkit-bulk-drawer> — a Web Component that renders a separate bulk
 * personalization surface alongside the main TailorKit customizer.
 *
 * v1 scope (text-only):
 * - Renders a CTA button "Personalize each individually" near the customizer
 * - Click opens an inline drawer with quantity input + N rows of text inputs
 *   (one row per unit, one input per text-type fieldset in the active template)
 * - Click "Add all to cart" → builds N split line items, each with its own
 *   per-unit text overrides + base options inherited from the single-mode
 *   customizer's current state
 *
 * What v1 does NOT support (deferred to v2):
 * - Per-unit image upload, color, font, select option overrides
 * - Per-unit live preview canvas swapping
 * - "All same" master toggle, B/I/lock per text line
 * - Save/resume bulk session (BulkPersonalizerStore is intended for v2 persistence)
 *
 * v2 phase 3 (image live preview):
 * - Per-unit image uploads now trigger a live canvas preview by calling
 *   `customizer.setLayerImage(printAreaId, layerId, url, name)` after a
 *   successful upload, and `setLayerImage(_, _, '', '')` after a remove.
 *   Image options have no DOM input to mirror to, so the customizer exposes
 *   an explicit imperative API mirroring how the text path uses
 *   `input.value = ...; dispatchEvent(...)` to drive OptionProcessor +
 *   Konva. Optional chaining at the call site keeps older theme-cached
 *   customizer builds (without setLayerImage) silently no-op'ing instead
 *   of breaking the bulk ATC flow.
 *
 * Mount: rendered inline by Liquid (customizer.liquid) when the integration
 * has bulkPersonalize.enabled === true, as a sibling of
 * <tailorkit-product-personalizer-customizer>. Hidden otherwise.
 *
 * Accessibility:
 * - Trigger button has aria-expanded + aria-controls
 * - Panel has role=dialog and aria-modal=false (inline, not a true modal)
 * - Status message has aria-live=polite
 * - Escape key closes the panel
 * - Focus moves to first input on open and back to trigger on close
 */
export class TailorKitBulkDrawer extends HTMLElement {
  private config: ReturnType<typeof parseBulkConfig> | null = null
  private quantity = DEFAULT_QUANTITY
  private isOpen = false
  private allSame = false
  private root: HTMLElement | null = null
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null
  /** Per-unit image upload state keyed by `${unitIndex}:${printAreaId}:${layerId}`. */
  private uploadedImages: Map<string, UploadedImage> = new Map()
  /** Pending debounce timer for auto-save. Coalesces rapid keystrokes. */
  private draftSaveTimer: number | null = null
  /** True while submit() is mid-flight. Prevents double-submit when the
   * customer rapid-clicks the Add-to-cart button before the network
   * resolves — without this guard each click would post a separate
   * /cart/add.js request, duplicating every line item. */
  private isSubmitting: boolean = false
  /** Auto-save debounce window. Long enough to coalesce typing, short enough
   * that an F5 a couple seconds later still has the latest state. */
  private static readonly DRAFT_SAVE_DEBOUNCE_MS = 300
  /** Bridges the bulk drawer to the theme's existing Add-to-Cart button so
   * the customer never sees two competing ATC affordances. Attached when
   * the panel opens, detached on close. */
  private atcBridge: BulkAtcBridge | null = null
  /** Re-attach the ATC bridge when the variant changes mid-session. Many
   * themes destroy + recreate the ATC button on variant switch, leaving
   * our cached `atcButton` reference pointing at a detached node. Listening
   * for `locationchange` (already fired by the storefront `pushState`
   * monkey-patch in `location-change-handler.ts`) lets us re-resolve the
   * fresh ATC element before the customer notices. */
  private locationChangeHandler: (() => void) | null = null

  connectedCallback(): void {
    this.config = parseBulkConfig(this.getAttribute('data-bulk-config'))
    if (!this.config?.enabled) {
      // Hidden by default; nothing to render when feature is off.
      this.style.display = 'none'
      return
    }
    this.quantity = Math.max(MIN_QUANTITY, Math.min(this.quantity, this.config.maxUnits))
    this.render()
  }

  disconnectedCallback(): void {
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler)
      this.keydownHandler = null
    }
    // Drop the pending save timer so a remove-then-readd of the element
    // (e.g. theme HMR) doesn't fire a stale callback.
    this.flushDraftSaveTimer()
    // Release the hijacked theme ATC so a teardown doesn't leak listeners
    // or leave the "Add N to cart" label stuck on the button.
    this.detachAtcBridge()
    this.root = null
  }

  /**
   * Locate the inner `<tailorkit-product-personalizer>` that wraps this drawer.
   * Works in BOTH inline and modal modes because the drawer is always rendered
   * inside the personalizer (see `print-areas.liquid`). In modal mode the modal
   * lifts only the inner personalizer into a separate DOM subtree, so the outer
   * customizer-customizer is not an ancestor — but the personalizer is.
   */
  private getPersonalizerEl(): HTMLElement | null {
    return this.closest<HTMLElement>('tailorkit-product-personalizer')
  }

  /**
   * Locate the outer `<tailorkit-product-personalizer-customizer>` Web Component.
   * In inline mode it is the drawer's ancestor; in modal mode the modal lifts the
   * personalizer (and its drawer) into a separate DOM subtree, so we fall back to
   * a document-wide lookup keyed by the personalizer's variant id. Shopify variant
   * ids are unique within a shop, so the query unambiguously identifies the
   * matching customizer when multiple products coexist on the same page.
   */
  private getCustomizerEl(): HTMLElement | null {
    const ancestor = this.closest<HTMLElement>('tailorkit-product-personalizer-customizer')
    if (ancestor) return ancestor
    const variantId = this.getPersonalizerEl()?.getAttribute('data-selected-variant-id') ?? ''
    if (variantId) {
      const byVariant = document.querySelector<HTMLElement>(
        `tailorkit-product-personalizer-customizer[data-variant-id="${CSS.escape(variantId)}"]`
      )
      if (byVariant) return byVariant
    }
    // Legacy fallback for older test fixtures (drawer mounted alongside, not
    // inside, the customizer). Not exercised in production markup.
    const sibling = this.parentElement?.querySelector<HTMLElement>('tailorkit-product-personalizer-customizer')
    return sibling ?? null
  }

  private getVariantId(): string {
    // Prefer the customizer's `data-variant-id`: in modal mode the fallback
    // injector re-stamps this attribute to the current variant when the modal
    // opens (see `fallback-injector.ts` → `setAttribute('data-variant-id', …)`),
    // and in inline mode it carries the initial Liquid-rendered variant. The
    // personalizer's `data-selected-variant-id` is only used when the customizer
    // is unreachable AND the personalizer carries the right variant — that
    // covers degraded markup (no customizer mounted at all). Both attributes
    // match in normal modal/inline flows; the order matters only for edge cases.
    const fromCustomizer = this.getCustomizerEl()?.getAttribute('data-variant-id')
    if (fromCustomizer) return fromCustomizer
    const fromPersonalizer = this.getPersonalizerEl()?.getAttribute('data-selected-variant-id')
    if (fromPersonalizer) return fromPersonalizer
    console.warn('[TailorKit Bulk] No variant id available on personalizer or customizer.')
    return ''
  }

  /** Read the product id from the customizer. Empty string when
   * unavailable — callers must treat that as "no draft scope" and skip persist. */
  private getProductId(): string {
    return this.getCustomizerEl()?.getAttribute('data-product-id') ?? ''
  }

  /**
   * Read all personalizable fieldsets that belong to this drawer's personalizer.
   * Returns text (text_customer + text_option) and image (image_option) variants
   * together. Each represents a per-unit overridable slot the bulk drawer renders
   * an input for. Order matches the personalizer's DOM (preserves merchant's
   * intended layout).
   *
   * Scoped to the inner `<tailorkit-product-personalizer>` rather than the outer
   * customizer-customizer because the fieldsets live inside the personalizer in
   * both inline and modal modes — the customizer is unreachable from a modal.
   */
  private getPersonalizableFields(): PersonalizableField[] {
    const scope = this.getPersonalizerEl() ?? this.getCustomizerEl()
    if (!scope) return []
    const all = scope.querySelectorAll<HTMLElement>(
      'fieldset[data-option-type="text_customer"], fieldset[data-option-type="text_option"], fieldset[data-option-type="image_option"]'
    )
    const fields: PersonalizableField[] = []
    all.forEach(fs => {
      const optionType = fs.getAttribute('data-option-type') || ''
      const kind: FieldKind = optionType === 'image_option' ? 'image' : 'text'
      fields.push({
        kind,
        fieldsetId: fs.getAttribute('data-id') || '',
        printAreaId: fs.getAttribute('data-print-area-id') || '',
        layerId: fs.getAttribute('data-layer-id') || '',
        label: fs.getAttribute('data-label') || (kind === 'image' ? 'Image' : 'Personalization'),
      })
    })
    return fields
  }

  /**
   * Build base properties: read the current single-mode customizer state
   * (image upload, color picks, etc.) so each split line item inherits
   * shared options. Per-unit text values override later.
   */
  private gatherBaseProperties(): Record<string, string> {
    const props: Record<string, string> = {}
    const customizer = this.getCustomizerEl()
    if (!customizer) return props

    // Read FormManager-injected hidden inputs from any matching ATC form.
    const variantId = this.getVariantId()
    const forms = document.querySelectorAll('form[action*="/cart/add"]')
    for (const form of forms) {
      const idInput = form.querySelector<HTMLInputElement>('input[name="id"]')
      if (idInput && idInput.value !== variantId) continue
      const inputs = form.querySelectorAll<HTMLInputElement>('input[type="hidden"][name^="properties["]')
      for (const input of inputs) {
        const match = input.name.match(/^properties\[(.+)\]$/)
        if (match) props[match[1]] = input.value
      }
      break
    }
    return props
  }

  /** Compose the storage key used by uploadedImages map. */
  private imageKey(unitIndex: number, printAreaId: string, layerId: string): string {
    return `${unitIndex}:${printAreaId}:${layerId}`
  }

  /**
   * Drop every uploaded image whose unit index is >= cutoff. Used when the
   * customer reduces the quantity input so trailing units' stored images are
   * not silently submitted with the next ATC.
   */
  private pruneImagesAtOrAbove(cutoff: number): void {
    for (const key of Array.from(this.uploadedImages.keys())) {
      const idx = Number.parseInt(key.split(':')[0], 10)
      if (Number.isFinite(idx) && idx >= cutoff) this.uploadedImages.delete(key)
    }
  }

  /**
   * Snapshot the current drawer state into the BulkDraft shape. Reads text
   * values directly from DOM (each unit's input has a stable data-* identity).
   */
  private snapshotDraft(): Omit<BulkDraft, 'v' | 'ts'> {
    const text: BulkDraft['text'] = {}
    const inputs = this.querySelectorAll<HTMLInputElement>('[data-tlk-bulk-input]')
    inputs.forEach(input => {
      const idx = Number.parseInt(input.dataset.unitIndex ?? '', 10)
      if (!Number.isFinite(idx)) return
      const printAreaId = input.dataset.printAreaId ?? ''
      const layerId = input.dataset.layerId ?? ''
      if (!printAreaId || !layerId) return
      const fieldKey = `${printAreaId}:${layerId}`
      if (!text[idx]) text[idx] = {}
      text[idx][fieldKey] = input.value
    })

    const images: BulkDraft['images'] = {}
    for (const [storageKey, value] of this.uploadedImages.entries()) {
      const [idxStr, printAreaId, layerId] = storageKey.split(':')
      const idx = Number.parseInt(idxStr, 10)
      if (!Number.isFinite(idx) || !printAreaId || !layerId) continue
      const fieldKey = `${printAreaId}:${layerId}`
      if (!images[idx]) images[idx] = {}
      // Persist `displayLabel` so a draft restored from localStorage can
      // still emit the per-unit cart-visible override in collectUnits().
      // Without this, F5 mid-session would silently drop the per-unit URL
      // from the cart property the customer actually sees.
      images[idx][fieldKey] = { url: value.url, name: value.name, displayLabel: value.displayLabel }
    }

    return { qty: this.quantity, allSame: this.allSame, text, images }
  }

  /**
   * Restore drawer state from a previously saved draft. Sets quantity +
   * allSame and seeds the in-memory image map. Text inputs are populated
   * after the next renderUnits() call via populateTextInputsFromDraft().
   */
  private pendingDraftText: BulkDraft['text'] | null = null
  private restoreFromDraft(draft: BulkDraft): void {
    if (!this.config) return
    const clampedQty = Math.max(2, Math.min(draft.qty, this.config.maxUnits))
    this.quantity = clampedQty
    this.allSame = draft.allSame
    this.uploadedImages.clear()
    for (const [idxStr, fields] of Object.entries(draft.images)) {
      const idx = Number.parseInt(idxStr, 10)
      if (!Number.isFinite(idx) || idx >= clampedQty) continue
      for (const [fieldKey, img] of Object.entries(fields)) {
        const [printAreaId, layerId] = fieldKey.split(':')
        if (!printAreaId || !layerId) continue
        if (!img || typeof img.url !== 'string' || typeof img.name !== 'string') continue
        // Reject empty-string url drafts: a previous race (drawer closed
        // mid-upload, then localStorage corrupted) could leave url:"" which
        // renders a broken thumbnail and a "Replace" button for a session
        // the customer never actually uploaded into.
        if (!img.url) continue
        this.uploadedImages.set(this.imageKey(idx, printAreaId, layerId), {
          url: img.url,
          name: img.name,
          displayLabel: typeof img.displayLabel === 'string' ? img.displayLabel : undefined,
        })
      }
    }
    // Hold text values until renderUnits() builds the inputs; then we copy
    // values across in one pass and drop the reference.
    this.pendingDraftText = draft.text
  }

  /**
   * Copy draft text values into the freshly rendered text inputs. Called by
   * renderUnits() right after innerHTML assignment so inputs exist in DOM.
   * If no inputs are present yet (customizer fieldsets not loaded), keep the
   * pending draft alive so the next renderUnits() call can still hydrate.
   */
  private populateTextInputsFromDraft(): void {
    if (!this.pendingDraftText) return
    const inputs = this.querySelectorAll<HTMLInputElement>('[data-tlk-bulk-input]')
    if (inputs.length === 0) return
    inputs.forEach(input => {
      const idx = Number.parseInt(input.dataset.unitIndex ?? '', 10)
      if (!Number.isFinite(idx)) return
      const printAreaId = input.dataset.printAreaId ?? ''
      const layerId = input.dataset.layerId ?? ''
      const fieldKey = `${printAreaId}:${layerId}`
      const value = this.pendingDraftText?.[idx]?.[fieldKey]
      if (typeof value === 'string') input.value = value
    })
    // Drop the reference now that we hydrated. Otherwise a later renderUnits()
    // (e.g. on qty change after the customer typed something fresh) would
    // overwrite the customer's typed value with the original draft snapshot.
    this.pendingDraftText = null
  }

  /**
   * Schedule a debounced auto-save. Coalesces rapid keystrokes so we don't
   * flood localStorage on every character. Skipped silently when the drawer
   * has no productId/variantId scope (e.g. test environments without a
   * sibling customizer).
   */
  private scheduleDraftSave(): void {
    const productId = this.getProductId()
    const variantId = this.getVariantId()
    if (!productId || !variantId) return
    if (this.draftSaveTimer !== null) {
      window.clearTimeout(this.draftSaveTimer)
    }
    this.draftSaveTimer = window.setTimeout(() => {
      this.draftSaveTimer = null
      saveDraft(productId, variantId, this.snapshotDraft())
    }, TailorKitBulkDrawer.DRAFT_SAVE_DEBOUNCE_MS)
  }

  /** Flush any pending debounced save immediately (e.g. before clearing). */
  private flushDraftSaveTimer(): void {
    if (this.draftSaveTimer !== null) {
      window.clearTimeout(this.draftSaveTimer)
      this.draftSaveTimer = null
    }
  }

  private render(): void {
    if (!this.config) return
    // Restore any previously saved draft before painting the panel. Quantity
    // and allSame need to land before the initial markup template uses them.
    const productId = this.getProductId()
    const variantId = this.getVariantId()
    if (productId && variantId) {
      const draft = loadDraft(productId, variantId)
      if (draft) this.restoreFromDraft(draft)
    }
    const dialogLabel = tHtml('bulk-personalization-dialog-label', 'Bulk personalization')
    this.innerHTML = `
      <label class="tlk-bulk-trigger">
        <input type="checkbox" class="tlk-bulk-trigger-checkbox" data-tlk-bulk-trigger-checkbox aria-controls="${PANEL_ID}" aria-expanded="false" />
        <span class="tlk-bulk-trigger-label">
          ${tHtml('bulk-trigger-label', 'I want to personalize each item differently')}
        </span>
      </label>
      <div id="${PANEL_ID}" class="tlk-bulk-panel" data-tlk-bulk-panel role="dialog" aria-modal="false" aria-label="${dialogLabel}" hidden>
        <div class="tlk-bulk-panel__header">
          <strong>${tHtml('bulk-personalization-title', 'Bulk personalization')}</strong>
          <button type="button" class="tlk-bulk-close" data-tlk-bulk-action="close" aria-label="${tHtml('bulk-close-label', 'Close')}">×</button>
        </div>
        <label class="tlk-bulk-qty">
          <span>${tHtml('bulk-quantity-label', 'Quantity')}</span>
          <input type="number" min="${MIN_QUANTITY}" max="${this.config.maxUnits}" value="${this.quantity}" data-tlk-bulk-qty />
        </label>
        <label class="tlk-bulk-allsame">
          <input type="checkbox" data-tlk-bulk-allsame${this.allSame ? ' checked' : ''} />
          <span>${tHtml('bulk-all-same-label', 'All units share the same personalization')}</span>
        </label>
        <div class="tlk-bulk-units" data-tlk-bulk-units></div>
        <button type="button" class="tlk-bulk-submit" data-tlk-bulk-action="submit">
          ${tHtml('bulk-submit-label', 'Add all to cart')}
        </button>
        <p class="tlk-bulk-status" data-tlk-bulk-status aria-live="polite"></p>
      </div>
    `
    this.root = this
    this.renderUnits()
    this.bindEvents()
  }

  private renderUnits(): void {
    const container = this.querySelector<HTMLElement>('[data-tlk-bulk-units]')
    if (!container) return

    // Capture customer-typed text values BEFORE we rebuild innerHTML so a
    // re-render triggered by qty change / image upload / image remove
    // doesn't wipe whatever the customer just typed. The snapshot is fed
    // into pendingDraftText so the existing populateTextInputsFromDraft()
    // call at the end of this method can repaint the values onto the
    // freshly rendered inputs. Skipped when a draft restore is already
    // pending (initial render seeded from localStorage) to avoid losing
    // the saved snapshot.
    if (!this.pendingDraftText) {
      const existingInputs = this.querySelectorAll<HTMLInputElement>('[data-tlk-bulk-input]')
      if (existingInputs.length > 0) {
        const snapshot: BulkDraft['text'] = {}
        existingInputs.forEach(input => {
          const idx = Number.parseInt(input.dataset.unitIndex ?? '', 10)
          if (!Number.isFinite(idx)) return
          const printAreaId = input.dataset.printAreaId ?? ''
          const layerId = input.dataset.layerId ?? ''
          if (!printAreaId || !layerId) return
          const fieldKey = `${printAreaId}:${layerId}`
          if (!snapshot[idx]) snapshot[idx] = {}
          snapshot[idx][fieldKey] = input.value
        })
        this.pendingDraftText = snapshot
      }
    }

    const keys = this.getPersonalizableFields()
    const total = this.quantity
    // When "all same" is checked, only render unit 0; the submit logic mirrors it across N items.
    const visibleCount = this.allSame ? 1 : total
    const rows: string[] = []
    for (let i = 0; i < visibleCount; i++) {
      const oneBased = i + 1
      const fields = keys
        .map(k =>
          k.kind === 'image'
            ? this.renderImageField(i, oneBased, total, k)
            : this.renderTextField(i, oneBased, total, k)
        )
        .join('')
      const legend = this.allSame
        ? tHtml('bulk-all-same-legend', 'All {{total}} units', { total: String(total) })
        : tHtml('bulk-unit-legend', 'Unit {{index}} of {{total}}', { index: String(oneBased), total: String(total) })
      const noFieldsMsg = tHtml(
        'bulk-no-personalizable-fields',
        'This product has no personalizable text or image fields.'
      )
      rows.push(`
        <fieldset class="tlk-bulk-unit" data-tlk-bulk-unit="${i}">
          <legend>${legend}</legend>
          ${fields || `<p>${noFieldsMsg}</p>`}
        </fieldset>`)
    }
    container.innerHTML = rows.join('')
    // Re-populate text inputs from a restored draft, if one is pending. Must
    // run after innerHTML so the input elements exist to receive values.
    this.populateTextInputsFromDraft()
  }

  private renderTextField(i: number, oneBased: number, total: number, k: PersonalizableField): string {
    const id = `tlk-bulk-u${i}-${escapeHtml(k.printAreaId)}-${escapeHtml(k.layerId)}`
    const placeholder = this.allSame
      ? tHtml('bulk-all-same-placeholder', 'Applied to all {{total}} units', { total: String(total) })
      : tHtml('bulk-unit-placeholder', 'Type for unit {{index}}', { index: String(oneBased) })
    return `
      <label class="tlk-bulk-field">
        <span>${escapeHtml(k.label)}</span>
        <input
          type="text"
          id="${id}"
          data-tlk-bulk-input
          data-unit-index="${i}"
          data-print-area-id="${escapeHtml(k.printAreaId)}"
          data-layer-id="${escapeHtml(k.layerId)}"
          data-option-id="${escapeHtml(k.fieldsetId)}"
          data-display-label="${escapeHtml(k.label)}"
          placeholder="${placeholder}"
          autocomplete="off"
        />
      </label>`
  }

  /**
   * Render a per-unit image upload field. The hidden file input lets the customer
   * pick an image; on change we upload via the existing TailorKit upload service
   * and store the resulting URL keyed by `${unitIndex}:${printAreaId}:${layerId}`.
   * Already-uploaded images render a thumbnail + filename so the customer knows
   * which file is attached to that unit.
   */
  private renderImageField(i: number, _oneBased: number, _total: number, k: PersonalizableField): string {
    const fileInputId = `tlk-bulk-image-u${i}-${escapeHtml(k.printAreaId)}-${escapeHtml(k.layerId)}`
    const stateKey = this.imageKey(i, k.printAreaId, k.layerId)
    const existing = this.uploadedImages.get(stateKey)
    const removeLabel = tHtml('bulk-remove-image', 'Remove image')
    const previewMarkup = existing
      ? `<div class="tlk-bulk-image-preview">`
        + `<img src="${escapeHtml(existing.url)}" alt="${escapeHtml(existing.name)}" />`
        + `<span class="tlk-bulk-image-name">${escapeHtml(existing.name)}</span>`
        + `<button type="button" class="tlk-bulk-image-remove" `
        + `data-tlk-bulk-image-remove data-image-key="${escapeHtml(stateKey)}" aria-label="${removeLabel}">×</button>`
        + `</div>`
      : `<span class="tlk-bulk-image-empty">${tHtml('bulk-no-image-yet', 'No image yet')}</span>`
    return `
      <label class="tlk-bulk-field tlk-bulk-field--image">
        <span>${escapeHtml(k.label)}</span>
        <div class="tlk-bulk-image-row">
          ${previewMarkup}
          <label for="${fileInputId}" class="tlk-bulk-image-button">
            ${tHtml(existing ? 'bulk-replace-image' : 'bulk-upload-image', existing ? 'Replace' : 'Upload')}
          </label>
          <input
            type="file"
            id="${fileInputId}"
            class="tlk-bulk-image-input"
            data-tlk-bulk-image-input
            data-unit-index="${i}"
            data-print-area-id="${escapeHtml(k.printAreaId)}"
            data-layer-id="${escapeHtml(k.layerId)}"
            data-option-id="${escapeHtml(k.fieldsetId)}"
            data-display-label="${escapeHtml(k.label)}"
            accept="image/png, image/jpeg, image/webp"
          />
        </div>
      </label>`
  }

  private bindEvents(): void {
    if (!this.root) return
    // Stop ALL clicks inside this drawer from reaching the parent
    // <tailorkit-product-personalizer>'s clickEventHandler. That handler
    // calls e.preventDefault() on every click whose target is NOT one of:
    //   - <summary> / file-input / .emtlkit--checkbox-container
    //   - <label> with `for` attribute containing "-input"
    // None of the drawer's UI matches that whitelist, so without
    // stopPropagation the parent's preventDefault would silently break:
    //   - trigger checkbox tick (label-to-checkbox toggle native action)
    //   - "Upload" label click (label-to-file-input native action) →
    //     file picker never opens, customer cannot upload per-unit
    //     images, and the cart ends up reusing the single-mode upload
    //     for every line item
    //   - allSame checkbox tick
    //   - text input focus / typing
    //   - submit / close button clicks
    // The drawer dispatches its own actions below; the parent personalizer
    // has no logic that depends on seeing the drawer's clicks.
    this.root.addEventListener('click', e => {
      const target = e.target as HTMLElement
      if (!target.closest('.tlk-bulk-trigger') && !target.closest('[data-tlk-bulk-panel]')) {
        // Click happened outside both the trigger and the panel — it is
        // not for the drawer; let it bubble normally so other listeners
        // (e.g. the personalizer's option pickers) can handle it.
        return
      }
      e.stopPropagation()
      const action = target.closest<HTMLElement>('[data-tlk-bulk-action]')?.getAttribute('data-tlk-bulk-action')
      if (action === 'close') this.close()
      else if (action === 'submit') void this.submit()
    })

    // Trigger checkbox: tick opens the bulk panel, untick collapses it back
    // to single-mode. Acts as a clear opt-in inside the personalize design
    // card so the customer knows they have a choice.
    const triggerCheckbox = this.querySelector<HTMLInputElement>('[data-tlk-bulk-trigger-checkbox]')
    triggerCheckbox?.addEventListener('change', () => {
      if (triggerCheckbox.checked) this.open()
      else this.close()
    })
    const qtyInput = this.querySelector<HTMLInputElement>('[data-tlk-bulk-qty]')
    qtyInput?.addEventListener('change', () => {
      const next = Number.parseInt(qtyInput.value, 10)
      const safe = Number.isFinite(next) ? Math.max(MIN_QUANTITY, Math.min(next, this.config!.maxUnits)) : this.quantity
      qtyInput.value = String(safe)
      // Reducing quantity drops trailing units — purge their stored images so we
      // never serialize an image keyed to a unit that no longer exists.
      if (safe < this.quantity) this.pruneImagesAtOrAbove(safe)
      this.quantity = safe
      this.renderUnits()
      this.scheduleDraftSave()
      // Keep the hijacked theme ATC label ("Add 4 to cart") in sync with the
      // new quantity so the customer never sees a stale count on the button
      // they are about to click.
      this.atcBridge?.setQuantity(safe)
    })

    // Remove-image button per unit. Drops the entry from uploadedImages and
    // re-renders so the row reverts to "Upload" + "No image yet" placeholder.
    this.addEventListener('click', e => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-tlk-bulk-image-remove]')
      if (!target) return
      const key = target.dataset.imageKey
      if (!key) return
      this.uploadedImages.delete(key)
      this.renderUnits()
      this.scheduleDraftSave()
      // Mirror the removal to the customizer canvas so the live preview
      // falls back to the template's default image, mirroring the upload
      // path's preview behavior. Empty url asks setLayerImage to clear.
      const [, printAreaId, layerId] = key.split(':')
      if (printAreaId && layerId) void this.previewLayerImage(printAreaId, layerId, '', '')
    })

    const allSameInput = this.querySelector<HTMLInputElement>('[data-tlk-bulk-allsame]')
    allSameInput?.addEventListener('change', () => {
      this.allSame = Boolean(allSameInput.checked)
      this.renderUnits()
      this.scheduleDraftSave()
    })

    // Live preview: as customer types in a unit input, mirror the value to the
    // matching single-mode customizer text input and fire input + change events.
    // The customizer's existing OptionProcessor + Konva pipeline picks it up and
    // re-renders the canvas so the customer sees what they are personalizing.
    // Also schedule a debounced draft save so an F5 mid-typing keeps progress.
    this.addEventListener('input', e => {
      const target = e.target as HTMLElement
      if (!target.matches('[data-tlk-bulk-input]')) return
      // Mirror to single-mode customizer was removed: dispatching `input`/
      // `change` on the single-mode text input triggered the personalizer's
      // root input handler (setupTextInputListeners → 200ms debounce →
      // renderCanvas + Transmitter 'tailorkit-set-options' → handleOptionSetChange
      // cascade), which under prod conditions ends up mutating the drawer
      // panel's DOM enough to wipe per-unit upload/text rows mid-typing.
      // Customers observed: typing in unit 2 caused unit 1's text to vanish
      // and the upload fields to collapse to a single shared field.
      // Text-content live preview is sacrificed for data correctness — the
      // per-unit text in the cart payload is unaffected (it's read from the
      // drawer's own inputs, not from the single-mode FormManager). Image
      // live preview still works because it routes through setLayerImage,
      // which serializes its own work and does not dispatch DOM events.
      this.scheduleDraftSave()
    })

    // Per-unit image upload: on file selection, upload via the existing TailorKit
    // upload service and stash the URL in `uploadedImages` keyed by unit + layer.
    this.addEventListener('change', async e => {
      const target = e.target as HTMLElement
      if (!target.matches('[data-tlk-bulk-image-input]')) return
      const fileInput = target as HTMLInputElement
      const file = fileInput.files?.[0]
      if (!file) return
      await this.handlePerUnitImageUpload(fileInput, file)
    })

    // Focus-based text mirror was removed for the same reason: a focusin
    // would batch-mirror all of a unit's text values to the single-mode
    // inputs, triggering the same cascade described above. Per-unit cart
    // data is still correct (collectUnits reads bulk inputs directly).

    // Document-level Escape handler so the customer can dismiss the panel quickly.
    this.keydownHandler = e => {
      if (e.key === 'Escape' && this.isOpen) this.close()
    }
    document.addEventListener('keydown', this.keydownHandler)
  }

  /**
   * Ask the sibling customizer to imperatively swap a layer's image source
   * for live preview. Mirrors the text-mirror UX: drawer asks, customizer
   * does the work, drawer ignores the result. Empty `imageUrl` clears so
   * remove-image rolls back to the template's default image.
   *
   * Optional chaining + try/catch so older theme-cached customizer builds
   * (or a customizer that hasn't finished its initial mount yet) silently
   * no-op instead of breaking the drawer's ATC flow. The cart-line image
   * URL has already been stored in `uploadedImages` by the caller, so a
   * missing preview is purely cosmetic.
   */
  private async previewLayerImage(
    printAreaId: string,
    layerId: string,
    imageUrl: string,
    imageName: string
  ): Promise<void> {
    // `setLayerImage` is a method on `<tailorkit-product-personalizer>` (the
    // inner wrapper), not on the outer customizer-customizer. In modal mode
    // the outer customizer isn't even an ancestor, so we must resolve the
    // personalizer directly.
    const personalizer = this.getPersonalizerEl() as
      | (HTMLElement & {
          setLayerImage?: (printAreaId: string, layerId: string, url: string, name?: string) => Promise<void>
        })
      | null
    try {
      await personalizer?.setLayerImage?.(printAreaId, layerId, imageUrl, imageName)
    } catch {
      // Silent — preview is best-effort; the cart payload already has the URL.
    }
  }

  /**
   * Upload a customer-selected image for one bulk unit. Reuses the existing
   * uploadImageToServer service so the file lands in the same Shopify Files
   * bucket as single-mode uploads. Stores `{url, name}` keyed by unit + layer
   * so subsequent re-renders show the thumbnail and submit() includes the URL
   * in that unit's properties.
   */
  private async handlePerUnitImageUpload(fileInput: HTMLInputElement, file: File): Promise<void> {
    const idx = Number.parseInt(fileInput.dataset.unitIndex ?? '0', 10)
    if (!Number.isFinite(idx)) return
    const printAreaId = fileInput.dataset.printAreaId ?? ''
    const layerId = fileInput.dataset.layerId ?? ''
    if (!printAreaId || !layerId) return

    // Disable the matching upload <label> button + mark aria-busy so the
    // customer can't trigger a second upload on the same row mid-flight.
    const uploadButton = fileInput.previousElementSibling as HTMLElement | null
    const buttonOriginalText = uploadButton?.textContent ?? null
    if (uploadButton) {
      uploadButton.setAttribute('aria-busy', 'true')
      uploadButton.setAttribute('aria-disabled', 'true')
      uploadButton.classList.add('tlk-bulk-image-button--busy')
      uploadButton.textContent = translate('bulk-status-uploading-image', 'Uploading image…')
    }

    this.setStatus(translate('bulk-status-uploading-image', 'Uploading image…'), 'info')
    try {
      const result = await uploadImageToServer(file, false)
      // Race guard: if the drawer was closed mid-upload, close() already cleared
      // uploadedImages — committing the resolved URL here would leak it into the
      // next session and the customer would re-open the drawer to see a stale
      // thumbnail they didn't intentionally upload.
      if (!this.isOpen) return
      if (!result.success || !result.url) {
        this.setStatus(result.error || translate('bulk-error-upload-failed', 'Upload failed.'), 'error')
        // Reset file input so the row's filename label clears — otherwise the
        // browser still shows the failed file name even though no image was stored.
        fileInput.value = ''
        return
      }
      // Capture the fieldset's option-set id (same source the text branch
      // uses) so collectUnits can emit a cart property with selectedOptionId
      // matching single-mode shape. Without it, the cart UI / order print
      // can't resolve the option and the image silently disappears.
      const optionId = fileInput.dataset.optionId ?? ''
      // Capture the display label too so collectUnits can override the
      // cart UI's visible label-keyed property per unit (see UploadedImage
      // docstring for why this matters).
      const displayLabel = fileInput.dataset.displayLabel ?? ''
      this.uploadedImages.set(this.imageKey(idx, printAreaId, layerId), {
        url: result.url,
        name: file.name,
        optionId,
        displayLabel,
      })
      this.setStatus('', 'info')
      // Re-render units so the new thumbnail + Replace button show up.
      this.renderUnits()
      this.scheduleDraftSave()
      // Mirror the upload to the customizer canvas so the customer sees a
      // live preview of what they just uploaded. Optional chaining tolerates
      // older theme-cached customizer builds that pre-date setLayerImage.
      void this.previewLayerImage(printAreaId, layerId, result.url, file.name)
    } catch (err) {
      if (!this.isOpen) return
      const message = err instanceof Error ? err.message : translate('bulk-error-upload-failed', 'Upload failed.')
      this.setStatus(message, 'error')
      fileInput.value = ''
    } finally {
      // Re-enable the button regardless of success/failure so the customer can
      // retry. Skipped when renderUnits() above replaced the row entirely.
      if (uploadButton && uploadButton.isConnected) {
        uploadButton.removeAttribute('aria-busy')
        uploadButton.removeAttribute('aria-disabled')
        uploadButton.classList.remove('tlk-bulk-image-button--busy')
        if (buttonOriginalText !== null) uploadButton.textContent = buttonOriginalText
      }
    }
  }

  private open(): void {
    this.isOpen = true
    // Refresh unit rows from the live customizer fieldsets. The drawer is
    // mounted INSIDE <tailorkit-product-personalizer> ABOVE the views-bar +
    // print-areas, so when the drawer's connectedCallback fires during HTML
    // parsing, the fieldsets haven't been parsed yet and the initial
    // renderUnits build sees zero personalizable fields. By the time the
    // customer ticks the trigger to open the panel, the fieldsets are in
    // the DOM — re-rendering here is the safest place to pick them up.
    // The snapshot/restore inside renderUnits preserves anything the
    // customer already typed across re-opens.
    this.renderUnits()
    const panel = this.querySelector<HTMLElement>('[data-tlk-bulk-panel]')
    const checkbox = this.querySelector<HTMLInputElement>('[data-tlk-bulk-trigger-checkbox]')
    if (panel) {
      panel.hidden = false
      // Move focus to quantity input so keyboard users can start interacting immediately.
      panel.querySelector<HTMLInputElement>('[data-tlk-bulk-qty]')?.focus()
    }
    if (checkbox) {
      // Keep the trigger checkbox state in sync (programmatic opens still
      // need to flip the visible tick on, e.g. if a future flow opens the
      // panel without the customer ticking the box themselves).
      if (!checkbox.checked) checkbox.checked = true
      checkbox.setAttribute('aria-expanded', 'true')
    }
    this.attachAtcBridge()
  }

  /**
   * Hijack the theme's Add-to-Cart button so customer clicks it to submit
   * the bulk payload, and hide express checkouts (Buy It Now, Shop Pay, …)
   * that would otherwise bypass per-unit personalization. When the bridge
   * attaches successfully the drawer's internal submit button is hidden so
   * only ONE add-to-cart affordance is visible at a time. If no theme ATC
   * exists (degraded markup) the bridge silently no-ops and the drawer's
   * own submit stays visible as a fallback.
   */
  private attachAtcBridge(): void {
    if (this.atcBridge) return
    this.atcBridge = new BulkAtcBridge({
      onAtcClick: () => {
        void this.submit()
      },
      bulkLabel: (qty: number) => translate('bulk-atc-label', 'Add {{count}} to cart', { count: String(qty) }),
    })
    const attached = this.atcBridge.attach(this.quantity)
    const ownSubmit = this.querySelector<HTMLButtonElement>('[data-tlk-bulk-action="submit"]')
    if (attached && ownSubmit) ownSubmit.hidden = true
    if (!attached) {
      this.atcBridge = null
      // Skip the locationchange listener too: a page with no theme ATC will
      // not gain one on variant switch, and the warn from re-attach would
      // fire on every navigation.
      return
    }
    // Watch for variant changes — themes re-render the ATC button on variant
    // switch, leaving our cached reference detached. Re-resolve on each event.
    if (!this.locationChangeHandler) {
      this.locationChangeHandler = () => this.reattachAtcBridge()
      window.addEventListener('locationchange', this.locationChangeHandler)
    }
  }

  private detachAtcBridge(): void {
    if (this.locationChangeHandler) {
      window.removeEventListener('locationchange', this.locationChangeHandler)
      this.locationChangeHandler = null
    }
    if (!this.atcBridge) return
    this.atcBridge.detach()
    this.atcBridge = null
    const ownSubmit = this.querySelector<HTMLButtonElement>('[data-tlk-bulk-action="submit"]')
    if (ownSubmit) ownSubmit.hidden = false
  }

  /**
   * Detach + re-attach the bridge so we resolve the freshly rendered ATC
   * button. Called on `locationchange` (variant switch). No-op when the
   * drawer is closed because the location listener is only added on open
   * and torn down on close.
   *
   * If the new attach attempt fails (e.g. variant change navigated to a
   * page that no longer has an ATC button), we tear down the location
   * listener as well — otherwise every subsequent navigation would
   * spam the console with "no ATC found" warnings indefinitely.
   */
  private reattachAtcBridge(): void {
    if (!this.isOpen) return
    if (this.atcBridge) {
      this.atcBridge.detach()
      this.atcBridge = null
    }
    this.atcBridge = new BulkAtcBridge({
      onAtcClick: () => {
        void this.submit()
      },
      bulkLabel: (qty: number) => translate('bulk-atc-label', 'Add {{count}} to cart', { count: String(qty) }),
    })
    const attached = this.atcBridge.attach(this.quantity)
    const ownSubmit = this.querySelector<HTMLButtonElement>('[data-tlk-bulk-action="submit"]')
    if (attached && ownSubmit) ownSubmit.hidden = true
    if (!attached) {
      this.atcBridge = null
      if (ownSubmit) ownSubmit.hidden = false
      if (this.locationChangeHandler) {
        window.removeEventListener('locationchange', this.locationChangeHandler)
        this.locationChangeHandler = null
      }
    }
  }

  private close(): void {
    this.isOpen = false
    // Cancel any debounced draft save before we clear in-memory state. Otherwise
    // the timer would fire AFTER uploadedImages.clear() and overwrite the
    // localStorage draft with an empty images map, silently dropping every
    // upload the customer made this session.
    this.flushDraftSaveTimer()
    // Discard any pending hydration so a fresh open/type cycle with a slow
    // fieldset load doesn't get its inputs overwritten by stale draft text
    // when renderUnits below runs.
    this.pendingDraftText = null
    // Roll back any bulk-driven image overrides on the customizer canvas
    // before we drop our local map. Each previewLayerImage('', '') call
    // tells setLayerImage to remove the bulk-uploaded option from the
    // option set and its localStorage backing, so closing the drawer
    // without ATC leaves single-mode untouched. De-duplicate to one
    // call per layer regardless of how many units uploaded to that layer.
    const layersToClear = new Set<string>()
    for (const key of this.uploadedImages.keys()) {
      const [, paId, layerId] = key.split(':')
      if (paId && layerId) layersToClear.add(`${paId}:${layerId}`)
    }
    for (const layerKey of layersToClear) {
      const [paId, layerId] = layerKey.split(':')
      void this.previewLayerImage(paId, layerId, '', '')
    }
    // Drop any uploaded image state on close so re-opening starts clean. The
    // map otherwise persists across drawer sessions and would either leak
    // memory or cause stale URLs to be submitted on the next bulk ATC.
    this.uploadedImages.clear()
    const panel = this.querySelector<HTMLElement>('[data-tlk-bulk-panel]')
    const checkbox = this.querySelector<HTMLInputElement>('[data-tlk-bulk-trigger-checkbox]')
    if (panel) panel.hidden = true
    if (checkbox) {
      if (checkbox.checked) checkbox.checked = false
      checkbox.setAttribute('aria-expanded', 'false')
      // Return focus to the toggle so keyboard navigation continues from there.
      checkbox.focus()
    }
    // Restore the theme's ATC label + express-checkout visibility now that
    // the customer has opted back to single-mode.
    this.detachAtcBridge()
    // Re-render units so any thumbnails painted from the previous session are
    // wiped from the DOM in case the customer re-opens the drawer.
    this.renderUnits()
  }

  private setStatus(msg: string, tone: 'info' | 'error' | 'success' = 'info'): void {
    const el = this.querySelector<HTMLElement>('[data-tlk-bulk-status]')
    if (!el) return
    el.textContent = msg
    el.dataset.tone = tone
  }

  private collectUnits(): BulkUnitInput[] {
    const baseProps = this.gatherBaseProperties()
    const inputs = Array.from(this.querySelectorAll<HTMLInputElement>('[data-tlk-bulk-input]'))
    const units: UnitTextValues[] = Array.from({ length: this.quantity }, () => ({}))

    for (const input of inputs) {
      const idx = Number.parseInt(input.dataset.unitIndex ?? '0', 10)
      if (!Number.isFinite(idx) || idx < 0 || idx >= units.length) continue
      const printAreaId = input.dataset.printAreaId ?? ''
      const layerId = input.dataset.layerId ?? ''
      const displayLabel = input.dataset.displayLabel ?? ''
      const value = input.value || ''
      // Technical key: storefront key shape mirrors OptionProcessor's text-option
      // serialization exactly: `${PROPERTY_PREFIX} ${printAreaId} ${layerId}`.
      // Hardcoding "_PF" would not match the runtime-resolved per-shop prefix,
      // so use the shared constant so override works.
      const technicalKey = `${PROPERTY_PREFIX} ${printAreaId} ${layerId}`
      units[idx][technicalKey] = JSON.stringify({
        selectedOptionId: input.dataset.optionId ?? '',
        settings: { content: value },
      })
      // Display label key: Shopify cart UI hides properties whose key starts
      // with `_`, so the technical key above is invisible to the customer.
      // Without overriding the label-keyed property too, the customer would
      // see the same single-mode base value on every line item even though
      // the per-unit data is being submitted correctly.
      //
      // Skip empty values so the customer's typed-nothing units inherit the
      // single-mode base instead of showing an empty label-value pair in cart.
      if (displayLabel && value) {
        units[idx][displayLabel] = value
      }
    }

    // Per-unit image overrides: serialize using the SAME shape single-mode
    // emits when an image_option is selected. Cart UI + order print both
    // parse `settings.image.imageSrc` and ignore properties that don't have
    // the `settings` wrapper, so omitting it makes the upload silently
    // disappear from the cart. Match the text branch's shape exactly:
    // { selectedOptionId, settings: { ... } }.
    for (const [storageKey, image] of this.uploadedImages.entries()) {
      const [idxStr, printAreaId, layerId] = storageKey.split(':')
      const idx = Number.parseInt(idxStr, 10)
      if (!Number.isFinite(idx) || idx < 0 || idx >= units.length) continue
      if (!printAreaId || !layerId) continue
      const technicalKey = `${PROPERTY_PREFIX} ${printAreaId} ${layerId}`
      units[idx][technicalKey] = JSON.stringify({
        selectedOptionId: image.optionId ?? '',
        settings: {
          image: { imageSrc: image.url, imageName: image.name },
        },
      })
      // Mirror the per-unit filename onto the display label key for the same
      // reason as the text branch above (Shopify cart hides `_`-prefixed
      // properties). Use `image.name` (filename) rather than the full CDN url
      // so the cart line matches the single-mode shape — FormManager emits
      // the filename for image_option uploads, and the customer expects the
      // same look on both single-mode and bulk line items.
      if (image.displayLabel) {
        units[idx][image.displayLabel] = image.name
      }
    }

    // "All same" mode: only unit 0 was rendered + populated. Mirror its values
    // to units 1..N. ORDER DEPENDENCY: this MUST run AFTER both the text and
    // image loops above so the display-label overrides written into units[0]
    // get propagated. Reordering above the image loop would silently drop
    // image display-label values for units 1..N — keep this block last.
    if (this.allSame && units.length > 0) {
      const sourceValues = units[0]
      for (let i = 1; i < units.length; i++) {
        units[i] = { ...sourceValues }
      }
    }

    return units.map(unitText => ({
      properties: { ...baseProps, ...unitText },
    }))
  }

  private async submit(): Promise<void> {
    if (!this.config) return
    // Double-submit guard: if a customer rapid-clicks the ATC button, two
    // concurrent submit() calls would each fire postBulkCartAdd, doubling
    // the cart line items (2×N instead of N). Block re-entry until the
    // first submission settles.
    if (this.isSubmitting) return
    const variantId = this.getVariantId()
    if (!variantId) {
      this.setStatus(translate('bulk-error-no-variant', 'Cannot find variant ID. Reload and try again.'), 'error')
      return
    }

    this.isSubmitting = true
    const submitBtn = this.querySelector<HTMLButtonElement>('[data-tlk-bulk-action="submit"]')
    if (submitBtn) {
      submitBtn.setAttribute('disabled', 'true')
      submitBtn.setAttribute('aria-busy', 'true')
    }
    this.setStatus(translate('bulk-status-adding', 'Adding to cart…'), 'info')

    try {
      const fit = await canFitBulkInCart(this.quantity)
      if (!fit.ok) {
        this.setStatus(fit.reason, 'error')
        return
      }

      const units = this.collectUnits()
      const groupId = generateUuid()
      const payload = buildBulkCartPayload(variantId, units, groupId, this.config.labelTemplate)

      try {
        await postBulkCartAdd(payload)
        dispatchCartRefreshEvents()
        // Successful ATC means the draft has fulfilled its purpose — wipe it
        // so the customer doesn't re-open the drawer to find a stale snapshot
        // of what they already submitted. Flush any pending debounced save
        // first to avoid a race where the timer fires after we cleared.
        this.flushDraftSaveTimer()
        const productId = this.getProductId()
        if (productId && variantId) clearDraft(productId, variantId)
        this.setStatus(
          translate('bulk-status-success', '{{count}} items added to cart.', { count: String(this.quantity) }),
          'success'
        )
        this.close()
        // Soft refresh fallback: if no cart drawer is listening to our events,
        // navigate to /cart so the customer sees the result.
        setTimeout(() => {
          if (!this.hasAttribute(SKIP_REDIRECT_ATTR)) {
            window.location.href = '/cart'
          }
        }, CART_REDIRECT_DELAY_MS)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Bulk add failed.'
        // Sanitized: only render plain text via textContent (set by setStatus).
        this.setStatus(message, 'error')
      }
    } finally {
      this.isSubmitting = false
      // Re-enable the button so the customer can retry on error. On success
      // the drawer closes anyway, so the button is hidden — the cleanup is
      // still safe because we look it up fresh and tolerate null.
      const btnAfter = this.querySelector<HTMLButtonElement>('[data-tlk-bulk-action="submit"]')
      if (btnAfter) {
        btnAfter.removeAttribute('disabled')
        btnAfter.removeAttribute('aria-busy')
      }
    }
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('tailorkit-bulk-drawer')) {
  customElements.define('tailorkit-bulk-drawer', TailorKitBulkDrawer)
}
