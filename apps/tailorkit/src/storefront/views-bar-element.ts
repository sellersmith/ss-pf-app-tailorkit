const TAG_NAME = 'tailorkit-views-bar'

type TailorKitView = {
  _id?: string
  title?: string
  label?: string
}

type ViewsReadyDetail = {
  views?: TailorKitView[]
  storefrontLabel?: string
  featuredProductImage?: string
  currentViewId?: string
}

declare global {
  interface Window {
    __tailorkit__?: Record<string, any>
  }
}

function normalizeBaseLabel(label?: string) {
  const text = (label || '').trim()
  const delimiterIndex = text.indexOf(':')
  return delimiterIndex >= 0 ? text.slice(0, delimiterIndex).trim() : text
}

function viewLabel(view: TailorKitView, index: number) {
  return view.title || view.label || `View ${index + 1}`
}

class TailorKitViewsBarElement extends HTMLElement {
  private mounted = false
  private selectedId?: string
  private storefrontLabel?: string
  private featuredProductImage?: string
  private views: TailorKitView[] = []
  private container: HTMLDivElement | null = null

  connectedCallback() {
    if (this.mounted) return
    this.mounted = true
    document.addEventListener('tailorkit:views-ready', this.handleViewsReady as EventListener)
    this.attemptLateInit()
    requestAnimationFrame(() => this.attemptLateInit())
  }

  disconnectedCallback() {
    this.mounted = false
    document.removeEventListener('tailorkit:views-ready', this.handleViewsReady as EventListener)
    this.replaceChildren()
    this.container = null
  }

  private readonly handleViewsReady = (event: Event) => {
    const detail = (event as CustomEvent<ViewsReadyDetail>).detail || {}
    const views = Array.isArray(detail.views) ? detail.views : []
    if (views.length <= 1) {
      this.renderViews(views)
      return
    }

    this.selectedId = detail.currentViewId || this.selectedId || views[0]?._id
    this.storefrontLabel = normalizeBaseLabel(detail.storefrontLabel)
    this.featuredProductImage = detail.featuredProductImage
    this.renderViews(views)
  }

  private attemptLateInit() {
    const personalizer =
      (this.closest('tailorkit-product-personalizer') as any | null)
      || (document.querySelector('tailorkit-product-personalizer') as any | null)
    const productPersonalizer = personalizer?.productPersonalizer || window.__tailorkit__?.product_personalizer
    const views = Array.isArray(productPersonalizer?.views) ? productPersonalizer.views : []
    if (views.length <= 1) return

    this.selectedId = this.selectedId || views[0]?._id
    this.storefrontLabel = normalizeBaseLabel(productPersonalizer?.storefrontLabel || '')
    this.featuredProductImage = productPersonalizer?.pi?.u || productPersonalizer?.pi?.url || ''
    this.renderViews(views)
  }

  private renderViews(views: TailorKitView[]) {
    this.views = views
    if (!Array.isArray(views) || views.length <= 1) {
      this.style.border = 'none'
      this.replaceChildren()
      this.container = null
      return
    }

    this.style.border = ''
    const container = document.createElement('div')
    container.className = 'emtlkit--views-bar'

    if (this.featuredProductImage || this.storefrontLabel) {
      const summary = document.createElement('div')
      summary.className = 'emtlkit--views-bar-summary'
      if (this.featuredProductImage) {
        const image = document.createElement('img')
        image.src = this.featuredProductImage
        image.alt = this.storefrontLabel || 'TailorKit view'
        image.loading = 'lazy'
        summary.appendChild(image)
      }
      if (this.storefrontLabel) {
        const label = document.createElement('span')
        label.textContent = this.storefrontLabel
        summary.appendChild(label)
      }
      container.appendChild(summary)
    }

    const list = document.createElement('div')
    list.className = 'emtlkit--views-bar-list'
    views.forEach((view, index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'emtlkit--views-bar-item'
      button.textContent = viewLabel(view, index)
      button.dataset.viewId = view._id || ''
      button.setAttribute('aria-pressed', String(Boolean(view._id && view._id === this.selectedId)))
      button.addEventListener('click', () => this.selectView(view._id, views))
      list.appendChild(button)
    })
    container.appendChild(list)

    this.container = container
    this.replaceChildren(container)
  }

  private selectView(viewId: string | undefined, views: TailorKitView[] = this.views) {
    if (!viewId || viewId === this.selectedId) return

    this.selectedId = viewId
    this.dispatchEvent(
      new CustomEvent('tailorkit:set-view', { detail: { viewId, reRenderCanvas: true }, bubbles: true })
    )
    this.renderViews(views)
  }
}

/** Registers TailorKit's storefront views bar without pulling in the original Preact component. */
export function registerTailorKitViewsBarElement() {
  if (!customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, TailorKitViewsBarElement)
  }
}
