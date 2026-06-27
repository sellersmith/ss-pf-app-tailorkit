// Type/const definitions copied verbatim from TailorKit upstream `app/models/*` and `app/globals.d.ts`.
// The upstream source files mix these pure types with Mongoose schema runtime (connect-db), which
// cannot run inside the PageFly publisher. The transform only consumes the type/const portions, so
// they are reproduced here exactly to keep typecheck honest without importing the DB layer.
import type { Layer as _Layer, ELayerType } from './types/psd'
import type { LayerIntegration } from './types/integration'

// Source: app/models/Layer.server.ts → DEFAULT_IMAGE_UPLOADER_OPTIONS (verbatim)
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

// Source: app/models/Layer.server.ts → ImageUploaderOptions (verbatim)
export type ImageUploaderOptions = typeof DEFAULT_IMAGE_UPLOADER_OPTIONS

// Source: app/models/Layer.server.ts → ControlCondition (verbatim)
export type ControlCondition = {
  ifOptionSelected: string
  thenShowOrHideLayers: string[]
}

// Source: app/models/Layer.server.ts → LayerDocument (verbatim)
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
}

// Source: app/models/OptionSet.d.ts → EOptionSetEditingMode, OptionPricing (verbatim)
export type EOptionSetEditingMode = 'sync' | 'individual'
export type OptionPricing = {
  value: number // User input amount
  flatRate: number // USD equivalent for consistent pricing calculations
}

// Source: app/stores/modules/integration/layerIntegration.ts → TLayerIntegrationStore.
// Upstream this is a browser zustand-like Store wrapper; the publish transform never reads the
// store API off it, only the LayerIntegration data shape, so a structural alias to that shape is
// sufficient for typecheck.
export type TLayerIntegrationStore = LayerIntegration

// Source: app/globals.d.ts → MyShopify (verbatim)
export interface MyShopify {
  tailorkit: {
    [key: string]: unknown
  }
}
