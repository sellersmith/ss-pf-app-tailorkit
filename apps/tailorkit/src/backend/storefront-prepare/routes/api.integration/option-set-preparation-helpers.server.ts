import type { MultiLayoutOptionSet } from '../../types/psd'
import { EOptionSet, optionSetDataKeys } from '../../types/psd'
import { isAdditionalPricingEnabled } from '../../utils/optionSet-pricing'
import { prepareImageOptionIndividualData } from './image-option-helpers.server'

/**
 * Canonical storefront display order for option sets.
 * Mirrors the admin Text element inspector render order (Text → Font → Colour),
 * so the storefront doesn't depend on DB insertion order of optionSet entries.
 * Unknown types fall back to the end of the list.
 * @see app/modules/TemplateEditor/elements/components/Text/index.tsx
 */
const OPTION_SET_DISPLAY_ORDER: Record<string, number> = {
  [EOptionSet.TEXT_OPTION]: 0,
  [EOptionSet.FONT_OPTION]: 1,
  [EOptionSet.COLOR_OPTION]: 2,
  [EOptionSet.IMAGE_OPTION]: 3,
  [EOptionSet.MASK_OPTION]: 4,
  [EOptionSet.IMAGELESS_OPTION]: 5,
  [EOptionSet.MULTI_LAYOUT_OPTION]: 6,
}

/**
 * Transforms a layer's option sets into a storefront-ready serialized format.
 * Filters preset images based on image personalization mode and handles multi-layout options.
 */
export const prepareOptionSets = (
  layer: any,
  scale: { x: number; y: number } | null,
  hasAiCredits?: boolean,
  // Optional shop-wide Colour Guide URL used as fallback when a color_option
  // has no per-template `data.colourGuideImageUrl`. Per-template wins.
  globalColourGuideUrl?: string,
  // Optional shop-wide intro/description text shown above the swatch list in
  // the Colour Guide modal. Falls back when per-template description empty.
  globalColourGuideDescription?: string
) => {
  const { optionSet: optionSetList = [], settings: { storefrontOptionSetLabels = undefined } = {} } = layer || {}

  // Sort to canonical display order before mapping so storefront render order
  // matches admin preview regardless of DB insertion order.
  const sortedOptionSetList = [...optionSetList].sort((a: any, b: any) => {
    const orderA = OPTION_SET_DISPLAY_ORDER[a?.type] ?? 99
    const orderB = OPTION_SET_DISPLAY_ORDER[b?.type] ?? 99
    return orderA - orderB
  })

  return sortedOptionSetList.map((optionSet: any) => {
    const { type, data = {} } = optionSet || {}
    // Honor the merchant's per-option-set toggle: if extra pricing is disabled,
    // strip pricing from the storefront payload so the buyer is never charged
    // for stale data (e.g. merchant turned the toggle off after configuring prices).
    const pricingEnabled = isAdditionalPricingEnabled(optionSet)

    // For multi-layout, prioritize layer's storefrontLabel over optionSet's labelOnStoreFront
    const label
      = type === EOptionSet.MULTI_LAYOUT_OPTION
        ? storefrontOptionSetLabels?.[type] || layer?.settings?.storefrontLabel || optionSet.labelOnStoreFront
        : storefrontOptionSetLabels?.[type] || optionSet.labelOnStoreFront || layer?.settings?.storefrontLabel

    const baseOption: any = {
      t: type,
      i: optionSet._id,
      l: label,
    }

    const optionDataKey = optionSetDataKeys[type as keyof typeof optionSetDataKeys]

    let ol: any[] = []

    const optionSetData = evaluateOptionSetData(type, optionDataKey, data, layer)

    // Prepare data option set for multi-layout element
    if (optionDataKey === optionSetDataKeys[EOptionSet.MULTI_LAYOUT_OPTION]) {
      const _optionSetData = optionSetData as MultiLayoutOptionSet

      if (!_optionSetData) {
        return
      }

      // Upstream assumes a configured multi_layout option-set always has populated `data` so
      // `layouts` is an array. PageFly's editor can persist an unconfigured option-set with
      // `data: null`, in which case `evaluateOptionSetData` yields `[]` and `.layouts` is undefined.
      // Guard with optional chaining so an empty/unconfigured multi_layout is skipped, not a crash.
      const layouts = _optionSetData.layouts

      if (!layouts?.length) {
        return
      }

      ol = layouts.map(layout => {
        return {
          i: layout._id,
          v: layout._id,
          l: layout.name,
          t: layout.thumbnail,
          ls: layout.layerIds,
        }
      })

      // Set first layout is layout selected by default
      const layoutSelected = layouts[0]?._id || null

      baseOption.layoutSelected = layoutSelected
    } else {
      function getOptionValue(optionData: any) {
        let v = ''
        switch (type) {
          case 'mask_option':
          case 'image_option':
            v = optionData.src
            break
          case 'font_option':
            v = JSON.stringify({ family: optionData.family, src: optionData.src })
            break
          case 'color_option':
            v = optionData.value
            break
          default:
            v = optionData.name
            break
        }

        return v
      }

      ol = optionSetData?.map((d: any) => {
        // Imageless option sets used to auto-select the first option when none was pre-selected
        // (so conditional logic had a valid initial selection). That caused buyers to be silently
        // charged additional-cost options (e.g. "Yes (+$20)") they never interacted with. Leaving
        // the field empty means: no configuration, no charge. Conditional layers with no
        // selection now fall through to their default (template-designed) visibility.

        const base: any = {
          i: d._id,
          l: d.name,
          v: getOptionValue(d),
          ...(pricingEnabled && d.additionalPricing ? { additionalPricing: d.additionalPricing } : {}),
          ...(d.selecting ? { s: 1 } : {}),
          ...(d.thumbnail ? { t: d.thumbnail } : {}),
          // Include overlay data for VectorEditor-edited raster images
          ...(d.overlay?.overlaySvg
            ? {
                overlay: {
                  overlaySvg: d.overlay.overlaySvg,
                  overlayMetadata: d.overlay.overlayMetadata,
                },
              }
            : {}),
          // Include pre-composited thumbnail URL for storefront swatch rendering
          ...(d.compositedThumbnailSrc ? { compositedThumbnailSrc: d.compositedThumbnailSrc } : {}),
        }

        // IMAGE_OPTION with scale: prepare individual mode data for storefront
        if (type === EOptionSet.IMAGE_OPTION && scale) {
          return prepareImageOptionIndividualData(base, d, optionSet, layer, scale)
        }

        return base
      })
    }

    // Omit the optionDataKey + Colour Guide fields (serialized as short keys `cg`/`cd` below) from data
    const { [optionDataKey]: omit, colourGuideImageUrl: _omitCg, colourGuideDescription: _omitCd, ...rest } = data || {}

    const advancedOption = {
      ...rest,
    }

    // Calculate image personalization mode flags once (for IMAGE_OPTION type)
    let enableBuyerImage = false
    let enableSellerImage = false

    if (type === EOptionSet.IMAGE_OPTION) {
      const imageUploaderOptions = layer?.settings?.imageUploaderOptions

      // Calculate backend flags (source of truth)
      enableBuyerImage
        = layer?.settings?.enableBuyerImage
        ?? imageUploaderOptions?.allowCustomerGenerateImageWithAI
        ?? imageUploaderOptions?.allowCustomerUploadImage
        ?? false

      enableSellerImage
        = layer?.settings?.enableSellerImage ?? imageUploaderOptions?.allowCustomerUseImageOptionSet ?? false

      // Serialize image uploader options based on selected mode
      if (imageUploaderOptions) {
        // IMPORTANT: Use enableBuyerImage/enableSellerImage as source of truth
        // Only serialize flags relevant to the selected mode

        // Override AI generation flag when credits are exhausted at publish time
        const effectiveAllowAI = hasAiCredits === false ? false : imageUploaderOptions.allowCustomerGenerateImageWithAI

        if (enableBuyerImage && !enableSellerImage) {
          // Buyer's image mode: Only serialize customer upload/AI flags
          advancedOption.required = imageUploaderOptions.required
          advancedOption.allowCustomerUploadImage = imageUploaderOptions.allowCustomerUploadImage
          advancedOption.allowCustomerGenerateImageWithAI = effectiveAllowAI
          advancedOption.allowCustomerToEditImage = imageUploaderOptions.allowCustomerToEditImage
          advancedOption.allowCustomerToUseReferenceImage = imageUploaderOptions.allowCustomerToUseReferenceImage
          // DO NOT serialize allowCustomerUseImageOptionSet (merchant's preset images)
        } else if (enableSellerImage && !enableBuyerImage) {
          // Your image mode: Only serialize option set flag
          advancedOption.allowCustomerUseImageOptionSet = imageUploaderOptions.allowCustomerUseImageOptionSet
          // DO NOT serialize allowCustomerUploadImage/allowCustomerGenerateImageWithAI (buyer's flags)
        } else {
          // Backward compatibility: Both flags or neither set, flatten all flags (old templates)
          advancedOption.required = imageUploaderOptions.required
          advancedOption.allowCustomerUploadImage = imageUploaderOptions.allowCustomerUploadImage
          advancedOption.allowCustomerGenerateImageWithAI = effectiveAllowAI
          advancedOption.allowCustomerToEditImage = imageUploaderOptions.allowCustomerToEditImage
          advancedOption.allowCustomerUseImageOptionSet = imageUploaderOptions.allowCustomerUseImageOptionSet
        }
      }
    }

    // Filter preset images (ol) based on selected mode
    if (type) {
      let filteredOl = ol || []

      if (type === EOptionSet.IMAGE_OPTION && enableBuyerImage && !enableSellerImage) {
        // Buyer's image mode: Clear preset images (merchant's option set)
        filteredOl = []
      }

      // Resolve Colour Guide image URL + description for color_option only.
      // Per-template wins over global. Emit short keys `cg` (image) and `cd`
      // (description) only when configured — absent keys signal "no extras".
      const colourGuideUrl
        = type === EOptionSet.COLOR_OPTION ? data?.colourGuideImageUrl || globalColourGuideUrl || '' : ''
      const colourGuideDesc
        = type === EOptionSet.COLOR_OPTION ? data?.colourGuideDescription || globalColourGuideDescription || '' : ''

      // Augment per-colour items with `cgd` (colour guide per-swatch description)
      // when the merchant set one in the admin Color Option Set editor.
      const colours: Array<{ _id?: string; colourGuideDescription?: string }> = data?.colors || []
      const olWithDescriptions
        = type === EOptionSet.COLOR_OPTION
          ? filteredOl.map((item: { i?: string }) => {
              const cgd = colours.find(c => c?._id === item?.i)?.colourGuideDescription
              return cgd ? { ...item, cgd } : item
            })
          : filteredOl

      return {
        ...baseOption,
        ...advancedOption,
        ol: olWithDescriptions,
        ...(colourGuideUrl ? { cg: colourGuideUrl } : {}),
        ...(colourGuideDesc ? { cd: colourGuideDesc } : {}),
      }
    }

    return {}
  })
  // Drop `undefined` holes the map produces for skipped/unconfigured option-sets (e.g. an empty
  // multi_layout). Upstream never emits these because its store always has populated option-set data;
  // PageFly can persist unconfigured option-sets, and a `undefined` entry would crash the storefront
  // runtime's `osl.find(os => os.i === ...)` lookup. Filtering keeps every valid entry untouched.
  .filter(Boolean)
}

/**
 * Extracts the option items array from an option set's data object using the appropriate data key.
 * Returns the items for the given option type (e.g., `files` for image, `colors` for color).
 */
function evaluateOptionSetData(type: EOptionSet, optionDataKey: string, data: any, layer?: any) {
  return data?.[optionDataKey] || []
}
