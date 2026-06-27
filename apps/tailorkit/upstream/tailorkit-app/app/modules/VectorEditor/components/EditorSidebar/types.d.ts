/**
 * EditorSidebar types
 */

import type {
  ParsedPathExtended,
  SvgDefs,
  GradientDef,
  FilterDef,
  ColorAdjustments,
  BlendMode,
  ImageColorAdjustments,
  SidebarSection,
  EditModeSettings,
  GridSettings,
  ViewBox,
} from '../../types'

export type { SidebarSection }

export interface FillSectionProps {
  selectedPath: ParsedPathExtended | null
  defs: SvgDefs
  disabled?: boolean
  onFillColorChange: (color: string) => void
  onFillRuleChange?: (fillRule: 'nonzero' | 'evenodd') => void
  onGradientCreate: (gradient: GradientDef) => void
  onGradientUpdate: (id: string, gradient: Partial<GradientDef>) => void
  onGradientDelete: (id: string) => void
  onFillGradientApply: (gradientId: string) => void
}

export interface StrokeSectionProps {
  color: string | null
  width: number | null
  disabled?: boolean
  onColorChange: (color: string) => void
  onWidthChange: (width: number) => void
}

export interface FiltersSectionProps {
  selectedPath: ParsedPathExtended | null
  defs: SvgDefs
  disabled?: boolean
  /** Whether the selected path has adjustments applied (shows remove-only UI for legacy SVGs) */
  selectedPathHasAdjustments?: boolean
  onFilterCreate: (filter: FilterDef) => void
  onFilterUpdate: (id: string, filter: Partial<FilterDef>) => void
  onFilterDelete: (id: string) => void
  onFilterApply: (filterId: string | null) => void
  /** Whether there are paths in the SVG workspace */
  hasPaths?: boolean
  /** Apply filter to all paths (when no path is selected) */
  onFilterApplyToAll?: (filterId: string | null) => void
  /** Callback to change fill color (used by leather techniques) */
  onFillChange?: (fill: string) => void
  /** Callback to change stroke color (used by leather techniques to remove stroke) */
  onStrokeChange?: (stroke: string) => void
  /** Callback to switch to a different sidebar section */
  onSwitchSection?: (section: SidebarSection) => void
  // Overlay mode (raster image) props for filter presets
  isOverlayMode?: boolean
  imageColorAdjustments?: ImageColorAdjustments
  onImageFilterPresetChange?: (presetId: string | null) => void
  onImageFilterPresetCommit?: () => void
  onImageFilterParamChange?: (paramKey: string, value: number) => void
}

export interface AdjustmentsSectionProps {
  selectedPath: ParsedPathExtended | null
  disabled?: boolean
  /** Whether the selected path has a filter applied (disables adjustments) */
  selectedPathHasFilter?: boolean
  onColorAdjustmentsChange: (adjustments: ColorAdjustments, commitToHistory?: boolean) => void
  onBlendModeChange: (blendMode: BlendMode, commitToHistory?: boolean) => void
  onOpacityChange: (opacity: number, commitToHistory?: boolean) => void
  /** Reset all adjustments (color adjustments, opacity, blend mode) in a single update */
  onResetAdjustments?: () => void
  // Overlay mode (raster image) props
  isOverlayMode?: boolean
  imageColorAdjustments?: ImageColorAdjustments
  onImageAdjustmentsChange?: (adjustments: ImageColorAdjustments | undefined) => void
  onImageAdjustmentChange?: <K extends keyof ImageColorAdjustments>(key: K, value: ImageColorAdjustments[K]) => void
  onImageAdjustmentCommit?: () => void
  // Adjustment mask props
  isSelectedPathAdjustmentMask?: boolean
  selectedPathAdjustments?: ImageColorAdjustments
  onUpdateAdjustmentMask?: (adjustments: Partial<ImageColorAdjustments>) => void
  onUpdateAdjustmentMaskCommit?: () => void
}

export interface DrawModeSectionProps {
  /** Currently selected predefined shape ID (null for freehand) */
  selectedShape: string | null
  /** Callback when a shape is selected */
  onShapeSelect: (shapeId: string | null) => void
  /** Current editor mode */
  editorMode: 'edit' | 'draw'
  /** Callback to change editor mode */
  onModeChange: (mode: 'edit' | 'draw') => void
  /** Current image URL in the editor (for extracting filter preset) */
  imageUrl?: string
  /** Callback when AI generates a vector */
  onAIVectorGenerate?: (svgDataUri: string, svgUrl?: string) => void
  /** Callback to close the sidebar */
  onClose?: () => void
}

export interface EditModeSectionProps {
  /** Edit mode settings */
  editModeSettings: EditModeSettings
  /** Callback when edit mode settings change */
  onEditModeSettingsChange: (settings: Partial<EditModeSettings>) => void
  /** Grid settings */
  gridSettings: GridSettings
  /** Callback when grid settings change */
  onGridSettingsChange: (settings: Partial<GridSettings>) => void
  /** Current viewBox (for viewport resize) */
  viewBox?: ViewBox
  /** Callback when viewBox changes */
  onViewBoxChange?: (viewBox: ViewBox) => void
}

export interface GuideImageSectionProps {
  /** Currently selected guide image URL */
  imageUrl?: string
  /** Capture current canvas as guide image */
  onCaptureCanvas: () => void
  /** Remove the guide image */
  onRemoveImage: () => void
  /** Inline image browser content rendered directly in the sidebar (no modal) */
  imageBrowser?: React.ReactNode
}

export interface EditorSidebarProps {
  activeSection: SidebarSection
  onClose: () => void
  fillProps: FillSectionProps
  strokeProps: StrokeSectionProps
  filtersProps: FiltersSectionProps
  adjustmentsProps: AdjustmentsSectionProps
  drawModeProps?: DrawModeSectionProps
  editModeProps?: EditModeSectionProps
  guideImageProps?: GuideImageSectionProps
}
