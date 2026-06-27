/** @jsxImportSource preact */
import { h, render } from 'preact'

type View = {
  _id?: string
  title?: string
  baseImage?: { url?: string }
  backgroundImage?: { url?: string }
  maskImage?: { url?: string; l?: number; t?: number; w?: number; h?: number; r?: number }
}

function normalizeBaseLabel(label?: string): string {
  const s = (label || 'Select view').trim()
  const idx = s.indexOf(':')
  return idx >= 0 ? s.slice(0, idx).trim() : s
}

function ViewsBar({
  views,
  selectedId,
  storefrontLabel,
  featuredProductImage,
  onSelect,
}: {
  views: View[]
  selectedId?: string
  storefrontLabel?: string
  featuredProductImage?: string
  onSelect: (id?: string) => void
}) {
  if (!Array.isArray(views) || views.length <= 1) return null as any
  const current = views.find(v => v._id === selectedId) || views[0]

  return (
    <div>
      <div className="emtlkit--views-bar emtlkit--d-flex emtlkit--flex-column emtlkit--gap-8 emtlkit--mb-12">
        <label className="emtlkit--view-title">
          {normalizeBaseLabel(storefrontLabel)}: {current?.title || 'View'}
        </label>
        <div
          id={'emtlkit--views-bar-container'}
          className="emtlkit--d-flex emtlkit--flex-row emtlkit--gap-8 emtlkit--flex-wrap"
        >
          {views.map((v, idx) => (
            <div
              key={`${v._id || idx}-${[
                (v as any)?.baseImage?.url || '',
                (v as any)?.backgroundImage?.url || '',
                (v as any)?.maskImage?.url || '',
                (v as any)?.maskImage?.x ?? '',
                (v as any)?.maskImage?.y ?? '',
                (v as any)?.maskImage?.w ?? '',
                (v as any)?.maskImage?.h ?? '',
              ].join('|')}`}
              className={`emtlkit--view-thumb ${v._id === selectedId ? 'active' : ''}`}
              style={{ position: 'relative' }}
            >
              <canvas
                data-view-id={v._id}
                aria-label={v.title || 'View'}
                width={60}
                height={60}
                onClick={() => onSelect(v._id)}
                ref={el => {
                  if (!el) return
                  try {
                    const ctx = el.getContext('2d')
                    if (!ctx) return
                    // HiDPI canvas for crisper thumbnails
                    const DPR = Math.max(1, Math.min(3, (window as any).devicePixelRatio || 1))
                    const CSS_W = 60
                    const CSS_H = 60
                    // Set backing store size and CSS size
                    el.width = Math.round(CSS_W * DPR)
                    el.height = Math.round(CSS_H * DPR)
                    el.style.width = `${CSS_W}px`
                    el.style.height = `${CSS_H}px`

                    // Configure context for HiDPI and smoothing
                    ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
                    const W = CSS_W
                    const H = CSS_H
                    ctx.clearRect(0, 0, W, H)
                    ctx.imageSmoothingEnabled = true
                    try {
                      ;(ctx as any).imageSmoothingQuality = 'high'
                    } catch (_) {}

                    const loadImage = (src?: string) =>
                      new Promise<HTMLImageElement | null>(resolve => {
                        if (!src) return resolve(null)
                        const img = new Image()
                        img.crossOrigin = 'anonymous'
                        img.onload = () => resolve(img)
                        img.onerror = () => resolve(null)
                        img.src = src
                      })

                    const fitContain = (iw: number, ih: number, bw: number, bh: number) => {
                      if (!iw || !ih) return { w: 0, h: 0, x: 0, y: 0 }
                      const s = Math.min(bw / iw, bh / ih)
                      const w = Math.max(1, Math.round(iw * s))
                      const h = Math.max(1, Math.round(ih * s))
                      const x = Math.round((bw - w) / 2)
                      const y = Math.round((bh - h) / 2)
                      return { w, h, x, y }
                    }

                    ;(async () => {
                      const bgUrl = v.backgroundImage?.url
                      const baseUrl = v.baseImage?.url || featuredProductImage
                      const maskUrl = v.maskImage?.url

                      const [bg, base, mask] = await Promise.all([
                        loadImage(bgUrl),
                        loadImage(baseUrl),
                        loadImage(maskUrl),
                      ])

                      if (bg) {
                        const r = fitContain(bg.naturalWidth || bg.width, bg.naturalHeight || bg.height, W, H)
                        ctx.drawImage(bg, r.x, r.y, r.w, r.h)
                      } else {
                        ctx.fillStyle = '#ffffff'
                        ctx.fillRect(0, 0, W, H)
                      }

                      let baseDraw: { x: number; y: number; w: number; h: number } | null = null
                      // Prefer explicit view base size if available, fallback to loaded image dims
                      const viewBaseW = Number((v as any)?.baseImage?.width || 0)
                      const viewBaseH = Number((v as any)?.baseImage?.height || 0)
                      const baseOrigW = base ? base.naturalWidth || base.width || 0 : viewBaseW
                      const baseOrigH = base ? base.naturalHeight || base.height || 0 : viewBaseH
                      if (base) {
                        const r = fitContain(baseOrigW, baseOrigH, W, H)
                        ctx.drawImage(base, r.x, r.y, r.w, r.h)
                        baseDraw = r
                      } else if (baseOrigW && baseOrigH) {
                        // Compute fitted rect even if we couldn't load/draw the base image
                        baseDraw = fitContain(baseOrigW, baseOrigH, W, H)
                      }

                      if (mask) {
                        // Derive mask geometry from view overrides for the actual mask layer id,
                        // consistent with main canvas rendering logic
                        let geom: { x?: number; y?: number; width?: number; height?: number } = {}
                        // 1) Prefer geometry provided with maskImage (admin bridge resolved)
                        if (
                          typeof (v as any)?.maskImage?.l === 'number'
                          && typeof (v as any)?.maskImage?.t === 'number'
                          && typeof (v as any)?.maskImage?.w === 'number'
                          && typeof (v as any)?.maskImage?.h === 'number'
                        ) {
                          geom = {
                            x: (v as any).maskImage.l,
                            y: (v as any).maskImage.t,
                            width: (v as any).maskImage.w,
                            height: (v as any).maskImage.h,
                          }
                        } else {
                          // 2) Fallback: geometry unknown, draw mask contained
                          geom = {}
                        }

                        const hasGeom
                          = typeof geom.x === 'number'
                          && typeof geom.y === 'number'
                          && typeof geom.width === 'number'
                          && typeof geom.height === 'number'

                        if (hasGeom && baseDraw && baseOrigW > 0 && baseOrigH > 0) {
                          const scaleX = baseDraw.w / baseOrigW
                          const scaleY = baseDraw.h / baseOrigH
                          const mx = Math.round(baseDraw.x + Number(geom.x || 0) * scaleX)
                          const my = Math.round(baseDraw.y + Number(geom.y || 0) * scaleY)
                          const mw = Math.max(1, Math.round(Number(geom.width || 0) * scaleX))
                          const mh = Math.max(1, Math.round(Number(geom.height || 0) * scaleY))
                          ctx.drawImage(mask, mx, my, mw, mh)
                        } else {
                          const r = fitContain(mask.naturalWidth || mask.width, mask.naturalHeight || mask.height, W, H)
                          ctx.drawImage(mask, r.x, r.y, r.w, r.h)
                        }
                      }
                    })()
                  } catch (_) {}
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const TAG_NAME = 'tailorkit-views-bar'

class TailorKitViewsBarElement extends HTMLElement {
  private mounted = false
  private _onViewsReady?: (e: Event) => void
  private _selectedId?: string
  private _storefrontLabel?: string
  private _featuredProductImage?: string
  private _container: HTMLDivElement | null = null

  /**
   * Try to initialize the views bar if the initial event was missed (late-init in modal)
   * Attempts to find a nearby modal personalizer instance first, then falls back to global state.
   */
  private attemptLateInit() {
    try {
      // Prefer the personalizer inside the same modal content (if any)
      const modalRoot = this.closest('.emtlkit-modal__customizer-content') as HTMLElement | null
      const localModalPersonalizer = modalRoot?.querySelector(
        'tailorkit-product-personalizer.emtlkit-modal-instance'
      ) as any | null

      // Fallbacks: any modal instance in the document, then the main instance
      const anyModalPersonalizer
        = localModalPersonalizer
        || (document.querySelector('tailorkit-product-personalizer.emtlkit-modal-instance') as any | null)
        || (document.querySelector('tailorkit-product-personalizer') as any | null)

      // Resolve product personalizer data either from element instance or global bridge
      const pp
        = (anyModalPersonalizer && (anyModalPersonalizer as any).productPersonalizer)
        || ((window as any).__tailorkit__ && (window as any).__tailorkit__['product_personalizer'])

      const views = Array.isArray(pp?.views) ? pp.views : []
      if (!Array.isArray(views) || views.length <= 1) return

      const storefrontLabel = (pp?.storefrontLabel || '') as string
      const featuredProductImage = (pp?.pi && pp.pi.u) || ''

      // Keep selected id if present; otherwise default to first
      this._selectedId = this._selectedId || (views?.[0]?._id as string | undefined)
      this._storefrontLabel = normalizeBaseLabel(storefrontLabel)
      this._featuredProductImage = featuredProductImage
      this.renderViews(views)
    } catch (_) {
      // ignore late init errors
    }
  }

  private renderViews(views: View[]) {
    if (!Array.isArray(views) || views.length <= 1) {
      try {
        // Remove border if there are no views (or only one)
        this.style.border = 'none'
        // Clear any existing children to avoid residual layout
        this.replaceChildren()
      } catch (_) {}
      return
    }
    // Restore default border when views are available
    try {
      this.style.border = ''
    } catch (_) {}
    if (!this._container) {
      this._container = document.createElement('div')
      this.replaceChildren(this._container)
    }

    try {
      render(
        h(ViewsBar, {
          views,
          selectedId: this._selectedId,
          storefrontLabel: this._storefrontLabel,
          featuredProductImage: this._featuredProductImage,
          onSelect: (id?: string) => {
            if (id === this._selectedId) {
              return
            }

            this._selectedId = id
            this.dispatchEvent(
              new CustomEvent('tailorkit:set-view', { detail: { viewId: id, reRenderCanvas: true }, bubbles: true })
            )
            // Re-render to update title and active state declaratively
            this.renderViews(views)
          },
        }),
        this._container
      )
    } catch (err) {
      console.error('[views-bar] preact render error', err)
    }
    this.mounted = true
  }

  connectedCallback() {
    if (this.mounted) return

    // Defer until product-personalizer is ready (CustomEvent bridge)
    this._onViewsReady = (e: Event) => {
      try {
        const detail
          = (e as CustomEvent<{ views?: View[]; storefrontLabel?: string; featuredProductImage?: string }>).detail || {}
        const detailViews = detail?.views || []
        const storefrontLabel = detail?.storefrontLabel || ''
        const featuredProductImage = detail?.featuredProductImage || ''
        const currentViewId = (detail as any)?.currentViewId as string | undefined

        if (Array.isArray(detailViews) && detailViews.length > 1) {
          // Preserve current selection if already set; otherwise default to first
          this._selectedId = currentViewId || this._selectedId || detailViews?.[0]?._id
          this._storefrontLabel = normalizeBaseLabel(storefrontLabel)
          this._featuredProductImage = featuredProductImage
          this.renderViews(detailViews)
        }
      } catch (_) {}
    }
    document.addEventListener('tailorkit:views-ready', this._onViewsReady as EventListener)

    // Late-init path: if the views-ready event already fired before we connected (common in modal),
    // attempt to pull current data and render immediately. Schedule now and one RAF later for safety.
    this.attemptLateInit()
    try {
      requestAnimationFrame(() => this.attemptLateInit())
    } catch (_) {}
  }

  disconnectedCallback() {
    this.mounted = false
    if (this._onViewsReady) {
      document.removeEventListener('tailorkit:views-ready', this._onViewsReady as EventListener)
      this._onViewsReady = undefined
    }
    this.replaceChildren()
  }
}

if (!customElements.get(TAG_NAME)) {
  customElements.define(TAG_NAME, TailorKitViewsBarElement)
}
