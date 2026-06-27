import type { OptionSetDocument } from './OptionSet.d'
import type { ShapeSetting, Layer as PsdLayer, ELayerType } from '../types/psd'
import type { Paint } from '../../extensions/tailorkit-src/src/shared/libraries/paint'

export type ImageUploaderOptions = {
  required: boolean
  allowCustomerUploadImage: boolean
  allowCustomerGenerateImageWithAI: boolean
  allowCustomerToUseReferenceImage: boolean
  enabledQuickPrompts: string[]
  enabledTemplateTypes: string[]
  enabledVisualStyles: string[]
  enabledContentThemes: string[]
  allowCustomerToUseQuickPrompts: boolean
  allowCustomerToUseTemplateTypes: boolean
  allowCustomerToUseVisualStyles: boolean
  allowCustomerToUseContentThemes: boolean
  allowCustomerToEditImage: {
    allowTransform: boolean
    allowRotate: boolean
    allowZoom: boolean
    allowRemoveBackground: boolean
  }
  allowCustomerUseImageOptionSet: boolean
  autoRemoveSolidWhiteBackground: boolean
}

export type ControlCondition = {
  ifOptionSelected: string
  thenShowOrHideLayers: string[]
}

export type LayerDocument = Partial<PsdLayer> & {
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
      overlayState?: unknown
      overlayMetadata?: unknown
    }
    storefrontOptionSetLabels?: Record<string, string>
    storefrontLabel?: string
    [key: string]: unknown
  }
  shapeSettings?: ShapeSetting
  interaction?: {
    containerStyle: object
    elementScalable: boolean
  }
  clonedBy?: string
  optionSetEditingState?: {
    [key: string]: {
      newOptionSetPressed?: boolean
      existOptionSetPressed?: boolean
      editMode?: boolean
    }
  }
  constrainProportions?: boolean
  proportions?: number | null
  isStatic?: boolean
  isGroupLayer?: boolean
  fills?: Paint[]
}
