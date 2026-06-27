/* eslint-disable max-len, max-lines */
import { h, render } from 'preact'
import {
  APP_PROXY_PATH,
  ProductPersonalizerCustomizerWebComponentTag,
  ProductPersonalizerWebComponentTag,
  PROPERTY_PREFIX,
} from '../constants'
import { DEFAULT_APP_BLOCK_INSTALLATION_SETTINGS } from '../constants/app-block'
import { resolveFeaturedImageContainerSelector } from '../utils/resolve-featured-container'
import { parseFeaturedImagePosition } from '../utils/parse-featured-image-position'
import { TAILORKIT_PRODUCT_PERSONALIZER_ERRORS } from '../constants/errors'
import { isJSON } from '../fns/is-json'
import '../libraries/location-change-handler'
import { Transmitter } from '../libraries/transmitter'
import { ModalTrigger } from './preact/commons/modal/modal-trigger'
import { InlineConfirmationCheckboxManager } from '../features/confirmation-checkbox/inline-checkbox-manager'
import type { TailorKitProductPersonalizer } from './product-personalizer'
import { getDeviceType, isMobile as isMobileDevice } from '../utils/devices'
import { OptionProcessor } from './option-processors'
import { FormManager } from './form-manager'
import { CanvasPreviewManager } from './canvas-preview-manager'
import { PricingManager } from './pricing-manager'
import { TransmitterEvents } from '../constants/transmitter-events'
import { PersonalizerStore } from '../libraries/personalizer-store'
import { STORE_FRONT_ACTION } from '../constants/app-actions'
import { EXPRESS_CHECKOUT_SELECTORS } from '../handlers/buyItNowHandler'
import { parseJSONAttribute } from '../utils/helpers'
import type { PrintArea, TransmitterEventData } from '../type'
import type { EventObject } from '../libraries/event-handler'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TailorKitPersonalizationSession: any
  }
}

interface ModalSettings {
  mobile?: boolean
  desktop?: boolean
}

interface AppSettings {
  modalPersonalizeDesign?: ModalSettings & {
    showAddToCart?: boolean
    showBuyItNow?: boolean
  }
  featured_image_container_selector?: string
  buyItNowHandling?: {
    enabled?: boolean
    mode?: 'disable' | 'redirect'
  }
}

class TailorKitPrintAreaCustomizer extends HTMLElement {
  private locationChangeHandler: (() => void) | null = null
  private resizeHandler: (() => void) | null = null
  private modalSettings: ModalSettings = {}
  private appSettings: AppSettings = {}
  private productImageSelector: string = ''
  private isModalMode: boolean = false
  private isInitialized: boolean = false
  private triggerContainer: HTMLElement | null = null
  private inlineCheckboxManager: InlineConfirmationCheckboxManager | null = null
  private optionChangeDebounceTimer: number | null = null
  private readonly optionChangeDebounceDelay: number = 300

  private listenedATC: boolean = false
  private listenedBIN: boolean = false
  private totalInteractions: number = 0

  /** Per-instance tracking timer (replaces module-level `timer`) */
  private _trackingTimer: ReturnType<typeof setTimeout> | null = null
  private _boundInitHandler: ((e: EventObject) => void) | null = null

  // Track last processed variant to prevent infinite loops on locationchange
  private lastProcessedVariantId: string | null = null
  private locationChangeDebounceTimer: number | null = null
  private readonly locationChangeDebounceDelay: number = 100

  /** Check if any print area contains charm builder config (synchronous data check) */
  private hasCharmConfig(): boolean {
    const pp = this.querySelector(ProductPersonalizerWebComponentTag) as HTMLElement
    if (!pp) return false
    const printAreas = parseJSONAttribute(pp, 'data-print-areas', [])
    return printAreas.some((pa: { charmConfig?: unknown }) => pa?.charmConfig)
  }

  /** Show warning when duplicate blocks detected — only the first block should function */
  private renderDuplicateWarning() {
    this.innerHTML = `
      <div style="
        padding: 16px;
        border: 2px dashed #d82c0d;
        border-radius: 8px;
        background: #fff4f4;
        color: #1a1a1a;
        text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        margin: 8px 0;
      ">
        <p style="margin: 0 0 4px; font-weight: 600;">⚠️ Duplicate TailorKit Block</p>
        <p style="margin: 0;">Only one TailorKit block is needed per product page. Please remove this extra block.</p>
      </div>
    `
  }

  /** Returns a stable per-product-page instance key */
  getInstanceId(): string {
    const productId = this.getAttribute('data-product-id') || ''
    return productId ? `${productId}::page` : 'default'
  }

  init() {
    // Defensive: nested duplicates (e.g., PageFly page builder injecting the block
    // as a child of another customizer) are outside the merchant's direct control.
    // Silently remove the nested copy instead of showing a warning.
    const parentCustomizer = this.parentElement?.closest(ProductPersonalizerCustomizerWebComponentTag)
    if (parentCustomizer) {
      this.remove()
      return
    }

    // Detect duplicate blocks — allow one per product-id, not one per page.
    // A second block for the same product-id is a config error; different product-ids
    // on the same page (cross-product modal) are intentional and both should initialize.
    const productId = this.getAttribute('data-product-id')
    if (productId) {
      const sameProductCustomizers = document.querySelectorAll(
        `${ProductPersonalizerCustomizerWebComponentTag}[data-product-id="${productId}"]`
      )
      if (sameProductCustomizers.length > 1 && sameProductCustomizers[0] !== this) {
        this.renderDuplicateWarning()
        return
      }
    } else {
      // No product-id: fall back to the original single-per-page guard
      const allCustomizers = document.querySelectorAll(ProductPersonalizerCustomizerWebComponentTag)
      if (allCustomizers.length > 1 && allCustomizers[0] !== this) {
        this.renderDuplicateWarning()
        return
      }
    }

    // Check if personalization available
    const productPersonalizer = this.querySelector(ProductPersonalizerWebComponentTag) as HTMLElement
    const printAreas = productPersonalizer && parseJSONAttribute(productPersonalizer, 'data-print-areas')

    if (!printAreas?.find((p: PrintArea) => p?.ls?.length || p?.charmConfig)) {
      return
    }

    // Init personalization session — keyed per product-id so multiple products on
    // the same page maintain independent session data (multi-instance support).
    window.TailorKitPersonalizationSession = window.TailorKitPersonalizationSession || {}

    // Track page visit (productId already declared above from duplicate guard check)
    const sessionProductId = productId || ''
    const variantId = this.getAttribute('data-variant-id') || ''
    const productName = this.getAttribute('data-product-name') || ''

    // Per-product session bucket (falls back to top-level for backward compat with single-instance)
    const sessionKey = sessionProductId || 'default'
    window.TailorKitPersonalizationSession[sessionKey] = window.TailorKitPersonalizationSession[sessionKey] || {}
    const productSession = window.TailorKitPersonalizationSession[sessionKey]

    // Also keep writing flat top-level keys for backward-compat consumers
    if (!window.TailorKitPersonalizationSession.sessionId) {
      window.TailorKitPersonalizationSession.productId = sessionProductId
      window.TailorKitPersonalizationSession.variantId = variantId
      window.TailorKitPersonalizationSession.productName = productName
    }

    if (
      !productSession.sessionId
      || productSession.productId !== sessionProductId
      || productSession.variantId !== variantId
    ) {
      productSession.productId = sessionProductId
      productSession.variantId = variantId
      productSession.productName = productName

      const visitedAt = (productSession.visitedAt = Date.now())

      const sessionId = (productSession.sessionId = `${this.getInstanceId()}::${visitedAt}`)

      fetch(`${APP_PROXY_PATH}/app_proxy/storefront`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: STORE_FRONT_ACTION.TRACK_EVENT,
          eventName: 'storefront_product_page_view',
          properties: {
            sessionId,
            visitedAt,
            productId: sessionProductId,
            variantId,
            productName,
            deviceType: getDeviceType(),
            referrerUrl: document.referrer,
          },
        }),
      })
    }

    // Initialize modal functionality if needed
    this.initModalSettings()

    // Initialize responsive modal/inline switching
    this.initResponsiveMode()

    // Initialize Buy It Now handling for customized products
    this.initBuyItNowHandling()

    // Initialize wizard mode if configured
    this.initWizardMode()

    // Listen to event to update AI usages
    Transmitter.listen('tailorkit-storefront-usage', e => {
      e.preventDefault()
      e.stopPropagation()

      // Get add-to-cart forms
      const addToCartForms = this.getAddToCartForms()

      if (addToCartForms?.length) {
        const { data } = e

        // Set option data to form
        addToCartForms.forEach(addToCartForm => {
          const propName = `${PROPERTY_PREFIX}_USE_${data.feature}`
          const input = addToCartForm.querySelector(`input.emtlkit--tracking[data-name="${propName}"]`)
          const numberOfUses = Number((input as HTMLInputElement)?.value || 0)

          // Clear previous inputs
          input?.parentNode?.removeChild(input)

          // Create a new input element to track the usage of the feature
          FormManager.createInputElement(propName, `${numberOfUses + 1}`, addToCartForm, true)
        })
      }
    })

    /**
     * Listen to event to update add-to-cart form with debouncing
     * Handles option set changes with optional immediate execution for add-to-cart/buy-it-now flows.
     * When `immediate: true` is set in the event data, bypasses debouncing to ensure state is
     * synchronized before form submission. This is critical for ATC/BIN flows where timing matters.
     */
    Transmitter.listen('tailorkit-set-options', e => {
      e.preventDefault()
      e.stopPropagation()

      try {
        const eventData = (e as EventObject)?.data as TransmitterEventData | undefined
        const { immediate } = eventData || {}

        if (immediate === true) {
          // Run synchronously for ATC flows (skip debounce)
          // This ensures form data is flushed before submission
          this.handleOptionSetChange()
        } else {
          this.debouncedHandleOptionSetChange()
        }
      } catch {
        this.debouncedHandleOptionSetChange()
      }

      // Track personalization session
      const eventData = (e as EventObject)?.data as TransmitterEventData | undefined
      if (!eventData?.automation) {
        this.totalInteractions++

        if (!window.TailorKitPersonalizationSession.engagedAt) {
          this._trackingTimer && clearTimeout(this._trackingTimer)

          this._trackingTimer = setTimeout(() => {
            const tkps = window.TailorKitPersonalizationSession
            const { sessionId, visitedAt } = tkps
            const engagedAt = (window.TailorKitPersonalizationSession.engagedAt = Date.now())

            fetch(`${APP_PROXY_PATH}/app_proxy/storefront`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: STORE_FRONT_ACTION.TRACK_EVENT,
                eventName: 'storefront_personalization_start',
                properties: {
                  sessionId,
                  engagedAt,
                  productId,
                  variantId,
                  productName,
                  deviceType: getDeviceType(),
                  timeToEngagementSeconds: (engagedAt - visitedAt) / 1000,
                },
              }),
            })
          }, 100)
        }
      }
    })

    // Listen to Buy It Now buttons
    if (!this.listenedBIN) {
      this.listenedBIN = true

      EXPRESS_CHECKOUT_SELECTORS.forEach(selector => {
        document.querySelectorAll(selector).forEach(button => {
          button.addEventListener(
            'click',
            () => {
              this._trackingTimer && clearTimeout(this._trackingTimer)

              this._trackingTimer = setTimeout(() => {
                const tkps = window.TailorKitPersonalizationSession
                const { sessionId, productId, variantId, productName, engagedAt } = tkps

                fetch(`${APP_PROXY_PATH}/app_proxy/storefront`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: STORE_FRONT_ACTION.TRACK_EVENT,
                    eventName: 'storefront_personalization_complete',
                    properties: {
                      sessionId,
                      productId,
                      variantId,
                      productName,
                      addedToCart: true,
                      deviceType: getDeviceType(),
                      totalInteractions: this.totalInteractions,
                      customizationTimeSeconds: (Date.now() - engagedAt) / 1000,
                    },
                  }),
                })
              }, 100)
            },
            true
          )
        })
      })
    }
  }

  /**
   * Debounced option set change handler to prevent multiple simultaneous updates
   */
  private debouncedHandleOptionSetChange() {
    // Clear existing timer
    if (this.optionChangeDebounceTimer) {
      clearTimeout(this.optionChangeDebounceTimer)
    }

    // Set new timer
    this.optionChangeDebounceTimer = window.setTimeout(() => {
      this.handleOptionSetChange()
    }, this.optionChangeDebounceDelay)
  }

  /**
   * Main handler for option set changes
   * Processes option set changes and updates add-to-cart forms with current personalization data.
   * This method is called either:
   * - Synchronously (when `immediate: true` flag is set in the event) for add-to-cart/buy-it-now flows
   *   to ensure state is flushed before form submission
   * - Via debounced handler for regular option changes to prevent excessive updates
   */
  private handleOptionSetChange() {
    // Skip syncFromGlobalStore in modal mode — the personalizer lives in the
    // modal overlay, so clicking containers would fire cascading events and
    // cause an infinite loop between the inline and modal DOM trees.
    if (!this.isModalMode) {
      this.syncFromGlobalStore()
    }

    const addToCartForms = this.getAddToCartForms()

    if (!addToCartForms?.length) {
      return
    }

    const productPersonalizer = this.getProductPersonalizer()

    if (!productPersonalizer) {
      console.log(TAILORKIT_PRODUCT_PERSONALIZER_ERRORS.NONE_EXISTED_TAILORKIT_PRODUCT_PERSONALIZER)
      return
    }

    // Process metadata and display data from fieldsets
    const { metaData, displayData } = OptionProcessor.processFieldsetData(productPersonalizer)
    // Persist snapshot to shared store for cross-instance syncing (keyed by product+variant)
    PersonalizerStore.setSnapshot(this.getInstanceId(), { metaData, displayData })
    const productName = this.getAttribute('data-product-name') || ''

    // Update all add-to-cart forms
    FormManager.updateAddToCartForms(
      addToCartForms,
      metaData,
      displayData,
      productPersonalizer,
      productName,
      PricingManager.getDisplayValueWithPricing
    )

    // Update pricing and generate canvas preview for all forms.
    // Bind WC instanceId so the per-instance debounce timer and cache are used.
    const wcInstanceId = this.getInstanceId()
    PricingManager.updatePricingAndPreview(addToCartForms, productPersonalizer, (pp, forms) =>
      CanvasPreviewManager.debouncedGenerateCanvasPreview(wcInstanceId, pp, forms)
    )
  }

  /** Apply snapshot from shared store to the inline personalizer DOM */
  private syncFromGlobalStore() {
    try {
      const instanceId = this.getInstanceId()
      const snapshot = PersonalizerStore.getState(instanceId)
      if (!snapshot) return

      const productPersonalizer = this.getProductPersonalizer()
      if (!productPersonalizer) return

      const fieldsets = productPersonalizer.querySelectorAll('fieldset.emtlkit--option-set')
      fieldsets.forEach(fieldset => {
        const printAreaId = fieldset.getAttribute('data-print-area-id') || ''
        const layerId = fieldset.getAttribute('data-layer-id') || ''
        if (!printAreaId || !layerId) return

        const layerMeta = snapshot.metaData?.[printAreaId]?.[layerId]
        const selectedOptionId = layerMeta?.selectedOptionId
        if (!selectedOptionId) return

        const radio = fieldset.querySelector(`input[data-id="${selectedOptionId}"]`)
        const container = radio?.closest('.emtlkit--option-container') as HTMLElement | null
        if (container && !container.classList.contains('active')) {
          container.click()
        }
      })
    } catch (error) {
      console.warn('[TailorKit] Failed to sync from global store:', error)
    }
  }

  /**
   * Get the product personalizer instance
   */
  private getProductPersonalizer(): TailorKitProductPersonalizer | null {
    // Inline mode: scope to THIS customizer to avoid cross-product conflicts.
    const inline = this.querySelector('tailorkit-product-personalizer') as TailorKitProductPersonalizer | null
    if (inline) return inline

    // Modal mode: the personalizer was moved into the modal overlay (outside
    // this element). Find it by the data-modal-instance marker set in initModalMode.
    if (this.isModalMode) {
      return document.querySelector(
        'tailorkit-product-personalizer[data-modal-instance="true"]'
      ) as TailorKitProductPersonalizer | null
    }

    return null
  }

  getAddToCartForms() {
    const addToCartForms: HTMLFormElement[] = []

    // Get product ID
    const productId = this.getAttribute('data-product-id')

    if (productId) {
      const productInputs = document.querySelectorAll(`input[name="product-id"][value="${productId}"]`)

      productInputs.forEach(input => {
        const form = input.closest('form[action*="/cart/add"]') as HTMLFormElement

        if (form && !addToCartForms.includes(form)) {
          addToCartForms.push(form)

          // Track add to cart
          if (!this.listenedATC) {
            form.addEventListener('submit', () => {
              this._trackingTimer && clearTimeout(this._trackingTimer)

              this._trackingTimer = setTimeout(() => {
                const tkps = window.TailorKitPersonalizationSession
                const { sessionId, productId, variantId, productName, engagedAt } = tkps

                fetch(`${APP_PROXY_PATH}/app_proxy/storefront`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: STORE_FRONT_ACTION.TRACK_EVENT,
                    eventName: 'storefront_personalization_complete',
                    properties: {
                      sessionId,
                      productId,
                      variantId,
                      productName,
                      addedToCart: true,
                      deviceType: getDeviceType(),
                      totalInteractions: this.totalInteractions,
                      customizationTimeSeconds: (Date.now() - engagedAt) / 1000,
                    },
                  }),
                })
              }, 100)
            })
          }
        }
      })
    }

    this.listenedATC = true

    return addToCartForms
  }

  initLocationChangeHandler = () => {
    const { searchParams } = new URL(window.location.href)
    const variantId = searchParams.get('variant') || this.getAttribute('data-variant-id')

    // Set initial option data on page load
    Transmitter.trigger('tailorkit-set-options', { automation: true })

    // Store initial variant ID to track changes
    this.lastProcessedVariantId = variantId || null

    if (variantId) {
      // Store reference to handler function with debouncing and change detection
      this.locationChangeHandler = () => {
        // Clear any pending debounce timer
        if (this.locationChangeDebounceTimer) {
          clearTimeout(this.locationChangeDebounceTimer)
        }

        // Debounce the handler to prevent rapid-fire calls
        this.locationChangeDebounceTimer = window.setTimeout(() => {
          // Skip variant change processing when cross-product modal is open.
          // The modal WC shares some global state — re-init during modal can corrupt both instances.
          if (document.querySelector('.tlk-cross-product-modal__personalizer-wrapper')) return

          // Get current variant from URL
          const { searchParams: currentParams } = new URL(window.location.href)
          const currentVariantId = currentParams.get('variant') || this.getAttribute('data-variant-id')

          // Only trigger refresh if variant actually changed
          if (currentVariantId && currentVariantId !== this.lastProcessedVariantId) {
            this.lastProcessedVariantId = currentVariantId
            Transmitter.trigger(TransmitterEvents.REFRESH_LIVE_PREVIEW)
          }
        }, this.locationChangeDebounceDelay)
      }

      window.addEventListener('locationchange', this.locationChangeHandler)
    }

    return !!variantId
  }

  private initModalSettings() {
    const { featured_image_container_selector } = DEFAULT_APP_BLOCK_INSTALLATION_SETTINGS

    try {
      const appSettingsAttr = this.getAttribute('data-app-settings')

      if (appSettingsAttr && isJSON(appSettingsAttr)) {
        this.appSettings = JSON.parse(appSettingsAttr)
        this.modalSettings = this.appSettings?.modalPersonalizeDesign || {
          mobile: true,
          desktop: false,
        }
      } else {
        console.warn('🔧 No valid app settings found, using test settings for development')
        // Temporary fallback for development/testing
        this.modalSettings = {
          mobile: true,
          desktop: false,
        }
        this.appSettings = {
          modalPersonalizeDesign: this.modalSettings,
          featured_image_container_selector: featured_image_container_selector,
        }
      }

      // Query the featured image container selector from ProductPersonalizerWebComponentTag web component
      const productPersonalizer = document.querySelector(
        ProductPersonalizerWebComponentTag
      ) as TailorKitProductPersonalizer
      const dataSettings = productPersonalizer?.getAttribute('data-settings')

      if (dataSettings && isJSON(dataSettings)) {
        const dataSettingsObj = JSON.parse(dataSettings)
        this.appSettings = {
          ...this.appSettings,
          ...dataSettingsObj,
        }

        const featuredImageContainerSelector = this.appSettings.featured_image_container_selector
        // Optional 1-based image position (e.g. 2 = second image). When > 1, resolver
        // bypasses visibility check to target hidden slides in slideshow themes.
        const validPosition = parseFeaturedImagePosition(this.appSettings.featured_image_position)

        // Resolve product image selector
        this.productImageSelector
          = resolveFeaturedImageContainerSelector(
            featuredImageContainerSelector,
            featured_image_container_selector,
            validPosition
          ) || featured_image_container_selector
      }
    } catch (error) {
      console.error('🔧 Error parsing modal settings:', error)
      // Fallback for errors
      this.modalSettings = { mobile: true, desktop: false }
      this.productImageSelector = featured_image_container_selector
    }
  }

  private shouldShowModal(): boolean {
    // Always use inline mode inside a cross-product modal — already in a modal context
    if (this.getAttribute('data-cross-product') === 'true') return false

    const isMobile = isMobileDevice()

    if (isMobile) {
      return this.modalSettings.mobile === true
    }
    return this.modalSettings.desktop === true
  }

  private initResponsiveMode() {
    // Set up resize handler for responsive switching
    this.resizeHandler = () => {
      this.handleModeSwitch()
    }

    // Add resize event listener
    window.addEventListener('resize', this.resizeHandler)

    // Initial mode setup
    this.handleModeSwitch()
  }

  private handleModeSwitch() {
    const shouldShowModal = this.shouldShowModal()

    // If mode hasn't changed and we're already initialized, do nothing
    if (this.isInitialized && shouldShowModal === this.isModalMode) {
      return
    }

    this.isModalMode = shouldShowModal
    this.isInitialized = true

    if (shouldShowModal) {
      this.initModalMode()
    } else {
      this.initInlineMode()
    }
  }

  private initModalMode() {
    // Get all option set wrappers
    const optionSetWrappers = this.querySelectorAll('tailorkit-product-personalizer .emtlkit--option-set-wrapper')

    if ((!optionSetWrappers || optionSetWrappers.length === 0) && !this.hasCharmConfig()) {
      return
    }

    // Tell FormManager that modal mode is active - skip inline validation
    FormManager.setModalModeActive(true, this.getInstanceId())

    // Hide the inline customizer content
    const container = this.querySelector('.emtlkit--tab-content-container')

    if (container) {
      ;(container as HTMLElement).style.display = 'none'
    }

    // Remove existing trigger if it exists
    if (this.triggerContainer) {
      this.triggerContainer.remove()
    }

    // Create and render the modal trigger
    this.triggerContainer = document.createElement('div')
    this.triggerContainer.className = 'emtlkit-modal-trigger-container'

    const personalizedDesignTitle = window.__tailorkit__?.['app_block_settings']?.personalized_design_title
    const modalActions = this.appSettings?.modalPersonalizeDesign || {}
    try {
      render(
        h(ModalTrigger, {
          buttonText: personalizedDesignTitle || 'PERSONALIZE DESIGN',
          productImageSelector: this.productImageSelector,
          customizerContent: container as HTMLElement,
          showAddToCart: modalActions?.showAddToCart !== false,
          showBuyItNow: modalActions?.showBuyItNow === true,
          buttonClass: 'emtlkit--personalize emtlkit--product-personalizer emtlkit-button--fullWidth',
        }),
        this.triggerContainer
      )
    } catch (error) {
      console.error('🔧 Error rendering modal trigger:', error)
    }

    // Opt-in auto-positioning: attach the trigger directly under the theme's
    // ATC button for specific merchants who requested it. Other stores keep
    // the merchant-controlled block placement from the theme editor.
    const shouldAutoPosition = this.shouldAutoPositionTrigger()
    if (shouldAutoPosition && this.insertTriggerAfterATC()) {
      // Mirror the theme ATC button's font so the trigger matches the theme look.
      this.applyThemeButtonFont()
    } else if (container) {
      this.insertBefore(this.triggerContainer, container)
    } else {
      this.appendChild(this.triggerContainer)
    }

    // Set up FormManager for modal mode validation and button blocking
    const instanceId = this.getInstanceId()
    FormManager.setModalTriggerContainer(this.triggerContainer, instanceId)
    FormManager.setModalInstanceId(instanceId, instanceId)
    FormManager.blockThemeButtons(this, instanceId)
  }

  /**
   * Whether to auto-position the Personalise trigger below the theme's ATC button.
   * Opt-in per-shop to avoid overriding merchants who intentionally placed the
   * TailorKit block elsewhere via the theme editor.
   *
   * Matches either the Shopify permanent domain or the storefront hostname
   * (for custom domains like thedailyedited.com that don't expose the .myshopify.com).
   */
  private shouldAutoPositionTrigger(): boolean {
    const shop = (window as unknown as { Shopify?: { shop?: string } }).Shopify?.shop || ''
    const hostname = window.location.hostname || ''
    // Shops that requested "below Add to Bag" positioning.
    const AUTO_POSITION_SHOPS = new Set(['thedailyedited-au.myshopify.com', 'thedailyedited.myshopify.com'])
    const AUTO_POSITION_HOSTS = new Set(['thedailyedited.com', 'www.thedailyedited.com'])
    return AUTO_POSITION_SHOPS.has(shop) || AUTO_POSITION_HOSTS.has(hostname)
  }

  /**
   * Resolve the ATC form that belongs to THIS customizer's product, so cross-
   * product modals / quick-add widgets don't accidentally hijack another
   * product's form. Falls back to the first ATC form on the page.
   */
  private findProductATCForm(): HTMLElement | null {
    const productId = this.getAttribute('data-product-id')
    if (productId) {
      const productInput = document.querySelector(
        `input[name="product-id"][value="${productId}"]`
      ) as HTMLElement | null
      const scopedForm = productInput?.closest('form[action*="/cart/add"]') as HTMLElement | null
      if (scopedForm) return scopedForm
    }
    return document.querySelector('form[action*="/cart/add"]') as HTMLElement | null
  }

  /**
   * Find the visible ATC submit button inside the form.
   *
   * Many themes render `<button class="product-form__submit">` without an
   * explicit `name="add"` or `type="submit"` attribute (the default for
   * <button> inside a form already is submit). The CSS selector
   * `[type="submit"]` only matches when the attribute is present in HTML, so
   * we need a broader fallback chain.
   */
  private findATCSubmitButton(form: HTMLElement): HTMLElement | null {
    // 1. Standard Shopify themes (Dawn, Debut) + TDE custom theme.
    //    Keep `[type="submit"]` un-qualified to also catch <input type="submit">.
    const standard = form.querySelector(
      'button[name="add"], [type="submit"], .product-form__submit, [ref="atcButton"]'
    ) as HTMLElement | null
    if (standard) return standard

    // 2. Generic fallback: first VISIBLE <button> with default-submit semantics.
    //    Visibility guard prevents picking up hidden quantity steppers or
    //    off-screen widgets that share the form scope.
    const buttons = Array.from(form.querySelectorAll('button')) as HTMLButtonElement[]
    return buttons.find(b => b.type === 'submit' && b.offsetParent !== null) || null
  }

  /**
   * Locate the theme's add-to-cart form/button and insert the trigger container
   * immediately after it. Returns true on success, false otherwise.
   */
  private insertTriggerAfterATC(): boolean {
    if (!this.triggerContainer) return false

    const atcForm = this.findProductATCForm()
    if (!atcForm) return false

    const atcButton = this.findATCSubmitButton(atcForm)

    // Climb to the GRID/ACTIONS wrapper so the trigger sits OUTSIDE the grid
    // taking the full row width. Do NOT include `.product-form__submit` in
    // this selector — when the button itself has that class, `closest()` would
    // return the button and the trigger would inherit the grid column layout
    // (single cell, leaving an empty cell next to it).
    const wrapper = atcButton?.closest('.product-form__buttons, .product-form__actions') as HTMLElement | null
    const anchor: HTMLElement = wrapper || atcForm

    const parent = anchor.parentNode
    if (!parent) return false

    parent.insertBefore(this.triggerContainer, anchor.nextSibling)
    return true
  }

  /**
   * Read computed font styles from the theme's ATC button and apply them as
   * CSS custom properties on the trigger container so the modal trigger
   * matches the theme's Add-to-Cart look.
   *
   * Skips when the ATC button is not visible (offsetParent === null) to avoid
   * reading empty computed values that would defeat the CSS var fallbacks.
   */
  private applyThemeButtonFont(): void {
    if (!this.triggerContainer) return

    const atcForm = this.findProductATCForm()
    if (!atcForm) return
    const atcButton = this.findATCSubmitButton(atcForm)
    if (!atcButton || atcButton.offsetParent === null) return

    const computed = window.getComputedStyle(atcButton)
    const container = this.triggerContainer
    // Only set each CSS var if the computed value is non-empty; otherwise the
    // var("--x", default) fallback in styles.css is defeated by the empty value.
    const setIfTruthy = (name: string, value: string) => {
      if (value) container.style.setProperty(name, value)
    }
    setIfTruthy('--emtlkit-trigger-font-family', computed.fontFamily)
    setIfTruthy('--emtlkit-trigger-font-weight', computed.fontWeight)
    setIfTruthy('--emtlkit-trigger-font-size', computed.fontSize)
    setIfTruthy('--emtlkit-trigger-line-height', computed.lineHeight)
    setIfTruthy('--emtlkit-trigger-text-transform', computed.textTransform)
    setIfTruthy('--emtlkit-trigger-letter-spacing', computed.letterSpacing)

    // The trigger button also carries class `.emtlkit--personalize` which has
    // `font-weight: var(--emtlkit-heading-font-weight, 500) !important;` in
    // tailorkit.css and wins specificity. Scope the heading vars on the
    // container so the trigger inherits the theme weight too.
    setIfTruthy('--emtlkit-heading-font-weight', computed.fontWeight)
    setIfTruthy('--emtlkit-heading-font-size', computed.fontSize)
    setIfTruthy('--emtlkit-heading-color', computed.color)
  }

  private initInlineMode() {
    const instanceId = this.getInstanceId()
    // Tell FormManager that modal mode is inactive - use inline validation
    FormManager.setModalModeActive(false, instanceId)

    // Clean up FormManager's modal mode button blocking
    FormManager.unblockThemeButtons(instanceId)
    FormManager.setModalTriggerContainer(null, instanceId)

    // Remove modal trigger if it exists
    if (this.triggerContainer) {
      this.triggerContainer.remove()
      this.triggerContainer = null
    }

    // Initialize inline customizer functionality
    this.initInlineCustomizer()
  }

  private initInlineCustomizer() {
    // Hide sub headers if there is only one summary
    const summaries = this.querySelectorAll('summary.emtlkit--accordion-sub-header')

    if (summaries.length === 1) {
      summaries.forEach(summary => {
        ;(summary as HTMLElement).style.display = 'none'
      })
    }

    // Get all option set wrappers
    const optionSetWrappers = this.querySelectorAll('tailorkit-product-personalizer .emtlkit--option-set-wrapper')

    if (optionSetWrappers.length > 0 || this.hasCharmConfig()) {
      // Reveal the personalized design section
      const container = this.querySelector('.emtlkit--tab-content-container')

      if (container) {
        ;(container as HTMLElement).style.display = 'initial'
      }
    }

    // Initialize and render confirmation checkbox for inline mode
    if (!this.inlineCheckboxManager) {
      this.inlineCheckboxManager = new InlineConfirmationCheckboxManager(this)
    }
    this.inlineCheckboxManager.render()
  }

  /** Initialize wizard mode if the published mockup data contains a wizard config */
  private initWizardMode() {
    const pp = this.querySelector(ProductPersonalizerWebComponentTag) as HTMLElement
    if (!pp) return

    const mockupData = parseJSONAttribute(pp, 'data-mockup')
    if (!mockupData) return

    // data-mockup is the mockup object: { _id, pi, printAreas, ..., wz }
    const wzConfig = mockupData?.wz
    if (!wzConfig?.enabled) return

    const container = this.querySelector('.emtlkit--personalization-area-container')
    if (!container) return

    const wizard = document.createElement('tailorkit-wizard') as HTMLElement
    wizard.setAttribute('data-product-id', pp.getAttribute('data-product-id') || '')
    wizard.setAttribute('data-variant-id', pp.getAttribute('data-variant-id') || '')
    wizard.setAttribute('data-wizard-config', JSON.stringify(wzConfig))

    container.parentNode?.insertBefore(wizard, container)
    wizard.appendChild(container)
  }

  private initBuyItNowHandling() {
    // The actual Buy It Now handler is initialized globally in tailorkit.ts
    // This method can be used to override settings per product if needed
    const appSettingsAttr = this.getAttribute('data-app-settings')

    if (appSettingsAttr && isJSON(appSettingsAttr)) {
      try {
        const appSettings = JSON.parse(appSettingsAttr)
        const buyItNowSettings = appSettings.buyItNowHandling

        if (buyItNowSettings) {
          // Override global settings if specified in app settings
          if (buyItNowSettings.enabled === false) {
            console.log('[TailorKit] Buy It Now handling disabled for this product')
            return
          }

          if (buyItNowSettings.mode === 'disable') {
            // Hide Buy It Now buttons for customized products
            this.disableBuyItNowButtons()
            return
          }
        }
      } catch (error) {
        console.warn('[TailorKit] Error parsing Buy It Now settings:', error)
      }
    }

    console.log('[TailorKit] Buy It Now handling configured for customizer')
  }

  private disableBuyItNowButtons() {
    const checkAndDisable = () => {
      const hasCustomizations = this.querySelector('tailorkit-product-personalizer .emtlkit--option-container.active')

      if (hasCustomizations) {
        const buyItNowButtons = document.querySelectorAll(`
          [data-shopify="buy-now"],
          .shopify-payment-button__button
        `)

        buyItNowButtons.forEach(button => {
          const element = button as HTMLElement
          element.style.display = 'none'

          // Add explanatory message
          if (!element.nextElementSibling?.classList.contains('tailorkit-buy-now-message')) {
            const message = document.createElement('div')
            message.className = 'tailorkit-buy-now-message'
            message.style.cssText = 'font-size: 12px; color: #666; margin-top: 8px; text-align: center;'
            message.textContent = 'Please use "Add to Cart" for customized products'
            element.parentNode?.insertBefore(message, element.nextSibling)
          }
        })
      }
    }

    // Check immediately and on customization changes
    checkAndDisable()
    window.addEventListener('tailorkit-set-options', checkAndDisable)
  }

  connectedCallback() {
    this.initLocationChangeHandler()

    // Filter by productId to avoid cross-product modal events triggering this instance
    this._boundInitHandler = (e: EventObject) => {
      const eventProductId = e?.data?.productId
      const myProductId = this.getAttribute('data-product-id')
      // Only init if event is for THIS product (or no productId filter = legacy)
      if (!eventProductId || eventProductId === myProductId) {
        this.init()
      }
    }
    Transmitter.listen(TransmitterEvents.INIT_PRINT_AREA, this._boundInitHandler)
  }

  disconnectedCallback() {
    if (this.optionChangeDebounceTimer) {
      clearTimeout(this.optionChangeDebounceTimer)
      this.optionChangeDebounceTimer = null
    }

    if (this.locationChangeDebounceTimer) {
      clearTimeout(this.locationChangeDebounceTimer)
      this.locationChangeDebounceTimer = null
    }

    if (this._trackingTimer) {
      clearTimeout(this._trackingTimer)
      this._trackingTimer = null
    }

    if (this.locationChangeHandler) {
      window.removeEventListener('locationchange', this.locationChangeHandler)
      this.locationChangeHandler = null
    }

    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler)
      this.resizeHandler = null
    }

    if (this.inlineCheckboxManager) {
      this.inlineCheckboxManager.cleanup()
      this.inlineCheckboxManager = null
    }

    // Unblock theme buttons that FormManager may have intercepted
    const instanceId = this.getInstanceId()
    FormManager.unblockThemeButtons(instanceId)
    FormManager.setModalTriggerContainer(null, instanceId)

    // Remove modal trigger — when auto-positioned it lives outside this element
    // so custom-element teardown won't reach it, leaving a stale button.
    if (this.triggerContainer) {
      this.triggerContainer.remove()
      this.triggerContainer = null
    }

    CanvasPreviewManager.cleanup(this.getInstanceId())

    if (this._boundInitHandler) {
      Transmitter.remove(TransmitterEvents.INIT_PRINT_AREA, this._boundInitHandler)
    }
  }

  /**
   * @deprecated Use PricingManager methods instead
   */
  calculateAndUpdateAdditionalCost(addToCartForm: HTMLFormElement) {
    console.warn('calculateAndUpdateAdditionalCost is deprecated. Use PricingManager methods instead.')
  }
}

// Check if the web component is already defined
if (!customElements.get(ProductPersonalizerCustomizerWebComponentTag)) {
  customElements.define(ProductPersonalizerCustomizerWebComponentTag, TailorKitPrintAreaCustomizer)
}
