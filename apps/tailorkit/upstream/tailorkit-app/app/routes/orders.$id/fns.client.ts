/* eslint-disable max-lines */
import { EOptionSet } from '~/types/psd'
import type {
  CharmNodeSettings,
  CharmProductRef,
  ImageOptionSet,
  Layer,
  MultiLayoutDataOptionSet,
  NodeImage,
  PSD,
  TextSettings,
} from '~/types/psd'
import type { LayerDocument } from '~/models/Layer.server'
import { lengthUnitToPixels } from '~/utils/lengthUnitToPixels'
import { groupOptionsByPrintAreaAndOptionSet } from '../orders._index/fns'
import { evaluateLayerContainerScaleInPrintArea } from '~/utils/canvas/evaluateScale'
import { loadTextIntoCanvas } from 'extensions/tailorkit-src/src/assets/fns/load-text-into-canvas'
import type { Shape } from 'extensions/tailorkit-src/src/assets/constants/shape'
import { isJSON } from 'extensions/tailorkit-src/src/assets/fns/is-json'
import { checkLayerInsideMultiLayout } from '~/modules/TemplateEditor/elements/fns'
import type { FulfillmentOrderStatus } from '~/constants/fulfillment-providers'
import { EPROVIDER, FULFILLMENT_PROVIDERS } from '~/constants/fulfillment-providers'
import { openInNewTab } from '~/utils/openInNewTab'
import Konva from 'konva'
import cloneDeep from 'lodash/cloneDeep'
import { KonvaCanvasManager } from 'extensions/tailorkit-src/src/shared/libraries/konva/core'
import { sanitizeTextProps } from 'extensions/tailorkit-src/src/assets/utils/render-text-layer-to-data-source'
import { isEmpty } from 'extensions/tailorkit-src/src/assets/utils/helpers'
import { isLayerOfTemplateVisible } from '~/modules/TemplateEditor/fns'
import { DEFAULT_TEXT_AUTO_FIT_TO_CONTAINER, DEFAULT_INCLUDE_FILTER_PRESETS_IN_PRINT } from '~/constants/inspector/text'
import { evaluateSelectedImageOption } from '~/utils/image-option-transforms'
import { decodeClipGroupFromPct, scaleClipGroup, type ClipGroup } from '~/utils/clip-group-transforms'
import {
  createSvgPrintDocument,
  prepareFontCss,
  imageUrlToBase64,
  isSvgSource,
  type TextLayerData,
  type ImageLayerData,
} from 'extensions/tailorkit-src/src/shared/libraries/svg'
import { CHARM_THUMB_SIZE } from '~/modules/TemplateEditor/elements/components/CharmNode/charm-node-utils'
import { getCharmKonvaPivot } from 'extensions/tailorkit-src/src/assets/features/charm-builder/charm-anchor-utils'

interface LineItem {
  admin_graphql_api_id?: string
  vendor?: string
  product?: { vendor?: string } | null
  fulfillment_order_submitted?: { orderId?: string; status?: FulfillmentOrderStatus } | null
  fulfillment_status?: FulfillmentOrderStatus | null
}

/**
 * Result of print image generation
 */
export interface PrintImageResult {
  /** PNG data URL */
  png: string | undefined
  /** SVG data URL (only if generateSvg is true) */
  svg?: string | undefined
}

/**
 * Generates a print-ready image for a given print area by rendering template layers onto a canvas.
 *
 * This function:
 * - Groups line item options by print area and option set.
 * - Initializes a Konva canvas manager for the print area.
 * - Filters out layers that are inside multi-layouts.
 * - Iterates through visible template layers and renders each onto the canvas.
 * - Exports the canvas as a PNG data URL.
 * - Optionally generates an SVG file alongside the PNG.
 * - Optionally resizes and crops the image to fit the specified print area dimensions.
 *
 * @param params - The parameters for drawing the print image.
 * @param params.PROPERTY_PREFIX - Prefix used for grouping line item properties.
 * @param params._id - The ID of the print area.
 * @param params.containerId - The container element or its ID where the canvas will be rendered.
 * @param params.properties - List of TailorKit line item properties.
 * @param params.templateConfig - Template configuration containing PSDs, layers, and dimension info.
 * @param params.printAreaDimension - (Optional) The target width and height for the print area.
 * @param params.generateSvg - (Optional) Whether to generate an SVG alongside PNG. Default: false.
 * @returns A promise that resolves to PrintImageResult with PNG and optionally SVG data URLs.
 *
 * @example
 * const result = await drawPrintImageOnCanvas({
 *   PROPERTY_PREFIX: 'custom_',
 *   _id: 'printArea123',
 *   containerId: 'canvas-container',
 *   properties: [{ name: 'custom_text', value: 'Hello' }],
 *   templateConfig: { psds: [...], layers: [...], dimension: {...} },
 *   printAreaDimension: { width: 800, height: 600 },
 *   generateSvg: true
 * });
 * console.log(result.png, result.svg);
 */
export async function drawPrintImageOnCanvas(params: {
  PROPERTY_PREFIX: string
  // The ID of the print area
  _id: string
  // The ID of the container to draw the print image on
  containerId: HTMLDivElement | string
  // A list of TailorKit line item properties
  properties: [{ name: string; value: string }]
  // Template config of the print area
  templateConfig: { psds: any[]; layers: any[]; dimension: any }
  // Dimension of the print area
  printAreaDimension?: { width: number; height: number }
  // Whether to generate SVG alongside PNG
  generateSvg?: boolean
}): Promise<PrintImageResult> {
  const {
    _id,
    containerId,
    properties,
    templateConfig,
    PROPERTY_PREFIX,
    printAreaDimension,
    generateSvg = false,
  } = params

  // Group line item options by print area and option set
  const { grouped: groupedOptions } = groupOptionsByPrintAreaAndOptionSet({ PROPERTY_PREFIX, options: properties })

  // Extract template data
  const {
    psds = [],
    layers = [],
    dimension: { width: _templateWidth = 0, height: _templateHeight = 0, resolution = 1, measurementUnit = 'px' } = {},
  } = templateConfig || {}

  const templateWidth = lengthUnitToPixels(_templateWidth, measurementUnit, resolution)
  const templateHeight = lengthUnitToPixels(_templateHeight, measurementUnit, resolution)

  const canvasWidth = templateWidth
  const canvasHeight = templateHeight

  // Init stage
  const canvasManager = new KonvaCanvasManager({
    width: canvasWidth,
    height: canvasHeight,
    containerId,
    printAreaId: _id,
    autoResize: false,
  })

  // Collect layer data for SVG generation (if enabled)
  const svgLayerData: Array<{ type: 'text' | 'image'; data: TextLayerData | ImageLayerData }> = []

  // Exclude layers inside multi-layout
  const layersWithoutInsideMultiLayout = layers.filter(layer => {
    const { isLayerInsideMultiLayout } = checkLayerInsideMultiLayout(layer, layers)

    return !isLayerInsideMultiLayout
  })

  // Count charm-node layers for backward-compat fallback logic in resolve functions
  const charmNodeCount = layersWithoutInsideMultiLayout.filter((l: Layer) => l.type === 'charm-node').length

  // Loop thru template layers to draw layer images
  for (let layerIndex = layersWithoutInsideMultiLayout?.length - 1; layerIndex > -1; layerIndex--) {
    const layer = layersWithoutInsideMultiLayout[layerIndex]
    const layerVisible = isLayerOfTemplateVisible(layer, layers)

    if (!layerVisible) {
      continue
    }

    // Detect layer visibility
    if (isLayerVisible(layer, layers, groupedOptions)) {
      // Check if layer is hidden when printing
      const layerSettings = layer.settings || {}
      const hideWhenPrinting = layerSettings.hideWhenPrinting || false

      if (hideWhenPrinting) {
        continue
      }

      // Apply customer layer transform override (Layer Interaction feature — _{propertyPrefix}_Layer_{id} properties)
      const layerTransformPropName = `_${PROPERTY_PREFIX}_Layer_${layer._id}`
      const layerTransformProp = (properties as Array<{ name: string; value: string }>).find(
        p => p.name === layerTransformPropName
      )
      let effectiveLayer = layer
      if (layerTransformProp) {
        try {
          const transform = JSON.parse(layerTransformProp.value)
          if (!transform.deleted) {
            effectiveLayer = {
              ...layer,
              left: typeof transform.x === 'number' ? transform.x : layer.left,
              top: typeof transform.y === 'number' ? transform.y : layer.top,
              width: typeof transform.w === 'number' ? transform.w : layer.width,
              height: typeof transform.h === 'number' ? transform.h : layer.height,
              rotate: typeof transform.r === 'number' ? transform.r : layer.rotate,
            }
          }
          // If transform.deleted: effectiveLayer = layer (render at default position — conservative)
        } catch {
          // Ignore invalid JSON — fall through to default position
        }
      }

      // charm-node: render all charms at slot positions using customer selections
      if (effectiveLayer.type === 'charm-node') {
        try {
          await renderCharmNodeForPrint(
            effectiveLayer,
            canvasManager,
            psds,
            resolution,
            templateWidth,
            templateHeight,
            properties as Array<{ name: string; value: string }>,
            PROPERTY_PREFIX,
            charmNodeCount
          )
          if (generateSvg) {
            const charmSvgData = await collectCharmNodeForSvg(
              effectiveLayer,
              psds,
              resolution,
              templateWidth,
              templateHeight,
              properties as Array<{ name: string; value: string }>,
              PROPERTY_PREFIX,
              charmNodeCount
            )
            if (charmSvgData) svgLayerData.push(...charmSvgData)
          }
        } catch (err) {
          console.error('[TailorKit] Failed to render charm-node layer for print:', err)
        }
        continue
      }

      // charm child layers: skip (rendered via charm-node parent above)
      if (effectiveLayer.type === 'charm') continue

      // Render layer to Konva canvas
      await renderLayer({
        allLayers: layers,
        layer: effectiveLayer,
        psds,
        resolution,
        templateHeight,
        templateWidth,
        groupedOptions,
        _id,
        canvasManager,
        hasUserTransform: !!layerTransformProp,
      })

      // Collect layer data for SVG generation (if enabled)
      if (generateSvg) {
        const layerData = await collectLayerDataForSvg({
          allLayers: layers,
          layer: effectiveLayer,
          psds,
          resolution,
          templateHeight,
          templateWidth,
          groupedOptions,
          _id,
          hasUserTransform: !!layerTransformProp,
        })
        if (layerData) {
          svgLayerData.push(...layerData)
        }
      }
    }
  }

  const konvaStage = canvasManager.getStage()

  // Get the image data url (wrap in try/catch — Konva throws if any image node has 0 dimensions)
  let imageDataUrl: string | undefined
  try {
    imageDataUrl = konvaStage?.toDataURL({
      mimeType: 'image/png',
      pixelRatio: printAreaDimension ? 1 : window.devicePixelRatio,
    })
  } catch (err) {
    console.error('[TailorKit] Failed to export canvas to image:', err)
  }

  if (imageDataUrl) {
    // Resize the print image to fit the dimension of the print area
    const { width: printAreaWidth = 0, height: printAreaHeight = 0 } = printAreaDimension || {}

    if (printAreaWidth < canvasWidth || printAreaHeight < canvasHeight) {
      await new Promise(resolve => {
        const image = new Image()
        image.src = imageDataUrl || ''

        image.onload = () => {
          // Calculate the target dimension of the print image to ensure it fits the print area
          let width = printAreaWidth
          let height = printAreaHeight

          const templateRatio = canvasWidth / canvasHeight
          const printAreaRatio = printAreaWidth / printAreaHeight

          // Resize the print image according to the following rules:
          // 1. If the print area is smaller than the canvas, resize the print image to fit the print area
          // 2. If the print area is smaller than the canvas width, resize the print image to fit the print area width
          // 3. If the print area is smaller than the canvas height, resize the print image to fit the print area height
          if (printAreaWidth < canvasWidth && printAreaHeight < canvasHeight) {
            if (printAreaRatio > templateRatio) {
              width = printAreaWidth
              height = width / templateRatio
            } else {
              height = printAreaHeight
              width = height * templateRatio
            }
          } else if (printAreaWidth < canvasWidth) {
            width = printAreaWidth
            height = width / templateRatio
          } else if (printAreaHeight < canvasHeight) {
            height = printAreaHeight
            width = height * templateRatio
          }

          // Resize the print image to fit the dimension of the print area
          const resizeCanvas = document.createElement('canvas')
          resizeCanvas.width = width
          resizeCanvas.height = height

          const resizeCtx = resizeCanvas.getContext('2d')
          document.querySelector(`#${containerId} canvas`)?.replaceWith(resizeCanvas)

          resizeCtx?.drawImage(image, 0, 0, width, height)

          // Crop the print image to fit the dimension of the print area
          let cropCanvas

          if (width > printAreaWidth || height > printAreaHeight) {
            cropCanvas = document.createElement('canvas')
            cropCanvas.width = Math.min(printAreaWidth, width)
            cropCanvas.height = Math.min(printAreaHeight, height)

            const cropCtx = cropCanvas.getContext('2d')
            document.querySelector(`#${containerId} canvas`)?.replaceWith(cropCanvas)

            cropCtx?.drawImage(
              resizeCanvas,
              (width - printAreaWidth) / 2,
              (height - printAreaHeight) / 2,
              cropCanvas.width,
              cropCanvas.height,
              0,
              0,
              cropCanvas.width,
              cropCanvas.height
            )
          }

          imageDataUrl = (cropCanvas || resizeCanvas).toDataURL('image/png')

          resolve(true)
        }
      })
    }
  }

  // Generate SVG if enabled
  let svgDataUrl: string | undefined
  if (generateSvg && svgLayerData.length > 0) {
    try {
      const svgDoc = createSvgPrintDocument({
        width: canvasWidth,
        height: canvasHeight,
      })

      for (const layerItem of svgLayerData) {
        if (layerItem.type === 'text') {
          const textData = layerItem.data as TextLayerData
          const fontCss = await prepareFontCss(textData.fontFamily, textData.fontWeight, textData.fontSrc)
          await svgDoc.addTextLayer(textData, fontCss)
        } else if (layerItem.type === 'image') {
          await svgDoc.addImageLayer(layerItem.data as ImageLayerData)
        }
      }

      svgDataUrl = svgDoc.exportAsDataUri()
    } catch (error) {
      console.error('Failed to generate SVG:', error)
    }
  }

  return {
    png: imageDataUrl,
    svg: svgDataUrl,
  }
}

let tmpCanvas: HTMLCanvasElement

export async function renderLayer(args: {
  allLayers: any[]
  layer: Layer
  psds: any[]
  resolution: number
  templateWidth: number
  templateHeight: number
  groupedOptions: any
  _id: string
  canvasManager: KonvaCanvasManager
  /** When true, user has modified layer transforms via storefront interaction — skip image option transforms */
  hasUserTransform?: boolean
}) {
  const {
    allLayers,
    layer,
    psds,
    resolution,
    templateWidth,
    templateHeight,
    groupedOptions,
    _id,
    canvasManager,
    hasUserTransform,
  } = args

  if (!layer?.visible) {
    return
  }

  // Compute scale level
  const psd = psds.find((psd: PSD) => psd._id === layer.psdId)
  const originWidth = resolution === 1 ? psd?.image.width || templateWidth : templateWidth
  const originHeight = resolution === 1 ? psd?.image.height || templateHeight : templateHeight

  const { scaleX, scaleY } = evaluateLayerContainerScaleInPrintArea(
    {
      width: templateWidth,
      height: templateHeight,
    },
    {
      width: originWidth,
      height: originHeight,
    }
  )

  // Extract necessary layer data
  const { image, top, left, width, height, rotate: layerRotation = 0 } = layer

  let imageSrc = ''
  let maskSrc = ''

  const groupedOptionsLayer = groupedOptions[_id][layer._id]

  const props = isJSON(groupedOptionsLayer) ? JSON.parse(groupedOptionsLayer) : undefined

  if (layer.type === 'multi-layout') {
    // Get layout selected from order
    const layoutSelectedId = props['optionSet'].find((ot: any) => ot.type === EOptionSet.MULTI_LAYOUT_OPTION).data[
      'multi_layout'
    ].layoutSelected

    // Get current multi layout layer
    const multiLayoutOptionSet = layer.optionSet?.find((ot: any) => ot.type === EOptionSet.MULTI_LAYOUT_OPTION)

    if (!multiLayoutOptionSet) {
      return
    }

    const multiLayoutOptionSetData = (multiLayoutOptionSet.data as MultiLayoutDataOptionSet)['multi_layout']

    // Find layout selected by id
    const layoutSelected = multiLayoutOptionSetData.layouts.find(layout => layout._id === layoutSelectedId)

    if (!layoutSelected) {
      return
    }

    const layerIds = [...layoutSelected.layerIds].reverse()

    // Loop through all layer to get layer detail by id
    for (const layerId of layerIds) {
      for (const _layer of allLayers) {
        if (_layer._id === layerId) {
          // Render layers inside layout selected
          await renderLayer({
            ...args,
            layer: _layer,
          })
        }
      }
    }
  }

  if (layer.type === 'image') {
    // Get the URL of the layer image
    const src = props?.image?.imageSrc

    imageSrc = src || (image as NodeImage)?.src

    // Get the URL of the layer mask
    maskSrc = props?.image?.maskSrc
  }

  if (layer.type === 'text') {
    // const shapeSettings = props?.shapeSettings
    const settings = props?.settings
    // Cast layer.settings to TextSettings when working with text layers for proper type safety
    const layerTextSettings = layer.settings as TextSettings | undefined

    const {
      autoFitToContainer = DEFAULT_TEXT_AUTO_FIT_TO_CONTAINER,
      content: layerContent,
      textColor: layerTextColor,
      fills: settingsFills,
      strokes: settingsStrokes,
      skipEffectsWhenPrinting = false,
    } = layerTextSettings ?? {}

    // Paint fills can be stored at layer level or in settings - check both locations
    const layerAny = layer as any
    const layerFills = settingsFills || layerAny.fills
    const layerStrokes = settingsStrokes || layerAny.strokes

    const textContent = settings?.content || layerContent
    const textColor = settings?.color?.colorValue || layerTextColor

    // For customer text: check hideWhenEmpty setting when input is empty
    const textCreatedBy = layerTextSettings?.textCreatedBy
    const hideWhenEmpty = layerTextSettings?.hideWhenEmpty ?? false
    if (textCreatedBy === 'customers' && hideWhenEmpty && isEmpty(settings?.content)) {
      return
    }

    if (textColor) {
      layer.settings = { ...(layerTextSettings || {}), textColor }
    }

    const textFontFamily = settings?.fontFamily || layerTextSettings?.fontFamily

    // Render text layer to data source
    // imageSrc = await renderTextLayerToDataSource(layer, { shape: shapeSettings?.shape || '', value: textContent })

    // Prepare text settings, conditionally stripping effects for print output
    let textSettingsForPrint = { ...(layerTextSettings || {}) }
    if (skipEffectsWhenPrinting) {
      // Strip visual effects (shadows, blur, noise) for print output
      textSettingsForPrint = {
        ...textSettingsForPrint,
        effects: undefined,
        // Also strip legacy neon effect properties
        neonMode: undefined,
        neonIntensity: undefined,
        neonOffsetX: undefined,
        neonOffsetY: undefined,
      }
    }

    const textProps = sanitizeTextProps({
      ...textSettingsForPrint,
      content: textContent,
      fill: textColor,
      fontFamily: textFontFamily,
    } as any)

    // Pass custom emoji font for PUA character rendering in print
    const emojiFont = layerTextSettings?.emojiPicker?.font
    const textNode = await canvasManager.addTextLayer({
      ...textProps,
      fills: layerFills,
      strokes: layerStrokes,
      x: left * scaleX,
      y: top * scaleY,
      width: width * scaleX,
      height: height * scaleY,
      rotation: layerRotation,
      autoFitToContainer,
      // Pass updatedAt for text layer rendering version control (required for paint fills to work)
      updatedAt: layerAny.updatedAt,
      ...(emojiFont ? { emojiFontFamily: emojiFont.family, emojiFontSrc: emojiFont.src } : {}),
    })

    // Clip buyer text to movement zone boundary (matches storefront zone clipping)
    const layerSettings = (layer.settings || {}) as { textCreatedBy?: string }
    const movementBounds = (
      layer as {
        shapeSettings?: {
          movementBounds?: {
            type?: string
            x?: number
            y?: number
            width?: number
            height?: number
            pathData?: string
          }
        }
      }
    ).shapeSettings?.movementBounds
    const isBuyerText = layerSettings.textCreatedBy === 'customers'
    if (movementBounds && textNode && isBuyerText) {
      const clipGroup = buildMovementZoneClipGroup(textNode as Konva.Node, movementBounds, scaleX, scaleY)
      canvasManager.getMainLayer().add(clipGroup)
    }

    return
  }

  if (!imageSrc) {
    return
  }

  // Determine geometry: prefer option-level ds if available
  let drawLeft = left
  let drawTop = top
  let drawWidth = width
  let drawHeight = height
  let drawRotation = layerRotation

  // Variable to hold overlay data for SVG compositing
  let overlay: { overlaySvg: string; overlayMetadata?: any } | undefined

  // Variable to hold the evaluated clipGroup
  let evaluatedClipGroup: ClipGroup | undefined

  // Get the design state of the image option
  if (layer.type === 'image') {
    // Identify which image option is selected for this order using its src
    const selectedSrc = imageSrc
    const imageOptionSet = layer.optionSet?.find(os => os.type === EOptionSet.IMAGE_OPTION)

    // Use shared function to evaluate the selected image option transform
    // IMPORTANT: Skip image option transforms when user has modified the layer via storefront interaction
    // User transforms (from _{propertyPrefix}_Layer_{id} cart properties) take priority over image option transforms
    if (!hasUserTransform) {
      const baseLayerTransform = {
        width: drawWidth,
        height: drawHeight,
        left: drawLeft,
        top: drawTop,
        rotate: drawRotation,
      }

      const computedTransform = evaluateSelectedImageOption(imageOptionSet, selectedSrc, baseLayerTransform)

      if (computedTransform) {
        drawLeft = computedTransform.left
        drawTop = computedTransform.top
        drawWidth = computedTransform.width
        drawHeight = computedTransform.height
        drawRotation = computedTransform.rotate
      }
    }

    // Evaluate clipGroup for the selected option
    // Priority 1: Check if selected option has clipGroupPct (individual mode)
    const files = (imageOptionSet?.data as any)?.files || (imageOptionSet?.data as any)?.images || []
    const selectedOption = files.find((f: ImageOptionSet) => f.src === selectedSrc) as any

    if (selectedOption?.clipGroupPct) {
      // Decode clipGroup from percentages using the computed container dimensions
      evaluatedClipGroup = decodeClipGroupFromPct(selectedOption.clipGroupPct, drawWidth, drawHeight, drawRotation)
    } else if (selectedOption?.clipGroup) {
      // Priority 2: Use option's direct clipGroup (for unedited options in individual mode)
      evaluatedClipGroup = selectedOption.clipGroup
    } else if (props?.image?.clipGroup) {
      // Priority 3: Use clipGroup from order line item properties
      evaluatedClipGroup = props.image.clipGroup
    } else if ((layer.image as NodeImage)?.clipGroup) {
      // Priority 4: Fallback to layer's default clipGroup
      evaluatedClipGroup = (layer.image as NodeImage).clipGroup as ClipGroup
    }

    // Priority 1: Get overlay from order line item properties (stored when order was placed)
    if (props?.image?.overlay?.overlaySvg) {
      overlay = {
        overlaySvg: props.image.overlay.overlaySvg,
        overlayMetadata: props.image.overlay.overlayMetadata,
      }
    }

    // Priority 2: Extract overlay from selected image option in template (fallback for older orders)
    if (!overlay && selectedOption?.overlay?.overlaySvg) {
      overlay = {
        overlaySvg: selectedOption.overlay.overlaySvg,
        overlayMetadata: selectedOption.overlay.overlayMetadata,
      }
    }

    // Priority 3: Fallback to layer-level overlay (for image layers without option sets)
    // Note: VectorEditor stores overlay in layer.settings.overlay, NOT layer.image
    if (!overlay) {
      const layerSettings = layer.settings as any
      if (layerSettings?.overlay?.overlaySvg) {
        overlay = {
          overlaySvg: layerSettings.overlay.overlaySvg,
          overlayMetadata: layerSettings.overlay.overlayMetadata,
        }
      }
    }
  }

  // Scale clipGroup if it exists
  const scaledClipGroup = evaluatedClipGroup ? scaleClipGroup(evaluatedClipGroup, scaleX, scaleY) : undefined

  // Read includeFilterPresetsInPrint setting from layer settings
  // When true, filter presets (debossing, embossing, hot-foil-stamping, laser-engraving) are included in print
  // When false (default), filter presets are skipped as they are for visualization only
  const layerSettings = layer.settings || {}
  const includeFilterPresetsInPrint
    = (layerSettings as any).includeFilterPresetsInPrint ?? DEFAULT_INCLUDE_FILTER_PRESETS_IN_PRINT

  // Draw layer images
  await canvasManager.addImageLayer({
    url: imageSrc,
    x: drawLeft * scaleX,
    y: drawTop * scaleY,
    width: drawWidth * scaleX,
    height: drawHeight * scaleY,
    rotation: drawRotation,
    clipGroup: scaledClipGroup as any,
    maskConfig: {
      src: maskSrc,
    },
    overlay,
    skipFilterPresets: !includeFilterPresetsInPrint,
  })
}

// ---------------------------------------------------------------------------
// Charm-node print rendering — mirrors storefront charm-layer-renderer logic.
// Uses charm-node parent (slot positions + per-product sizes) + customer
// selections from order properties. Does NOT use charm child layers because:
// 1. Child count may differ from customer selection count
// 2. Child left/top use admin offset conventions, not storefront slot positions
// 3. Storefront computes sizes with print-area uniformScale baked in
// ---------------------------------------------------------------------------

type CharmPrintInstance = { thumbnailUrl: string; x: number; y: number; size: number; rotation: number }

/**
 * Try to read charm data from the consolidated _TLK_charms (or _PF_charms) property for a specific layer.
 * The consolidated property stores all charm selections keyed by layerId:
 * { [layerId]: { products: { [productId]: { variantId, qty, unitPrice } }, slots?: [...], positions?: [...] } }
 */
function getConsolidatedCharmData(
  properties: Array<{ name: string; value: string }>,
  layerId: string
): {
  products: Record<string, { variantId?: string; qty: number }>
  slots?: (string | null)[]
  positions?: Array<{ pid: string; x: number; y: number; r: number; s: number }>
} | null {
  const prop = properties.find(p => p.name === '_TLK_charms' || p.name === '_PF_charms')
  if (!prop?.value) return null
  try {
    const all = JSON.parse(prop.value)
    return all[layerId] || null
  } catch (error) {
    console.warn('[TailorKit] Failed to parse consolidated _TLK_charms property', { layerId })
    return null
  }
}

/**
 * Resolve which charms to render and where, from charm-node settings + order properties.
 * Follows the same slot-filling logic as the storefront charm-layer-renderer.
 */
export function resolveCharmInstances(
  layer: Layer,
  properties: Array<{ name: string; value: string }>,
  propertyPrefix: string,
  charmNodeCount: number
): CharmPrintInstance[] {
  const settings = layer.settings as CharmNodeSettings | undefined
  if (!settings) return []

  const linkedProducts = settings.linkedProducts || []
  const nodes = settings.nodes || []
  const displayStyle = settings.displayStyle || 'FIXED'
  if (linkedProducts.length === 0) return []
  if (displayStyle === 'FIXED' && nodes.length === 0) return []

  // Build product lookup: shopifyProductId → CharmProductRef
  const productById = new Map<string, (typeof linkedProducts)[0]>()
  for (const p of linkedProducts) {
    if (p.shopifyProductId) productById.set(p.shopifyProductId, p)
  }

  // FREE mode: positions come from order properties (no slot nodes)
  if (displayStyle === 'FREE') {
    return resolveFreeModeInstances(settings, properties, propertyPrefix, productById, layer._id, charmNodeCount)
  }

  // Per-product charm size — mirrors storefront preparation logic:
  // 1. Product's own transform scale (if any placed on canvas)
  // 2. Merchant's defaultCharmSize setting (converted to scale: px / CHARM_THUMB_SIZE)
  // 3. Fallback to CHARM_THUMB_SIZE (scale = 1)
  const defaultScale = settings.defaultCharmSize ? settings.defaultCharmSize / CHARM_THUMB_SIZE : 1
  const getProductSize = (product: (typeof linkedProducts)[0]) =>
    CHARM_THUMB_SIZE * (product.transforms?.[0]?.scale || defaultScale)

  // Anchor Y offset for print: top = 0 (hang below), center = -half, bottom = -full
  const anchorPos = settings.anchorPosition
  const anchorYOffset = (sz: number) => (anchorPos === 'center' ? -sz / 2 : anchorPos === 'bottom' ? -sz : 0)

  // Resolution strategy (scoped-first with backward-compat fallback):
  // 1. Try consolidated _TLK_charms / _PF_charms property (new multi-charm format)
  // 2. Try scoped individual key: _${PREFIX}_charm_slots_${layerId}
  // 3. Fallback to unscoped key: _${PREFIX}_charm_slots  (only when single charm-node — unambiguous)
  // 4. If multi charm-node and only unscoped keys: skip + warn (safe degradation)
  let perSlotProductIds: (string | null)[] | null = null

  // 1. Try consolidated property
  const consolidated = getConsolidatedCharmData(properties, layer._id)
  if (consolidated) {
    if (consolidated.slots) {
      perSlotProductIds = consolidated.slots
    } else if (consolidated.products) {
      // Build slot list from products map using qty
      const queue: string[] = []
      for (const [pid, data] of Object.entries(consolidated.products)) {
        const qty = data.qty || 1
        for (let i = 0; i < qty; i++) queue.push(pid)
      }
      if (queue.length > 0) perSlotProductIds = queue
    }
  }

  // 2 & 3. Try scoped then legacy slots property
  if (!perSlotProductIds) {
    const scopedSlotsName = `_${propertyPrefix}_charm_slots_${layer._id}`
    let slotsProp = properties.find(p => p.name === scopedSlotsName)

    if (!slotsProp) {
      if (charmNodeCount <= 1) {
        // Fallback: unscoped (pre-multi orders, unambiguous)
        slotsProp = properties.find(p => p.name === `_${propertyPrefix}_charm_slots`)
      } else {
        // Multi charm-node with no scoped data — will check per-product legacy keys below
      }
    }

    if (slotsProp?.value) {
      try {
        const parsed = JSON.parse(slotsProp.value)
        if (Array.isArray(parsed)) perSlotProductIds = parsed
      } catch {
        /* fall through to legacy per-product keys */
      }
    }
  }

  // Legacy: parse aggregate charm selections from order properties: _${PREFIX}_charm_${productId}
  // For scoped format: _${PREFIX}_charm_${layerId}_${productId} (layerId = 24-char hex)
  const prefix = `_${propertyPrefix}_charm_`
  const selectionQueue: string[] = []
  if (!perSlotProductIds) {
    const scopedProductPrefix = `_${propertyPrefix}_charm_${layer._id}_`
    const hasScopedProductKeys = properties.some(p => p.name?.startsWith(scopedProductPrefix))

    if (hasScopedProductKeys) {
      // New scoped per-product keys for this layer
      for (const prop of properties) {
        if (prop.name?.startsWith(scopedProductPrefix)) {
          const pid = prop.name.slice(scopedProductPrefix.length)
          let qty = 1
          try {
            qty = JSON.parse(prop.value).qty || 1
          } catch {
            /* default 1 */
          }
          for (let i = 0; i < qty; i++) selectionQueue.push(pid)
        }
      }
    } else if (charmNodeCount <= 1) {
      // Legacy unscoped per-product keys — only safe for single charm-node
      for (const prop of properties) {
        if (prop.name?.startsWith(prefix) && !prop.name.endsWith('_slots') && !prop.name.endsWith('_positions')) {
          const afterPrefix = prop.name.slice(prefix.length)
          // Skip if this looks like a scoped key: 24-char hex followed by '_'
          if (/^[0-9a-f]{24}_/.test(afterPrefix)) continue
          const pid = afterPrefix
          let qty = 1
          try {
            qty = JSON.parse(prop.value).qty || 1
          } catch {
            /* default 1 */
          }
          for (let i = 0; i < qty; i++) selectionQueue.push(pid)
        }
      }
    } else {
      // Multi charm-node template with unscoped legacy order data — cannot resolve safely
      console.warn(
        '[TailorKit] Multi charm-node template with legacy unscoped order properties — skipping ambiguous resolution for layer',
        layer._id
      )
      return []
    }
  }

  // Build lookup for customer drag overrides: _${PREFIX}_Layer_charm-<nodeId>-<slotIdx>
  // When customer drags a charm to a different slot, the storefront saves the new position.
  const transformPrefix = `_${propertyPrefix}_Layer_charm-${layer._id}-`
  const slotTransforms = new Map<number, { x: number; y: number; w: number; h: number }>()
  for (const prop of properties) {
    if (prop.name?.startsWith(transformPrefix)) {
      const slotIdx = parseInt(prop.name.slice(transformPrefix.length), 10)
      if (isNaN(slotIdx)) continue
      try {
        const t = JSON.parse(prop.value)
        if (!t.deleted) slotTransforms.set(slotIdx, t)
      } catch {
        /* ignore invalid */
      }
    }
  }

  const instances: CharmPrintInstance[] = []

  if (perSlotProductIds && perSlotProductIds.length > 0) {
    // Per-slot mapping: exact user click order preserved
    for (let i = 0; i < nodes.length && i < perSlotProductIds.length; i++) {
      const pid = perSlotProductIds[i]
      if (!pid) continue
      const product = productById.get(pid)
      if (!product?.thumbnailUrl) continue
      const size = getProductSize(product)
      const slotRotation = nodes[i].rotation || 0

      const override = slotTransforms.get(i)
      if (override) {
        instances.push({
          thumbnailUrl: product.thumbnailUrl,
          x: override.x + (override.w || size) / 2,
          y: override.y,
          size: override.w || size,
          rotation: slotRotation,
        })
      } else {
        instances.push({
          thumbnailUrl: product.thumbnailUrl,
          x: nodes[i].x,
          y: nodes[i].y + anchorYOffset(size),
          size,
          rotation: slotRotation,
        })
      }
    }
  } else if (selectionQueue.length > 0) {
    // Legacy: fill slots sequentially from aggregate quantities
    for (let i = 0; i < nodes.length && selectionQueue.length > 0; i++) {
      const product = productById.get(selectionQueue.shift()!)
      if (!product?.thumbnailUrl) continue
      const size = getProductSize(product)
      const slotRotation = nodes[i].rotation || 0

      const override = slotTransforms.get(i)
      if (override) {
        instances.push({
          thumbnailUrl: product.thumbnailUrl,
          x: override.x + (override.w || size) / 2,
          y: override.y,
          size: override.w || size,
          rotation: slotRotation,
        })
      } else {
        instances.push({
          thumbnailUrl: product.thumbnailUrl,
          x: nodes[i].x,
          y: nodes[i].y + anchorYOffset(size),
          size,
          rotation: slotRotation,
        })
      }
    }
  } else {
    // No customer selections → render defaults (if configured)
    for (let i = 0; i < nodes.length; i++) {
      const slot = nodes[i]
      const product = slot.defaultCharm ? linkedProducts.find(p => p._id === slot.defaultCharm?._id) : null
      if (!product?.thumbnailUrl) continue
      const size = getProductSize(product)
      instances.push({
        thumbnailUrl: product.thumbnailUrl,
        x: slot.x,
        y: slot.y + anchorYOffset(size),
        size,
        rotation: slot.rotation || 0,
      })
    }
  }

  return instances
}

/**
 * Resolve charm instances for FREE mode — positions come from order properties,
 * not from slot nodes. Reads `_{propertyPrefix}_charm_positions` first, falls back to admin
 * `tr[]` (transforms) from linked product settings.
 */
function resolveFreeModeInstances(
  settings: CharmNodeSettings,
  properties: Array<{ name: string; value: string }>,
  propertyPrefix: string,
  productById: Map<string, CharmProductRef>,
  layerId?: string,
  charmNodeCount = 1
): CharmPrintInstance[] {
  const defaultScale = settings.defaultCharmSize ? settings.defaultCharmSize / CHARM_THUMB_SIZE : 1

  // Build buyer drag overrides: _${PREFIX}_Layer_charm-free-${layerId}-${idx}
  // StorefrontInteractiveCanvasManager saves these when buyer drags/resizes/rotates charms
  const dragOverrides = new Map<number, { x: number; y: number; w?: number; h?: number; rotation?: number }>()
  if (layerId) {
    const dragPrefix = `_${propertyPrefix}_Layer_charm-free-${layerId}-`
    for (const prop of properties) {
      if (prop.name?.startsWith(dragPrefix)) {
        const idx = parseInt(prop.name.slice(dragPrefix.length), 10)
        if (isNaN(idx)) continue
        try {
          const t = JSON.parse(prop.value)
          if (!t.deleted) dragOverrides.set(idx, t)
        } catch {
          /* ignore */
        }
      }
    }
  }

  // Resolution strategy for FREE mode positions (scoped-first with backward-compat fallback):
  // 1. Try consolidated _TLK_charms / _PF_charms property (new multi-charm format)
  // 2. Try scoped: _${PREFIX}_charm_positions_${layerId}
  // 3. Fallback to unscoped: _${PREFIX}_charm_positions (only when single charm-node)
  let resolvedPositions: Array<{ pid: string; x: number; y: number; r: number; s: number }> | null = null

  if (layerId) {
    // 1. Try consolidated property
    const consolidated = getConsolidatedCharmData(properties, layerId)
    if (consolidated?.positions) {
      resolvedPositions = consolidated.positions
    }

    // 2 & 3. Try scoped then legacy positions property
    if (!resolvedPositions) {
      const scopedPosName = `_${propertyPrefix}_charm_positions_${layerId}`
      let posPropCandidate = properties.find(p => p.name === scopedPosName)

      if (!posPropCandidate && charmNodeCount <= 1) {
        // Fallback: unscoped (pre-multi orders, unambiguous)
        posPropCandidate = properties.find(p => p.name === `_${propertyPrefix}_charm_positions`)
      }

      if (posPropCandidate?.value) {
        try {
          const parsed = JSON.parse(posPropCandidate.value)
          if (Array.isArray(parsed)) resolvedPositions = parsed
        } catch {
          /* fall through to defaults */
        }
      }
    }

    if (!resolvedPositions && charmNodeCount > 1) {
      // Multi charm-node with only unscoped legacy data — cannot resolve safely
      console.warn(
        '[TailorKit] Multi charm-node template with legacy unscoped order properties — skipping ambiguous FREE mode resolution for layer',
        layerId
      )
      return []
    }
  }

  // Render from resolvedPositions (consolidated, scoped, or legacy unscoped)
  if (resolvedPositions) {
    const instances: CharmPrintInstance[] = []
    for (let idx = 0; idx < resolvedPositions.length; idx++) {
      const pos = resolvedPositions[idx]
      const product = productById.get(pos.pid)
      if (!product?.thumbnailUrl) continue
      const size = CHARM_THUMB_SIZE * (pos.s || defaultScale)

      // Merge buyer drag override if available (buyer moved/resized/rotated after initial placement)
      const override = dragOverrides.get(idx)
      if (override) {
        instances.push({
          thumbnailUrl: product.thumbnailUrl,
          x: override.x + (override.w || size) / 2,
          y: override.y,
          size: override.w || size,
          rotation: override.rotation ?? pos.r ?? 0,
        })
      } else {
        // pos.x/pos.y are CENTER coordinates from freeModePositionsCache.
        // renderCharmNodeForPrint expects x as center (subtracts size/2) but y as top-left.
        // Convert center Y → top-left Y for consistent print rendering.
        instances.push({
          thumbnailUrl: product.thumbnailUrl,
          x: pos.x,
          y: pos.y - size / 2,
          size,
          rotation: pos.r || 0,
        })
      }
    }
    return instances
  }

  // Fallback: use admin tr[] positions + aggregate qty from order properties
  // (for orders placed before position serialization was added)
  if (charmNodeCount > 1) {
    // Multi charm-node with no resolved positions — cannot use unscoped legacy keys safely
    console.warn(
      '[TailorKit] Multi charm-node template with legacy unscoped order properties — skipping ambiguous FREE mode fallback for layer',
      layerId
    )
    return []
  }
  const instances: CharmPrintInstance[] = []
  const prefix = `_${propertyPrefix}_charm_`
  for (const prop of properties) {
    if (prop.name?.startsWith(prefix) && !prop.name.endsWith('_slots') && !prop.name.endsWith('_positions')) {
      const afterPrefix = prop.name.slice(prefix.length)
      // Skip scoped keys: 24-char hex layerId followed by '_'
      if (/^[0-9a-f]{24}_/.test(afterPrefix)) continue
      const pid = afterPrefix
      const product = productById.get(pid)
      if (!product?.thumbnailUrl) continue
      let qty = 1
      try {
        qty = JSON.parse(prop.value).qty || 1
      } catch {
        /* default 1 */
      }
      const transforms = product.transforms || []
      for (let i = 0; i < qty; i++) {
        const tr = transforms[i]
        const scale = tr?.scale || defaultScale
        instances.push({
          thumbnailUrl: product.thumbnailUrl,
          x: tr?.x ?? 0,
          y: tr?.y ?? 0,
          size: CHARM_THUMB_SIZE * scale,
          rotation: tr?.rotation || 0,
        })
      }
    }
  }
  return instances
}

/** Render charm-node layer onto Konva canvas for PNG export. */
async function renderCharmNodeForPrint(
  layer: Layer,
  canvasManager: KonvaCanvasManager,
  psds: any[],
  resolution: number,
  templateWidth: number,
  templateHeight: number,
  properties: Array<{ name: string; value: string }>,
  propertyPrefix: string,
  charmNodeCount = 1
) {
  const psd = psds.find((p: PSD) => p._id === layer.psdId)
  const originW = resolution === 1 ? psd?.image.width || templateWidth : templateWidth
  const originH = resolution === 1 ? psd?.image.height || templateHeight : templateHeight
  const { scaleX, scaleY } = evaluateLayerContainerScaleInPrintArea(
    { width: templateWidth, height: templateHeight },
    { width: originW, height: originH }
  )

  // Storefront positioning: X centered on slot, Y offset per anchorPosition setting.
  // Pivot the rotation at the slot anchor point (top / center / bottom of the charm
  // bbox) so admin-configured slot rotation matches editor + storefront behavior.
  const anchorPosition = (layer.settings as CharmNodeSettings | undefined)?.anchorPosition

  for (const c of resolveCharmInstances(layer, properties, propertyPrefix, charmNodeCount)) {
    try {
      const renderWidth = c.size * scaleX
      const renderHeight = c.size * scaleY
      const pivot = getCharmKonvaPivot(anchorPosition, c.size)
      await canvasManager.addImageLayer({
        url: c.thumbnailUrl,
        x: (c.x - c.size / 2) * scaleX,
        y: c.y * scaleY,
        width: renderWidth,
        height: renderHeight,
        rotation: c.rotation,
        // Helper returns unscaled pivot in source units; print renders at (scaleX,
        // scaleY), so scale offsetY by scaleY (offsetX matches renderWidth/2 already).
        rotationOrigin: {
          offsetX: pivot.offsetX * scaleX,
          offsetY: pivot.offsetY * scaleY,
        },
      })
    } catch (err) {
      console.warn('[TailorKit] Failed to render charm image:', c.thumbnailUrl, err)
    }
  }
}

/** Collect charm-node layer data for SVG export. */
async function collectCharmNodeForSvg(
  layer: Layer,
  psds: any[],
  resolution: number,
  templateWidth: number,
  templateHeight: number,
  properties: Array<{ name: string; value: string }>,
  propertyPrefix: string,
  charmNodeCount = 1
): Promise<Array<{ type: 'image'; data: ImageLayerData }> | null> {
  const psd = psds.find((p: PSD) => p._id === layer.psdId)
  const originW = resolution === 1 ? psd?.image.width || templateWidth : templateWidth
  const originH = resolution === 1 ? psd?.image.height || templateHeight : templateHeight
  const { scaleX, scaleY } = evaluateLayerContainerScaleInPrintArea(
    { width: templateWidth, height: templateHeight },
    { width: originW, height: originH }
  )

  const anchorPosition = (layer.settings as CharmNodeSettings | undefined)?.anchorPosition

  const result: Array<{ type: 'image'; data: ImageLayerData }> = []
  for (const c of resolveCharmInstances(layer, properties, propertyPrefix, charmNodeCount)) {
    const base64 = await imageUrlToBase64(c.thumbnailUrl).catch(() => '')
    if (!base64) continue
    const renderWidth = c.size * scaleX
    const renderHeight = c.size * scaleY
    const pivot = getCharmKonvaPivot(anchorPosition, c.size)
    result.push({
      type: 'image',
      data: {
        src: base64,
        x: (c.x - c.size / 2) * scaleX,
        y: c.y * scaleY,
        width: renderWidth,
        height: renderHeight,
        rotation: c.rotation,
        // Match editor + storefront via the shared pivot helper, scaled into print units.
        rotationOrigin: {
          offsetX: pivot.offsetX * scaleX,
          offsetY: pivot.offsetY * scaleY,
        },
      } as ImageLayerData,
    })
  }
  return result.length > 0 ? result : null
}

/**
 * Extract drop shadows and inner shadows from effects array
 */
function extractShadowEffects(effects?: any[]): {
  dropShadows: any[]
  innerShadows: any[]
} {
  const dropShadows: any[] = []
  const innerShadows: any[] = []

  if (!effects || !Array.isArray(effects)) {
    return { dropShadows, innerShadows }
  }

  for (const effect of effects) {
    if (effect.type === 'DROP_SHADOW' && effect.visible !== false) {
      dropShadows.push(effect)
    } else if (effect.type === 'INNER_SHADOW' && effect.visible !== false) {
      innerShadows.push(effect)
    }
  }

  return { dropShadows, innerShadows }
}

/**
 * Collect layer data for SVG generation
 * Extracts the same data used by renderLayer but formats it for SVG builder
 */
async function collectLayerDataForSvg(args: {
  allLayers: any[]
  layer: Layer
  psds: any[]
  resolution: number
  templateWidth: number
  templateHeight: number
  groupedOptions: any
  _id: string
  /** When true, user has modified layer transforms via storefront interaction — skip image option transforms */
  hasUserTransform?: boolean
}): Promise<Array<{ type: 'text' | 'image'; data: TextLayerData | ImageLayerData }> | null> {
  const { allLayers, layer, psds, resolution, templateWidth, templateHeight, groupedOptions, _id, hasUserTransform }
    = args

  if (!layer?.visible) {
    return null
  }

  // Compute scale level (same as renderLayer)
  const psd = psds.find((psd: PSD) => psd._id === layer.psdId)
  const originWidth = resolution === 1 ? psd?.image.width || templateWidth : templateWidth
  const originHeight = resolution === 1 ? psd?.image.height || templateHeight : templateHeight

  const { scaleX, scaleY } = evaluateLayerContainerScaleInPrintArea(
    { width: templateWidth, height: templateHeight },
    { width: originWidth, height: originHeight }
  )

  const { image, top, left, width, height, rotate: layerRotation = 0 } = layer
  const groupedOptionsLayer = groupedOptions[_id][layer._id]
  const props = isJSON(groupedOptionsLayer) ? JSON.parse(groupedOptionsLayer) : undefined

  const result: Array<{ type: 'text' | 'image'; data: TextLayerData | ImageLayerData }> = []

  // Handle multi-layout layers recursively
  if (layer.type === 'multi-layout') {
    const layoutSelectedId = props?.['optionSet']?.find((ot: any) => ot.type === EOptionSet.MULTI_LAYOUT_OPTION)
      ?.data?.['multi_layout']?.layoutSelected

    const multiLayoutOptionSet = layer.optionSet?.find((ot: any) => ot.type === EOptionSet.MULTI_LAYOUT_OPTION)
    if (!multiLayoutOptionSet) return null

    const multiLayoutOptionSetData = (multiLayoutOptionSet.data as MultiLayoutDataOptionSet)['multi_layout']
    const layoutSelected = multiLayoutOptionSetData.layouts.find(layout => layout._id === layoutSelectedId)
    if (!layoutSelected) return null

    const layerIds = [...layoutSelected.layerIds].reverse()

    for (const layerId of layerIds) {
      for (const _layer of allLayers) {
        if (_layer._id === layerId) {
          const childData = await collectLayerDataForSvg({ ...args, layer: _layer })
          if (childData) {
            result.push(...childData)
          }
        }
      }
    }

    return result.length > 0 ? result : null
  }

  // Handle text layers
  if (layer.type === 'text') {
    const settings = props?.settings
    const layerTextSettings = layer.settings as TextSettings | undefined

    const {
      content: layerContent,
      textColor: layerTextColor,
      fontFamily: layerFontFamilyObj,
      fontSize: layerFontSize,
      textStyle: layerTextStyle,
      strokeColor: layerStrokeColor,
      strokeWeight: layerStrokeWeight,
      letterSpacing: layerLetterSpacing,
      lineHeight: layerLineHeight,
      textAlign: layerAlign,
      verticalAlign: layerVerticalAlign,
      wrap: layerWrap,
      textShape: layerTextShape,
      fillShapePathData: layerFillShapePathData,
      fillShapeMetadata: layerFillShapeMetadata,
      fillShapeVerticalOffset: layerFillShapeVerticalOffset,
      fillShapeVerticalScale: layerFillShapeVerticalScale,
      fillShapeHorizontalOffset: layerFillShapeHorizontalOffset,
      fillShapeHorizontalScale: layerFillShapeHorizontalScale,
      fillShapeCharacterSpacing: layerFillShapeCharacterSpacing,
      circleStartAngle: layerCircleStartAngle,
      circleEndAngle: layerCircleEndAngle,
      circleInverted: layerCircleInverted,
      curvePeaks: layerCurvePeaks,
      curveBend: layerCurveBend,
      customPathData: layerCustomPathData,
      customPathMetadata: layerCustomPathMetadata,
      customPathInverted: layerCustomPathInverted,
      effects: layerEffects,
      fills: layerFills,
      strokes: layerStrokes,
      skipEffectsWhenPrinting: layerSkipEffectsWhenPrinting = false,
    } = layerTextSettings ?? {}

    // Extract font family string and source from the fontFamily object
    // TextSettings.fontFamily is { family: string; src: string }
    const layerFontFamily = typeof layerFontFamilyObj === 'object' ? layerFontFamilyObj?.family : layerFontFamilyObj
    const layerFontSrc = typeof layerFontFamilyObj === 'object' ? layerFontFamilyObj?.src : undefined

    // Extract font style (bold, italic) from textStyle array
    const textStyleArr = layerTextStyle || []
    const fontStyleLower = textStyleArr.filter((s: string) => s !== 'normal' && s !== 'underline').join(' ')
    const hasUnderline = textStyleArr.includes('underline')
    const hasBold = textStyleArr.includes('bold')

    const textContent = settings?.content || layerContent
    const textColor = settings?.color?.colorValue || layerTextColor || '#000000'
    const textFontFamily = settings?.fontFamily || layerFontFamily || 'Arial'

    // Check hideWhenEmpty for customer text
    const textCreatedBy = layerTextSettings?.textCreatedBy
    const hideWhenEmpty = layerTextSettings?.hideWhenEmpty ?? false
    if (textCreatedBy === 'customers' && hideWhenEmpty && isEmpty(settings?.content)) {
      return null
    }

    // Extract drop shadows and inner shadows from effects array (unless skipEffectsWhenPrinting is enabled)
    const { dropShadows, innerShadows } = layerSkipEffectsWhenPrinting
      ? { dropShadows: undefined, innerShadows: undefined }
      : extractShadowEffects(layerEffects)

    // Get fills from layer or settings
    const layerAny = layer as any
    const fills = layerFills || layerAny.fills
    const strokes = layerStrokes || layerAny.strokes

    const textLayerData: TextLayerData = {
      content: textContent || '',
      x: left * scaleX,
      y: top * scaleY,
      width: width * scaleX,
      height: height * scaleY,
      rotation: layerRotation,
      fontSize: layerFontSize || 16,
      fontFamily: textFontFamily,
      fontWeight: hasBold ? 'bold' : undefined,
      fontStyle: fontStyleLower || undefined,
      fontSrc: layerFontSrc,
      color: textColor,
      letterSpacing: layerLetterSpacing,
      lineHeight: layerLineHeight,
      align: layerAlign as TextLayerData['align'],
      verticalAlign: layerVerticalAlign as TextLayerData['verticalAlign'],
      wrap: layerWrap as TextLayerData['wrap'],
      textDecoration: hasUnderline ? 'underline' : undefined,
      stroke: layerStrokeColor,
      strokeWidth: layerStrokeWeight,
      strokes,
      fill: fills?.[0], // Pass first fill as primary fill
      dropShadows,
      innerShadows,
      textShape: layerTextShape as TextLayerData['textShape'],
      fillShapePathData: layerFillShapePathData,
      fillShapeMetadata: layerFillShapeMetadata,
      fillShapeVerticalOffset: layerFillShapeVerticalOffset,
      fillShapeVerticalScale: layerFillShapeVerticalScale,
      fillShapeHorizontalOffset: layerFillShapeHorizontalOffset,
      fillShapeHorizontalScale: layerFillShapeHorizontalScale,
      fillShapeCharacterSpacing: layerFillShapeCharacterSpacing,
      circleStartAngle: layerCircleStartAngle,
      circleEndAngle: layerCircleEndAngle,
      circleInverted: layerCircleInverted,
      curvePeaks: layerCurvePeaks,
      curveBend: layerCurveBend,
      customPathData: layerCustomPathData,
      customPathMetadata: layerCustomPathMetadata,
      customPathInverted: layerCustomPathInverted,
    }

    result.push({ type: 'text', data: textLayerData })
    return result
  }

  // Handle image layers
  if (layer.type === 'image') {
    const src = props?.image?.imageSrc
    const imageSrc = src || (image as NodeImage)?.src

    if (!imageSrc) {
      return null
    }

    // Determine geometry (same as renderLayer)
    let drawLeft = left
    let drawTop = top
    let drawWidth = width
    let drawHeight = height
    let drawRotation = layerRotation

    const selectedSrc = imageSrc
    const imageOptionSet = layer.optionSet?.find(os => os.type === EOptionSet.IMAGE_OPTION)

    // Skip image option transforms when user has modified the layer via storefront interaction
    // User transforms (from _{propertyPrefix}_Layer_{id} cart properties) take priority over image option transforms
    if (!hasUserTransform) {
      const baseLayerTransform = {
        width: drawWidth,
        height: drawHeight,
        left: drawLeft,
        top: drawTop,
        rotate: drawRotation,
      }

      const computedTransform = evaluateSelectedImageOption(imageOptionSet, selectedSrc, baseLayerTransform)

      if (computedTransform) {
        drawLeft = computedTransform.left
        drawTop = computedTransform.top
        drawWidth = computedTransform.width
        drawHeight = computedTransform.height
        drawRotation = computedTransform.rotate
      }
    }

    // Extract overlay data (same priority as renderLayer)
    let overlay: { overlaySvg: string; overlayMetadata?: any } | undefined

    // Get the selected image option for overlay lookup
    const files = (imageOptionSet?.data as any)?.files || (imageOptionSet?.data as any)?.images || []
    const selectedOption = files.find((f: ImageOptionSet) => f.src === selectedSrc) as any

    // Priority 1: Get overlay from order line item properties (stored when order was placed)
    if (props?.image?.overlay?.overlaySvg) {
      overlay = {
        overlaySvg: props.image.overlay.overlaySvg,
        overlayMetadata: props.image.overlay.overlayMetadata,
      }
    }

    // Priority 2: Extract overlay from selected image option in template (fallback for older orders)
    if (!overlay && selectedOption?.overlay?.overlaySvg) {
      overlay = {
        overlaySvg: selectedOption.overlay.overlaySvg,
        overlayMetadata: selectedOption.overlay.overlayMetadata,
      }
    }

    // Priority 3: Fallback to layer-level overlay (for image layers without option sets)
    // VectorEditor stores overlay in layer.settings.overlay
    if (!overlay) {
      const layerSettings = layer.settings as any
      if (layerSettings?.overlay?.overlaySvg) {
        overlay = {
          overlaySvg: layerSettings.overlay.overlaySvg,
          overlayMetadata: layerSettings.overlay.overlayMetadata,
        }
      }
    }

    // Convert image to base64 for SVG embedding (skip SVG files to preserve vector data)
    let base64DataUri: string | undefined
    if (!isSvgSource(imageSrc)) {
      try {
        base64DataUri = await imageUrlToBase64(imageSrc)
      } catch (error) {
        console.warn('Failed to convert image to base64 for SVG:', error)
      }
    }

    // Read includeFilterPresetsInPrint setting from layer settings
    const layerSettings = layer.settings || {}
    const includeFilterPresetsInPrint
      = (layerSettings as any).includeFilterPresetsInPrint ?? DEFAULT_INCLUDE_FILTER_PRESETS_IN_PRINT

    const imageLayerData: ImageLayerData = {
      src: imageSrc,
      x: drawLeft * scaleX,
      y: drawTop * scaleY,
      width: drawWidth * scaleX,
      height: drawHeight * scaleY,
      rotation: drawRotation,
      base64DataUri,
      overlay: overlay
        ? {
            overlaySvg: overlay.overlaySvg,
            overlayMetadata: overlay.overlayMetadata,
          }
        : undefined,
      skipFilterPresets: !includeFilterPresetsInPrint,
    }

    result.push({ type: 'image', data: imageLayerData })
    return result
  }

  return null
}

export async function renderTextLayerToDataSource(
  layer: LayerDocument,
  textOption: { value: string; shape: Shape }
): Promise<string> {
  const { width = 0, height = 0, settings: { content = '', fontFamily, ...otherStyle } = {} } = layer
  const { value: textValue, shape } = textOption

  // Init a canvas once to draw the text layer
  if (!tmpCanvas) {
    tmpCanvas = document.createElement('canvas')
  }

  tmpCanvas.width = width
  tmpCanvas.height = height

  // Get a context to draw the text layer
  const context = tmpCanvas.getContext('2d')

  if (context) {
    context.clearRect(0, 0, width, height)

    const textContent = textValue || (content as string)

    const url = await loadTextIntoCanvas(context, {
      width,
      height,
      textContent,
      style: {
        fontFamily: typeof fontFamily === 'string' ? { family: fontFamily, src: '' } : fontFamily,
        ...(otherStyle as any),
      },
      shape,
    })

    return url
  }

  return tmpCanvas.toDataURL()
}

/**
 * Helper function to check conditional logic for the visibility of a layer
 */
function isLayerVisible(layer: LayerDocument, allLayers: LayerDocument[], selectedOptions: any): boolean {
  const { _id, conditionalLogic: { isControlledBy } = {} } = layer
  let visible = !_id || !isControlledBy?.length

  if (_id && isControlledBy?.length) {
    const controllers = isControlledBy.map((cId: string) => allLayers.find(l => l._id === cId))

    controllers.forEach((controller: any) => {
      const { conditionalLogic: { controls: { action, conditions = [] } = {} } = {} } = controller || {}
      const controllerVisible = isLayerVisible(controller, allLayers, selectedOptions)
      visible = action === 'hide'

      for (const printAreaId in selectedOptions) {
        for (const layerId in selectedOptions[printAreaId]) {
          try {
            const option = JSON.parse(selectedOptions[printAreaId][layerId])
            const matchedCondition = conditions?.find((c: any) => c.ifOptionSelected === option.selectedOptionId)
            const { thenShowOrHideLayers } = matchedCondition || {}

            if (thenShowOrHideLayers?.includes(_id)) {
              visible = controllerVisible && action === 'show'

              break
            }
          } catch (e: any) {
            // Do nothing
          }
        }
      }
    })
  }

  return visible
}

export function openFulfillmentProvider(id: string, shop_id: string, vendor: EPROVIDER) {
  switch (vendor) {
    case EPROVIDER.PRINTIFY: {
      const HOST = 'https://printify.com'
      // url: https://printify.com/app/store/16458805/order/673c3d1cccdd76e6ea074906
      openInNewTab(`${HOST}/app/store/${shop_id}/order/${id}`)
    }
  }
}

export function getStatusFulfillmentOrder(line_items: LineItem[]): FulfillmentOrderStatus {
  const statuses = line_items
    .map((line_item: LineItem) => {
      const { fulfillment_order_submitted, fulfillment_status } = line_item

      // Get fulfillment order submitted properties
      const fulfillmentOrderSubmittedOrderId = fulfillment_order_submitted?.orderId
      const fulfillmentOrderSubmittedStatus = fulfillmentOrderSubmittedOrderId && fulfillment_order_submitted?.status

      return fulfillmentOrderSubmittedStatus || fulfillment_status
    })
    .filter((status): status is FulfillmentOrderStatus => !!status)

  if (!statuses.length || statuses.some(status => !status || status === 'unfulfilled')) {
    return 'unfulfilled'
  }

  const uniqueStatuses = new Set(statuses)

  if (uniqueStatuses.size === 1) {
    const [status] = [...uniqueStatuses]
    return status
  }

  return 'unfulfilled'
}

export const groupLineItemsByVendor = (line_items: any[]) => {
  return line_items.reduce((grouped, line_item) => {
    const vendor = line_item.product?.vendor || line_item.vendor || ''

    if (!grouped[vendor]) {
      grouped[vendor] = [] // Initialize array if vendor group doesn't exist
    }

    grouped[vendor].push(line_item) // Add the line item to the vendor's group
    return grouped
  }, {}) // Initial value of grouped is an empty object
}

/**
 * Merge fulfillment order line items into order line items
 * And remove the line item from the default order
 *
 * @param order
 * @param fulfillmentOrders
 * @returns
 */
export const mergeFulfillmentOrderLineItemsIntoOrderLineItems = (order: any, _fulfillmentOrders: any[]) => {
  // Return if no fulfillment orders (fallback for old order version)
  if (!_fulfillmentOrders) {
    return { line_items: order.line_items, fulfillmentOrders: [], externalFulfillmentOrders: [] }
  }

  const fulfillmentOrders = cloneDeep(_fulfillmentOrders)
  const line_items = cloneDeep(order.line_items) as LineItem[]

  for (const fulfillmentOrder of fulfillmentOrders) {
    // Merge the line_item into line_items of fulfillment order
    const { lineItems: fulfillmentLineItems } = fulfillmentOrder

    for (const fulfillmentLineItem of fulfillmentLineItems) {
      const { lineItem } = fulfillmentLineItem

      const _lineItem = line_items.find(item => item.admin_graphql_api_id === lineItem.id)

      if (_lineItem) {
        // Merge the line item into the fulfillment line item
        Object.assign(lineItem, _lineItem)

        // Transform the lineItem to root level
        Object.assign(fulfillmentLineItem, lineItem)

        // Remove line item from default order
        line_items.splice(line_items.indexOf(_lineItem), 1)
      }
    }
  }

  // Remove fulfillment order that does not have line items included in FULFILLMENT_PROVIDERS
  const internalFulfillmentOrders = fulfillmentOrders.filter(fulfillmentOrder =>
    (fulfillmentOrder.lineItems as LineItem[]).some(
      lineItem => lineItem.vendor && FULFILLMENT_PROVIDERS.includes(lineItem.vendor)
    )
  )

  // Keep the external fulfillment orders
  const externalFulfillmentOrders = fulfillmentOrders.filter(
    fulfillmentOrder => !internalFulfillmentOrders.includes(fulfillmentOrder)
  )

  return {
    line_items,
    fulfillmentOrders: internalFulfillmentOrders,
    externalFulfillmentOrders,
  }
}

/**
 * Build a Konva clip group that clips content to a movement zone boundary.
 * Supports rectangle, ellipse, and custom path (hexagonal, etc.) zone shapes.
 * Reparents the given node into the clip group with zone-local positioning.
 */
function buildMovementZoneClipGroup(
  node: Konva.Node,
  mb: { type?: string; x?: number; y?: number; width?: number; height?: number; pathData?: string },
  scaleX: number,
  scaleY: number
): Konva.Group {
  const mbX = (mb.x || 0) * scaleX
  const mbY = (mb.y || 0) * scaleY
  const mbW = (mb.width || 0) * scaleX
  const mbH = (mb.height || 0) * scaleY

  const clipGroup = new Konva.Group({
    x: mbX,
    y: mbY,
    clipFunc: (ctx: Konva.Context) => {
      if (mb.type === 'ellipse') {
        ctx.ellipse(mbW / 2, mbH / 2, mbW / 2, mbH / 2, 0, 0, Math.PI * 2)
      } else if (mb.type === 'path' && mb.pathData) {
        const raw = (ctx as any)._context as CanvasRenderingContext2D
        if (raw && typeof raw.clip === 'function') {
          if (scaleX !== 1 || scaleY !== 1) {
            const scaledPath = new Path2D()
            scaledPath.addPath(new Path2D(mb.pathData), new DOMMatrix([scaleX, 0, 0, scaleY, 0, 0]))
            raw.clip(scaledPath, 'nonzero')
          } else {
            raw.clip(new Path2D(mb.pathData), 'nonzero')
          }
        }
        ctx.rect(0, 0, mbW, mbH)
      } else {
        ctx.rect(0, 0, mbW, mbH)
      }
    },
  })

  const nodeX = node.x()
  const nodeY = node.y()
  node.remove()
  node.x(nodeX - mbX)
  node.y(nodeY - mbY)
  clipGroup.add(node as Konva.Shape | Konva.Group)

  return clipGroup
}
