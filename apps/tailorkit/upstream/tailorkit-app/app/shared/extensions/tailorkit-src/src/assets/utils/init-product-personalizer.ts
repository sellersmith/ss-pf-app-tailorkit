import { minifyDesignMetrics } from '../fns/minify-design-metrics'
import { getFieldsetSelector } from '../fns/get-fieldset-selector'
import type { Layer, LayerIntegration, PrintArea } from '../type'
import { TAILORKIT_PRODUCT_PERSONALIZER_ERRORS } from '../constants/errors'

/**
 * Prepares product personalizer data for rendering
 *
 * This function transforms data from server-side format (preparation-fns.server.ts)
 * to the exact structure needed by the renderer (product-personalizer.ts)
 *
 * @param productPersonalizerElement - HTML element containing the product personalizer
 * @param pi - Product image data
 * @param mockup - Mockup data from server
 * @param lis - Layer integrations
 * @param printAreas - Print areas
 * @returns Structured data ready for rendering
 */
export const prepareProductPersonalizer = (
  productPersonalizerElement: HTMLElement,
  pi: any,
  mockup: any,
  lis: LayerIntegration[],
  printAreas: PrintArea[]
) => {
  // Normalize any image-like object to a canonical schema preserving geometry
  // Returns: { url, width, height, l, t, w, h, r } where l/t/w/h/r are used by renderer directly
  const normalizeImage = (
    img: any
  ): {
    url: string
    width: number
    height: number
    l: number
    t: number
    w: number
    h: number
    r: number
  } | null => {
    if (!img) return null
    const isObj = typeof img === 'object'
    const url = !isObj ? String(img) : (img.url ?? img.u ?? img.src ?? '')
    if (!url) return null
    const width = isObj ? (img.width ?? img.w ?? 0) : 0
    const height = isObj ? (img.height ?? img.h ?? 0) : 0

    return {
      url,
      width,
      height,
      l: img.l || img.x || 0,
      t: img.t || img.y || 0,
      w: width,
      h: height,
      r: img.r || img.rotation || 0,
    }
  }

  // Process mask layer information for views
  const processMaskLayerForViews = (view: any, maskImageLayer: any, baseProductImage: any) => {
    const maskImg = view?.maskImage ?? {}
    const baseImg = view?.baseImage ?? {}
    const canvasBase = baseProductImage ?? {}
    const maskLayerId = maskImageLayer?.i
    const maskOv = view?.overrides?.[maskLayerId]

    // If we have mask overrides, calculate scaled coordinates
    if (maskOv) {
      const viewW = Number(baseImg.width ?? 0)
      const viewH = Number(baseImg.height ?? 0)
      const canvasW = Number(canvasBase.width ?? 0)
      const canvasH = Number(canvasBase.height ?? 0)
      const sx = viewW > 0 && canvasW > 0 ? canvasW / viewW : 1
      const sy = viewH > 0 && canvasH > 0 ? canvasH / viewH : 1

      return {
        ...view,
        maskImage: {
          ...maskImg,
          l: Number(maskOv.x ?? 0) * sx,
          t: Number(maskOv.y ?? 0) * sy,
          w: Number(maskOv.w ?? 0) * sx,
          h: Number(maskOv.h ?? 0) * sy,
          r: Number(maskOv.rotation ?? 0),
        },
      }
    }

    return view
  }

  // Process template layers with print area information
  const processTemplateLayers = (layerIntegration: any, printArea: any) => {
    if (!printArea) {
      console.log(TAILORKIT_PRODUCT_PERSONALIZER_ERRORS.NONE_EXISTED_PRINT_AREA)
      return layerIntegration
    }

    return {
      ...layerIntegration,
      data: {
        ...layerIntegration.data,
        ls: layerIntegration.data.ls.map((layer: Layer) => {
          const { t } = layer
          // Get fieldset selectors for this layer
          const optionSelectors = getFieldsetSelector({
            container: productPersonalizerElement,
            layerId: layer.i,
            printAreaId: printArea.i,
          })

          return {
            ...layer,
            // Supplement print area id
            printAreaId: printArea.i,
            // Supplement layer setting (special handling for text layers)
            s: {
              ...layer.s,
              ...(t === 'text' ? layerIntegration.data.ls.find((l: any) => l.i === layer.i)?.s || {} : {}),
            },
            // Supplement layer design
            ds: layerIntegration.data.ls.find((l: any) => l.i === layer.i)?.ds || {},
            // Insert option selector
            optionSelectors,
          }
        }),
      },
    }
  }

  // Main result structure
  const result: any = {
    // Base product image (with backward compatibility)
    pi: minifyDesignMetrics(pi || mockup?.pi),

    // Background image (with backward compatibility)
    bgi: minifyDesignMetrics(mockup?.bgi || mockup?.backgroundImage),

    // AI-generated prompt for this product
    preMadePrompt: mockup.preMadePrompt,

    // Product identifier and label
    i: productPersonalizerElement.getAttribute('data-id') || '',
    l: productPersonalizerElement.getAttribute('data-label') || '',

    // Clipping mask settings
    enableClippingMask: mockup?.enableClippingMask ?? mockup?.mockup?.enableClippingMask,

    // Flag indicating if option sets exist
    eot: mockup?.eot,

    // Storefront label for display
    storefrontLabel: mockup?.storefrontLabel,

    // Process views (if available)
    views: Array.isArray(mockup?.views)
      ? mockup.views.map((view: any) => {
          // Find mask layer for this view
          const maskImageLayer = lis.find((li: any) => li?.t === 'mask')
          return processMaskLayerForViews(view, maskImageLayer, pi)
        })
      : [],

    // Process layer integrations
    lis: lis
      .filter(li => li && li.vsb !== false) // Only include visible layers
      .map(li => {
        // Special handling for template layers
        if (li.t === 'template') {
          const printArea = printAreas.find(printArea => printArea.i === li.data.printAreaId)
          return processTemplateLayers(li, printArea)
        }
        return li
      }),
  }

  // Build a default view for legacy data or normalize incomplete views

  const collectBaseLayers = () => {
    const overrides: any = {}
    const layerIds: string[] = lis.map((li: any) => li?.i)

    // Collect per-layer overrides from template layers
    const templateItems = result.lis.filter((li: any) => li?.t === 'template')

    // Add template-level mask override per-view if clipping mask is enabled and geometry exists
    if (mockup.enableClippingMask) {
      templateItems.forEach((li: any) => {
        const tmplId = li?.i
        const m = (li?.data as any)?.mask
        if (!tmplId || !m) return
        overrides[tmplId] = {
          ...(overrides[tmplId] || {}),
          mask: m,
        }
      })
    }

    return { layerIds, overrides }
  }

  // If no views, create a default one
  if (!Array.isArray(result.views) || result.views.length === 0) {
    const { layerIds, overrides } = collectBaseLayers()
    result.views = [
      {
        _id: 'default',
        title: result.l || 'View 1',
        layers: layerIds,
        overrides,
        enableClippingMask: !!result.enableClippingMask,
        // Normalize legacy base/background images into canonical schema
        baseImage: normalizeImage(mockup?.pi),
        backgroundImage: normalizeImage(mockup?.bgi),
        // Legacy has no per-view mask image
        maskImage: null,
      },
    ]
  } else {
    // Normalize any view entries missing layers/overrides
    result.views = result.views.map((v: any, idx: number) => {
      const normalized = {
        _id: v?._id || `view-${idx + 1}`,
        title: v?.title || `${result.l || 'View'} ${idx + 1}`,
        // Preserve empty layer arrays to honor view-only rendering (no fallback)
        layers: Array.isArray(v?.layers) ? v.layers : [],
        overrides: v?.overrides || {},
        enableClippingMask: v?.enableClippingMask,
        // Normalize images to canonical schema
        baseImage: normalizeImage(v?.baseImage),
        backgroundImage: normalizeImage(v?.backgroundImage),
        maskImage: normalizeImage(v?.maskImage),
      }

      return normalized
    })
  }

  return result
}
