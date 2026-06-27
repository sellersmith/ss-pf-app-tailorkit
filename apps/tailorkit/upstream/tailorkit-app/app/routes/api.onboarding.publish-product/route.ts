/* eslint-disable max-lines */
/**
 * API endpoint: POST /api/onboarding/publish-product
 *
 * Simplified onboarding step 5 "See It Works" flow:
 * 1. Clones the selected product with "Personalized " prefix
 * 2. Creates a Template + Layer in MongoDB (real documents the storefront can read)
 * 3. Creates Integration + PrintArea + LayerIntegration + Mockup + VariantIntegration
 * 4. Publishes the integration to storefront via metafields
 * 5. Returns the storefront URL for the cloned product
 */

import type { ActionFunctionArgs } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import { json } from '~/bootstrap/fns/fetch.server'
import { errorResponse } from '~/utils/error-response.server'
import { catchAsync } from '~/utils/catchAsync'
import { uuid } from '~/utils/uuid'
import { getShopifyApiClient } from '~/shopify/graphql/api.server'
import { saveIntegrationProcess, publishIntegrationProcess } from '~/routes/api.integration/fns.server'
import type { IntegrationDataSaver } from '~/types/integration'
import Template from '~/models/Template.server'
import Layer from '~/models/Layer.server'
import ImageModel from '~/models/Image.server'
import { ELayerType, EOptionSet } from '~/types/psd'
import { TEMPLATE_TYPE } from '~/routes/api.templates/constants'
import OptionSet from '~/models/OptionSet.server'
import Shop, { getShopData, updateShopUsages } from '~/models/Shop.server'
import quickPrompts from '~/models/PromptPreset.quickPrompts'
import { isApprovedCharge } from '~/models/PricingPlan.fns'
import { visualStyles } from '~/modules/PromptPresets/taxonomies/visualStyles'
import {
  fetchOriginalProductForDirectPublish,
  productHasActiveIntegration,
} from './fetch-original-product-for-direct-publish.server'
import { replaceFeaturedMedia } from './replace-featured-media.server'

// ============================================================================
// Inventory tracking — personalized products are made-to-order, no stock to track
// ============================================================================

/** Disable inventory tracking on all variants so merchants can place test orders. */
async function disableInventoryTracking(
  admin: { graphql: (...args: any[]) => any },
  inventoryItemIds: string[]
): Promise<void> {
  for (const id of inventoryItemIds.slice(0, 100)) {
    const result = await admin.graphql(
      `mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
        inventoryItemUpdate(id: $id, input: $input) {
          inventoryItem { id tracked }
          userErrors { field message }
        }
      }`,
      { variables: { id, input: { tracked: false } } }
    )
    const parsed = await result.json()
    const errors = parsed?.data?.inventoryItemUpdate?.userErrors
    if (errors?.length) {
      console.warn('[disableInventoryTracking] userErrors for', id, errors)
    }
  }
}

// ============================================================================
// AI effect (quick prompt) matching for image templates
// ============================================================================

/** Keywords that match specific template types (partial match — "painterly" matches "paint") */
const TEMPLATE_TYPE_KEYWORDS: Record<string, string[]> = {
  // Initial/monogram/typography/signature templates
  initial: ['initial', 'monogram', 'typography', 'signature', 'letter', 'name'],
  monogram: ['initial', 'monogram', 'typography', 'signature', 'letter', 'name'],
  // Illustration templates
  illustration: [
    'scene',
    'illustration',
    'transformation',
    'celebration',
    'birthday',
    'valentine',
    'christmas',
    'holiday',
    'anniversary',
    'memorial',
    'wedding',
    'family',
    'mother',
  ],
  // Portrait templates
  portrait: ['portrait', 'pet', 'person', 'face', 'photo'],
  // Pattern templates
  pattern: ['pattern', 'background', 'decorative', 'floral', 'frame', 'ornament', 'mandala', 'wreath'],
}

/** Keywords enabled for ALL image template types */
const UNIVERSAL_KEYWORDS = ['flat', 'draw', 'line', 'pixel', 'retro', 'realistic', 'solid', 'paint']

/** Get the keyword category for a template type */
function getTemplateKeywordCategory(templateType: string): string {
  if (templateType.includes('initial')) return 'initial'
  if (templateType.includes('monogram')) return 'monogram'
  if (templateType.includes('illustration')) return 'illustration'
  if (templateType.includes('pet') || templateType.includes('person') || templateType.includes('portrait')) {
    return 'portrait'
  }
  if (templateType.includes('pattern') || templateType.includes('motif') || templateType.includes('accent')) {
    return 'pattern'
  }
  return 'illustration' // fallback
}

/** Check if a name matches any keyword (partial, case-insensitive) */
function matchesKeywords(name: string, keywords: string[]): boolean {
  const lower = name.toLowerCase()
  return keywords.some(kw => lower.includes(kw))
}

/** Build enabledQuickPrompts for an image template type by filtering all available presets */
function buildEnabledQuickPrompts(templateType: string): string[] {
  const category = getTemplateKeywordCategory(templateType)
  const typeKeywords = TEMPLATE_TYPE_KEYWORDS[category] || []
  const allKeywords = [...new Set([...typeKeywords, ...UNIVERSAL_KEYWORDS])]

  const allPresets = [
    ...quickPrompts.map((p: { name: string }) => p.name),
    ...visualStyles.map((s: { name: string }) => s.name),
  ]

  return allPresets.filter(name => matchesKeywords(name, allKeywords))
}

// ============================================================================
// Request / Response types
// ============================================================================

interface PublishProductRequest {
  productId: string
  productTitle: string
  templateType: string
  /**
   * How to persist personalization:
   *  - 'clone' (default): duplicate product, attach integration to new variants
   *  - 'integrate-direct': attach integration to ORIGINAL product variants (no duplicate)
   */
  publishMode?: 'clone' | 'integrate-direct'
  /** Mask image URL from mockup processing; null when merchant skipped drawing (no-mask flow) */
  processedImageUrl: string | null
  /** Original product image URL */
  selectedImageUrl: string
  /** Original product image natural dimensions (from client-side Image.naturalWidth/Height) */
  originalImageWidth?: number
  originalImageHeight?: number
  /** CDN URL of the generated template artwork (for vector/image templates).
   * Uploaded client-side before calling this endpoint. */
  templateImageUrl?: string
  /** Natural dimensions of the template image (for fit-centering within print area) */
  templateImageWidth?: number
  templateImageHeight?: number
  /** SVG overlay with filter primitives (storefront extracts filterPresetId from this) */
  overlaySvg?: string
  /** When set, skip template/layer creation and use this existing template ID */
  existingTemplateId?: string
  /** Replace Featured Media toggle — when true and featuredMediaUrl is provided, the
   *  server uploads the mockup to Shopify and promotes it to the product's featured image. */
  replaceFeaturedMedia?: boolean
  /** CDN URL of the composite mockup (product + template overlay), uploaded client-side */
  featuredMediaUrl?: string
  featuredMediaWidth?: number
  featuredMediaHeight?: number
  /** Template positions from mockup wizard (in processed/downscaled image space).
   *  templatePositions: fitted visual positions (may differ from area after user manipulation).
   *  transparentAreas: actual processing result with bounding box + sourceShapeDimensions. */
  mockupResult: {
    processedImageUrl: string | null
    templatePositions: Array<{ x: number; y: number; width: number; height: number; rotation?: number }>
    processedDimensions: { width: number; height: number }
    transparentAreas?: Array<{
      boundingBox: { x: number; y: number; width: number; height: number }
      rotation?: number
      sourceShapeDimensions?: { width: number; height: number }
      inscribedRect?: {
        x: number
        y: number
        width: number
        height: number
        rotation: number
        centerX: number
        centerY: number
      }
    }>
  }
}

// ============================================================================
// Layer settings per template type
// ============================================================================

/** Build text layer settings based on the selected template type.
 * Effects match the client-side preview (emboss/deboss shadows). */
function buildTextLayerSettings(templateType: string, width: number, height: number) {
  const base = {
    // fontFamily must be an object { family, src } — editor and storefront read fontFamily.family
    fontFamily: {
      family: 'Special Elite',
      src: 'https://fonts.gstatic.com/s/specialelite/v18/XLYgIZbkc4JPUL5CVArUVL0nhncESXFtUsM.ttf',
    },
    fontSize: Math.round(Math.min(width, height) * 0.8 * 0.3), // ~30% of usable area, similar to preview auto-fit
    textStyle: [] as string[],
    autoFitToContainer: true,
    textAlign: 'center',
    verticalAlign: 'middle',
    text: 'Your Text',
    content: 'Your Text',
    storefrontLabel: 'Enter your message',
    textCreatedBy: 'customers' as const,
    personalizedByBuyer: true,
    personalizedByBuyerOptions: {
      label: 'Enter your message',
      placeholder: 'Enter your message',
      required: true,
      fieldType: 'single-line' as const,
      characterLimit: 30,
    },
  }

  switch (templateType) {
    case 'embossed-custom-text':
      return {
        ...base,
        textColor: 'rgba(0, 0, 0, 0.15)',
        effects: [
          { type: 'INNER_SHADOW', visible: true, color: 'rgba(0, 0, 0, 0.92)', offsetX: 0, offsetY: -5, radius: 5 },
          {
            type: 'INNER_SHADOW',
            visible: true,
            color: 'rgba(255, 255, 255, 0.75)',
            offsetX: 0,
            offsetY: 3,
            radius: 4,
          },
        ],
      }

    case 'debossed-custom-text':
      return {
        ...base,
        textColor: 'rgba(152, 75, 9, 0.3)',
        effects: [
          {
            type: 'INNER_SHADOW',
            visible: true,
            color: 'rgba(235, 234, 234, 0.50)',
            offsetX: 0,
            offsetY: 1.5,
            radius: 2,
          },
          { type: 'DROP_SHADOW', visible: true, color: 'rgba(0, 0, 0, 0.45)', offsetX: 0, offsetY: -2, radius: 3 },
        ],
      }

    // All other types (plain text, vector, image): standard black text, no effects
    default:
      return { ...base, textColor: '#000000ff' }
  }
}

// ============================================================================
// Action handler
// ============================================================================

export const action = catchAsync(async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request)
  const shopDomain = session.shop

  const body = (await request.json()) as PublishProductRequest
  const {
    productId,
    productTitle,
    templateType,
    mockupResult,
    processedImageUrl,
    selectedImageUrl,
    templateImageUrl,
    templateImageWidth: templateImgW,
    templateImageHeight: templateImgH,
    originalImageWidth,
    originalImageHeight,
    overlaySvg,
    existingTemplateId,
  } = body

  // Defensive coercion — anything other than the literal 'integrate-direct' falls back to 'clone'.
  // Prevents tampered clients from bypassing the safe default if the body is malformed.
  const publishMode: 'clone' | 'integrate-direct'
    = body.publishMode === 'integrate-direct' ? 'integrate-direct' : 'clone'
  const isClone = publishMode === 'clone'

  if (!productId || !productTitle || !templateType || !mockupResult) {
    return json({ success: false, error: 'Missing required fields' }, { status: 400 })
  }

  // First-product-free gate. The Quick Setup wizard publishes via this endpoint;
  // without this check, merchants could publish unlimited products without ever
  // subscribing. Mirrors the Full Editor gate in UnifiedHeader at publish time.
  // Match conditions: shop has no approved charge AND has already published ≥1
  // integration → block this 2nd+ publish, surface the pricing modal client-side.
  const shopData = await getShopData(shopDomain)
  if (shopData && !isApprovedCharge(shopData) && (shopData.usages?.totalPublishedIntegrations || 0) >= 1) {
    return errorResponse('Subscription required to publish additional products', 402, {
      needsSubscription: true,
    })
  }

  try {
    // Step 1: Resolve target product info — either CLONE the source product (default safe behavior)
    // or fetch the ORIGINAL product info for integrate-direct mode (no duplicate created).
    const shopifyApi = await getShopifyApiClient(shopDomain, admin)

    let newProductId: string
    let newProductHandle: string
    let variantIds: string[]
    /** Inventory items for cloned variants only — disabled below so merchants can place test orders.
     * In direct mode the merchant's live product is left untouched. */
    let trackedInventoryItemIds: string[] = []

    if (isClone) {
      const cloneResult = await shopifyApi.duplicateProduct(productId, `Personalized ${productTitle}`, {
        // Skip image copying — it can take 60-120s+ and causes Cloudflare tunnel 524 timeouts.
        // The storefront personalization uses TailorKit's baseImage/maskImage URLs from metafields,
        // not Shopify product images. Product listing images are nice-to-have but not required
        // for the onboarding "see it works" moment.
        includeImages: false,
        newStatus: 'UNLISTED',
        synchronous: true,
      })

      newProductId = cloneResult.productId
      newProductHandle = cloneResult.handle
      variantIds = cloneResult.variantIds
      trackedInventoryItemIds = cloneResult.trackedInventoryItemIds || []

      if (!newProductId || !variantIds.length) {
        return json({ success: false, error: 'Product cloning failed' }, { status: 500 })
      }
    } else {
      // integrate-direct: server-side defense — block when product already has an active integration.
      // The Step 1 "Personalized" Badge already prevents this in the UI, but a tampered client
      // could still POST. This guard returns 409 so the client can show a meaningful error.
      const conflict = await productHasActiveIntegration(shopDomain, productId)
      if (conflict) {
        return json(
          {
            success: false,
            error: 'PRODUCT_ALREADY_INTEGRATED',
            message:
              'This product already has personalization. Open it from the Personalized Products page to edit, or switch to "Publish as new".',
          },
          { status: 409 }
        )
      }

      const original = await fetchOriginalProductForDirectPublish(admin, productId)
      if (!original || !original.variantIds.length) {
        return json({ success: false, error: 'Failed to load product for direct publish' }, { status: 500 })
      }

      newProductId = original.productId
      newProductHandle = original.handle
      variantIds = original.variantIds
      // No inventory mutation in direct mode — preserves merchant's existing tracking config.
    }

    // Title shown in personalized-products list, Template name, Mockup label, Integration title.
    // Clone mode prefixes "Personalized " (matches the duplicated product name); direct mode uses
    // the existing product title verbatim so it lines up with the merchant's actual product.
    const integrationTitle = isClone ? `Personalized ${productTitle}` : productTitle

    // Step 2: Create Template + Layer(s) in MongoDB
    // The storefront reads these to render personalization UI.
    //
    // COORDINATE SPACE: Template positions from the wizard are in processed (downscaled)
    // image space. The editor and storefront use the original product image at full
    // resolution, so positions must be upscaled to match.
    // Compute upscale factor from original vs processed dimensions.
    const processedW = mockupResult.processedDimensions?.width || 0
    const processedH = mockupResult.processedDimensions?.height || 0
    const origW = originalImageWidth || 0
    const origH = originalImageHeight || 0
    // Use the max-dimension ratio (matches how downscale works: scale = maxDim / processed)
    const upscale = processedW > 0 && origW > 0 ? Math.max(origW / processedW, origH / processedH) : 1

    // Determine print area position and dimensions.
    // Use templatePositions[0] (fit-adjusted from the composite preview) — this matches
    // what the merchant sees and approved in Step 4. The inscribed rect provides the
    // rotation angle for vector paths, but its dimensions include unfilled space since
    // the template is fit-adjusted to maintain aspect ratio within the inscribed area.
    const area = mockupResult.transparentAreas?.[0]
    const inscribed = area?.inscribedRect
    const templatePos = mockupResult.templatePositions[0] || null
    const rawPos = templatePos
      ? {
          x: templatePos.x,
          y: templatePos.y,
          width: templatePos.width,
          height: templatePos.height,
          // Use the manipulated/computed rotation from templatePositions directly.
          // This reflects the user's adjustments in step 4 (or the initial fit calculation).
          rotation: templatePos.rotation ?? 0,
        }
      : inscribed
        ? {
            x: inscribed.centerX - inscribed.width / 2,
            y: inscribed.centerY - inscribed.height / 2,
            width: inscribed.width,
            height: inscribed.height,
            rotation: inscribed.rotation,
          }
        : null

    // Upscale the original wizard coordinates (processed → original image space)
    const wizPos = rawPos
      ? {
          x: Math.round(rawPos.x * upscale),
          y: Math.round(rawPos.y * upscale),
          width: Math.round(rawPos.width * upscale),
          height: Math.round(rawPos.height * upscale),
          rotation: rawPos.rotation || 0,
        }
      : null

    // Convert from MockupWizard coordinates (center-rotation) to Konva coordinates
    // (top-left-rotation) for the layerIntegration position.
    // MockupWizard computes x,y as top-left and rotates around the center of the rect.
    // Konva rotates around x,y (top-left). To get the same visual result, we compute
    // x,y such that Konva's top-left-pivot rotation places the template center at
    // the same position as MockupWizard's center-pivot rotation.
    const konvaPos = wizPos
      ? (() => {
          const { x, y, width: w, height: h, rotation: rot } = wizPos
          if (rot === 0) return { x, y, width: w, height: h, rotation: 0 }

          const cx = x + w / 2
          const cy = y + h / 2
          const rad = rot * (Math.PI / 180)
          const cosR = Math.cos(rad)
          const sinR = Math.sin(rad)
          const kx = cx - (w / 2) * cosR + (h / 2) * sinR
          const ky = cy - (w / 2) * sinR - (h / 2) * cosR
          return { x: Math.round(kx), y: Math.round(ky), width: w, height: h, rotation: rot }
        })()
      : null

    const printAreaWidth = wizPos ? wizPos.width : 400
    const printAreaHeight = wizPos ? wizPos.height : 300

    // When using an existing template, skip all template/layer/optionset creation
    const templateId = existingTemplateId || uuid()
    const textLayerId = uuid()
    const layerIds: string[] = []

    // Skip template/layer creation when using an existing template
    if (!existingTemplateId) {
      // For vector/image templates: create an image layer with the uploaded artwork
      const isImageTemplate
        = templateType.includes('initial') || templateType.includes('monogram') || templateType.startsWith('custom-')

      if (isImageTemplate && templateImageUrl) {
        const imageLayerId = uuid()
        const imageDocId = uuid()

        // Fit-center the template image within the print area (maintain aspect ratio).
        // The generated SVG/PNG may have different proportions than the print area.
        // Without this, the editor stretches the image to fill the entire area.
        let imgLayerW = printAreaWidth
        let imgLayerH = printAreaHeight
        let imgLayerLeft = 0
        let imgLayerTop = 0
        if (templateImgW && templateImgH && templateImgW > 0 && templateImgH > 0) {
          const imgAspect = templateImgW / templateImgH
          const areaAspect = printAreaWidth / printAreaHeight
          if (imgAspect > areaAspect) {
            // Image is wider — fit to width
            imgLayerW = printAreaWidth
            imgLayerH = Math.round(printAreaWidth / imgAspect)
          } else {
            // Image is taller — fit to height
            imgLayerH = printAreaHeight
            imgLayerW = Math.round(printAreaHeight * imgAspect)
          }
          imgLayerLeft = Math.round((printAreaWidth - imgLayerW) / 2)
          imgLayerTop = Math.round((printAreaHeight - imgLayerH) / 2)
        }

        // Create an Image document so the admin template editor can render it.
        // The editor reads image data from layer.image.src (populated Image ref),
        // NOT from settings.imageUrl (which is storefront-only).
        await ImageModel.create({
          _id: imageDocId,
          src: templateImageUrl,
          originalSrc: templateImageUrl,
          width: imgLayerW,
          height: imgLayerH,
          shopDomain,
        })

        // Create image option set for storefront personalization panel
        const imageOptionSetId = uuid()
        await OptionSet.create({
          _id: imageOptionSetId,
          type: EOptionSet.IMAGE_OPTION,
          label: 'Upload your image',
          labelOnStoreFront: 'Upload your image',
          data: {
            files: [
              {
                _id: uuid(),
                src: templateImageUrl,
                name: 'AI Generated Artwork',
                selecting: 'true',
                // Store overlay on the option so the storefront picks it up via option-level priority
                ...(overlaySvg ? { overlay: { overlaySvg } } : {}),
              },
            ],
          },
          shopDomain,
        })

        await Layer.create({
          _id: imageLayerId,
          type: ELayerType.IMAGE,
          label: 'AI Generated Artwork',
          open: true,
          visible: true,
          locked: false,
          top: imgLayerTop,
          left: imgLayerLeft,
          width: imgLayerW,
          height: imgLayerH,
          // No parent — root-level layer (parent is for nested/grouped layers only)
          shopDomain,
          templateId,
          image: imageDocId,
          optionSet: [imageOptionSetId],
          settings: {
            imageUrl: templateImageUrl,
            storefrontLabel: 'Upload your image',
            // Source-of-truth flag: buyer upload/AI mode (not merchant preset images)
            enableBuyerImage: true,
            enableSellerImage: false,
            // Store SVG overlay with filter primitives so the storefront can extract
            // the filterPresetId and re-apply the filter to newly generated/uploaded images
            ...(overlaySvg ? { overlay: { overlaySvg } } : {}),
            // Enable buyer to upload their own image or generate with AI on storefront.
            // enabledQuickPrompts filters which AI effects are shown — matched by template type
            // keywords so buyers see relevant effects (e.g., monogram templates show monogram effects).
            imageUploaderOptions: {
              required: false,
              allowCustomerUploadImage: true,
              allowCustomerGenerateImageWithAI: true,
              allowCustomerToUseReferenceImage: true,
              allowCustomerToEditImage: {
                allowTransform: true,
                allowRotate: true,
                allowZoom: true,
                allowRemoveBackground: true,
              },
              autoRemoveSolidWhiteBackground: true,
              allowCustomerToUseQuickPrompts: true,
              allowCustomerToUseVisualStyles: true,
              allowCustomerToUseContentThemes: true,
              enabledQuickPrompts: buildEnabledQuickPrompts(templateType),
              allowCustomerToUseTemplateTypes: false,
              allowCustomerUseImageOptionSet: false,
            },
          },
        })
        layerIds.push(imageLayerId)
      }

      // Create a text layer only for text-based templates.
      // Image-only templates (AI-generated artwork) should NOT get a text layer — the
      // storefront personalization uses the image uploader, not text input.
      // Text layer is only for text-based templates (plain/embossed/debossed-custom-text).
      // All SVG/PNG image templates (initials, monograms, illustrations, portraits, patterns)
      // use the image uploader, not text input.
      const needsTextLayer = !isImageTemplate

      if (needsTextLayer) {
        const layerSettings = buildTextLayerSettings(templateType, printAreaWidth, printAreaHeight)

        // Create a text option set so the storefront personalization panel renders a text input
        const textOptionSetId = uuid()
        await OptionSet.create({
          _id: textOptionSetId,
          type: EOptionSet.TEXT_OPTION,
          label: 'Custom Text',
          labelOnStoreFront: 'Your Text',
          data: {
            texts: [
              {
                _id: uuid(),
                name: 'Your Text',
                selecting: layerSettings.text || 'Your Text',
              },
            ],
          },
          shopDomain,
        })

        await Layer.create({
          _id: textLayerId,
          type: ELayerType.TEXT,
          label: 'Custom Text',
          open: true,
          visible: true,
          locked: false,
          top: 0,
          left: 0,
          width: printAreaWidth,
          height: printAreaHeight,
          // No parent — root-level layer (parent is for nested/grouped layers only)
          shopDomain,
          templateId,
          settings: layerSettings,
          optionSet: [textOptionSetId],
        })
        layerIds.push(textLayerId)
      }

      // Create a Template document referencing all layers
      await Template.create({
        _id: templateId,
        name: integrationTitle,
        dimension: {
          width: printAreaWidth,
          height: printAreaHeight,
          measurementUnit: 'px',
          resolution: 72,
        },
        layers: layerIds,
        shopDomain,
        type: TEMPLATE_TYPE.TEMPLATE,
        activeVariantIntegration: [],
      })
    } // end: skip when existingTemplateId

    // Step 3: Build integration entities
    const integrationId = uuid()
    const mockupId = uuid()
    const printAreaId = uuid()
    const layerIntegrationId = uuid()
    const viewId = uuid()

    // Compute previewProductImage — positions the product image on the template canvas
    // so the template design area aligns with the user's selection on the product.
    //
    // All coordinates are now in ORIGINAL image space (upscaled from processed space above).
    // The product image is placed with negative offsets so the selection area maps to (0,0).
    // Original image dimensions for baseImage/mockup sizing
    const imageWidth = origW > 0 ? origW : processedW > 0 ? Math.round(processedW * upscale) : printAreaWidth
    const imageHeight = origH > 0 ? origH : processedH > 0 ? Math.round(processedH * upscale) : printAreaHeight

    // PrintArea — references the Template document + product image placement.
    // The Editor renders the product image on the template canvas (printAreaWidth × printAreaHeight)
    // using Konva, which rotates around (x, y) = (left, top).
    //
    // We need the selection center (wizPos.x + w/2, wizPos.y + h/2) on the product image
    // to map to the template canvas center (w/2, h/2) after counter-rotation by -θ.
    const previewRotation = -(wizPos?.rotation || 0)
    let previewLeft = Math.round(-(wizPos?.x || 0))
    let previewTop = Math.round(-(wizPos?.y || 0))

    if (wizPos && wizPos.rotation !== 0) {
      const rad = previewRotation * (Math.PI / 180)
      const cosR = Math.cos(rad)
      const sinR = Math.sin(rad)
      // Point on the product image that should land at template canvas center (w/2, h/2)
      const selCx = wizPos.x + printAreaWidth / 2
      const selCy = wizPos.y + printAreaHeight / 2
      previewLeft = Math.round(printAreaWidth / 2 - selCx * cosR + selCy * sinR)
      previewTop = Math.round(printAreaHeight / 2 - selCx * sinR - selCy * cosR)
    }

    const printArea = {
      _id: printAreaId,
      name: 'Front',
      width: printAreaWidth,
      height: printAreaHeight,
      template: templateId,
      previewProductImage: {
        src: selectedImageUrl,
        left: previewLeft,
        top: previewTop,
        width: imageWidth,
        height: imageHeight,
        rotation: previewRotation,
        naturalWidth: imageWidth,
        naturalHeight: imageHeight,
        visible: true,
      },
    }

    // LayerIntegration — places the template on the product mockup.
    // Uses konvaPos (Konva-adjusted coordinates) so the storefront and Live Preview
    // (which use Konva top-left-pivot rotation) render the template at the correct position.
    const layerIntegration = {
      _id: layerIntegrationId,
      layerId: layerIntegrationId,
      printAreaId,
      x: konvaPos?.x || 0,
      y: konvaPos?.y || 0,
      width: printAreaWidth,
      height: printAreaHeight,
      rotation: konvaPos?.rotation || 0,
      type: 'template' as const,
      data: { templateId },
      name: templateType,
      visible: true,
    }

    // Mockup — contains mask image and layer references.
    // label is displayed as the product name in the personalized products list.
    const mockup = {
      _id: mockupId,
      layers: [layerIntegrationId],
      label: integrationTitle,
      baseImage: { url: selectedImageUrl, width: imageWidth, height: imageHeight },
      maskImage: processedImageUrl ? { url: processedImageUrl, width: imageWidth, height: imageHeight } : null,
    }

    // VariantIntegrations — one per variant of the cloned product
    const variantIntegrations = variantIds.map((variantId: string) => ({
      _id: uuid(),
      id: variantId,
      mockup: mockupId,
      productId: newProductId,
      productActivated: true,
      printAreas: [printAreaId],
    }))

    // Integration document
    const integration = {
      _id: integrationId,
      title: integrationTitle,
      // Must use Shopify variant IDs (not MongoDB _ids) — getDetailIntegration
      // populates via foreignField:'id' matching against these values
      variants: variantIntegrations.map((v: { id: string }) => v.id),
      publishedAt: null,
      shopDomain,
    }

    // MockupViews — default view for the mockup
    const mockupViews = [
      {
        _id: viewId,
        mockup: mockupId,
        title: 'Default view',
        baseImage: { url: selectedImageUrl, width: imageWidth, height: imageHeight },
        maskImage: processedImageUrl ? { url: processedImageUrl, width: imageWidth, height: imageHeight } : null,
        enableClippingMask: !!processedImageUrl,
        layers: [layerIntegrationId],
        overrides: {},
      },
    ]

    // Step 4: Save integration to MongoDB
    // Cast to IntegrationDataSaver — constructed objects contain all fields needed by
    // saveIntegrationProcess but don't include optional Mongoose document metadata.
    await saveIntegrationProcess({
      shopDomain,
      integration,
      printAreas: [printArea],
      layers: [layerIntegration],
      mockups: [mockup],
      variants: variantIntegrations,
      mockupViews,
    } as IntegrationDataSaver & { shopDomain: string })

    // Step 5: Publish integration (writes metafields to Shopify variants).
    // In CLONE mode, also copy product images + disable inventory tracking on the new product so
    // merchants can place test orders immediately. In INTEGRATE-DIRECT mode, skip both — the
    // merchant's live product already has its images and inventory configured correctly.
    const sideEffects: Promise<unknown>[] = isClone
      ? [
          shopifyApi.copyProductImages(productId, newProductId).catch(err => {
            // Image copy is non-critical — product works without images
            console.error('[api.onboarding.publish-product] Image copy failed:', err)
          }),
          disableInventoryTracking(admin, trackedInventoryItemIds).catch(err => {
            console.error('[api.onboarding.publish-product] Inventory tracking disable failed:', err)
          }),
        ]
      : []
    const [publishResult] = await Promise.all([
      publishIntegrationProcess(admin, integrationId, shopDomain, { skipProductActivation: true }),
      ...sideEffects,
    ])

    if (!publishResult) {
      console.error(
        '[api.onboarding.publish-product] publishIntegrationProcess returned null — integration not found or metafield write failed',
        { integrationId, shopDomain }
      )
      return json({ success: false, error: 'Failed to publish integration — please try again' }, { status: 500 })
    }

    // Mark onboarding as completed and record first publish event.
    // published_first_integration lets the dashboard skip the pricing redirect
    // (useOnboarding line 101: if isChargeApproved || publishedFirstIntegration → let through).
    Shop.updateOne(
      { shopDomain },
      {
        $set: { 'appConfig.occurredEvents.completed_onboarding': true },
        $inc: { 'appConfig.occurredEvents.published_first_integration': 1 },
      }
    ).catch(console.error)

    // Refresh totalPublishedIntegrations so the first-product-free gate fires on
    // the next publish attempt. Without this, repeat wizard publishes pass the gate.
    // Mirrors the fire-and-forget pattern used in api.integrations route.
    updateShopUsages(shopDomain).catch(console.error)

    // Replace featured media (optional — merchant opted in via Step 5 toggle).
    // Runs AFTER the main publish + clone side-effects (image copy) so the mockup lands at
    // position 0 and the copied images push to positions 1+. In direct mode there's no image
    // copy, so this just inserts the mockup and reorders the merchant's existing media.
    let featuredMediaReplaced = false
    let featuredMediaError: string | undefined
    if (body.replaceFeaturedMedia && body.featuredMediaUrl) {
      const result = await replaceFeaturedMedia({
        shopifyApi,
        admin,
        productId: newProductId,
        productTitle: integrationTitle,
        featuredMediaUrl: body.featuredMediaUrl,
      })
      featuredMediaReplaced = result.success
      if (!result.success) {
        featuredMediaError = result.error
        console.error('[api.onboarding.publish-product] featured media replace failed', {
          stage: result.stage,
          error: result.error,
          productId: newProductId,
        })
      }
    }

    // Build storefront URL
    const storefrontUrl = `https://${shopDomain}/products/${newProductHandle}`

    return json({
      success: true,
      storefrontUrl,
      integrationId,
      mockupId,
      newProductId,
      featuredMediaReplaced,
      featuredMediaError,
    })
  } catch (error) {
    console.error('[api.onboarding.publish-product] Error:', error)
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to publish product',
      },
      { status: 500 }
    )
  }
})
