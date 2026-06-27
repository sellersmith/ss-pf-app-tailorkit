import type { Layer, ProductPersonalizerElementType } from '../type'
import type { KonvaCanvasManager } from '../../shared/libraries/konva/core/konva-canvas-manager'
import type { CharmChangeDetail } from '../../shared/components/CharmPicker/charm-picker-types'
import { renderTextLayer } from '../utils/render-text-layer-to-data-source'
import { isLayerInsideMultiLayout } from '../utils/is-layer-inside-multi-layout'
import {
  getImageDesignEvaluation,
  getImageClipGroupEvaluation,
  getImageUploadedClipGroup,
} from '../fns/get-fieldset-selector'
import { loadFeature } from '../utils/feature-loader'
import { FEATURE_FLAGS } from '../constants/feature-flags'

/**
 * Register a layer as interactive on the canvas manager if it supports it.
 * This is a safe duck-typed call — only fires when canvasManager is a
 * StorefrontInteractiveCanvasManager and the LAYER_INTERACTION feature flag is ON.
 */
function maybeRegisterInteractiveLayer(
  canvasManager: KonvaCanvasManager,
  layer: Layer,
  defaultTransform: { x: number; y: number; width: number; height: number; rotation: number }
): void {
  // Layers with movementBounds are ALWAYS interactive — merchant explicitly configured
  // a movement zone for buyers to drag text within. Bypass global LAYER_INTERACTION flag.
  // Layers with an explicit movable flag from admin (Buyer Interaction toggles) are also
  // always interactive: the merchant opted in, so the global gate should not block them.
  // LAYER_INTERACTION still controls free-drag for layers that have no buyer-interaction
  // configuration at all (legacy templates without ss flags).
  const hasMovementZone = Boolean(layer.ss?.movementBounds)
  const hasExplicitBuyerInteraction = Boolean(
    layer.ss?.movable === true || layer.ss?.resizable === true || layer.ss?.rotatable === true
  )
  if (!FEATURE_FLAGS.LAYER_INTERACTION && !hasMovementZone && !hasExplicitBuyerInteraction) {
    return
  }
  // LAYER_INTERACTION is a global flag — when ON, all template layers are treated as interactive
  // using their ss flags (defaulting to full move/resize/rotate capabilities if not set).
  // Per-layer enableForCustomers is not yet configurable via Admin UI.
  // TODO: Restore per-layer guard once Admin UI ships:
  //   if (!layer.ss?.enableForCustomers) return
  if (!layer.i) {
    return
  }
  if (!('setNextLayerInteractive' in canvasManager)) {
    return
  }

  const flags = {
    movable: layer.ss?.movable ?? true,
    // For movement-zone layers: default resizable/rotatable to false unless merchant explicitly set them.
    // Movement zone = buyer drags text within bounds; resize/rotate not expected unless configured.
    resizable: layer.ss?.resizable ?? (hasMovementZone ? false : true),
    rotatable: layer.ss?.rotatable ?? (hasMovementZone ? false : true),
    movementBounds: layer.ss?.movementBounds,
    defaultOffsetX: layer.ss?.defaultOffsetX ?? 0,
    defaultOffsetY: layer.ss?.defaultOffsetY ?? 0,
    // Scale factors for converting storefront canvas px → template coords in ATC middleware
    originalScaleX: layer.ds?.originalScaleX,
    originalScaleY: layer.ds?.originalScaleY,
  }

  // When movementBounds is set, compute initial storefront position = zone origin + default offset
  const interactiveDefaultTransform = flags.movementBounds
    ? {
        ...defaultTransform,
        x: flags.movementBounds.x + (flags.defaultOffsetX ?? 0),
        y: flags.movementBounds.y + (flags.defaultOffsetY ?? 0),
      }
    : defaultTransform

  ;(canvasManager as any).setNextLayerInteractive(layer.i, flags, interactiveDefaultTransform)
}

/**
 * Context interface providing access to component methods and properties
 * needed by the layer rendering functions.
 *
 * This context decouples the rendering logic from the ProductPersonalizer component,
 * allowing the renderer to be tested and potentially reused independently.
 *
 * @example
 * const ctx: LayerRendererContext = {
 *   canvasManager: this.canvasManager,
 *   productPersonalizer: this.productPersonalizer,
 *   currentViewId: this.currentViewId,
 *   isLayerVisible: (layer, layers) => this.isLayerVisible(layer, layers),
 *   toggleLayerOptions: (id, visible) => this.toggleLayerOptions(id, visible),
 * }
 */
export interface LayerRendererContext {
  /** Konva canvas manager for rendering operations */
  canvasManager: KonvaCanvasManager

  /** Product personalizer configuration data */
  productPersonalizer: ProductPersonalizerElementType

  /** Optional current view identifier for multi-view templates */
  currentViewId?: string

  /** Determines if a layer should be visible based on controller conditions */
  isLayerVisible: (layer: Layer, extractedLayers: Layer[]) => boolean

  /** Toggles visibility of layer option UI elements in the DOM */
  toggleLayerOptions: (layerId: string, visible: boolean) => void

  /** Current charm selection state (from CharmPicker event) */
  charmState?: CharmChangeDetail | null

  /**
   * Multi-builder charm state map keyed by layerId.
   * When present, takes precedence over charmState for per-layer lookup.
   * Supports multiple charm builders on the same print area.
   */
  charmStateMap?: Map<string, CharmChangeDetail>
}

/**
 * Resolves the active view from the product personalizer views array
 */
function resolveActiveView(ctx: LayerRendererContext): any {
  const views = Array.isArray((ctx.productPersonalizer as any)?.views) ? (ctx.productPersonalizer as any).views : []
  return views.find((v: any) => v?._id === ctx.currentViewId) || views?.[0]
}

/**
 * Resolves the effective overlay for a layer, checking option-level first then layer-level
 * @param layer - The layer to resolve overlay for
 * @param layerImage - The current image URL (used for option matching when no option ID)
 * @returns The effective overlay configuration or undefined
 */
function resolveEffectiveOverlay(
  layer: Layer,
  layerImage: string | undefined
): { overlaySvg?: string; overlayMetadata?: any } | undefined {
  const imageOptionSet = layer.osl?.find((os: any) => os.t === 'image_option')
  const fieldsetImageOption = layer.optionSelectors['image_option']?.selector

  // Get selected option ID from fieldset - this is the most reliable source
  // It persists even when user uploads a custom image (layerImage URL changes but option ID stays)
  const selectedOptionId = fieldsetImageOption?.getAttribute('data-option-id')

  // Try to find the selected option in order of preference:
  // 1. By option ID from fieldset (most accurate - preserves selection even with user uploads)
  // 2. By image URL match (fallback when fieldset doesn't have option ID)
  // 3. By 's' flag (option marked as selected in metafield data)
  // 4. First option in the list (default)
  let selectedOption = selectedOptionId ? imageOptionSet?.ol?.find((opt: any) => opt.i === selectedOptionId) : null

  if (!selectedOption && layerImage) {
    selectedOption = imageOptionSet?.ol?.find((opt: any) => opt.v === layerImage)
  }

  if (!selectedOption) {
    // Try to find option with s: 1 (selected flag from metafield)
    selectedOption = imageOptionSet?.ol?.find((opt: any) => opt.s === 1)
  }

  if (!selectedOption && imageOptionSet?.ol?.length) {
    // Fallback to first option
    selectedOption = imageOptionSet.ol[0]
  }

  const optionOverlay = selectedOption?.overlay
  const layerOverlay = layer.s?.overlay
  return optionOverlay || layerOverlay
}

/**
 * Renders a layer integration based on its type
 */
export async function renderLayerIntegration(
  ctx: LayerRendererContext,
  layerIntegration: any,
  preloadImageOnly: boolean
): Promise<void> {
  const { t: type } = layerIntegration

  if (type === 'template') {
    await renderTemplateLayerIntegration(ctx, layerIntegration, preloadImageOnly)
  } else if (type === 'image') {
    await renderImageLayerIntegration(ctx, layerIntegration)
  } else if (type === 'mask') {
    await renderMaskLayerIntegration(ctx)
  }
}

/**
 * Renders a template layer integration with all its child layers
 */
export async function renderTemplateLayerIntegration(
  ctx: LayerRendererContext,
  layerIntegration: any,
  preloadImageOnly: boolean
): Promise<void> {
  const layerIntegrationData = layerIntegration.data
  const { t = 0, l: left = 0, r = 0, ls: layers } = layerIntegrationData

  // Resolve active view (presentational only). Backward compatible: no views => draw all layers as before
  const activeView = resolveActiveView(ctx)

  // Build ordered & overridden layers according to active view, supporting both template-level and layer-level modes
  let orderedLayers: Layer[] = layers
  const idToLayer: Record<string, Layer> = {}
  layers.forEach((ly: any) => {
    if (ly?.i) idToLayer[ly.i] = ly
  })

  if (activeView && Array.isArray(activeView.layers)) {
    const viewIds: string[] = activeView.layers
      .map((it: any) => (typeof it === 'string' ? it : it?._id))
      .filter((v: any): v is string => typeof v === 'string' && v.length > 0)

    const overrides: Record<string, any> = activeView.overrides || {}

    // Determine view mode ONCE by checking if any viewIds/override keys match template ids in this mockup
    const templateIds: string[] = (ctx.productPersonalizer.lis || [])
      .filter((li: any) => li?.t === 'template')
      .map((li: any) => li.i)
    const viewIsTemplateMode
      = viewIds.some(id => templateIds.includes(id)) || Object.keys(overrides).some(k => templateIds.includes(k))
    const isTemplateMode = viewIsTemplateMode

    if (isTemplateMode) {
      // If this template is not included in the view and templates are being targeted, simply skip drawing it.
      // Also consider explicit template-level overrides as inclusion signal.
      const includeTemplate
        = viewIds.includes(layerIntegration.i) || Object.prototype.hasOwnProperty.call(overrides, layerIntegration.i)
      if (!includeTemplate) {
        ctx.canvasManager.endTemplateGroup()
        return
      }

      // Apply group-level overrides when provided (x,y,rotation). Normalize to canvas space when base image sizes differ
      const groupOv = overrides[layerIntegration.i] || {}
      const viewBaseW = (activeView?.baseImage as any)?.width
      const viewBaseH = (activeView?.baseImage as any)?.height
      const piW = Number(ctx.productPersonalizer.pi?.w || 0)
      const piH = Number(ctx.productPersonalizer.pi?.h || 0)
      const viewScaleX = viewBaseW > 0 && piW > 0 ? piW / viewBaseW : 1
      const viewScaleY = viewBaseH > 0 && piH > 0 ? piH / viewBaseH : 1

      // Accept both admin-style {x,y,width,height,rotation} and storefront-style {l,t,w,h,r}
      const rawX = groupOv.x || groupOv.l
      const rawY = groupOv.y || groupOv.t
      const rawW = groupOv.width || groupOv.w
      const rawH = groupOv.height || groupOv.h
      const rawR = groupOv.rotation || groupOv.r

      const normX = typeof rawX === 'number' ? rawX * viewScaleX : undefined
      const normY = typeof rawY === 'number' ? rawY * viewScaleY : undefined
      const normW = typeof rawW === 'number' ? rawW * viewScaleX : undefined
      const normH = typeof rawH === 'number' ? rawH * viewScaleY : undefined

      if (typeof rawX === 'number') {
        ;(layerIntegrationData as any).l = typeof normX === 'number' ? normX : rawX
      }
      if (typeof rawY === 'number') {
        ;(layerIntegrationData as any).t = typeof normY === 'number' ? normY : rawY
      }
      if (typeof rawR === 'number') {
        ;(layerIntegrationData as any).r = rawR
      }

      // Compute group scale factors based on override width/height vs base integration size
      const baseW = Number(layerIntegrationData.w) || 0
      const baseH = Number(layerIntegrationData.h) || 0
      const nextW = typeof normW === 'number' ? Number(normW) : typeof rawW === 'number' ? Number(rawW) : baseW
      const nextH = typeof normH === 'number' ? Number(normH) : typeof rawH === 'number' ? Number(rawH) : baseH

      const scaleX = baseW > 0 && nextW > 0 ? nextW / baseW : 1
      const scaleY = baseH > 0 && nextH > 0 ? nextH / baseH : 1

      // Keep layer data intact; scale will be applied at group level in startTemplateGroup
      orderedLayers = layers

      // Attach computed scale to layerIntegrationData for later call
      ;(layerIntegrationData as any).__groupScale = { x: scaleX, y: scaleY }
    } else {
      // Layer-mode (legacy or admin). Order only layers included in view and apply per-layer overrides
      const built: Layer[] = []

      viewIds.forEach(id => {
        const base = idToLayer[id]
        if (!base) return
        const ov = overrides[id] || {}
        // Normalize overrides to canvas space if view base image differs from product image
        const viewBaseW = (activeView?.baseImage as any)?.width
        const viewBaseH = (activeView?.baseImage as any)?.height
        const piW = Number(ctx.productPersonalizer.pi?.w || 0)
        const piH = Number(ctx.productPersonalizer.pi?.h || 0)
        const scaleX = viewBaseW > 0 && piW > 0 ? piW / viewBaseW : 1
        const scaleY = viewBaseH > 0 && piH > 0 ? piH / viewBaseH : 1
        const rawLX = ov.x || ov.l
        const rawTY = ov.y || ov.t
        const rawW = ov.width || ov.w
        const rawH = ov.height || ov.h
        const rawR = ov.rotation || ov.r
        const l = typeof rawLX === 'number' ? rawLX * scaleX : undefined
        const t = typeof rawTY === 'number' ? rawTY * scaleY : undefined
        const w = typeof rawW === 'number' ? rawW * scaleX : undefined
        const h = typeof rawH === 'number' ? rawH * scaleY : undefined
        const r = typeof rawR === 'number' ? rawR : undefined
        const patched: any = {
          ...base,
          ds: {
            ...base.ds,
            ...(l !== undefined ? { l } : {}),
            ...(t !== undefined ? { t } : {}),
            ...(w !== undefined ? { w } : {}),
            ...(h !== undefined ? { h } : {}),
            ...(r !== undefined ? { r } : {}),
          },
        }
        if (typeof ov.visible === 'boolean' && ov.visible === false) {
          // Respect explicit visibility override only
        } else {
          built.push(patched)
        }
      })

      if (!built.length) {
        // No matching layers for this template in the view => skip drawing this template
        return
      }
      orderedLayers = built
    }
  }

  // Respect template-level visibility override (per view)
  const templateOv = ((activeView?.overrides as any) || {})[layerIntegration.i] || {}
  if (typeof templateOv.visible === 'boolean' && templateOv.visible === false) {
    return
  }

  // Now start template group using final (possibly overridden) transform
  const finalLeft = Number((layerIntegrationData as any).l ?? left ?? 0)
  const finalTop = Number((layerIntegrationData as any).t ?? t ?? 0)
  const finalRotation = Number((layerIntegrationData as any).r ?? r ?? 0)
  // Clipping: prefer view-level flag, fallback to global enableClippingMask
  const isClipOn = Boolean((activeView as any)?.enableClippingMask ?? ctx.productPersonalizer.enableClippingMask)

  // Resolve final mask geometry from per-view override (templateOv.mask) or base template mask
  const templateOvMask = (templateOv && (templateOv as any).mask) || undefined
  // Convert view-space (x,y,width,height) to canvas-space (l,t,w,h)
  let finalMask: { l: number; t: number; w: number; h: number; r: number } | undefined
  if (isClipOn && templateOvMask) {
    const l = templateOvMask.l || templateOvMask.x || 0
    const t = templateOvMask.t || templateOvMask.y || 0
    const w = templateOvMask.w || templateOvMask.width || 0
    const h = templateOvMask.h || templateOvMask.height || 0
    const r = templateOvMask.r || templateOvMask.rotation || 0

    finalMask = { l, t, w, h, r }
  }

  ctx.canvasManager.startTemplateGroup(
    { l: finalLeft, t: finalTop, r: finalRotation },
    finalMask,
    (layerIntegrationData as any).__groupScale
  )

  const extractedLayers = orderedLayers.filter((layer: Layer) => !isLayerInsideMultiLayout(layer.i!, orderedLayers))

  // DEBUG: log all layers and their conditional logic state
  if ((window as any).__DEBUG_CONDITIONAL_LOGIC) {
    console.group('[CL] renderLayers - all extractedLayers')
    extractedLayers.forEach((layer: Layer) => {
      console.log(`  layer=${layer.i} type=${layer.t}`, {
        isControlledBy: layer.isControlledBy,
        controls: layer.controls,
        hasOptionSets: !!(layer as any).osl?.length,
      })
    })
    console.groupEnd()
  }

  // Render layers - they will be added to the group
  for (let layerIndex = extractedLayers.length - 1; layerIndex > -1; layerIndex--) {
    const layer = extractedLayers[layerIndex] as Layer
    if (!ctx.isLayerVisible(layer, extractedLayers)) {
      continue
    }

    switch (layer.t) {
      case 'text': {
        // Register as interactive before rendering (consumed by next addTextLayer call)
        maybeRegisterInteractiveLayer(ctx.canvasManager, layer, {
          x: layer.ds.l,
          y: layer.ds.t,
          width: layer.ds.w,
          height: layer.ds.h,
          rotation: layer.ds.r || 0,
        })
        await renderTextLayer(layer, ctx)
        break
      }

      case 'image': {
        // If this image layer is acting as a controller (has conditions that toggle other layers),
        // do not render the controller image itself to avoid visual duplication with the target layers.
        const controls = (layer as any)?.controls
        const actsAsController = controls && Array.isArray(controls.conditions) && controls.conditions.length > 0
        if (actsAsController) {
          // Still show its option-set UI via toggleLayerOptions elsewhere; just skip drawing its own bitmap
          break
        }

        const fieldsetImageOption = layer.optionSelectors['image_option']?.selector
        const layerImage = fieldsetImageOption ? fieldsetImageOption.getAttribute('value') || layer.u : layer.u
        const fieldsetMaskOption = layer.optionSelectors['mask_option']?.selector
        const layerMask = fieldsetMaskOption ? fieldsetMaskOption.getAttribute('value') : ''

        // Get the design state of the image option
        const { x, y, width, height, rotation } = getImageDesignEvaluation(layer, fieldsetImageOption)

        // Get the default clip group from the layer (with null safety)
        const defaultClipGroup = layer.ds?.clipGroup
        // Get the clip group: 1) from built-in option (decoded from pct), 2) uploaded image, 3) default layer
        const clipGroup
          = getImageClipGroupEvaluation(layer, fieldsetImageOption, { width, height, rotation })
          || getImageUploadedClipGroup(ctx, fieldsetImageOption)
          || defaultClipGroup

        // Resolve overlay (option-level takes precedence over layer-level)
        const effectiveOverlay = resolveEffectiveOverlay(layer, layerImage)

        if (layerImage) {
          // Register as interactive before rendering (consumed by the next addImageLayer call)
          maybeRegisterInteractiveLayer(ctx.canvasManager, layer, {
            x: layer.ds.l,
            y: layer.ds.t,
            width: layer.ds.w,
            height: layer.ds.h,
            rotation: layer.ds.r || 0,
          })
          await ctx.canvasManager.addImageLayer({
            url: layerImage,
            x,
            y,
            width,
            height,
            rotation,
            // For template layers, only use layer-level mask option
            maskConfig: layerMask ? { src: layerMask } : undefined,
            ...(clipGroup && { clipGroup }),
            // Pass overlay data for SVG compositing (from VectorEditor)
            // Prefer option-level overlay, fall back to layer-level overlay
            ...(effectiveOverlay?.overlaySvg && {
              overlay: {
                overlaySvg: effectiveOverlay.overlaySvg,
                overlayMetadata: effectiveOverlay.overlayMetadata,
              },
            }),
          })
        }
        break
      }

      case 'charm-node': {
        // Lazy-load charm-builder feature to avoid bundling charm code in main tailorkit.js
        const charmModule = await loadFeature('charm-builder')
        await charmModule.renderCharmNodeLayer(ctx, layer)
        break
      }

      case 'multi-layout': {
        await renderMultiLayoutLayer(ctx, layer, layerIntegration, extractedLayers)
        break
      }
    }
  }

  ctx.canvasManager.endTemplateGroup()
}

/**
 * Renders a multi-layout layer with its child layouts
 * @param ctx - The layer renderer context
 * @param layer - The multi-layout layer to render
 * @param layerIntegration - The parent layer integration data
 * @param extractedLayers - All extracted layers for visibility checks
 */
export async function renderMultiLayoutLayer(
  ctx: LayerRendererContext,
  layer: Layer,
  layerIntegration: any,
  extractedLayers: Layer[]
): Promise<void> {
  // Resolve active view (presentational only)
  const compositeLayers = layerIntegration.data.ls as Layer[]
  const os = layer.osl?.find(os => os?.t === 'multi_layout_option')

  if (!os) return

  const multiLayoutSelector = layer.optionSelectors['multi_layout_option']?.selector
  const layoutSelected = multiLayoutSelector ? multiLayoutSelector.getAttribute('value') : os.layoutSelected

  const layout = os.ol.filter((o: any) => {
    ;(o.ls || []).forEach((layerId: string) => {
      const layer = compositeLayers.find(layer => layer.i === layerId)
      ctx.toggleLayerOptions(layerId, o.v === layoutSelected && !layer?.isControlledBy)
    })
    return o.v === layoutSelected
  })[0]

  const layerIdsOfLayout: string[] = (layout?.ls || []) as string[]
  const childLayers = layerIdsOfLayout
    .map(layerId => compositeLayers.find(layer => layer.i === layerId))
    .filter(l => !!l)

  const allLayers = extractedLayers.concat(childLayers)

  for (let layerIndex = childLayers.length - 1; layerIndex > -1; layerIndex--) {
    const childLayer: Layer = childLayers[layerIndex]
    if (!ctx.isLayerVisible(childLayer, allLayers)) continue

    const isTextLayer = childLayer.t === 'text'
    const isImageLayer = childLayer.t === 'image'

    if (isTextLayer || isImageLayer) {
      const layerImage = isTextLayer
        ? await renderTextLayer(childLayer, ctx)
        : childLayer.optionSelectors['image_option']?.selector?.getAttribute('value') || childLayer.u
      const layerMask = !isTextLayer && childLayer.optionSelectors['mask_option']?.selector?.getAttribute('value')

      // Resolve overlay for image layers (option-level takes precedence)
      const effectiveOverlay = !isTextLayer ? resolveEffectiveOverlay(childLayer, layerImage) : undefined

      if (layerImage) {
        // Register as interactive before rendering (consumed by next addImageLayer)
        maybeRegisterInteractiveLayer(ctx.canvasManager, childLayer, {
          x: childLayer.ds.l,
          y: childLayer.ds.t,
          width: childLayer.ds.w,
          height: childLayer.ds.h,
          rotation: childLayer.ds.r || 0,
        })
        await ctx.canvasManager.addImageLayer({
          url: layerImage,
          x: childLayer.ds.l,
          y: childLayer.ds.t,
          width: childLayer.ds.w,
          height: childLayer.ds.h,
          rotation: childLayer.ds.r || 0,
          // For template layers, only use layer-level mask option
          maskConfig: layerMask ? { src: layerMask as string } : undefined,
          // Pass clipGroup data if it exists (for layers with inner image transformations)
          // This ensures layers with clipGroup use the correct rendering path
          ...(childLayer.ds.clipGroup && {
            clipGroup: childLayer.ds.clipGroup as any,
          }),
          // Pass overlay data for SVG compositing (from VectorEditor)
          // Prefer option-level overlay, fall back to layer-level overlay
          ...(effectiveOverlay?.overlaySvg && {
            overlay: {
              overlaySvg: effectiveOverlay.overlaySvg,
              overlayMetadata: effectiveOverlay.overlayMetadata,
            },
          }),
        })
      }
    }
  }
}

/**
 * Renders an image layer integration
 */
export async function renderImageLayerIntegration(ctx: LayerRendererContext, layerIntegration: any): Promise<void> {
  const { u, w, h, l, t, r } = layerIntegration.data

  if (u) {
    await ctx.canvasManager.addImageLayer({
      url: u,
      x: l,
      y: t,
      width: w,
      height: h,
      rotation: r,
    })
  }
}

/**
 * Renders a mask layer integration from the active view
 */
export async function renderMaskLayerIntegration(ctx: LayerRendererContext): Promise<void> {
  // Resolve active view
  const activeView = resolveActiveView(ctx)
  const maskImg = (activeView as any)?.maskImage || {}
  const viewMaskUrl = maskImg?.url || ''

  if (!viewMaskUrl) return

  const { url, l, t, w, h, r } = maskImg ?? {}
  if (url && typeof w === 'number' && typeof h === 'number') {
    await ctx.canvasManager.addImageLayer({
      url,
      x: Number(l ?? 0),
      y: Number(t ?? 0),
      width: w,
      height: h,
      rotation: Number(r ?? 0),
    })
  }
}
