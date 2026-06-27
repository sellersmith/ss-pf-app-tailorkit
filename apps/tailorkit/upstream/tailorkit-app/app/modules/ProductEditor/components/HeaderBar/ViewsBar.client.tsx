import { useEffect, useMemo, useRef } from 'react'
import { useStore } from '~/libs/external-store'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { LayerIntegrationStoreSelection } from '~/stores/modules/integration/layer-integration-selection'
import { getViewLayerIntegrationStoreByIds } from '~/stores/modules/integration/viewLayerIntegration'
import { useEditorParams } from '../../hooks/useEditorParams'
import 'extensions/tailorkit-src/src/assets/components/preact/views-bar'

type ViewThumb = {
  _id: string
  title?: string
  baseImage?: { url?: string; width?: number; height?: number }
  backgroundImage?: { url?: string; width?: number; height?: number }
  maskImage?: { url?: string; x?: number; y?: number; w?: number; h?: number; r?: number; l?: number; t?: number }
}

export default function ViewsBar() {
  const { mockupId } = useEditorParams()
  const variants = useStore(IntegrationStore, state => state.variants)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const hostRef = useRef<HTMLElement | null>(null)
  const { previewMode: isPreviewMode } = useEditorParams()

  const activeVariant = useMemo(() => {
    if (!variants || variants.length === 0) return undefined
    return variants.find(v => v.mockup._id === mockupId) || variants[0]
  }, [variants, mockupId])

  const mockup = activeVariant?.mockup as any
  // Keep views memoized by reference to reduce re-renders but still reflect updates
  const rawViews: any[] = useMemo(() => (Array.isArray(mockup?.views) ? (mockup.views as any[]) : []), [mockup?.views])
  // Resolve final maskImage per view from effective mask layer state (store overrides applied)
  const views: ViewThumb[] = useMemo(() => {
    const mockupId = mockup?._id as string | undefined
    if (!mockupId || !Array.isArray(rawViews)) return []
    const result: ViewThumb[] = []
    for (const v of rawViews) {
      const viewId = v?._id as string | undefined
      if (!viewId) continue
      // Prefer explicit view images
      const baseImage = v?.baseImage
      const backgroundImage = v?.backgroundImage

      // Find mask layer id in this view
      let maskLayerId: string | undefined
      const layers = Array.isArray(v?.layers) ? v.layers : []
      for (const it of layers) {
        const obj = typeof it === 'string' ? null : it
        if (obj && (obj?.type === 'mask' || String(obj?.name || '').toLowerCase() === 'mask layer')) {
          maskLayerId = (obj?._id as string) || (obj?.layerId as string)
          break
        }
      }

      let maskImage:
        | { url?: string; x?: number; y?: number; w?: number; h?: number; l?: number; t?: number; r?: number }
        | undefined = v?.maskImage
      if (maskLayerId) {
        try {
          const store = getViewLayerIntegrationStoreByIds(mockupId, viewId, maskLayerId)
          const eff = store.getState() as any
          // Prefer per-view mask image asset for URL and intrinsic size; fall back to geometry store
          const url = maskImage && maskImage.url ? maskImage.url : eff?.data?.src
          // Geometry (position/size within base) comes from per-view overrides (geometry store)
          const x = typeof eff?.x === 'number' ? eff.x : (maskImage as any)?.x
          const l = typeof eff?.l === 'number' ? eff.l : (maskImage as any)?.l || x
          const y = typeof eff?.y === 'number' ? eff.y : (maskImage as any)?.y
          const t = typeof eff?.t === 'number' ? eff.t : (maskImage as any)?.t || y
          const w = typeof eff?.width === 'number' ? eff.width : (maskImage as any)?.w
          const h = typeof eff?.height === 'number' ? eff.height : (maskImage as any)?.h
          const r = typeof eff?.rotation === 'number' ? eff.rotation : (maskImage as any)?.r
          maskImage = { url, x, l, y, t, w, h, r }
        } catch {}
      }

      result.push({
        _id: viewId,
        title: v?.title,
        baseImage,
        backgroundImage,
        maskImage,
      })
    }
    return result
  }, [mockup?._id, rawViews])
  const normalizeBaseLabel = (label?: string) => {
    const s = (label || 'Select view').trim()
    const idx = s.indexOf(':')
    return idx >= 0 ? s.slice(0, idx).trim() : s
  }
  const storefrontLabel = normalizeBaseLabel(mockup?.storefrontLabel || 'Select view')
  const featuredProductImage = activeVariant?.product?.featuredImage?.url
  const selectedViewId = mockup?.selectedViewId || views?.[0]?._id
  const viewsIdsSignature = useMemo(() => (Array.isArray(views) ? views.map(v => v._id).join(',') : ''), [views])
  const viewsStateSignature = useMemo(() => {
    try {
      const rawViews = (views || []) as Array<any>
      if (!Array.isArray(rawViews)) return viewsIdsSignature
      const sig = rawViews
        .map(v => {
          const id = v?._id || ''
          const bi = v?.baseImage || {}
          const bg = v?.backgroundImage || {}
          const mi = v?.maskImage || {}
          const bUrl = bi?.url || ''
          const bW = typeof bi?.width === 'number' ? bi.width : ''
          const bH = typeof bi?.height === 'number' ? bi.height : ''
          const bgUrl = bg?.url || ''
          const bgW = typeof bg?.width === 'number' ? bg.width : ''
          const bgH = typeof bg?.height === 'number' ? bg.height : ''
          const mUrl = mi?.url || ''
          const mgX = typeof mi?.x === 'number' ? mi.x : ''
          const mgY = typeof mi?.y === 'number' ? mi.y : ''
          const mgW = typeof mi?.w === 'number' ? mi.w : ''
          const mgH = typeof mi?.h === 'number' ? mi.h : ''
          // eslint-disable-next-line max-len
          return `${id}|B:${bUrl}|Bw:${bW}|Bh:${bH}|BG:${bgUrl}|BGw:${bgW}|BGh:${bgH}|M:${mUrl}|Mw:${mgW}|Mh:${mgH}|MG:${mgX},${mgY},selectedViewId:${selectedViewId}`
        })
        .join('||')
      return sig || viewsIdsSignature
    } catch {
      return viewsIdsSignature
    }
  }, [selectedViewId, views, viewsIdsSignature])
  const initializedRef = useRef(false)
  const prevStateSigRef = useRef<string | null>(null)

  // 1) Mount once: create custom element inside host so connectedCallback runs exactly once
  useEffect(() => {
    const host = hostRef.current as any
    if (!host) return

    if (!host.querySelector('tailorkit-views-bar')) {
      const child = document.createElement('tailorkit-views-bar') as HTMLElement
      host.appendChild(child)
    }
  }, [isPreviewMode])

  // 2) Update data: do NOT recreate element to avoid flicker. Emit views-ready when data set changes
  useEffect(() => {
    if (!Array.isArray(views) || views.length <= 1) return
    const host = hostRef.current as any
    if (!host) return

    const wc = host.querySelector('tailorkit-views-bar') as HTMLElement | null
    if (wc) {
      if (!isPreviewMode) {
        // Remove margin and border via CSS variables so downstream CSS can be overridden externally
        wc.style.setProperty('--tlk-views-bar-margin', '0')
        wc.style.setProperty('--tlk-views-bar-border', '0')
      } else {
        // Apply compact margin in preview mode, restore default border
        wc.style.setProperty('--tlk-views-bar-margin', '-8px')
        wc.style.removeProperty('--tlk-views-bar-border')
      }
    }

    host.productPersonalizer = {
      ...(host.productPersonalizer || {}),
      views,
      storefrontLabel,
      featuredProductImage,
    }

    // Debounce state updates slightly to avoid back-to-back layout thrash
    let debounceTimer: number | undefined
    host.setView = (id?: string) => {
      const viewId = id || views?.[0]?._id
      const mockupId = mockup?._id
      if (!mockupId || !viewId || viewId === selectedViewId) return

      if (debounceTimer) window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        LayerIntegrationStoreSelection.resetState()
        IntegrationStore.dispatch({ type: 'SET_SELECTED_VIEW', payload: { mockupId, viewId }, skipTrace: true })
      }, 16) // ~1 frame
    }
    host.currentViewId = selectedViewId

    // Dispatch only when thumbnail-affecting fields change (baseImage/backgroundImage/maskImage)
    const shouldEmit = !initializedRef.current || prevStateSigRef.current !== viewsStateSignature

    if (shouldEmit) {
      initializedRef.current = true
      prevStateSigRef.current = viewsStateSignature
      const detail = {
        views,
        storefrontLabel: normalizeBaseLabel(storefrontLabel),
        featuredProductImage,
        currentViewId: selectedViewId,
      }
      document.dispatchEvent(new CustomEvent('tailorkit:views-ready', { detail }))
    }
  }, [
    viewsIdsSignature,
    viewsStateSignature,
    storefrontLabel,
    featuredProductImage,
    selectedViewId,
    mockup?._id,
    views,
    mockup,
    activeVariant,
    variants,
    isPreviewMode,
  ])

  // 3) Reflect selection without remounting
  useEffect(() => {
    const host = hostRef.current as any
    if (host) host.currentViewId = selectedViewId
  }, [selectedViewId])

  // Listen for selection from web component and sync to IntegrationStore
  useEffect(() => {
    const target: HTMLElement | Document = containerRef.current || document

    const onSetView = (e: Event) => {
      const { viewId } = (e as CustomEvent<{ viewId?: string }>).detail || {}
      const mockupId = mockup?._id
      if (!mockupId || !viewId || viewId === selectedViewId) return
      LayerIntegrationStoreSelection.resetState()
      IntegrationStore.dispatch({ type: 'SET_SELECTED_VIEW', payload: { mockupId, viewId }, skipTrace: true })
    }

    target.addEventListener('tailorkit:set-view', onSetView as EventListener)
    return () => {
      target.removeEventListener('tailorkit:set-view', onSetView as EventListener)
    }
  }, [mockup, selectedViewId])

  if (!Array.isArray(views) || views.length <= 1) return null

  const FakeHost: any = 'tailorkit-product-personalizer'
  return (
    <div ref={containerRef}>
      {/* Provide fake host so views-bar can use closest('tailorkit-product-personalizer') */}
      <FakeHost ref={hostRef} style={{ display: 'block' }} />
    </div>
  )
}
