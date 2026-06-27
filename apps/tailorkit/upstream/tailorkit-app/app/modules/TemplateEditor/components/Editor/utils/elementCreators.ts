/**
 * Utility functions for creating different types of elements in the template editor
 */

import type { TFunction } from 'i18next'
import { getDefaultStorefrontLabel } from '~/modules/TemplateEditor/elements/fns'
import type { TLayerStore } from '~/stores/modules/layer'
import { createLayerStore } from '~/stores/modules/layer'
import { createOptionSetStore } from '~/stores/modules/option-set'
import type { LayerType, TextSettings, CharmProductRef, CharmTransformInstance, CharmSettings } from '~/types/psd'
import { ELayerType, EOptionSet } from '~/types/psd'
import { registerCharmLayer } from '~/stores/modules/charm-layer-index'
import type { IImageQuery } from '~/types/shopify-files'
import { getFileNameWithoutExtension } from '~/utils/file-types'
import { uuid } from '~/utils/uuid'
import type { AllowedAspectRatio } from '~/routes/api.ai-assistant.suggestion/constants'
import type { LayerDocument } from '~/models/Layer.server'
import type { StretchBoxOptions } from '~/components/canvas/elements/Text/utils/stretchBoxToFit'
import { stretchBoxToFit } from '~/components/canvas/elements/Text/utils/stretchBoxToFit'
import { DEFAULT_TEXT_ALIGNMENT, DEFAULT_TEXT_VERTICAL_ALIGN, DEFAULT_TEXT_FAMILY } from '~/constants/inspector/text'
import { CHARM_THUMB_SIZE } from '~/modules/TemplateEditor/elements/components/CharmNode/charm-node-utils'
export type { TextSettings }

export interface ElementCreationContext {
  widthByPixels: number
  heightByPixels: number
  shopDomain: string
  t: TFunction
  /** Number of existing text layers — used to auto-number new text layer labels (Text 1, Text 2, …) */
  textLayerCount?: number
  /** Highest N seen in "Imageless N" labels — used to auto-number new imageless layer labels */
  imagelessLayerCount?: number
  /** Highest N seen in "Multi-layout N" labels — used to auto-number new multi-layout layer labels */
  multiLayoutLayerCount?: number
  /** Number of existing CHARM_NODE layers — used to auto-number new charm builder labels */
  charmNodeLayerCount?: number
}

export interface GenerativeOptions {
  prompt?: string
  aspectRatio?: AllowedAspectRatio
  visualStyle?: string
  contentTheme?: string
  templateType?: string
}

/**
 * Creates a text element layer store
 */
export function createTextElement(context: ElementCreationContext, settings?: TextSettings): TLayerStore {
  const { widthByPixels, heightByPixels, shopDomain, t, textLayerCount = 0 } = context
  const _id = uuid()

  let width = Math.round(widthByPixels / 4)
  let height = Math.round((width / 3) * 2)
  let top = Math.round((heightByPixels - height) / 2)
  let left = Math.round((widthByPixels - width) / 2)

  const optionSetStore = createOptionSetStore({
    _id: uuid(),
    type: EOptionSet.TEXT_OPTION,
    data: null,
    label: '',
    labelOnStoreFront: getDefaultStorefrontLabel({ t, type: EOptionSet.TEXT_OPTION }),
    shopDomain,
  })

  const optionSet: any = optionSetStore.getState()
  let computedSettings: TextSettings | undefined
  if (settings && settings.content) {
    // Enrich incoming settings with sensible defaults for initial sizing
    const baseFontSize = (settings as any)?.fontSize ?? Math.round(width / 5)
    computedSettings = {
      ...(settings as TextSettings),
      textAlign: (settings as any)?.textAlign ?? (DEFAULT_TEXT_ALIGNMENT as string),
      verticalAlign: (settings as any)?.verticalAlign ?? (DEFAULT_TEXT_VERTICAL_ALIGN as string),
      fontFamily: (settings as any)?.fontFamily ?? (DEFAULT_TEXT_FAMILY as any),
      fontSize: baseFontSize,
      autoFitToContainer: true,
    }

    const {
      width: fittedWidth,
      height: fittedHeight,
      x: fittedX,
      y: fittedY,
    } = stretchBoxToFit({
      ...(computedSettings as unknown as StretchBoxOptions),
      text: computedSettings.content!,
      position: { x: left, y: top },
      currentDimension: { width, height },
      fontSize: baseFontSize,
      // Ensure initial creation respects default alignments so the box remains centered
      textAlign: computedSettings.textAlign as string,
      verticalAlign: computedSettings.verticalAlign as string,
      // Use the font family name string for measurement
      fontFamily:
        ((computedSettings as any)?.fontFamily?.family as string)
        ?? ((computedSettings as any)?.fontFamily as unknown as string)
        ?? 'Arial',
      angle: 0,
    })
    width = fittedWidth
    height = fittedHeight
    if (fittedX !== undefined && fittedY !== undefined) {
      top = fittedY
      left = fittedX
    }
  }

  return createLayerStore({
    _id,
    top,
    left,
    width,
    height,
    rotate: 0,
    type: ELayerType.TEXT,
    visible: true,
    label: `Text ${textLayerCount + 1}`,
    optionSet: [optionSet],
    shopDomain,
    parent: '',
    shapeSettings: {
      shape: '',
      tempShape: undefined,
    },
    ...(computedSettings ? { settings: computedSettings } : settings ? { settings } : {}),
  })
}

/**
 * Creates image element layer stores from media files
 */
export function createImageElements(
  mediaFiles: IImageQuery[],
  context: ElementCreationContext,
  generativeOptions?: GenerativeOptions
): TLayerStore[] {
  const { widthByPixels, heightByPixels } = context
  const newLayerStores: TLayerStore[] = []

  for (let i = 0; i < mediaFiles.length; i++) {
    const {
      alt,
      image: { width: rawWidth, height: rawHeight, originalSrc },
    } = mediaFiles[i]

    // Fallback to canvas size when dimensions are missing (e.g. image clicked during upload)
    const width = rawWidth || widthByPixels
    const height = rawHeight || heightByPixels

    // Scale to cover maximum 100% of canvas
    const scale = Math.min((widthByPixels * 1) / width, (heightByPixels * 1) / height, 1)
    const widthScaled = width * scale
    const heightScaled = height * scale

    const left = Math.max(0, Math.round((widthByPixels - widthScaled) / 2))
    const top = Math.max(0, Math.round((heightByPixels - heightScaled) / 2))

    newLayerStores.push(
      createLayerStore({
        _id: uuid(),
        top,
        left,
        rotate: 0,
        label: alt,
        width: widthScaled,
        type: ELayerType.IMAGE,
        visible: true,
        height: heightScaled,
        legacyName: alt,
        parent: '',
        image: {
          _id: uuid(),
          width: width,
          height: height,
          src: originalSrc!,
          originalSrc: originalSrc!,
          imageName: getFileNameWithoutExtension(alt),
          generativeOptions,
        },
        settings: {
          generativeOptions,
          // Default: Enable buyer's image mode (customer upload/AI generation)
          enableBuyerImage: true,
          enableSellerImage: false,
        },
      })
    )
  }

  return newLayerStores
}

/**
 * Creates an imageless element layer store
 */
export function createImagelessElement(context: ElementCreationContext): TLayerStore {
  const { t, imagelessLayerCount = 0 } = context
  const _id = uuid()

  return createLayerStore({
    _id,
    visible: true,
    type: ELayerType.IMAGELESS,
    parent: '',
    label: `${t('imageless')} ${imagelessLayerCount + 1}`,
  })
}

/**
 * Creates a multi-layout element layer store
 */
export function createMultiLayoutElement(context: ElementCreationContext): TLayerStore {
  const { shopDomain, t, multiLayoutLayerCount = 0 } = context
  const _id = uuid()

  const optionSet: any[] = [
    {
      _id: uuid(),
      shopDomain,
      labelOnStoreFront: getDefaultStorefrontLabel({ t, type: EOptionSet.MULTI_LAYOUT_OPTION }),
      type: EOptionSet.MULTI_LAYOUT_OPTION,
      data: {
        multi_layout: {
          _id: uuid(),
          layouts: [],
          layoutNumber: 1,
          originalLayersSelected: [],
        },
      },
    },
  ]

  return createLayerStore({
    _id,
    open: true,
    visible: true,
    type: ELayerType.MULTI_LAYOUT,
    optionSet: optionSet,
    parent: '',
    label: `${t('multi-layout')} ${multiLayoutLayerCount + 1}`,
  })
}

/**
 * Factory function to create elements based on type
 */
export function createElement(
  type: LayerType,
  context: ElementCreationContext,
  mediaFiles?: IImageQuery[] | null,
  generativeOptions?: GenerativeOptions,
  settings?: LayerDocument['settings']
): TLayerStore[] {
  switch (type) {
    case ELayerType.TEXT:
      return [createTextElement(context, settings as TextSettings)]

    case ELayerType.IMAGE:
      if (!mediaFiles?.length) {
        return []
      }
      return createImageElements(mediaFiles, context, generativeOptions)

    case ELayerType.IMAGELESS:
      return [createImagelessElement(context)]

    case ELayerType.MULTI_LAYOUT:
      return [createMultiLayoutElement(context)]

    case ELayerType.CHARM_NODE:
      return [createCharmNodeElement(context)]

    default:
      return []
  }
}

/**
 * Creates a charm node element layer store.
 * Label is auto-numbered using `charmNodeLayerCount` from context (e.g. "Charm builder 1", "Charm builder 2").
 */
export function createCharmNodeElement(context: ElementCreationContext): TLayerStore {
  const { shopDomain, t, charmNodeLayerCount = 0 } = context
  const _id = uuid()

  return createLayerStore({
    _id,
    visible: true,
    type: ELayerType.CHARM_NODE,
    parent: '',
    label: `${t('charm-builder')} ${charmNodeLayerCount + 1}`,
    shopDomain,
    settings: {
      displayStyle: 'FREE' as const,
      nodes: [],
      linkedProducts: [],
      maxCharms: 5,
    },
  })
}

/**
 * Creates a CHARM layer store for an individual charm instance.
 * CHARM layers are virtual — they exist for the toolbar/inspector pipeline
 * but do not render on canvas (CharmNodeCanvasRenderer handles rendering).
 */
export function createCharmElement(
  context: ElementCreationContext,
  charmNodeLayerId: string,
  product: CharmProductRef,
  transform: CharmTransformInstance
): TLayerStore {
  const { shopDomain, t } = context

  const layerStore = createLayerStore({
    _id: uuid(),
    visible: true,
    type: ELayerType.CHARM,
    parent: charmNodeLayerId,
    label: product.title || t('charm'),
    shopDomain,
    left: transform.x,
    top: transform.y,
    width: CHARM_THUMB_SIZE * transform.scale,
    height: CHARM_THUMB_SIZE * transform.scale,
    rotate: transform.rotation,
    settings: {
      nodeId: charmNodeLayerId,
      productRef: {
        _id: product._id,
        shopifyProductId: product.shopifyProductId,
        selectedVariantId: product.selectedVariantId,
        title: product.title,
        price: product.price,
        currencyCode: product.currencyCode,
        thumbnailUrl: product.thumbnailUrl,
        instanceId: transform.instanceId,
      },
    } as CharmSettings,
  })

  // Register in charm layer index for O(1) lookup
  registerCharmLayer(transform.instanceId, layerStore)

  return layerStore
}
