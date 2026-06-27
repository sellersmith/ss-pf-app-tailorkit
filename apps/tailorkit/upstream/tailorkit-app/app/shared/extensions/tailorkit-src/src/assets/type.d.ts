import type { OptionsType } from '../fns/get-fieldset-selector'
import type { BaseTransform, PercentageTransform, ClipGroupPct } from '../fns/decode-option-transform'

type ProductImage = {
  // Product image URL for previewing the final print
  u: string
  // Width of the product image
  w: number
  // Height of the product image
  h: number
}

type Design = {
  // Width of the option set images on a product image
  w: number
  // Height of the option set images on a product image
  h: number
  // Top offset of option set images on a product image
  t: number
  // Left offset of option set images on a product image
  l: number
  // Rotation angle (in degree unit) of option set images on a product image
  r: number
  // Original scale x of option set images on a product image
  originalScaleX: number
  // Original scale y of option set images on a product image
  originalScaleY: number

  // Mask of for layer design
  mask?: {
    width: number
    height: number
    rotation: number
    x: number
    y: number
  }

  // The clip group of the option
  clipGroup?: KonvaEditorState
}

type Option = {
  // The id of the option
  i: string
  // The label/name of option value
  l: string
  /**
   * The value of the option to identify it with other options.
   * In case of image options, the `v` prop is the URL to the option image.
   * In case of font options, the `v` prop is the font family source and font family name, it is a string like: `{family: 'Arial', src: 'source-url'}`
   */
  v: string
  // The selected state of the option
  s?: number
  // The design state of the option
  ds?: Design
  // The clip group of the option
  clipGroup?: KonvaEditorState
  // Base transform for individual mode (used with pct for decoding)
  base?: BaseTransform
  // Percentage transform for individual mode
  pct?: PercentageTransform
  // ClipGroup percentage values for individual mode
  clipGroupPct?: ClipGroupPct
  // The mask config of the option
  maskConfig?: {
    src: string
    invert?: boolean
    globalCompositeOperation?: 'destination-in' | 'source-in' | 'destination-out' | 'source-out'
    smoothEdges?: boolean
    smoothingStrength?: number
  }
  // For multi-layout option value: list of layer ids to show
  ls?: string[]
  // SVG overlay data for raster images (from VectorEditor)
  overlay?: OverlayData
  // Pre-composited thumbnail URL (for image options with SVG overlay)
  compositedThumbnailSrc?: string
}

// Create the new option
type ExtendedImageOption = Option & { type: 'image_uploaded' | 'image_generated_by_ai'; removedBackground?: boolean }

type OptionSet = {
  // An ID to identify the option set
  i: string
  // Option set label
  l: string
  // Option set type
  t: string
  // List of options to customize the print area
  ol: Option[]
  // Selected layout value (for multi-layout)
  layoutSelected?: string
}

type ImageOptionSet = OptionSet & {
  /** Whether customer must upload/generate an image */
  required?: boolean
  /** Allow customer to use image option set */
  allowCustomerUseImageOptionSet?: boolean
  /** Allow customer to upload image */
  allowCustomerUploadImage?: boolean
  /** Allow customer to generate image with AI */
  allowCustomerGenerateImageWithAI?: boolean
  /** Allow customer to edit image */
  allowCustomerToEditImage?: {
    allowTransform: boolean
    allowRotate: boolean
    allowZoom: boolean
    allowRemoveBackground: boolean
  }
}

/** SVG overlay metadata from VectorEditor */
type OverlayMetadata = {
  imageWidth: number
  imageHeight: number
  hasClipPaths: boolean
  hasFilters: boolean
  hasDrawnPaths: boolean
  hasHoles?: boolean
  hasAdjustmentMasks?: boolean
}

/** Overlay data from VectorEditor for raster images */
type OverlayData = {
  /** Combined SVG string for rendering (contains clipPath, mask, filter, paths) */
  overlaySvg: string
  /** SVG string for resuming editing (contains all editable paths) */
  editableSvg?: string
  /** Metadata about the overlay */
  overlayMetadata?: OverlayMetadata
  /** State for restoring clip/hole/adjustment mask settings */
  overlayState?: any
}

type Layer = {
  // Layer ID
  i?: string
  // Layer type
  t?: string
  // Layer settings (includes overlay data from VectorEditor)
  s?: {
    overlay?: OverlayData
    [key: string]: any
  }
  // Layer shape settings
  ss: {
    label?: string
    /** @deprecated */
    shape: 'rectangle' | 'triangle' | 'ellipse' | 'star' | 'heart'
    enableForCustomers: boolean
    /**
     * Allow customer to drag/move this layer (requires enableForCustomers: true).
     * Defaults to true when not set.
     */
    movable?: boolean
    /**
     * Allow customer to resize this layer (requires enableForCustomers: true).
     * Defaults to true when not set.
     */
    resizable?: boolean
    /**
     * Allow customer to rotate this layer (requires enableForCustomers: true).
     * Defaults to true when not set.
     */
    rotatable?: boolean
    /**
     * Movement zone for buyer text movement feature.
     * Already scaled to canvas px by preparation-fns.server.ts.
     */
    movementBounds?: {
      type: 'rectangle' | 'ellipse' | 'path'
      x: number
      y: number
      width: number
      height: number
      /** SVG d attribute — only for type === 'path' */
      pathData?: string
      pathViewBox?: { width: number; height: number }
    }
    /**
     * Initial text x offset from movementBounds.x (already scaled to canvas px).
     * Initial position = movementBounds.x + defaultOffsetX.
     */
    defaultOffsetX?: number
    /**
     * Initial text y offset from movementBounds.y (already scaled to canvas px).
     * Initial position = movementBounds.y + defaultOffsetY.
     */
    defaultOffsetY?: number
  }
  // Layer image URL
  u: string
  // The dimension and position of the layer image on the current product image
  ds: Design
  // Option set or option for customer is wrapped in a fieldset
  optionSelectors: OptionsType
  // osl
  osl?: OptionSet[]
  // Print area id
  printAreaId: string
  // Conditional logic props
  controls?: {
    action: 'show' | 'hide'
    conditions: [
      {
        ifOptionSelected: string
        thenShowOrHideLayers: string[]
      },
    ]
  }
  isControlledBy?: string[]
  // HOTFIX: Layer updated timestamp for rendering version control
  // Used to determine old vs new text rendering (remove after July 2026)
  updatedAt?: string
  // Paint-based fills (image/gradient fills) - can be at layer level
  fills?: unknown[]
  // Paint-based strokes - can be at layer level
  strokes?: unknown[]
}

type TemplateDesign = Design & {
  // List of layer images (belonging to a template) that produce the final print
  ls: Layer[]
}

type LayerIntegration = {
  i: string
  // Layer integration type
  t: 'template' | 'image'
  // Layer integration data
  data: { printAreaId: string; ls: Layer[]; osl: OptionSet[] }
  // Layer integration visible
  vsb?: boolean
}

type PrintArea = {
  // Print area id
  i: string
  // List layers
  ls: Layer[]
  // Based on the layer integration visible
  vsb?: boolean
  // Charm builder configuration
  charmConfig?: any
}

interface TransmitterEventData {
  immediate?: boolean
  automation?: boolean
}

type ProductPersonalizerElementType = {
  // An ID to identify the print area
  i: string
  // Print area label
  l: string
  // List of product images to preview the final print
  pi?: ProductImage
  // Background image
  bgi?: ProductImage
  // List layer integrations
  lis?: any[]
  // Enable clipping mask
  enableClippingMask?: boolean
  // Exist option set
  eot?: boolean
  // Pre-made prompt
  preMadePrompt?: string

  // Presentational views (optional). Each view orders layers and applies overrides.
  views?: Array<{
    _id?: string
    title?: string
    baseImage?: ProductImage | null
    backgroundImage?: ProductImage | null
    maskImage?: ProductImage | null
    enableClippingMask?: boolean
    layers?: string[]
    overrides?: Record<
      string,
      {
        x?: number
        y?: number
        width?: number
        height?: number
        rotation?: number
        visible?: boolean
      }
    >
  }>

  /**
   * @deprecated
   */
  // List of template designs for every product image
  td?: TemplateDesign
}

type DrawLivePreviewFunction = () => Promise<void>

export {
  ProductImage,
  Design,
  Option,
  ExtendedImageOption,
  OptionSet,
  ImageOptionSet,
  Layer,
  OverlayData,
  OverlayMetadata,
  TemplateDesign,
  LayerIntegration,
  PrintArea,
  ProductPersonalizerElementType,
  DrawLivePreviewFunction,
  TransmitterEventData,
}
