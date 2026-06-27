import type { LayerIntegration as LayerIntegrationType } from '~/types/integration'

/**
 * Transforms raw mockup views into a compact metafield-ready payload by normalizing
 * layer references to string IDs, coercing override values, and resolving mask geometry.
 */
export function prepareViewsForMetafield(mockup: any, layerIntegrations: LayerIntegrationType[]) {
  try {
    const rawViews = Array.isArray(mockup?.views) ? mockup.views : []
    if (!rawViews.length) return []

    const normalizeLayerIds = (layers: any[]): string[] =>
      Array.isArray(layers)
        ? layers
            .map((it: any) => (typeof it === 'string' ? it : it?._id))
            .filter((v: any): v is string => typeof v === 'string' && v.length > 0)
        : []

    const coerceNum = (v: unknown) => (typeof v === 'number' ? v : Number.isFinite(Number(v)) ? Number(v) : undefined)

    const normalizeOverrides = (overrides: any): Record<string, any> => {
      const result: Record<string, any> = {}
      if (!overrides) return result

      const iterator: [string, any][]
        = overrides instanceof Map ? Array.from(overrides.entries()) : Object.entries(overrides)

      iterator.forEach(([layerId, patch]) => {
        if (!layerId || !patch) return
        const p = patch || {}

        const basePatch: Record<string, unknown> = {
          x: coerceNum(p.x),
          y: coerceNum(p.y),
          w: coerceNum(p.width),
          h: coerceNum(p.height),
          r: coerceNum(p.rotation),
          vsb: p.visible,
        }

        // Include mask geometry when provided in overrides (per-view)
        if (p.mask && typeof p.mask === 'object') {
          const mx = coerceNum(p.mask?.x)
          const my = coerceNum(p.mask?.y)
          const mw = coerceNum(p.mask?.width)
          const mh = coerceNum(p.mask?.height)
          const mr = coerceNum(p.mask?.rotation)

          const hasAnyMask
            = mx !== undefined || my !== undefined || mw !== undefined || mh !== undefined || mr !== undefined
          if (hasAnyMask) {
            basePatch.mask = {
              x: mx,
              y: my,
              w: mw,
              h: mh,
              r: mr,
            }
          }
        }

        result[String(layerId)] = basePatch
      })

      return result
    }

    return rawViews.map((v: any) => {
      // Normalize once
      const viewLayerIds = normalizeLayerIds(v?.layers)
      const normalizedOverrides = normalizeOverrides(v?.overrides)

      // Resolve mask layer id from global layer integrations (not from view layer objects)
      const maskLayer = (layerIntegrations || []).find(
        (li: any) => viewLayerIds.includes(li?._id) && li?.type === 'mask'
      )
      const maskImageOv = maskLayer ? normalizedOverrides?.[maskLayer._id] : undefined

      return {
        _id: v?._id,
        title: v?.title,
        baseImage: v?.baseImage,
        backgroundImage: v?.backgroundImage,
        maskImage: v?.maskImage
          ? {
              u: v?.maskImage.url,
              ...(maskImageOv || {}),
            }
          : null,
        enableClippingMask: Boolean(v?.enableClippingMask),
        layers: viewLayerIds,
        // Filter overrides to the layers present in the view
        overrides: Object.fromEntries(
          Object.entries(normalizedOverrides).filter(([lid]) => viewLayerIds.includes(String(lid)))
        ),
      }
    })
  } catch (e) {
    console.error('❌ Error preparing views for metafield:', e)
    return []
  }
}
