/* eslint-disable max-lines */
import {
  updateFieldsetAttributes,
  updateImageOptionLabel,
  updateMultiLayoutOptionLabel,
} from '../handlers/fieldsetHandlers'
import { restoreOptionSetListsFromLocalStorage } from '../handlers/optionHandlers'
import '../libraries/location-change-handler'
import { Transmitter } from '../libraries/transmitter'
import type { DrawLivePreviewFunction, ExtendedImageOption, Layer, ProductPersonalizerElementType } from '../type'
import { CLASS_EXCLUDE_INPUT_HANDLER } from '../utils/dom-constants'
import { TEXT_CUSTOMER_INPUT_SELECTOR } from '../utils/selectors'
import '../libraries/remove-all-event-listeners'
import { welcomeMsg } from '../fns/logs'
import { ProductPersonalizerWebComponentTag } from '../constants'
import type { KonvaCanvasManager } from '../../shared/libraries/konva/core/konva-canvas-manager'
import type { TailorKitProductPersonalizerBase } from '../types/product-personalizer'
import {
  isColorOptionClick,
  isFontOptionClick,
  isGenerateImageWithAI,
  isGenerateTextWithAI,
  isImagelessOptionClick,
  isImageOptionClick,
  isMaskOptionClick,
  isMultiLayoutOptionClick,
  isTextOptionClick,
  isTextShapeChange,
  isUploadButtonClick,
  isEditUploadedImageButtonClick,
  isDeleteImageButtonClick,
} from '../utils/click-condition'
import { getFeaturedImageContainerSelector, initCanvas } from '../utils/init-canvas'
import { prepareProductPersonalizer } from '../utils/init-product-personalizer'
import { parseJSONAttribute } from '../utils/helpers'
import { getProductImageUrl, prepareProductImage } from '../utils/prepare-product-image'
import { renderCanvasToMainContainer } from '../utils/render-canvas-to-main-container'
import {
  handleStandardOptionClick,
  setupTextInputListeners,
  setUpTextShapeSelectOption,
  handleDeleteImageOption,
} from '../handlers/event-handlers'
import { handleUploadImage, handleEditUploadedImage } from '../handlers/event-handlers/upload-image'
import { deleteImageOption, processUploadedImage } from '../handlers/event-handlers/image-editor/data-processing'
import { handleGenerateTextWithAI } from '../handlers/event-handlers/generateTextWithAi'
import { handleMultiLayoutOptionClick } from '../handlers/event-handlers/multil-layout-handler'
import { handleTextShapeClick } from '../handlers/event-handlers/text-shape-handler'
import { handleGenerateImageWithAI } from '../handlers/event-handlers/generateImageWithAi'
import { TransmitterEvents } from '../constants/transmitter-events'
import type { IOptionSetType } from '../../shared/constants/optionSets'
import { tlkOptionSetClickEvent } from '../../shared/constants/optionSets'
import { reuseOptionValuesFromLocalStorage } from '../utils/restore-option-values'
import { PersonalizerStore } from '../libraries/personalizer-store'
import { getViewsByLayerId } from '../utils/query-views'
import { getLayerByFieldset } from '../utils/query-layer'
import { renderLayerIntegration, type LayerRendererContext } from '../services/layer-renderer'
import { FEATURE_FLAGS } from '../constants/feature-flags'
import { loadFeature } from '../utils/feature-loader'
import type { CharmChangeDetail } from '../../shared/components/CharmPicker'
import { getStorefrontUndoStack } from '../stores/storefront-undo-stack'

/** Charm change event name — inlined to avoid importing CharmPicker into main bundle */
const CHARM_CHANGE_EVENT = 'tailorkit-charm-change'

// DEBUG: Enable conditional logic debugging via console: window.__DEBUG_CONDITIONAL_LOGIC = true
// Then interact with imageless options to see detailed visibility evaluation logs.
// To dump all layer data: window.__debugStorefrontLayers()

export class TailorKitProductPersonalizer extends HTMLElement implements TailorKitProductPersonalizerBase {
  // Declare settings for configuring data for web component
  declare settings: any

  // Debugger steps
  private _steps: { [key: string]: any }[] = []

  // Holds the product personalizer object that defines where the integration will be drawn
  private _productPersonalizer: ProductPersonalizerElementType | null = null

  // The canvas manager for Konva
  declare canvasManager: KonvaCanvasManager

  // A flag to track whether the images are currently being processed
  processingImages = false

  // Device pixel ratio for scaling images, defaulting to 1 if not available
  ratio = window.devicePixelRatio || 1

  // A dictionary of images currently being loaded or processed, keyed by their URL
  images: { [url: string]: HTMLImageElement } = {}

  // Current view state (managed locally; no persistence)
  private currentViewId?: string

  // Flag to prevent re-initialization when node is moved (e.g., into modal)
  private _initialized: boolean = false

  /**
   * Current charm builder selection state, keyed by layerId.
   * Supports multiple charm builders per product (multi-charm-builder feature).
   * Replaces previous single `CharmChangeDetail | null` field.
   */
  charmStateMap: Map<string, CharmChangeDetail> = new Map()

  /**
   * @deprecated Use charmStateMap. Kept for single-builder backward compat
   * (canvas renderer reads charmState for a specific layerId, multi-builder
   * routes through charmStateMap instead).
   */
  get charmState(): CharmChangeDetail | null {
    if (this.charmStateMap.size === 0) return null
    // Return the first entry (stable, deterministic for single-builder compat)
    return this.charmStateMap.values().next().value ?? null
  }

  /** Getter for debugger steps */
  get steps() {
    return this._steps
  }

  /** Set for debugger steps */
  set steps(value: { [key: string]: any }[]) {
    this._steps = [...value, ...this.steps]

    // Write under instanceId namespace for multi-instance isolation
    const ns = this.getInstanceId()
    window.__tailorkit__[ns] = window.__tailorkit__[ns] || {}
    window.__tailorkit__[ns]['steps'] = this.steps

    // Backward compat: first instance also writes to flat key
    if (!window.__tailorkit__['steps']) {
      window.__tailorkit__['steps'] = this.steps
    }
  }

  /** Getter for productPersonalizer */
  get productPersonalizer(): ProductPersonalizerElementType {
    return this._productPersonalizer!
  }

  /** Setter for productPersonalizer with change detection logic  */
  set productPersonalizer(value: ProductPersonalizerElementType) {
    if (this._productPersonalizer !== value) {
      this._productPersonalizer = value

      // Update steps
      this.steps = [value]

      // Write under instanceId namespace for multi-instance isolation
      const ns = this.getInstanceId()
      window.__tailorkit__[ns] = window.__tailorkit__[ns] || {}
      window.__tailorkit__[ns]['product_personalizer'] = this.productPersonalizer

      // Backward compat shim: first instance also writes to flat key so existing
      // consumers (views-bar, buyItNowHandler, etc.) that read
      // window.__tailorkit__['product_personalizer'] continue to work unchanged.
      if (!window.__tailorkit__['product_personalizer']) {
        window.__tailorkit__['product_personalizer'] = this.productPersonalizer
      }
    }
  }

  /** Init TailorKitProductPersonalizer state web component  */
  init = async () => {
    // Prevent re-initialization when node is moved (e.g., into modal)
    if (this._initialized) {
      console.log('[TailorKit][product-personalizer] already initialized, skipping re-init')
      return
    }

    try {
      // Init print area state/data for instance
      this.initPrintArea()

      // Init charm picker (if charm-node layer exists and feature flag is on)
      // Fire-and-forget: charm picker should not block main init
      this.initCharmPicker().catch(err => console.warn('[TailorKit] Charm picker init failed:', err))

      // Init events handlers for option sets
      this.initEventHandlers()

      // Set loading state
      await this.setLoadingState()

      // Render live preview on container
      await this.renderLivePreview()

      // After initial render, try to apply snapshot from shared store (if exists)
      this.applySnapshotFromStore()

      // Mark as initialized
      this._initialized = true
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : (e as string)
      this.steps = [{ Error: errorMessage }]

      throw new Error(errorMessage)
    } finally {
      this.clearLoadingState()
    }
  }

  /**
   * @description Obtain data from meta field set in liquid and init state for web component
   * */
  initPrintArea() {
    this.initCrossProductForm()

    // Parse the necessary attributes
    this.settings = parseJSONAttribute(this, 'data-settings')

    // Merge personalized_design_title from data attribute if provided
    const personalizedTitle = this.getAttribute('data-personalized-design-title')
    if (personalizedTitle) {
      this.settings.personalized_design_title = personalizedTitle
    }

    // Write under instanceId namespace for multi-instance isolation
    const ns = this.getInstanceId()
    window.__tailorkit__[ns] = window.__tailorkit__[ns] || {}
    window.__tailorkit__[ns]['app_block_settings'] = this.settings

    // Backward compat shim: first instance also writes to flat key
    if (!window.__tailorkit__['app_block_settings']) {
      window.__tailorkit__['app_block_settings'] = this.settings
    }

    let pi = parseJSONAttribute(this, 'data-product-image')
    const lis = parseJSONAttribute(this, 'data-layer-integrations', [])
    const printAreas = parseJSONAttribute(this, 'data-print-areas', [])
    const mockup = parseJSONAttribute(this, 'data-mockup')

    // Prepare the base product image
    pi = prepareProductImage(pi, mockup)

    // Initialize the product personalizer data
    this.productPersonalizer = prepareProductPersonalizer(this, pi, mockup, lis, printAreas)

    // Initialize current view if provided in metafield
    const _views = Array.isArray((this.productPersonalizer as any)?.views)
      ? (this.productPersonalizer as any).views
      : []
    this.currentViewId = _views?.[0]?._id

    // Trigger event to init print area — include productId so the customizer WC
    // can filter and only react to events for its own product (multi-instance support)
    const _productId = this.getAttribute('data-product-id') || ''
    Transmitter.trigger(TransmitterEvents.INIT_PRINT_AREA, { productId: _productId })

    // Subscribe to global store updates for this instance
    this.subscribeToStore()

    // Update print area accordion visibility based on current view
    this.updatePrintAreasVisibility()

    // Notify other components (e.g., views bar) that views are ready
    const pp: any = this.productPersonalizer || {}
    const views = Array.isArray(pp.views) ? pp.views : []
    const normalizeBaseLabel = (label?: string) => {
      const s = (label || '').trim()
      const idx = s.indexOf(':')
      return idx >= 0 ? s.slice(0, idx).trim() : s
    }
    const storefrontLabel = normalizeBaseLabel(pp.storefrontLabel || '')
    const featuredProductImage = (pp?.pi && pp.pi.u) || ''

    const evt = new CustomEvent('tailorkit:views-ready', {
      detail: { views, storefrontLabel, featuredProductImage, currentViewId: this.currentViewId },
    })
    document.dispatchEvent(evt)
  }

  /**
   * Detect charm config in print areas and inject <tailorkit-charm-picker> into each.
   * Gated behind CHARM_BUILDER_STOREFRONT feature flag.
   */
  private async initCharmPicker() {
    if (!FEATURE_FLAGS.CHARM_BUILDER_STOREFRONT) return

    const printAreas = parseJSONAttribute(this, 'data-print-areas', [])
    // Support both charmConfigs[] (new) and charmConfig (legacy single-builder)
    const hasCharmConfig = printAreas.some((pa: any) => pa.charmConfigs?.length || pa.charmConfig)
    if (!hasCharmConfig) return

    // Lazy-load charm feature module (registers <tailorkit-charm-picker> custom element)
    await loadFeature('charm-builder')

    for (const printArea of printAreas) {
      // Normalize: new format uses charmConfigs[], legacy uses charmConfig (single object)
      const configs: any[]
        = printArea.charmConfigs?.length > 0
          ? printArea.charmConfigs
          : printArea.charmConfig
            ? [printArea.charmConfig]
            : []

      if (!configs.length) continue

      for (const config of configs) {
        const charmLayerId: string = config.layerId || ''

        // Create charm picker element
        const picker = document.createElement('tailorkit-charm-picker')
        picker.setAttribute('data-charm-config', JSON.stringify(config))
        picker.setAttribute('data-print-area-id', printArea.i)

        // Find the Liquid-rendered placeholder wrapper (rendered at correct layer position)
        const wrapper = charmLayerId
          ? this.querySelector<HTMLElement>(`.emtlkit--charm-picker-wrapper[data-layer-id="${charmLayerId}"]`)
          : null

        if (wrapper) {
          // Liquid rendered the wrapper at the correct position — just inject picker inside
          wrapper.appendChild(picker)
        } else {
          // Fallback: create wrapper and append to fieldset parent (legacy templates without placeholder)
          const fieldset = this.querySelector(`fieldset[data-print-area-id="${printArea.i}"]`)
          if (!fieldset) continue
          const newWrapper = document.createElement('div')
          newWrapper.className = 'emtlkit--option-set-wrapper emtlkit--charm-picker-wrapper'
          if (charmLayerId) newWrapper.setAttribute('data-layer-id', charmLayerId)
          newWrapper.appendChild(picker)
          fieldset.parentElement?.appendChild(newWrapper)
        }
      }
    }
  }

  /**
   * Public: switch view by id (affects only rendering state)
   * @param viewId - Can be a string ID, array of string IDs, or array of view objects
   */
  async setView(viewId?: string | string[] | { _id: string }[], reRenderCanvas?: boolean) {
    // Get available views from product personalizer
    const views = Array.isArray((this.productPersonalizer as any)?.views) ? (this.productPersonalizer as any).views : []

    // Exit early if no views are available
    if (!views.length) return

    // Normalize input to array
    const viewIdArray = Array.isArray(viewId) ? viewId : [viewId]

    // Determine if we're dealing with string IDs or objects with _id property
    const isStringId = typeof viewIdArray[0] === 'string'

    // Extract the target view ID
    const targetViewId = isStringId ? (viewIdArray[0] as string) : (viewIdArray[0] as { _id: string })?._id

    const currentViewIdInViewIdArray = (viewIdArray as any[]).find((v: any) =>
      typeof v === 'string' ? v === this.currentViewId : v?._id === this.currentViewId
    )
    // Don't switch if already on the requested view
    if (this.currentViewId && currentViewIdInViewIdArray) {
      return
    }

    // Find the requested view in available views
    const viewExists = views.find((v: any) => v._id === targetViewId)

    // Set to requested view if it exists, otherwise use first view
    this.currentViewId = viewExists?._id || views[0]?._id

    // Update print area accordion visibility after view switch
    this.updatePrintAreasVisibility()

    if (reRenderCanvas) {
      await this.renderCanvas({ preloadImageOnly: true })
    } else {
      // Notify other components (e.g., views bar) that views are ready
      const pp: any = this.productPersonalizer || {}
      const views = Array.isArray(pp.views) ? pp.views : []
      const normalizeBaseLabel = (label?: string) => {
        const s = (label || '').trim()
        const idx = s.indexOf(':')
        return idx >= 0 ? s.slice(0, idx).trim() : s
      }
      const storefrontLabel = normalizeBaseLabel(pp.storefrontLabel || '')
      const featuredProductImage = (pp?.pi && pp.pi.u) || ''

      const evt = new CustomEvent('tailorkit:views-ready', {
        detail: { views, storefrontLabel, featuredProductImage, currentViewId: this.currentViewId },
      })

      document.dispatchEvent(evt)
    }
  }

  /**
   *  Init events handlers for whole web component
   * */
  initEventHandlers() {
    // Clean up event handlers
    this.cleanUpEventHandlers()

    const { initTextInputEventHandlers } = setupTextInputListeners(this)
    const { initTextShapeSelectOptionHandler } = setUpTextShapeSelectOption()

    // Init input action on input fields for text layer
    initTextInputEventHandlers()

    // Init text shape selection handler
    initTextShapeSelectOptionHandler()

    // Init click action to switch between options
    this.addEventListener('click', this.clickEventHandler)

    // Init option set click handler
    // Create a wrapper function that adapts the event to the expected parameters
    this.addEventListener(tlkOptionSetClickEvent, (e: Event) => {
      const detail = (
        e as CustomEvent<{
          optionSet: IOptionSetType
          currentPrintAreaId: string
          currentOptionSetId: string
          event: any
        }>
      ).detail
      const target = detail.event?.target as HTMLElement

      if (!target) {
        // Self-managed web component (e.g., checkbox toggle) already updated fieldset.
        // Re-render canvas and trigger form update to sync cart inputs.
        this.renderCanvas()
        Transmitter.trigger('tailorkit-set-options')
        return
      }

      // Route multi-layout dropdown clicks to the correct handler
      if (isMultiLayoutOptionClick(target)) {
        handleMultiLayoutOptionClick(target, this)
      } else {
        handleStandardOptionClick(target, this)
      }
    })

    // Lightweight view switcher via event
    this.addEventListener('tailorkit:set-view', (e: Event) => {
      const _event = e as CustomEvent<{ viewId?: string | string[] | { _id: string }[]; reRenderCanvas?: boolean }>
      const { viewId, reRenderCanvas } = _event.detail || {}

      this.setView(viewId, reRenderCanvas)
    })

    // Listen to charm picker change events (bubbles from <tailorkit-charm-picker>)
    this.addEventListener(CHARM_CHANGE_EVENT, (e: Event) => {
      const newCharmState = (e as CustomEvent<CharmChangeDetail>).detail
      const layerId = newCharmState.layerId || 'charm'

      // Snapshot previous state for this specific layer (undo/redo scoped per layer)
      const prevCharmState = this.charmStateMap.get(layerId) ?? null

      // Update map entry for this layer
      this.charmStateMap.set(layerId, newCharmState)
      Transmitter.trigger('tailorkit-set-options')
      // Re-render canvas to show/update charm thumbnails on canvas
      this.renderCanvas({ preloadImageOnly: true })

      // Push undo step so user can revert charm selection changes for this layer
      const restoreCharmState = (state: CharmChangeDetail | null) => {
        if (state) {
          this.charmStateMap.set(layerId, state)
        } else {
          this.charmStateMap.delete(layerId)
        }
        Transmitter.trigger('tailorkit-set-options')
        this.renderCanvas({ preloadImageOnly: true })
        // Sync CharmPicker quantities to match restored state (undo/redo support)
        document.dispatchEvent(
          new CustomEvent('tailorkit-charm-state-sync', {
            detail: { selections: state?.selections || [] },
          })
        )
      }

      // Use per-instance undo stack so charm changes for different products
      // are tracked independently (multi-instance support).
      getStorefrontUndoStack(this.getInstanceId()).push({
        type: 'CONTENT',
        layerId,
        before: {},
        after: {},
        undoFn: () => restoreCharmState(prevCharmState),
        redoFn: () => restoreCharmState(newCharmState),
      })
    })

    // Attach input/change listeners for option sets (no MutationObserver)
    const handler = async (e: Event) => {
      const target = e.target as HTMLElement | null
      if (!target) return

      // Exclude text inputs - they have their own debounced handler
      const isTextInput = target.matches?.(TEXT_CUSTOMER_INPUT_SELECTOR)
      if (isTextInput) return

      // Exclude inputs inside excluded containers (e.g., AI generator inputs that don't affect canvas state)
      if (target.closest(`.${CLASS_EXCLUDE_INPUT_HANDLER}`)) return

      const fieldset = target.closest('fieldset.emtlkit--option-set')
      if (fieldset) {
        await this.findViewAndSwitchTo(target)
        await this.renderCanvas({ preloadImageOnly: true })
      }
    }
    this.addEventListener('input', handler, { capture: true })
    this.addEventListener('change', handler, { capture: true })
  }

  cleanUpEventHandlers() {
    // Clear event handler
    this.removeEventListener('click', this.clickEventHandler)

    const { cleanUpTextInputEventHandlers } = setupTextInputListeners(this)

    const { cleanUpTextShapeSelectOptionHandler } = setUpTextShapeSelectOption()

    // Clean up input event handler
    cleanUpTextInputEventHandlers()

    // Clean up text shape selection handler
    cleanUpTextShapeSelectOptionHandler()
  }

  /**
   * Handle click events for product personalizer options in a scalable way
   * @param e MouseEvent
   */
  async clickEventHandler(e: MouseEvent) {
    const { target: _target } = e
    const target = _target as HTMLElement | undefined

    if (!target) return

    // Don't prevent default for summary elements, file inputs, and checkbox containers
    const isFileInput = target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'file'
    const isLabelForFileInput = target.tagName === 'LABEL' && target.getAttribute('for')?.includes('-input')
    const isCheckboxClick = !!target.closest('.emtlkit--checkbox-container')
    if (!target.closest('summary') && !isFileInput && !isLabelForFileInput && !isCheckboxClick) {
      e.preventDefault()
    }

    const isChangeTextShape = isTextShapeChange(target)
    const isClickOnImageOptionSet = isImageOptionClick(target)
    const isClickOnMaskOptionSet = isMaskOptionClick(target)
    const isClickOnTextOptionSet = isTextOptionClick(target)
    const isClickOnColorOptionSet = isColorOptionClick(target)
    const isClickOnFontOptionSet = isFontOptionClick(target)
    const isClickOnImagelessOptionSet = isImagelessOptionClick(target)
    const isClickOnMultiLayoutOptionSet = isMultiLayoutOptionClick(target)
    const isClickOnGenerateTextWithAI = isGenerateTextWithAI(target)
    const isClickOnUploadButton = isUploadButtonClick(target)
    const isClickOnEditUploadedImageButton = isEditUploadedImageButtonClick(target)
    const isClickOnDeleteImageButton = isDeleteImageButtonClick(target)
    const isClickOnGenerateImageWithAI = isGenerateImageWithAI(target)

    const isClickOnStandardOptionSet = [
      isClickOnImageOptionSet,
      isClickOnTextOptionSet,
      isClickOnColorOptionSet,
      isClickOnImagelessOptionSet,
      isClickOnMaskOptionSet,
      isClickOnFontOptionSet,
    ].some(Boolean)

    if (isChangeTextShape || isClickOnStandardOptionSet || isClickOnMultiLayoutOptionSet) {
      // Add steps for event handlers
      this.steps = [{ [this.clickEventHandler.name]: target }]
    }
    // Predicate-handler rules for click events
    const clickHandlerRules: {
      predicate: boolean
      name: string
      handler: (target: HTMLElement, instance: TailorKitProductPersonalizer) => Promise<void> | void
    }[] = [
      {
        predicate: isChangeTextShape,
        name: 'text-shape-click',
        handler: handleTextShapeClick,
      },
      {
        predicate: isClickOnDeleteImageButton,
        name: 'delete-image-option-click',
        handler: handleDeleteImageOption,
      },
      {
        predicate: isClickOnEditUploadedImageButton,
        name: 'edit-uploaded-image-click',
        handler: handleEditUploadedImage,
      },
      {
        predicate: isClickOnStandardOptionSet,
        name: 'standard-option-click',
        handler: handleStandardOptionClick,
      },
      {
        predicate: isClickOnMultiLayoutOptionSet,
        name: 'multi-layout-option-click',
        handler: handleMultiLayoutOptionClick,
      },
      {
        predicate: isClickOnGenerateTextWithAI,
        name: 'generate-text-with-ai-click',
        handler: handleGenerateTextWithAI,
      },
      {
        predicate: isClickOnUploadButton,
        name: 'upload-image-click',
        handler: handleUploadImage,
      },
      {
        predicate: isClickOnGenerateImageWithAI,
        name: 'generate-image-with-ai-click',
        handler: handleGenerateImageWithAI,
      },
      // Add more rules here as needed
    ]

    // Find and execute the first matching rule
    const matchedRule = clickHandlerRules.find(rule => rule.predicate)
    if (matchedRule) {
      await matchedRule.handler(target, this)

      this.findViewAndSwitchTo(target)
      // Render the canvas with preload option for better performance
      await this.renderCanvas({ preloadImageOnly: true })
    }
  }

  async findViewAndSwitchTo(target: HTMLElement) {
    // Get the fieldset containing the clicked element
    const fieldset = target.closest('fieldset') as HTMLFieldSetElement

    // Find the layer integration associated with this fieldset
    const { layerIntegration } = getLayerByFieldset(this, fieldset)

    // Find views that contain this layer
    const relatedViews = getViewsByLayerId(this, layerIntegration?.i || '')

    // Switch to the appropriate view if needed
    if (relatedViews && relatedViews.length > 0) {
      await this.setView(relatedViews as any[])
    }
  }

  /**
   * Render live preview on canvas
   */
  async renderLivePreview() {
    // Restore uploaded images and other option set lists from localStorage
    await restoreOptionSetListsFromLocalStorage(this as any)

    // Reuse option values stored in local storage
    const reusedOptionValuesFromLocalStorage = await reuseOptionValuesFromLocalStorage(this)

    // Draw live preview immediately if
    // - Always render live preview is enabled
    // - Option values are reused from local storage
    // - The template does not have any options set
    const isNonExistedOptionSet = this.productPersonalizer.eot === false
    const isAlwaysRenderLivePreview = this.settings.always_render_live_preview
    const isReusedOptionValuesFromLocalStorage = reusedOptionValuesFromLocalStorage

    let drawLivePreviewImmediately = false
    if (isAlwaysRenderLivePreview || isReusedOptionValuesFromLocalStorage || isNonExistedOptionSet) {
      drawLivePreviewImmediately = true
    }

    // Initialize canvas
    await initCanvas(this)

    // Append canvas to container
    await renderCanvasToMainContainer(this)

    // Only auto-select and render when drawLivePreviewImmediately is true
    // When always_render_live_preview is false, skip until user interaction
    if (drawLivePreviewImmediately) {
      // No client-side auto-click for imageless options. Merchant-set defaults
      // (`selecting: true` → server emits `s:1` → Liquid renders `active` + `checked`)
      // are already applied at render time; if the merchant didn't preselect anything
      // we intentionally leave the fieldset empty so buyers aren't silently charged for
      // paid options they never chose.

      await this.renderCanvas()
    }

    // Auto trigger to update add-to-cart form
    Transmitter.trigger('tailorkit-set-options', { automation: true })
  }

  // Handle conditional logic
  isLayerVisible(layer: Layer, extractedLayers: Layer[]) {
    const { i, isControlledBy } = layer
    let visible = !i || !isControlledBy?.length

    // DEBUG: conditional logic visibility evaluation
    const DEBUG_CL = (window as any).__DEBUG_CONDITIONAL_LOGIC
    if (DEBUG_CL && isControlledBy?.length) {
      console.group(`[CL] isLayerVisible: layer=${i}`)
      console.log('isControlledBy:', isControlledBy)
      console.log('layer.controls:', (layer as any).controls)
    }

    if (i && isControlledBy?.length) {
      // Check controller state
      isControlledBy.forEach(controllerId => {
        const controller = extractedLayers.find(l => l.i === controllerId)
        const { controls: { action, conditions } = { action: undefined, conditions: undefined } } = controller || {}
        visible = action === 'hide'

        if (DEBUG_CL) {
          console.log(`  controller=${controllerId}`, {
            found: !!controller,
            action,
            conditionsCount: conditions?.length,
            controllerControls: controller?.controls,
            defaultVisible: visible,
          })
        }

        if (!controller || !conditions?.length) {
          if (DEBUG_CL) console.log('  → EXIT: no controller or no conditions')
          return
        }

        // Check if controller is visible
        const isControllerVisible = this.isLayerVisible(controller, extractedLayers)

        if (!isControllerVisible) {
          if (DEBUG_CL) console.log('  → EXIT: controller not visible')
          return
        }

        // Get selected option from fieldset's data-option-id attribute.
        // This is the canonical source — set by all display styles (swatch, dropdown, etc.)
        // when the user selects an option, independent of internal DOM structure.
        const selectedConditionOption
          = this.querySelector(`fieldset.emtlkit--option-set[data-layer-id="${controllerId}"]`)?.getAttribute(
            'data-option-id'
          ) || null

        if (DEBUG_CL) {
          console.log('  selectedOption:', selectedConditionOption)
          console.log('  conditions:', JSON.stringify(conditions))
        }

        if (selectedConditionOption) {
          const matchedCondition = conditions.find(c => c.ifOptionSelected === selectedConditionOption)

          const { thenShowOrHideLayers } = matchedCondition || {}

          if (DEBUG_CL) {
            console.log('  matchedCondition:', matchedCondition)
            console.log(
              '  thenShowOrHideLayers:',
              thenShowOrHideLayers,
              'includes layer?',
              thenShowOrHideLayers?.includes(i)
            )
          }

          if (thenShowOrHideLayers?.includes(i)) {
            visible = action === 'show'
          }
        }
      })
    }

    if (DEBUG_CL && isControlledBy?.length) {
      console.log(`  RESULT: visible=${visible}`)
      console.groupEnd()
    }

    // Show layer options if visible
    this.toggleLayerOptions(i!, visible)

    return visible
  }

  toggleLayerOptions(layerId: string, visible: boolean) {
    // Find all fieldsets with matching layer-id (can be multiple option sets per layer)
    const fieldsets = this.querySelectorAll(`fieldset[data-layer-id="${layerId}"]`)

    fieldsets.forEach(fieldset => {
      // Find the parent option-set-wrapper
      const wrapper = fieldset.closest('.emtlkit--option-set-wrapper') as HTMLElement
      if (wrapper) {
        wrapper.style.display = visible ? 'flex' : 'none'
      }
    })
  }

  /**
   * Update print area accordion visibility based on current view's layer integration visibility
   * Filters accordions by checking if template layer integration is visible in active view
   */
  updatePrintAreasVisibility() {
    const views = Array.isArray((this.productPersonalizer as any)?.views) ? (this.productPersonalizer as any).views : []

    const currentView = views.find((v: any) => v?._id === this.currentViewId) || views?.[0]
    const overrides = currentView?.overrides || {}
    const lis = (this.productPersonalizer as any)?.lis || []

    // Find all print area accordions (details elements)
    const accordions = this.querySelectorAll('details')

    accordions.forEach(accordion => {
      // Find the fieldset with print-area-id inside this accordion
      const fieldset = accordion.querySelector('fieldset[data-print-area-id]')
      if (!fieldset) return

      const printAreaId = fieldset.getAttribute('data-print-area-id')
      if (!printAreaId) return

      // Find template layer integration for this print area
      const templateLi = lis.find((li: any) => li.data?.printAreaId === printAreaId && li.t === 'template')
      if (!templateLi) return

      // Check visibility: base visibility + view override
      let isVisible = templateLi.vsb !== false // Base visibility

      // Check view override (vsb field in overrides)
      if (overrides[templateLi.i] && 'vsb' in overrides[templateLi.i]) {
        isVisible = overrides[templateLi.i].vsb !== false
      }

      // Show/hide the entire accordion
      if (isVisible) {
        accordion.style.display = '' // Show (reset to default)
      } else {
        accordion.style.display = 'none' // Hide
      }
    })
  }

  // Handle rendering and removing loading indicator
  loadingRafId: number | null = null
  loadingDelayTimer: ReturnType<typeof setTimeout> | null = null
  firstTimeRender: boolean = true

  /**
   * Set loading state for the canvas container
   * @param dataURL - Optional data URL for placeholder image
   * @param delay - Delay in ms before showing loading indicator (default 100ms)
   *                This prevents loading flash for fast renders (< delay ms)
   */
  setLoadingState = (dataURL?: string, delay = 100) => {
    // Clear any pending delayed loading
    if (this.loadingDelayTimer) {
      clearTimeout(this.loadingDelayTimer)
      this.loadingDelayTimer = null
    }

    this.processingImages = true

    // Only show loading indicator if render takes longer than delay
    // This prevents loading flash for fast operations (10-20ms SVG renders)
    this.loadingDelayTimer = setTimeout(() => {
      this.loadingDelayTimer = null
      const container = document.querySelector(getFeaturedImageContainerSelector(this))

      if (!container) return

      if (!container.classList.contains('emtlkit--loading')) {
        container.classList.add('emtlkit--loading')
        container.classList.remove('emtlkit--live-preview')

        if (this.firstTimeRender) {
          container.classList.add('first-time')
        } else {
          const canvas = container.querySelector('canvas') as HTMLCanvasElement | null
          if (canvas && dataURL) {
            // Create a placeholder image
            const img = new Image()
            img.src = dataURL
            img.id = 'tlk-preview-placeholder'
            img.onload = () => {
              const beforeNode = canvas.parentNode && (canvas.parentNode as HTMLElement).parentNode
              if (beforeNode) {
                container.insertBefore(img, beforeNode)
                canvas.style.visibility = 'hidden'
              }
            }
          }
        }
      }
    }, delay)
  }

  clearLoadingState = () => {
    // Clear the delayed loading timer first (prevents loading flash for fast renders)
    if (this.loadingDelayTimer) {
      clearTimeout(this.loadingDelayTimer)
      this.loadingDelayTimer = null
    }

    // Clear loading state for the canvas container
    const container = document.querySelector(getFeaturedImageContainerSelector(this))

    if (this.loadingRafId !== null) {
      cancelAnimationFrame(this.loadingRafId)
      this.loadingRafId = null
    }

    // Always reset processingImages (even if loading class wasn't added due to fast render)
    this.processingImages = false

    if (container?.classList.contains('emtlkit--loading')) {
      container?.classList.remove('emtlkit--loading')
      container?.classList.add('emtlkit--live-preview')

      if (this.firstTimeRender) {
        container?.classList.remove('first-time')
      } else {
        const canvas = container.querySelector('canvas')

        if (canvas) {
          canvas.style.visibility = 'visible'

          // Remove the placeholder image
          const placeholder = container.querySelector('#tlk-preview-placeholder') as HTMLElement

          if (placeholder) {
            container.removeChild(placeholder)
          }
        }
      }

      this.firstTimeRender = false
    }
  }

  private _rendering: boolean = false
  private _renderQueued: { params?: { preloadImageOnly?: boolean } } | null = null
  /**
   * Serialization queue for setLayerImage. Multiple calls (e.g. when the
   * bulk drawer fires a preview for each of 12 units) await the chain
   * sequentially so processUploadedImage's read→push→write of the option
   * list never interleaves between calls and clobbers entries.
   */
  private _setLayerImageQueue: Promise<void> = Promise.resolve()

  async renderCanvas(params?: { preloadImageOnly?: boolean }): ReturnType<DrawLivePreviewFunction> {
    // SERIALIZE RENDERS: Avoid overlapping async renders that can lead to duplicate layers
    if (this._rendering) {
      // Remember last requested render; we only need the most recent parameters
      this._renderQueued = { params }
      return
    }
    this._rendering = true
    try {
      this.steps = [{ [this.renderCanvas.name]: params }]

      const visible = this.style.display !== 'none'
      const preloadImageOnly = params?.preloadImageOnly || !visible

      try {
        // Set loading state
        if (!preloadImageOnly) {
          /** @important Performance issue when set loading state with data URL, on mobile devices,
           * if we change options too fast, the data URL will be extracted too often and it will affect the performance */
          // this.setLoadingState(this.canvasManager.getStage().toDataURL())
          this.setLoadingState()
        }

        // Clear the canvas before rendering new content
        this.canvasManager.clear()

        // Resolve active view (presentational only)
        const views = Array.isArray((this.productPersonalizer as any)?.views)
          ? (this.productPersonalizer as any).views
          : []
        const activeView = views.find((v: any) => v?._id === this.currentViewId) || views?.[0]

        // Render product image from DOM as bottom-most layer (for consistent pinch-zoom)
        // Skip if view has baseImage configured (to avoid duplicate product images)
        if (!activeView?.baseImage?.url) {
          const featuredSelector = getFeaturedImageContainerSelector(this)
          const featuredContainer = document.querySelector(featuredSelector)
          const productImg = featuredContainer?.querySelector('img') as HTMLImageElement | null

          if (productImg) {
            // Hide original image (preserves layout, canvas takes over rendering)
            productImg.style.visibility = 'hidden'

            const productImageUrl = getProductImageUrl(productImg)
            if (productImageUrl) {
              await this.canvasManager.addImageLayer({
                url: productImageUrl,
                x: 0,
                y: 0,
                width: Number(this.productPersonalizer.pi?.w || 0),
                height: Number(this.productPersonalizer.pi?.h || 0),
              })
            }
          }
        }

        // Prefer per-view background; fallback to none (no global bgi in metafield today)
        const hasViewBg = !!(activeView && activeView.backgroundImage && activeView.backgroundImage.url)
        const backgroundUrl = hasViewBg ? activeView.backgroundImage.url : ''
        // Render background if exists
        if (backgroundUrl) {
          await this.canvasManager.addImageLayer({
            url: backgroundUrl,
            x: 0,
            y: 0,
            width: this.productPersonalizer.pi?.w || 0,
            height: this.productPersonalizer.pi?.h || 0,
          })
        }

        // Prefer per-view base image only. Do not fallback to the product image to avoid mixing products
        const hasViewBase = !!(activeView && activeView.baseImage && activeView.baseImage.url)
        const baseUrl = hasViewBase ? activeView.baseImage.url : ''

        // Render product image
        if (baseUrl) {
          await this.canvasManager.addImageLayer({
            url: baseUrl,
            x: 0,
            y: 0,
            width: Number(this.productPersonalizer.pi?.w || 0),
            height: Number(this.productPersonalizer.pi?.h || 0),
          })
        }

        // Render layer integrations in reverse order (view-only)
        const allLis = [...(this.productPersonalizer.lis || [])].filter(Boolean)
        const view = activeView
        const overrides = view?.overrides || {}
        const viewLayerIds = Array.isArray(view?.layers)
          ? view.layers
              .map((it: any) => (typeof it === 'string' ? it : it?._id))
              .filter(Boolean)
              .filter((id: string) => overrides[id]?.vsb !== false)
          : []

        // If a view exists and defines layers (even empty), restrict rendering to that selection
        const lisToRender = allLis.filter((li: any) => viewLayerIds.includes(li?.i))

        // Sort layer integrations by the order of viewLayerIds to match view ordering
        const orderIndex = new Map<string, number>(viewLayerIds.map((id: string, idx: number) => [id, idx]))
        const sortedLis = lisToRender.slice().sort((a: any, b: any) => {
          const ai = orderIndex.get(a?.i || '')
          const bi = orderIndex.get(b?.i || '')
          const aa = typeof ai === 'number' ? ai : Number.MAX_SAFE_INTEGER
          const bb = typeof bi === 'number' ? bi : Number.MAX_SAFE_INTEGER
          return aa - bb
        })

        // Render from top to bottom: reverse like admin renderer behavior
        const layerIntegrations = sortedLis.reverse()

        // Create renderer context for layer rendering
        const rendererContext: LayerRendererContext = {
          canvasManager: this.canvasManager,
          productPersonalizer: this.productPersonalizer,
          currentViewId: this.currentViewId,
          isLayerVisible: (layer, extractedLayers) => this.isLayerVisible(layer, extractedLayers),
          toggleLayerOptions: (layerId, visible) => this.toggleLayerOptions(layerId, visible),
          // Pass full map for multi-builder support; charm-layer-renderer resolves per layerId
          charmStateMap: this.charmStateMap,
          // Keep charmState for any consumer that hasn't been updated to use charmStateMap
          charmState: this.charmState,
        }

        // DEBUG: dump layer integrations and their conditional logic data
        if ((window as any).__DEBUG_CONDITIONAL_LOGIC) {
          console.group('[CL] renderCanvas - layerIntegrations')
          layerIntegrations.forEach((li: any) => {
            const ls = li?.ls || []
            console.log(`LI: ${li?.i}`, {
              layerCount: ls.length,
              layers: ls.map((l: any) => ({
                id: l.i,
                type: l.t,
                isControlledBy: l.isControlledBy,
                controls: l.controls,
                optionSets: l.osl?.length || 0,
              })),
            })
          })
          console.groupEnd()
        }

        for (const layerIntegration of layerIntegrations) {
          if (overrides[layerIntegration?.i]?.vsb === false) {
            continue
          }

          await renderLayerIntegration(rendererContext, layerIntegration, preloadImageOnly)
        }
      } catch (error) {
        console.error('Error rendering canvas:', error)
      } finally {
        if (!preloadImageOnly) {
          this.clearLoadingState()
        }
      }
    } finally {
      this._rendering = false
      // If another render was queued during execution, run it next (debounced style)
      if (this._renderQueued) {
        const next = this._renderQueued
        this._renderQueued = null
        // Fire and forget – serialization logic will queue further renders if needed
        await this.renderCanvas(next.params)
      }
    }
  }

  /**
   * Imperatively swap the image source of a layer without going through the
   * standard file-upload UI. The bulk personalization drawer uses this to
   * preview each unit's per-customer image on the customizer canvas while
   * the customer is still editing — text inputs already get DOM-based live
   * preview via the OptionProcessor, but image options have no equivalent
   * DOM write target so external callers need a direct API.
   *
   * Empty `imageUrl` clears any prior bulk-driven uploads on the layer so
   * the canvas falls back to the template's default image. All operations
   * route through the existing `processUploadedImage` / `deleteImageOption`
   * helpers so localStorage state, transmitter events, and clipGroup /
   * overlay invariants stay aligned with the regular upload flow.
   *
   * Errors are swallowed (logged + return) to mirror the silent failure
   * mode of the existing text-mirroring path: a missing layer or render
   * race must never break the bulk drawer's ATC flow.
   *
   * @param printAreaId  data-print-area-id of the target image fieldset
   * @param layerId      data-layer-id of the target image fieldset
   * @param imageUrl     fully-uploaded URL (e.g. S3) — empty string to clear
   * @param imageName    filename to display alongside the option, optional
   */
  async setLayerImage(printAreaId: string, layerId: string, imageUrl: string, imageName: string = ''): Promise<void> {
    // Chain onto the serialization queue so back-to-back calls (e.g. bulk
    // drawer firing once per uploaded unit) do not interleave inside
    // processUploadedImage's read→push→write of the option list.
    const next = this._setLayerImageQueue
      .catch(() => undefined)
      .then(() => this._doSetLayerImage(printAreaId, layerId, imageUrl, imageName))
    this._setLayerImageQueue = next
    return next
  }

  private async _doSetLayerImage(
    printAreaId: string,
    layerId: string,
    imageUrl: string,
    imageName: string
  ): Promise<void> {
    try {
      const fieldset = this.querySelector<HTMLFieldSetElement>(
        `fieldset[data-print-area-id="${CSS.escape(printAreaId)}"][data-layer-id="${CSS.escape(layerId)}"]`
      )
      if (!fieldset || fieldset.dataset.optionType !== 'image_option') return

      // Always drop any prior uploaded / AI-generated options for this layer
      // before adding a new one. Without this, repeated bulk preview calls
      // would append a fresh option each time AND persist via
      // saveOptionSetListToLocalStorage — so a 12-unit bulk session would
      // leave 12 stale "image_uploaded" entries that the customer's next
      // single-mode visit would still see in the picker.
      // suppressErrorModal=true keeps the cleanup silent (a transient
      // delete failure during a background cleanup must never pop a modal).
      const { optionSet } = getLayerByFieldset(this, fieldset)
      const optionsList = (optionSet?.ol as ExtendedImageOption[] | undefined) ?? []
      // Snapshot-then-mutate: `filter` returns a new array, so iterating
      // `uploadedOptions` while `deleteImageOption` splices the live
      // `targetOptionSet.ol` cannot skip or double-delete entries — we hold
      // stable references to each option object and delete by id. A future
      // refactor that switches `deleteImageOption` to remove by index would
      // break this; if that ever happens, snapshot the IDs separately.
      const uploadedOptions = optionsList.filter(
        o => o && (o.type === 'image_uploaded' || o.type === 'image_generated_by_ai')
      )
      for (const opt of uploadedOptions) {
        await deleteImageOption(fieldset, opt.i, this, true)
      }

      if (!imageUrl) {
        // Clear path: the deletes above already returned the layer to its
        // template default options. Nothing more to do.
        return
      }

      // Set path: reuse the file-upload pipeline so all downstream invariants
      // (clipGroup, overlay inheritance, localStorage persistence, fieldset
      // UI selection) stay in lockstep with single-mode uploads. The file
      // arg is synthesized — only file.name is read inside processUploadedImage.
      // suppressErrorModal=true keeps the bulk-preview path silent on failure
      // so a transient render error never pops a modal during ATC.
      await processUploadedImage({
        file: { name: imageName || 'bulk-image' } as unknown as File,
        objectUrl: imageUrl,
        fieldset,
        instance: this,
        transforms: {} as any,
        uploadedImageUrl: imageUrl,
        replaceImage: false,
        suppressErrorModal: true,
      })
    } catch (error) {
      console.warn('[TailorKit] setLayerImage failed:', error)
    }
  }

  /**
   * Get canvas preview as data URL with optimized size for upload
   * Supports both new options object and legacy string parameter for backward compatibility
   * @param optionsOrMimeType - Configuration options object or legacy mimeType string
   * @returns string - Optimized data URL of the canvas
   */
  getCanvasPreviewDataURL(
    optionsOrMimeType: {
      mimeType?: string
      quality?: number
      maxWidth?: number
      maxHeight?: number
      scaleFactor?: number
    } = {}
  ): string {
    if (!this.canvasManager || !this.canvasManager.getStage()) {
      throw new Error('Canvas is not initialized. Please render the canvas first.')
    }

    // Handle backward compatibility - support both object and string parameters
    const options = typeof optionsOrMimeType === 'string' ? { mimeType: optionsOrMimeType } : optionsOrMimeType

    const { mimeType = 'image/webp', quality = 0.92, maxWidth, maxHeight, scaleFactor = 0.7 } = options

    try {
      const stage = this.canvasManager.getStage()
      const stageWidth = stage.width()
      const stageHeight = stage.height()

      // Calculate optimal pixel ratio to reduce file size while maintaining quality
      let optimizedPixelRatio = this.ratio * scaleFactor

      // If max dimensions are specified, calculate the scale factor to fit within bounds
      if (maxWidth || maxHeight) {
        const widthScale = maxWidth ? maxWidth / stageWidth : Infinity
        const heightScale = maxHeight ? maxHeight / stageHeight : Infinity
        const constraintScale = Math.min(widthScale, heightScale, 1) // Don't upscale

        optimizedPixelRatio = Math.min(optimizedPixelRatio, constraintScale)
      }

      // Ensure pixel ratio doesn't go below a minimum threshold for quality
      optimizedPixelRatio = Math.max(optimizedPixelRatio, 0.3)

      const dataURL = stage.toDataURL({
        mimeType,
        pixelRatio: optimizedPixelRatio,
        quality,
      })

      // Calculate final dimensions for logging
      const finalWidth = Math.round(stageWidth * optimizedPixelRatio)
      const finalHeight = Math.round(stageHeight * optimizedPixelRatio)

      this.steps = [
        {
          [this.getCanvasPreviewDataURL.name]: {
            mimeType,
            quality,
            originalSize: `${stageWidth}x${stageHeight}`,
            finalSize: `${finalWidth}x${finalHeight}`,
            scaleFactor: optimizedPixelRatio,
            dataURLLength: dataURL.length,
          },
        },
      ]

      return dataURL
    } catch (error) {
      const errorMessage = `Failed to generate canvas preview data URL: ${error instanceof Error ? error.message : error}`
      this.steps = [{ Error: errorMessage }]
      throw new Error(errorMessage)
    }
  }

  /**
   *  Update field set to update option set according to template
   */
  updateFieldset(fieldset: HTMLFieldSetElement | undefined, optionId: string, optionName: string, optionValue: string) {
    if (!fieldset) return

    // Update the fieldset attributes
    updateFieldsetAttributes(fieldset, optionId, optionName, optionValue)

    // If it's an image option, update the label
    if (
      ['image_option', 'imageless_option', 'mask_option', 'font_option'].includes(
        fieldset.getAttribute('data-option-type') as string
      )
    ) {
      updateImageOptionLabel(fieldset, optionName)
    }

    if (fieldset.getAttribute('data-option-type') === 'multi_layout_option') {
      updateMultiLayoutOptionLabel(fieldset, optionName)
    }
  }

  /**
   * In cross-product mode, there's no ATC form on the page for this product.
   * Create one so FormManager can write hidden inputs into it.
   * Idempotent.
   */
  private initCrossProductForm(): void {
    const customizer = this.closest('tailorkit-product-personalizer-customizer')
    if (!customizer || customizer.getAttribute('data-cross-product') !== 'true') return
    if (customizer.querySelector('form.tlk-cross-product-form')) return

    const productId = this.getAttribute('data-product-id') || customizer.getAttribute('data-product-id') || ''
    if (!productId) {
      console.warn('[TailorKit] initCrossProductForm: no data-product-id found — skipping internal form creation')
      return
    }

    const form = document.createElement('form')
    form.className = 'tlk-cross-product-form'
    form.action = '/cart/add'
    form.method = 'post'
    form.style.display = 'none'
    form.setAttribute('aria-hidden', 'true')

    // Required for getAddToCartForms() to locate this form
    const productIdInput = document.createElement('input')
    productIdInput.type = 'hidden'
    productIdInput.name = 'product-id'
    productIdInput.value = productId
    form.appendChild(productIdInput)

    customizer.appendChild(form)

    console.log(`[TailorKit] Created internal cross-product form for product ${productId}`)
  }

  connectedCallback() {
    try {
      // Skip if already initialized (prevents re-init when node is moved)
      if (this._initialized) {
        // Ensure loading state is cleared in case it was stuck
        this.clearLoadingState()
        // Defer renotify to after all DOM moves in the current useLayoutEffect complete.
        // connectedCallback fires synchronously during appendChild(root), but the canvas
        // container is moved to modal AFTER root — so mountToolbar() needs the final DOM state.
        queueMicrotask(() => getStorefrontUndoStack(this.getInstanceId()).renotify())
        return
      }

      welcomeMsg()

      // Init global variables
      window.__tailorkit__ = window.__tailorkit__ || {}

      // DEBUG: register global helper to dump all layer data
      ;(window as any).__debugStorefrontLayers = () => {
        const lis = (this.productPersonalizer as any)?.lis || []
        console.group('[CL] __debugStorefrontLayers')
        lis.forEach((li: any) => {
          const ls = li?.ls || []
          console.log(`LayerIntegration: ${li?.i}`)
          ls.forEach((l: any) => {
            console.log(`  Layer: ${l.i} (${l.t})`, {
              isControlledBy: l.isControlledBy,
              controls: l.controls,
              optionSets: (l.osl || []).map((os: any) => ({ type: os.t, dataKeys: Object.keys(os.d || {}) })),
            })
          })
        })
        console.groupEnd()
      }

      // Init web component
      this.init()
    } catch (error) {
      console.error('An error occurred in the connectedCallback:', error)
    }
  }

  disconnectedCallback() {
    try {
      this.unsubscribeStore?.()
      this.unsubscribeStore = undefined
    } catch (error) {
      // ignore
    }

    // Detach auto-navigate listeners registered in init-canvas.ts setupAutoNavigateOnFocus
    try {
      const anyThis = this as unknown as { _autoNavCleanup?: () => void }
      anyThis._autoNavCleanup?.()
      anyThis._autoNavCleanup = undefined
    } catch (error) {
      // ignore
    }
  }

  /** Build stable instance id — reads from parent customizer WC or own attributes */
  private getInstanceId(): string {
    // data-tlk-instance-id is set by Liquid (customizer.liquid) or by cross-product modal
    const parentCustomizer = this.closest('tailorkit-product-personalizer-customizer')
    const explicitId = parentCustomizer?.getAttribute('data-tlk-instance-id')
    if (explicitId) return explicitId

    // Fallback: build from product-id on parent customizer
    const productId
      = parentCustomizer?.getAttribute('data-product-id') || this.getAttribute('data-product-id') || 'unknown-product'
    return `${productId}::page`
  }

  /** Subscribe to shared store to reflect changes coming from other instances (e.g., modal) */
  private unsubscribeStore?: () => void
  private subscribeToStore() {
    const instanceId = this.getInstanceId()
    this.unsubscribeStore?.()
    this.unsubscribeStore = PersonalizerStore.subscribe(instanceId, () => {
      // Apply snapshot to DOM and refresh canvas without infinite loops
      this.applySnapshotFromStore()
    })
  }

  /** Apply the snapshot from store to DOM (idempotent) */
  private applyingSnapshot = false
  private applySnapshotFromStore() {
    if (this.applyingSnapshot) return
    const instanceId = this.getInstanceId()
    const snapshot = PersonalizerStore.getState(instanceId)
    if (!snapshot) return

    this.applyingSnapshot = true
    const fieldsets = this.querySelectorAll('fieldset.emtlkit--option-set')
    let changedApplied = false
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
        changedApplied = true
      }
    })

    // Redraw canvas and notify others only if something actually changed
    if (changedApplied) {
      this.renderCanvas()
      Transmitter.trigger('tailorkit-set-options')
    }

    this.applyingSnapshot = false
  }
}

// Check if the web component is already defined
if (!customElements.get(ProductPersonalizerWebComponentTag)) {
  customElements.define(ProductPersonalizerWebComponentTag, TailorKitProductPersonalizer)

  // Check if the listener is already defined
  if (!Transmitter.hasListener(TransmitterEvents.REFRESH_LIVE_PREVIEW)) {
    // Listen to refresh event
    Transmitter.listen(TransmitterEvents.REFRESH_LIVE_PREVIEW, () => {
      location.reload()
    })
  }
}
