import type { GenerativeOptions } from '~/modules/TemplateEditor/components/Editor/utils/elementCreators'
import type { IImageQuery } from '~/types/shopify-files'
import type { PathFilterPresetParams } from '~/modules/VectorEditor/utils/filters/pathFilterPresets'

// Constants
export const MAX_REFERENCE_FILES = 1
export const MAX_IMAGE_SIZE = '15MB'
export const DEFAULT_ERROR_MESSAGE = 'An error occurred while generating the image. Please try again after few seconds.'

// Types
export interface ReferenceImage {
  name: string
  size: number
  type: string
  url: string
}

export interface ReferenceImageResult {
  files: ReferenceImage[]
  error?: string
}

/**
 * Type guard to check if a value is a ReferenceImageResult
 */
export function isReferenceImageResult(value: unknown): value is ReferenceImageResult {
  return (
    value !== null
    && typeof value === 'object'
    && 'files' in value
    && Array.isArray((value as ReferenceImageResult).files)
  )
}

export interface GenerativeOptionsState {
  prompt: string
  aspectRatio: string
}

/**
 * Vector generation result returned from the API
 */
export interface VectorGenerationResult {
  svgUrl: string
  svgDataUri?: string
}

/**
 * Vector generation options for style transfer (filter presets and fill/stroke colors)
 */
export interface VectorGenerationOptions {
  /** Filter preset ID to apply (e.g., 'debossing', 'embossing') */
  filterPresetId?: string
  /** Filter preset parameters (e.g., { depth: 50, softness: 30 }) */
  filterPresetParams?: PathFilterPresetParams
  /** Fill color to apply to generated paths (e.g., '#000000') */
  fill?: string
  /** Stroke color to apply to generated paths (e.g., '#000000') */
  stroke?: string
  /** Stroke width to apply to generated paths */
  strokeWidth?: number
}

export interface PopoverAIImageGeneratorProps {
  title?: string
  contentHeight?: string
  mainTextLabel: string | React.ReactNode
  placeholderMainTextLabel?: string
  baseImageUrl?: string
  numberGeneratedImages?: number
  initialImageOptions?: IImageQuery[]
  initialReferenceImages?: ReferenceImage[]
  allowMultiple?: boolean
  generativeOptions?: GenerativeOptions
  allowCustomerToUseReferenceImage?: boolean
  enabledQuickPrompts?: string[]
  allowCustomerToUseQuickPrompts?: boolean
  showAIEffectsSearch?: boolean
  forceUseAIEffects?: boolean
  layout?: 'section' | 'popover'
  aiEffectsLayout?: 'carousel' | 'grid' | 'list' | 'categorized'
  noScroll?: boolean
  /**
   * Whether to show the aspect ratio selector.
   * If true, displays a dropdown to select the aspect ratio (1:1, 16:9, 9:16, 3:4, 4:3, etc.)
   * Auto-detects ratio from reference image when uploaded.
   * @default false
   */
  showRatioSelector?: boolean
  /**
   * Optional handler for the Add image button in Reference Images area.
   * If provided and it returns a Promise of files, the component will use those files as reference images.
   * If it returns void/undefined, the component will fall back to opening the image library.
   * Can also return a ReferenceImageResult object with an optional error message.
   */
  onClickAddReferenceImageButton?: () => void | Promise<ReferenceImage[] | ReferenceImageResult>
  setInitialImageOptions?: (imageOptions: IImageQuery[]) => void
  disabledGenerate?: boolean
  disabledGenerateMessage?: string
  onGenerateButtonClick?: () => void
  onSelectImages: (mediaFiles: IImageQuery[], generativeOptions?: GenerativeOptions) => void

  // ===== Vector Generation Mode Props =====
  /**
   * When true, generates SVG vectors instead of raster images.
   * Uses GENERATE_VECTOR action instead of GENERATE_IMAGES.
   */
  mode?: 'image' | 'vector'
  /**
   * Vector generation options including filter preset info.
   * Only used when mode='vector'.
   */
  vectorOptions?: VectorGenerationOptions
  /**
   * Callback when a vector is generated.
   * Only called when mode='vector'.
   */
  onSelectVector?: (result: VectorGenerationResult) => void
}
