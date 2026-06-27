import mongoose from '~/bootstrap/db/connect-db.server'
import type { Layer as _Layer, ShapeSetting } from '~/types/psd'
import { ELayerType } from '~/types/psd'
import type { OptionSetDocument } from './OptionSet'
import type { Paint } from 'extensions/tailorkit-src/src/shared/libraries/paint'

/**
 * Default image uploader options configuration
 * Used consistently across the application for image layer settings
 */
export const DEFAULT_IMAGE_UPLOADER_OPTIONS = {
  required: false,
  allowCustomerUploadImage: false,
  allowCustomerGenerateImageWithAI: false,
  allowCustomerToUseReferenceImage: false,
  enabledQuickPrompts: [],
  enabledTemplateTypes: [],
  enabledVisualStyles: [],
  enabledContentThemes: [],
  allowCustomerToUseQuickPrompts: false,
  allowCustomerToUseTemplateTypes: false,
  allowCustomerToUseVisualStyles: false,
  allowCustomerToUseContentThemes: false,
  allowCustomerToEditImage: {
    allowTransform: true,
    allowRotate: true,
    allowZoom: true,
    allowRemoveBackground: true,
  },
  allowCustomerUseImageOptionSet: false,
  autoRemoveSolidWhiteBackground: false,
} as const

/**
 * Type for image uploader options based on the default configuration
 */
export type ImageUploaderOptions = typeof DEFAULT_IMAGE_UPLOADER_OPTIONS

export type ControlCondition = {
  ifOptionSelected: string
  thenShowOrHideLayers: string[]
}

export type LayerDocument = Partial<_Layer> & {
  _id: string
  type: ELayerType
  top?: number
  left?: number
  label: string
  open?: boolean
  width?: number
  height?: number
  parent: string
  locked?: boolean
  isDeletedOnEditor?: boolean
  conditionalLogic?: {
    controls: {
      action?: 'show' | 'hide'
      conditions: ControlCondition[]
    }
    isControlledBy: string[]
  }
  deletedAt?: Date
  /**@deprecated */
  dataSrc?: string
  createdAt?: Date
  updatedAt?: Date
  visible?: boolean
  shopDomain?: string
  templateId?: string
  optionSet?: string[] | OptionSetDocument[]
  settings?: {
    overlay?: {
      overlaySvg: string
      editableSvg?: string
      overlayState?: any
      overlayMetadata?: any
    }
    storefrontOptionSetLabels?: { [key: string]: string }
    storefrontLabel?: string
    [key: string]: any
  }
  shapeSettings?: ShapeSetting
  interaction?: {
    containerStyle: object
    elementScalable: boolean
  }
  clonedBy?: string

  /** For editor only */
  /**
   * @description: This property is the holding state of the creation button (new/existing) of the option set when changing the layer
   */
  optionSetEditingState?: {
    [key: string]: {
      newOptionSetPressed?: boolean
      existOptionSetPressed?: boolean
      editMode?: boolean
    }
  }

  /**
   * @description: This property is the sync/unsync proportions state when changing the layer dimension
   */
  constrainProportions?: boolean
  proportions?: number | null

  /** Static layer is status for checking if this layer should be duplicated in multi-layout  */
  isStatic?: boolean

  /**
   * @deprecated
   */
  isGroupLayer?: boolean

  /**
   * Paint fills for the layer (Figma-style)
   * Supports stacking multiple paints (e.g., gradient over image)
   * Order: first paint is bottom, last is top
   * Takes precedence over legacy color properties when set
   */
  fills?: Paint[]
}

const LayerSchema = new mongoose.Schema<Omit<LayerDocument, 'id'>>(
  {
    _id: String,
    type: {
      type: String,
      index: true,
      required: true,
      enum: Object.values(ELayerType),
    },
    open: {
      type: Boolean,
      default: true,
    },
    label: {
      type: String,
      index: true,
    },
    locked: {
      type: Boolean,
      index: true,
      default: false,
    },
    parent: {
      type: String,
      ref: 'Layer',
    },
    visible: {
      type: Boolean,
      index: true,
      default: true,
    },
    settings: {
      type: Object,
      default: {},
    },
    shapeSettings: {
      type: Object,
      default: null,
    },
    optionSet: [
      {
        type: String,
        index: true,
        ref: 'OptionSet',
      },
    ],
    conditionalLogic: {
      controls: {
        action: {
          type: String,
          default: 'show',
          enum: ['show', 'hide'],
        },
        conditions: [
          {
            ifOptionSelected: {
              type: String,
              default: null,
            },
            thenShowOrHideLayers: [
              {
                type: String,
                ref: 'Layer',
              },
            ],
          },
        ],
      },
      isControlledBy: [
        {
          type: String,
          ref: 'Layer',
        },
      ],
    },
    templateId: {
      type: String,
      index: true,
      ref: 'Template',
    },
    legacyName: {
      type: String,
    },
    psdId: {
      type: String,
      ref: 'PSD',
    },
    blendingRanges: {},
    channels: Number,
    channelsInfo: Array,
    cols: Number,
    image: {
      type: String,
      ref: 'Image',
    },
    inforKeys: Array,
    left: Number,
    top: Number,
    right: Number,
    bottom: Number,
    width: Number,
    height: Number,
    rotate: Number,
    mask: {
      type: String,
      ref: 'Image',
    },
    children: [String],
    clonedBy: {
      type: String,
      ref: 'Layer',
    },

    /**
     * @deprecated
     */
    isGroupLayer: Boolean,
    /**  */

    /**
     * In editor config
     * @description This property represent the state of ratio between width and height or not
     */
    constrainProportions: Boolean,
    /** */

    // The shop domain that owns the layer
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
    deletedAt: {
      type: Date,
      index: true,
      default: null,
    },
    /**
     * Paint fills for the layer (Figma-style)
     * Array of Paint objects that can be solid colors, images, or gradients
     */
    fills: {
      type: [mongoose.Schema.Types.Mixed],
      default: undefined,
    },
  },
  { timestamps: true }
)

// Compound index for shop-scoped type-filtered queries (e.g. bulk-apply
// of allowed emojis to every text layer in a shop). Without this, the
// shopDomain index gets selected and `type` is filtered in memory, which
// can be slow for shops with many templates.
LayerSchema.index({ shopDomain: 1, type: 1 })

const Layer = mongoose.models.Layer || mongoose.model('Layer', LayerSchema)

export default Layer
