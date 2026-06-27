/* eslint-disable max-lines */
import type { Shape } from '../_tlksrc/assets/constants/shape'
import type { TextStyle } from '../_tlksrc/assets/libraries/generate-shape-path'
import type { Paint } from '../_tlksrc/shared/libraries/paint'
import type { MaskShape } from '../bootstrap/constants/mask-option-sets'
import type { MEASUREMENT_UNIT } from '../constants/measurement-units'
import type { LayerDocument } from '../_external-types'
import type { EOptionSetEditingMode, OptionPricing } from '../_external-types'
import type {
  ColorDisplayStyle,
  FontDisplayStyle,
  ImageDisplayStyle,
  ImagelessDisplayStyle,
  MaskDisplayStyle,
  MultiLayoutDisplayStyle,
  TextDisplayStyle,
} from '../modules/TemplateEditor/elements/constants'
import type { EffectConfig } from '../modules/TemplateEditor/elements/effects/types'
import type { WizardConfig } from './wizard'

type Template = {
  _id: string
  name: string
  category?: string
  dimension: {
    width: number
    height: number
    measurementUnit: MEASUREMENT_UNIT
    resolution: number
  }
  shopDomain: string
  previewUrl: string
  thumbnailUrl?: string
  previewProductImage?: {
    _id: string
    src: string
    altText: string
    left: number
    top: number
    width: number
    height: number
    rotation: number
    naturalWidth?: number
    naturalHeight?: number
    visible?: boolean
  } | null
  psds: PSD[]
  updatedAt?: Date
  layers: LayerDocument[]
  deletedAt?: Date
  createdAt?: Date | string
  metadata?: Record<string, any>
  /** Step-by-step wizard config — defines how option sets are presented to buyers */
  wizardConfig?: WizardConfig | null
}

type PSD = {
  name: string
  _id: string
  psdId: string
  header: any
  file: any
  image: NodeImage
  layerMask: any
  parsed: boolean
  resources: any
  layers: LayerDocument[]
}

type NodeImage = {
  _id: string
  originalSrc?: string
  src: string
  /** @deprecated */
  dataSrc?: string
  imageName?: string
  file?: any
  opacity?: number
  maskData?: Uint8Array
  pixelData?: Uint8Array
  hasMask?: boolean
  width: number
  height: number
  clipGroup?: {
    absoluteX: number
    absoluteY: number
    absoluteWidth: number
    absoluteHeight: number
    rotation: number

    // Optional properties served for preview
    width?: number
    height?: number
    left?: number
    top?: number
  }

  _width?: number
  _height?: number

  obj?: NodeImage

  channelData?: any
  channelLength?: any
  channelsInfo?: any[]
  toBase64?: () => Promise<string>
  generativeOptions?: {
    prompt?: string
    aspectRatio?: string
    templateType?: string
    visualStyle?: string
    contentTheme?: string
  }

  /** SVG overlay data for raster images edited in VectorEditor */
  overlaySvg?: string
  /** Metadata about the overlay (dimensions, flags) */
  overlayMetadata?: {
    imageWidth: number
    imageHeight: number
    hasClipPaths: boolean
    hasFilters: boolean
    hasDrawnPaths: boolean
  }
}

type NodeText = {
  value: string
  font: {
    lengthArray: number[]
    styles: string[]
    weights: string[]
    names: string[]
    sizes: number[]
    colors: number[][]
    alignment: string[]
    textDecoration: string[]
    leading: number[]
  }
  left: number
  top: number
  right: number
  bottom: number
  transform: { xx: number; xy: number; yx: number; yy: number; tx: number; ty: number }
}

type LayerNode = {
  coords: { top: number; left: number; bottom: number; right: number }
  forVisible: null
  layer: Layer
  leftOffset: number
  name: string
  parent: LayerNode
  topOffset: number
  node: LayerNode
  _children: LayerNode[]
}

type Mask = {
  _id: string
  src?: string
  bottom: number
  left: number
  right: number
  top: number
  size: number
  relative: boolean
  defaultColor: number
  disabled: boolean
  external: boolean
  file: {
    data: Uint8Array
    pos: number
  }
  flags: number
  invert: boolean
  width: number
  height: number
}

export type ImageSettings = {
  /** Storefront label of the image */
  storefrontLabel?: string

  /**
   * Backend flag: Allow buyers to upload/generate images.
   * Controls buyer-side image personalization (upload + AI generation).
   *
   * **UI Pattern**: Mutually exclusive with enableSellerImage (radio button behavior).
   * When true, buyer can upload or generate images. When false, merchant provides preset images.
   *
   * **Used by**: UI, backend serialization, API, storefront rendering.
   *
   * @see enableSellerImage - Merchant provides preset image options
   * @see imageUploaderOptions.allowCustomerUploadImage - Enable upload button
   * @see imageUploaderOptions.allowCustomerGenerateImageWithAI - Enable AI generation
   */
  enableBuyerImage?: boolean

  /**
   * Backend flag: Allow merchant to provide preset image options.
   * Controls merchant-provided image option sets.
   *
   * **UI Pattern**: Mutually exclusive with enableBuyerImage (radio button behavior).
   * When true, merchant provides preset images. When false, customer uploads their own.
   *
   * **Used by**: UI, backend serialization, API, storefront rendering.
   *
   * @see enableBuyerImage - Customer uploads/generates images
   * @see imageUploaderOptions.allowCustomerUseImageOptionSet - Enable option set selection
   */
  enableSellerImage?: boolean
  /** Image uploader options */
  imageUploaderOptions?: {
    /** Required field */
    required?: boolean
    /** Allow buyer to upload image */
    allowCustomerUploadImage?: boolean
    /** Allow buyer to generate image with AI */
    allowCustomerGenerateImageWithAI?: boolean
    /** Allow buyer to use reference image */
    allowCustomerToUseReferenceImage?: boolean
    enabledQuickPrompts?: string[]
    enabledTemplateTypes?: string[]
    enabledVisualStyles?: string[]
    enabledContentThemes?: string[]
    allowCustomerToUseQuickPrompts?: boolean
    allowCustomerToUseTemplateTypes?: boolean
    allowCustomerToUseVisualStyles?: boolean
    allowCustomerToUseContentThemes?: boolean
    /** Allow buyer to edit image */
    allowCustomerToEditImage?: {
      allowTransform?: boolean
      allowRotate?: boolean
      allowZoom?: boolean
      allowRemoveBackground?: boolean
    }
    /** Allow buyer to use your image option set */
    allowCustomerUseImageOptionSet?: boolean
    /** Auto remove solid white background */
    autoRemoveSolidWhiteBackground?: boolean
  }
}

export type TextStyleText = 'bold' | 'italic' | 'underline' | 'normal'
export type TextStyleAlign = 'left' | 'center' | 'right' | 'justify'
export type TextStyleVerticalAlign = 'top' | 'middle' | 'bottom'
export type TextStyleNeonMode = 'none' | 'classic' | 'inverse'
export type TextStyleCase = 'none' | 'uppercase' | 'lowercase' | 'title' | 'sentence'
export type TextStyleShape = 'none' | 'circle' | 'curve' | 'custom' | 'fill-shape'
export type TextStyleStrokePosition = 'outside' | 'center' | 'inside'

export type TextSettings = {
  /** Content of the text */
  content?: string
  /**
   * Wrap text of the text
   * @default 'none'
   * @enum {string}
   * @description
   * - none: No wrapping
   * - word: Wrap text at word boundaries
   * - char: Wrap text at character boundaries
   */
  wrap?: 'none' | 'word' | 'char'
  /** Temporary content of the text */
  tempContent?: string
  /** Font family of the text */
  fontFamily: { family: string; src: string }
  /** Font size of the text */
  fontSize?: number
  /** Line height of the text */
  lineHeight?: number
  /** Letter spacing of the text (pixels). Positive widens, negative tightens */
  letterSpacing?: number
  /** Storefront label of the text */
  storefrontLabel?: string
  /** Placeholder of the text */
  placeholder?: string
  /** Required of the text */
  required?: boolean
  /** Style of the text */
  textStyle: TextStyle['textStyle']
  /** Color of the text */
  textColor?: string
  /**
   * Paint fills for the text (new Paint system)
   * Takes precedence over textColor when set
   */
  fills?: Paint[]
  /** Alignment of the text */
  textAlign?: TextStyleAlign
  /** Vertical alignment of the text */
  verticalAlign?: TextStyleVerticalAlign
  /** Created by of the text */
  textCreatedBy?: 'merchant' | 'customers'
  /** Character limit for text */
  characterLimit?: number
  /** Allow buyers to input multi-line text. Default is false */
  allowMultiLineText?: boolean
  /** Notes for buyers */
  notesForCustomers?: string
  /** Auto fit text to the container. Default is true */
  autoFitToContainer?: boolean
  /** Allow buyers to generate text with AI */
  generateTextWithAI?: {
    allow?: boolean
    settings?: {
      color?: string
    }
  }
  /** Emoji picker configuration for storefront text input */
  emojiPicker?: {
    /** Whether emoji picker is enabled on storefront */
    enabled?: boolean
    /** Raw string of allowed emojis (e.g., "❤️🖤⭐🌙") */
    emojis?: string
    /** Custom font for emoji characters (e.g., monogram icon fonts) */
    font?: { family: string; src: string }
    /** Allow merchants to upload custom emoji fonts inline */
    allowFontUpload?: boolean
  }
  /**
   * @deprecated Use strokes array instead for Paint-based strokes
   */
  strokeColor?: string
  /** Stroke weight of the text */
  strokeWeight?: number
  /**
   * Paint-based strokes (supports solid, image, gradient like Figma)
   * If set, takes precedence over strokeColor
   */
  strokes?: Paint[]
  /** Neon effect mode */
  neonMode?: TextStyleNeonMode
  /** Neon effect intensity */
  neonIntensity?: number
  /** Neon effect shadow offset X */
  neonOffsetX?: number
  /** Neon effect shadow offset Y */
  neonOffsetY?: number
  /** Style case of the text */
  styleCase?: TextStyleCase
  /** Text shape mode */
  textShape?: TextStyleShape
  /** Number of curve peaks for curve text shape */
  curvePeaks?: number
  /** Bend percentage for curve text shape (-100% to 100%) */
  curveBend?: number
  /** Start angle for circular text shape (in radians) */
  circleStartAngle?: number
  /** End angle for circular text shape (in radians) */
  circleEndAngle?: number
  /** Custom SVG path data for 'custom' text shape (d attribute from VectorEditor) */
  customPathData?: string
  /** Metadata for custom path editing and scaling */
  customPathMetadata?: {
    /** Original viewBox width from VectorEditor */
    viewBoxWidth: number
    /** Original viewBox height from VectorEditor */
    viewBoxHeight: number
    /** Editable SVG for resuming editing in VectorEditor */
    editableSvg?: string
  }
  /** Fill shape SVG path data for 'fill-shape' text shape (closed path from VectorEditor) */
  fillShapePathData?: string
  /** Metadata for fill shape editing and scaling */
  fillShapeMetadata?: {
    /** Original viewBox width from VectorEditor */
    viewBoxWidth: number
    /** Original viewBox height from VectorEditor */
    viewBoxHeight: number
    /** Editable SVG for resuming editing in VectorEditor */
    editableSvg?: string
  }
  /**
   * Vertical offset for fill-shape text positioning (-50 to +50 percent)
   * Positive values move text down, negative move text up
   * @default 0
   */
  fillShapeVerticalOffset?: number
  /**
   * Vertical scale factor for fill-shape character height (0.5 to 2.0)
   * Values > 1.0 stretch characters taller, < 1.0 compress them
   * @default 1.0
   */
  fillShapeVerticalScale?: number
  /**
   * Horizontal offset for fill-shape text positioning (-50 to +50 percent)
   * Positive values move text right, negative move text left
   * @default 0
   */
  fillShapeHorizontalOffset?: number
  /**
   * Horizontal scale factor for fill-shape character width (0.5 to 2.0)
   * Values > 1.0 stretch characters wider, < 1.0 compress them
   * @default 1.0
   */
  fillShapeHorizontalScale?: number
  /**
   * Character spacing adjustment for fill-shape (-50 to +50)
   * Negative values bring characters closer together, positive values spread them apart
   * @default 0
   */
  fillShapeCharacterSpacing?: number
  /** Invert circle text direction (counter-clockwise when true) */
  circleInverted?: boolean
  /** Invert custom path text direction (text flows in reverse when true) */
  customPathInverted?: boolean
  /** Composable effects stack applied to text */
  effects?: EffectConfig[]
  /** Metadata for UI state and preferences (not affecting visual output) */
  metadata?: {
    /** Font filter preferences for this text layer */
    fontFilterPreferences?: {
      /** Selected font kind */
      fontKind?: 'google-fonts' | 'custom-fonts'
      /** Google Fonts filter values */
      googleFontsFilters?: {
        styleTagPaths?: string[]
        languageIds?: string[]
        subsetKeys?: string[]
      }
    }
    /** Currently selected effect preset style */
    effectStyle?: 'none' | 'emboss' | 'deboss' | 'neon' | 'outline' | null
    /** Whether color overlay is applied for emboss/deboss */
    applyColorOverlay?: boolean
  }
  /**
   * Hide this text layer when content is empty (trimmed whitespace)
   * Works for both merchant and customer text inputs
   * @default false
   */
  hideWhenEmpty?: boolean
  /**
   * Skip visual effects (shadows, blur, noise) when generating print images.
   * Effects still render in admin canvas and storefront preview.
   * @default false
   */
  skipEffectsWhenPrinting?: boolean
}

type LayerType =
  | ELayerType.IMAGE
  | ELayerType.TEXT
  | ELayerType.IMAGELESS
  | ELayerType.MULTI_LAYOUT
  | ELayerType.GROUP
  | ELayerType.CHARM_NODE
  | ELayerType.CHARM

type Layer = {
  _id: string
  type: ELayerType
  label: string
  psdId: string
  blendingRanges: any
  channels: number
  channelsInfo: any[]
  cols: number
  inforKeys: any[]
  image: NodeImage | string
  width: number
  height: number
  left: number
  top: number
  right: number
  bottom: number
  visible: boolean
  rotate: number
  legacyName: string
  mask: Mask
  node: LayerNode
  parent?: string | null
  clonedBy?: string

  // Extra properties
  resourceUrl?: string
  maskSrc?: string
  optionSet?: OptionSet[]
  children?: string[] | LayerNode[]
  isStatic?: boolean
  settings?: ImageSettings | TextSettings | CharmNodeSettings | CharmSettings

  overlay?: {
    overlaySvg: string
    editableSvg?: string
    overlayState?: any
    overlayMetadata?: any
  }
}

export enum EOptionSet {
  IMAGE_OPTION = 'image_option',
  TEXT_OPTION = 'text_option',
  COLOR_OPTION = 'color_option',
  FONT_OPTION = 'font_option',
  MULTI_LAYOUT_OPTION = 'multi_layout_option',
  IMAGELESS_OPTION = 'imageless_option',
  SHAPE = 'shape',
  MASK_OPTION = 'mask_option',
}

export const FILE_OPTION_TYPE = 'files'
export const TEXT_OPTION_TYPE = 'texts'
export const COLOR_OPTION_TYPE = 'colors'
export const FONT_OPTION_TYPE = 'fonts'
export const MULTI_LAYOUT_OPTION_TYPE = 'multi_layout'
export const IMAGELESS_OPTION_TYPE = 'values'
export const MASK_OPTION_TYPE = 'masks'

export const optionSetDataKeys = {
  [EOptionSet.IMAGE_OPTION]: FILE_OPTION_TYPE,
  [EOptionSet.TEXT_OPTION]: TEXT_OPTION_TYPE,
  [EOptionSet.COLOR_OPTION]: COLOR_OPTION_TYPE,
  [EOptionSet.FONT_OPTION]: FONT_OPTION_TYPE,
  [EOptionSet.MULTI_LAYOUT_OPTION]: MULTI_LAYOUT_OPTION_TYPE,
  [EOptionSet.IMAGELESS_OPTION]: IMAGELESS_OPTION_TYPE,
  [EOptionSet.MASK_OPTION]: MASK_OPTION_TYPE,
}

export const optionSetDataKeyValidation: Partial<Record<EOptionSet, Record<string, { required: boolean }>>> = {
  [EOptionSet.IMAGE_OPTION]: {
    [FILE_OPTION_TYPE]: {
      required: false,
    },
  },
  [EOptionSet.TEXT_OPTION]: {
    [TEXT_OPTION_TYPE]: {
      required: true,
    },
  },
  [EOptionSet.COLOR_OPTION]: {
    [COLOR_OPTION_TYPE]: {
      required: true,
    },
  },
  [EOptionSet.FONT_OPTION]: {
    [FONT_OPTION_TYPE]: {
      required: true,
    },
  },
  [EOptionSet.MULTI_LAYOUT_OPTION]: {
    [MULTI_LAYOUT_OPTION_TYPE]: {
      required: true,
    },
  },
  [EOptionSet.IMAGELESS_OPTION]: {
    [IMAGELESS_OPTION_TYPE]: {
      required: true,
    },
  },
  [EOptionSet.MASK_OPTION]: {
    [MASK_OPTION_TYPE]: {
      required: true,
    },
  },
}

export type IMAGE_OPTION_SET = {
  _id: string
  data: ImageDataOptionSet | null
  type: EOptionSet.IMAGE_OPTION
  label?: string
  shopDomain?: string
  labelOnStoreFront?: string
  additionalPricingEnabled?: boolean
  /** Editor-only: per-option-set editing mode */
  editingMode?: EOptionSetEditingMode
  /**
   * Editor-only: Original base layer state before any individual editing started.
   * Used to restore the original state when switching back to sync mode or switching layers.
   * Set to null when cleared (for MongoDB to actually remove the field).
   */
  originalBaseState?: {
    width: number
    height: number
    left: number
    top: number
    rotate: number
    /** Original image source URL when entering individual mode */
    imageSrc?: string
  } | null
  /**
   * Editor-only: Original clipGroup state when entering individual mode.
   * Used to restore the original clip position when switching layers or back to sync mode.
   * Set to null when cleared (for MongoDB to actually remove the field).
   */
  originalClipGroup?: NodeImage['clipGroup'] | null
}

export type IMAGELESS_OPTION_SET = {
  _id: string
  data: ImagelessDataOptionSet | null
  type: EOptionSet.IMAGELESS_OPTION
  label?: string
  shopDomain?: string
  labelOnStoreFront?: string
  additionalPricingEnabled?: boolean
}

export type TEXT_OPTION_SET = {
  _id: string
  data: TextDataOptionSet | null
  type: EOptionSet.TEXT_OPTION
  label?: string
  shopDomain?: string
  labelOnStoreFront?: string
  additionalPricingEnabled?: boolean
}

export type COLOR_OPTION_SET = {
  _id: string
  data: ColorDataOptionSet | null
  type: EOptionSet.COLOR_OPTION
  label?: string
  shopDomain?: string
  labelOnStoreFront?: string
  additionalPricingEnabled?: boolean
}

export type FONT_OPTION_SET = {
  _id: string
  data: FontDataOptionSet | null
  type: EOptionSet.FONT_OPTION
  label?: string
  shopDomain?: string
  labelOnStoreFront?: string
  additionalPricingEnabled?: boolean
}

export type SHAPE_OPTION_SET = {
  _id: string
  // Shape option set data is unknown
  label?: string
  data: any
  type: EOptionSet.SHAPE
  labelOnStoreFront?: string
}

export type MULTI_LAYOUT_OPTION_SET = {
  _id: string
  data: MultiLayoutDataOptionSet | null
  type: EOptionSet.MULTI_LAYOUT_OPTION
  label?: string
  shopDomain?: string
  labelOnStoreFront?: string
}

export type MASK_OPTION_SET = {
  _id: string
  data: MaskDataOptionSet | null
  type: EOptionSet.MASK_OPTION
  label?: string
  shopDomain?: string
  labelOnStoreFront?: string
  additionalPricingEnabled?: boolean
}

// Discriminated Union for OptionSet
type OptionSet =
  | IMAGE_OPTION_SET
  | IMAGELESS_OPTION_SET
  | TEXT_OPTION_SET
  | COLOR_OPTION_SET
  | FONT_OPTION_SET
  | MULTI_LAYOUT_OPTION_SET
  // | SHAPE_OPTION_SET
  | MASK_OPTION_SET

type ImageDataOptionSet = {
  [FILE_OPTION_TYPE]: ImageOptionSet[]
  displayType?: 'image' | 'video'
  displayStyle?: ImageDisplayStyle
}

type MaskDataOptionSet = {
  [MASK_OPTION_TYPE]: (MaskShape & {
    selecting: boolean
  })[]
  displayStyle?: MaskDisplayStyle
}

type ImagelessDataOptionSet = {
  [IMAGELESS_OPTION_TYPE]: ImagelessOptionSet[]
  displayStyle?: ImagelessDisplayStyle
}

type ImageOptionSet = {
  _id: string
  name: string
  size?: number
  type?: string
  arrayBuffer?: () => Promise<ArrayBuffer>
  src: string
  dataSrc?: string
  selecting: boolean
  additionalPricing?: OptionPricing

  /**
   * Optional transform data saved when a user adjusts this image on the canvas.
   * Stored in canvas (pixel) coordinate space exactly as persisted in the layer store.
   */
  width?: number
  height?: number
  left?: number
  top?: number
  rotate?: number

  /**
   * Percent-based transform relative to the base image layer at selection time.
   * These are the source of truth to recompute absolute transforms when base changes.
   */
  widthPct?: number
  heightPct?: number
  leftPct?: number
  topPct?: number
  /** Rotation delta relative to base rotation (degrees) */
  rotateDelta?: number

  /**
   * Snapshot of base layer geometry at the moment this option becomes selected.
   * Used in editor to encode percentages. Not serialized to storefront.
   * Set to null when cleared (for MongoDB to actually remove the field).
   */
  baseSnapshot?: {
    width: number
    height: number
    left: number
    top: number
    rotate: number
  } | null
  clipGroup: NodeImage['clipGroup']

  /**
   * Percent-based clipGroup transform relative to container dimensions.
   * These are the source of truth to recompute absolute clipGroup when container changes.
   * Only populated in individual editing mode when user edits the clip position.
   */
  clipGroupPct?: {
    /** absoluteX / container.width */
    absoluteXPct?: number
    /** absoluteY / container.height */
    absoluteYPct?: number
    /** absoluteWidth / container.width */
    absoluteWidthPct?: number
    /** absoluteHeight / container.height */
    absoluteHeightPct?: number
    /** rotation delta relative to container rotation (degrees) */
    rotationDelta?: number
  }

  /**
   * SVG overlay data for raster images edited in VectorEditor.
   * When present, the overlay SVG should be composited on top of the base image.
   */
  overlay?: {
    /** Rendered overlay SVG (with clipPath, mask, filter, paths) */
    overlaySvg?: string
    /** Editable overlay SVG (contains all paths for resuming editing) */
    editableSvg?: string
    /** Overlay state for restoring clip/hole/adjustment mask settings */
    overlayState?: any
    /** Metadata about the overlay (dimensions, flags) */
    overlayMetadata?: {
      imageWidth: number
      imageHeight: number
      hasClipPaths: boolean
      hasFilters: boolean
      hasDrawnPaths: boolean
    }
  }

  /**
   * Pre-composited thumbnail URL for web component rendering.
   * Generated during save when overlay exists.
   */
  compositedThumbnailSrc?: string
}

type ImagelessOptionSet = {
  _id: string
  name: string
  type: string
  thumbnail?: string
  selecting: boolean
  additionalPricing?: OptionPricing
}

type TextDataOptionSet = {
  [TEXT_OPTION_TYPE]: TextOptionSet[]
  displayStyle?: TextDisplayStyle
}

type TextOptionSet = {
  _id: string
  name: string
  selecting: boolean
  additionalPricing?: OptionPricing
}

type ColorDataOptionSet = {
  [COLOR_OPTION_TYPE]: ColorOptionSet[]
  displayStyle?: ColorDisplayStyle
}

type FontDataOptionSet = {
  [FONT_OPTION_TYPE]: FontOptionSet[]
  displayStyle?: FontDisplayStyle
}

type FontOptionSet = {
  _id: string
  name: string
  family: string
  svgString: string
  src: string
  selecting: boolean
  fontSource: 'google' | 'custom'
  additionalPricing?: OptionPricing
}

type ColorOptionSet = {
  _id: string
  name: string
  selecting: boolean
  value: string
  additionalPricing?: OptionPricing
}

type Layout = {
  _id: string
  name: string
  layerIds: string[]
  thumbnail: string
}

type MultiLayoutOptionSet = {
  _id: string
  originalLayersSelected: string[]
  layoutNumber: number
  layouts: Layout[]
  layoutSelected?: string
}

type MultiLayoutDataOptionSet = {
  [MULTI_LAYOUT_OPTION_TYPE]: MultiLayoutOptionSet
  displayStyle?: MultiLayoutDisplayStyle
}

/** Zone shape type for buyer text movement zone */
export type MovementZoneType = 'rectangle' | 'ellipse' | 'path'

/**
 * Defines the bounded zone within which the buyer can move/resize text.
 * Stored in shapeSettings, scaled by safeScaleX/Y in preparation-fns before sending to storefront.
 * Zone acts as a clipping mask — text outside zone is hidden (same as image+mask pattern).
 */
export type MovementBounds = {
  /** Shape of the zone boundary (default: 'rectangle') */
  type: MovementZoneType
  /** Bounding box left, canvas px relative to print area */
  x: number
  /** Bounding box top, canvas px relative to print area */
  y: number
  width: number
  height: number
  /** SVG d attribute — only for type === 'path' (from VectorEditor) */
  pathData?: string
  /** Original viewBox dimensions for scaling pathData to canvas */
  pathViewBox?: { width: number; height: number }
}

type ShapeSetting = {
  label?: string
  /** @deprecated */
  enableForCustomers?: boolean
  shape?: Shape

  /** This temporary shape is served for preview screen */
  tempShape?: Shape

  /** Allow buyer to drag/move the text layer */
  movable?: boolean
  /** Allow buyer to resize the text layer */
  resizable?: boolean
  /** Allow buyer to rotate the text layer */
  rotatable?: boolean
  /** Movement zone — clipping mask + soft drag boundary for buyer interactions */
  movementBounds?: MovementBounds
  /** Editable SVG string for resuming path editing in VectorEditor (movement zone path only) */
  movementBoundsEditableSvg?: string
  /** Default text position relative to movementBounds.x (canvas px, scaled in preparation-fns) */
  defaultOffsetX?: number
  /** Default text position relative to movementBounds.y (canvas px, scaled in preparation-fns) */
  defaultOffsetY?: number
}

export enum ELayerType {
  GROUP = 'group',
  TEXT = 'text',
  IMAGE = 'image',
  IMAGELESS = 'imageless',
  MULTI_LAYOUT = 'multi-layout',
  CHARM_NODE = 'charm-node',
  CHARM = 'charm',
}

// --- Charm Builder Types ---

export type CharmPathGeometry = {
  /** Path type. MVP: LINE only. Future: CURVE (bezier) */
  type: 'LINE'
  /** Array of [x, y] coordinates. LINE has exactly 2 points */
  points: [number, number][]
}

export type CharmSlotNode = {
  _id: string
  /** Absolute X position on canvas */
  x: number
  /** Absolute Y position on canvas */
  y: number
  /** Max charms allowed in this slot (1-3) */
  slotLimit: number
  /** Display label on canvas (e.g. "#1", "#2") */
  label: string
  /** Default charm assigned to this slot */
  defaultCharm?: CharmProductRef | null
  /** Rotation in degrees (0-359). Applied to charms snapped into this slot. Default 0. */
  rotation?: number
}

export type CharmTransformInstance = {
  instanceId: string
  x: number
  y: number
  rotation: number
  scale: number
}

/**
 * Reference to a Shopify product used as a charm.
 *
 * Charm identity = Shopify Product (not variant).
 * - `shopifyProductId` is the PRIMARY identifier (immutable, used for duplicate detection)
 * - `selectedVariantId` is OPTIONAL (used for add-to-cart when merchant pre-selects a variant)
 */
export type CharmProductRef = {
  _id: string
  /** PRIMARY: Shopify product ID - the charm identity */
  shopifyProductId: string
  /** OPTIONAL: Pre-selected variant ID for add-to-cart */
  selectedVariantId?: string
  title: string
  price: string
  currencyCode: string
  thumbnailUrl: string
  /** Each entry = one instance on canvas. Length = quantity displayed. */
  transforms?: CharmTransformInstance[]
  /** Direct instanceId reference. Used by CHARM layer to look up transform in parent. */
  instanceId?: string
  /** Whether this product is a default option on the storefront */
  isDefault?: boolean
  /** Number of charms to pre-fill when isDefault is true */
  defaultQuantity?: number
}

export type CharmNodeSettings = {
  /** Display mode: FIXED or FREE */
  displayStyle: 'FIXED' | 'FREE'
  /** Label shown on storefront for this charm option */
  storefrontLabel?: string
  /** Snap node positions on the canvas */
  nodes?: CharmSlotNode[]
  /** Maximum charms allowed */
  maxCharms?: number
  /** Whether node-adding mode is enabled on canvas */
  isAddingNodeMode?: boolean
  /** Linked charm product catalog for browsing */
  linkedProducts?: CharmProductRef[]
  /** Allow the same charm to be assigned to multiple nodes (default: false = one-to-one) */
  allowMultipleAssignments?: boolean
  /**
   * Default charm size in pixels, set by merchant via UI slider.
   * Used as fallback when no charms are placed on canvas, so merchants can
   * control charm size without having to place/resize/delete a default charm.
   * Stored as px (not scale) to avoid rounding errors.
   * Internally converted to scale via `px / CHARM_THUMB_SIZE`.
   */
  defaultCharmSize?: number
  /** Anchor position: where the charm aligns relative to the fix-point node */
  anchorPosition?: 'top' | 'center' | 'bottom'
  /**
   * Editor-only rotation snap step in degrees, applied to:
   *  1. Per-slot rotation values configured via the slot list
   *  2. Konva.Transformer drag-rotate snap angles in FIXED-mode canvas
   * 0 / undefined = no snap (free rotation). Common values: 15, 45, 90.
   * Not serialized to storefront/print — purely an admin convenience.
   */
  snapStep?: number
}

export type CharmSettings = {
  /** Reference to parent CHARM_NODE layer ID */
  nodeId: string
  /** Shopify product reference */
  productRef: CharmProductRef
  /** Slot index within the node */
  slotIndex?: number
}

export type {
  Template,
  LayerType,
  Layer,
  NodeImage,
  NodeText,
  PSD,
  Layout,
  ImageDataOptionSet,
  ImageOptionSet,
  ImagelessOptionSet,
  OptionSet,
  TextOptionSet,
  TextDataOptionSet,
  FontOptionSet,
  FontDataOptionSet,
  ShapeSetting,
  ColorOptionSet,
  MultiLayoutOptionSet,
  MultiLayoutDataOptionSet,
}
