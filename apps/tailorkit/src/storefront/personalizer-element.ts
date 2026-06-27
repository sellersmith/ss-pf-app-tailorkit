import { renderTailorKitConfirmationCheckbox, resetTailorKitConfirmationCheckbox } from './confirmation-checkbox'
import { syncTailorKitForms } from './form-sync'

export const TAILORKIT_PERSONALIZER_ELEMENT = 'tailorkit-product-personalizer'

interface TailorKitView {
  _id?: string
  title?: string
  overrides?: Record<string, { vsb?: boolean }>
}

interface TailorKitLayerIntegration {
  i?: string
  t?: string
  vsb?: boolean
  data?: {
    printAreaId?: string
  }
}

interface TailorKitProductPersonalizerState {
  i: string
  l: string
  pi: unknown
  bgi: unknown
  mockup: Record<string, any>
  printAreas: unknown[]
  lis: TailorKitLayerIntegration[]
  views: TailorKitView[]
  storefrontLabel?: string
}

declare global {
  interface Window {
    __tailorkit__?: Record<string, any>
  }
}

function parseJSONAttribute<T>(element: HTMLElement, attribute: string, fallback: T): T {
  const value = element.getAttribute(attribute)
  if (!value) return fallback

  try {
    return JSON.parse(value) as T
  } catch (error) {
    console.warn(`[TailorKit][PageFly] Cannot parse ${attribute}`, error)
    return fallback
  }
}

function normalizeBaseLabel(label?: string) {
  const text = (label || '').trim()
  const delimiterIndex = text.indexOf(':')
  return delimiterIndex >= 0 ? text.slice(0, delimiterIndex).trim() : text
}

function buildFallbackView(mockup: Record<string, any>, lis: TailorKitLayerIntegration[]): TailorKitView {
  return {
    _id: 'default',
    title: mockup.label || 'View 1',
    overrides: {},
    ...(Array.isArray(lis) ? { layers: lis.map(layer => layer?.i).filter(Boolean) } : {}),
  }
}

function prepareProductPersonalizerState(
  element: HTMLElement,
  productImage: unknown,
  mockup: Record<string, any>,
  lis: TailorKitLayerIntegration[],
  printAreas: unknown[]
): TailorKitProductPersonalizerState {
  const views = Array.isArray(mockup?.views) && mockup.views.length ? mockup.views : [buildFallbackView(mockup, lis)]

  return {
    i: element.getAttribute('data-id') || '',
    l: element.getAttribute('data-label') || '',
    pi: productImage || mockup?.pi,
    bgi: mockup?.bgi || mockup?.backgroundImage,
    mockup,
    printAreas,
    lis: Array.isArray(lis) ? lis.filter(Boolean) : [],
    views,
    storefrontLabel: mockup?.storefrontLabel,
  }
}

class TailorKitProductPersonalizer extends HTMLElement {
  private initialized = false
  private currentViewId?: string
  private currentProductPersonalizer?: TailorKitProductPersonalizerState

  get productPersonalizer(): TailorKitProductPersonalizerState {
    return this.currentProductPersonalizer!
  }

  set productPersonalizer(value: TailorKitProductPersonalizerState) {
    this.currentProductPersonalizer = value

    const namespace = this.getInstanceId()
    window.__tailorkit__ = window.__tailorkit__ || {}
    window.__tailorkit__[namespace] = window.__tailorkit__[namespace] || {}
    window.__tailorkit__[namespace].product_personalizer = value

    if (!window.__tailorkit__.product_personalizer) {
      window.__tailorkit__.product_personalizer = value
    }
  }

  connectedCallback() {
    if (this.initialized) {
      this.dispatchViewsReady()
      return
    }

    window.__tailorkit__ = window.__tailorkit__ || {}
    const settings = parseJSONAttribute(this, 'data-settings', {})
    const productImage = parseJSONAttribute(this, 'data-product-image', {})
    const lis = parseJSONAttribute<TailorKitLayerIntegration[]>(this, 'data-layer-integrations', [])
    const printAreas = parseJSONAttribute<unknown[]>(this, 'data-print-areas', [])
    const mockup = parseJSONAttribute<Record<string, any>>(this, 'data-mockup', {})

    const namespace = this.getInstanceId()
    window.__tailorkit__[namespace] = window.__tailorkit__[namespace] || {}
    window.__tailorkit__[namespace].app_block_settings = settings
    if (!window.__tailorkit__.app_block_settings) {
      window.__tailorkit__.app_block_settings = settings
    }

    this.productPersonalizer = prepareProductPersonalizerState(this, productImage, mockup, lis, printAreas)
    this.currentViewId = this.productPersonalizer.views?.[0]?._id
    this.setAttribute('data-tailorkit-runtime', 'pagefly-tailorkit')
    this.updatePrintAreasVisibility()
    this.dispatchViewsReady()
    renderTailorKitConfirmationCheckbox(this)
    syncTailorKitForms(this)
    this.addEventListener('tailorkit:set-view', this.handleSetView)
    this.addEventListener('input', this.handleOptionChange)
    this.addEventListener('change', this.handleOptionChange)
    this.initialized = true
  }

  disconnectedCallback() {
    this.removeEventListener('tailorkit:set-view', this.handleSetView)
    this.removeEventListener('input', this.handleOptionChange)
    this.removeEventListener('change', this.handleOptionChange)
  }

  async setView(viewId?: string | string[] | { _id: string }[], reRenderCanvas?: boolean) {
    const views = Array.isArray(this.productPersonalizer?.views) ? this.productPersonalizer.views : []
    if (!views.length) return

    const viewIdArray = Array.isArray(viewId) ? viewId : [viewId]
    const isStringId = typeof viewIdArray[0] === 'string'
    const targetViewId = isStringId ? (viewIdArray[0] as string) : (viewIdArray[0] as { _id: string })?._id
    const currentViewIdInViewIdArray = (viewIdArray as any[]).find((view: any) =>
      typeof view === 'string' ? view === this.currentViewId : view?._id === this.currentViewId
    )
    if (this.currentViewId && currentViewIdInViewIdArray) return

    const viewExists = views.find(view => view?._id === targetViewId)
    this.currentViewId = viewExists?._id || views[0]?._id
    this.updatePrintAreasVisibility()

    if (!reRenderCanvas) {
      this.dispatchViewsReady()
    }
    syncTailorKitForms(this)
  }

  updatePrintAreasVisibility() {
    const views = Array.isArray(this.productPersonalizer?.views) ? this.productPersonalizer.views : []
    const currentView = views.find(view => view?._id === this.currentViewId) || views?.[0]
    const overrides = currentView?.overrides || {}
    const lis = this.productPersonalizer?.lis || []

    this.querySelectorAll('details').forEach(accordion => {
      const fieldset = accordion.querySelector('fieldset[data-print-area-id]')
      if (!fieldset) return

      const printAreaId = fieldset.getAttribute('data-print-area-id')
      if (!printAreaId) return

      const templateLi = lis.find(layer => layer?.data?.printAreaId === printAreaId && layer?.t === 'template')
      if (!templateLi) return

      let isVisible = templateLi.vsb !== false
      if (templateLi.i && overrides[templateLi.i] && 'vsb' in overrides[templateLi.i]) {
        isVisible = overrides[templateLi.i].vsb !== false
      }

      accordion.style.display = isVisible ? '' : 'none'
    })
  }

  private readonly handleSetView = (event: Event) => {
    const detail = (event as CustomEvent<{ viewId?: string | string[] | { _id: string }[]; reRenderCanvas?: boolean }>)
      .detail
    this.setView(detail?.viewId, detail?.reRenderCanvas)
  }

  private readonly handleOptionChange = (event: Event) => {
    const target = event.target as HTMLElement | null
    if (target?.matches('input[data-confirmation-input="true"]')) {
      syncTailorKitForms(this)
      return
    }

    const fieldset = target?.closest('fieldset')
    const activeContainer = target?.closest('.emtlkit--option-container')
    if (fieldset && activeContainer) {
      fieldset.querySelectorAll('.emtlkit--option-container.active').forEach(container => {
        if (container !== activeContainer) container.classList.remove('active')
      })
      activeContainer.classList.add('active')
      const input = target as HTMLInputElement
      fieldset.setAttribute('value', input.value || input.getAttribute('data-name') || '')
      if (input.getAttribute('data-name')) fieldset.setAttribute('data-name', input.getAttribute('data-name') || '')
    }

    if (fieldset) resetTailorKitConfirmationCheckbox(this)
    syncTailorKitForms(this)
  }

  private dispatchViewsReady() {
    const productPersonalizer = this.productPersonalizer
    const views = Array.isArray(productPersonalizer?.views) ? productPersonalizer.views : []
    const storefrontLabel = normalizeBaseLabel(productPersonalizer?.storefrontLabel || '')
    const featuredProductImage = (productPersonalizer?.pi as any)?.u || (productPersonalizer?.pi as any)?.url || ''

    document.dispatchEvent(
      new CustomEvent('tailorkit:views-ready', {
        detail: { views, storefrontLabel, featuredProductImage, currentViewId: this.currentViewId },
      })
    )
  }

  private getInstanceId(): string {
    const parentCustomizer = this.closest('tailorkit-product-personalizer-customizer')
    const explicitId = this.getAttribute('data-tlk-instance-id') || parentCustomizer?.getAttribute('data-tlk-instance-id')
    if (explicitId) return explicitId

    const productId =
      parentCustomizer?.getAttribute('data-product-id') || this.getAttribute('data-product-id') || 'unknown-product'
    return `${productId}::page`
  }
}

/** Registers the inner TailorKit personalizer element rendered by TailorKit Liquid snippets. */
export function registerTailorKitProductPersonalizerElement() {
  if (!customElements.get(TAILORKIT_PERSONALIZER_ELEMENT)) {
    customElements.define(TAILORKIT_PERSONALIZER_ELEMENT, TailorKitProductPersonalizer)
  }
}
