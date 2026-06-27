/**
 * Shared enum constants for JSON schemas across template agents.
 * Centralizes validation options to ensure consistency across all template services.
 */

import { MEASUREMENT_UNITS } from '~/constants/measurement-units'
import { ELayerType } from '~/types/psd'

/** Supported layer types for template elements */
export const LAYER_TYPES = [ELayerType.TEXT, ELayerType.IMAGE]

/** Text styling options */
export const TEXT_STYLES = ['bold', 'italic', 'underline', 'normal']
export const TEXT_ALIGN_VALUES = ['left', 'center', 'right', 'justify']
export const TEXT_VERTICAL_ALIGN_VALUES = ['top', 'middle', 'bottom']
export const TEXT_CASE_VALUES = ['none', 'uppercase', 'lowercase', 'title', 'sentence']
export const TEXT_SHAPE_VALUES = ['none', 'circle', 'curve']
export const TEXT_NEON_MODE_VALUES = ['none', 'inverse']

/** Canvas blend modes for layer compositing */
export const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay']

/** Element positioning and layout options */
export const POSITION_VALUES = ['center', 'top', 'bottom', 'left', 'right', 'corner', 'edge']

/** Design intent and element behavior options */
export const PURPOSE_VALUES = ['hero', 'secondary', 'decorative', 'background', 'functional']
export const SCALING_BEHAVIOR_VALUES = ['fixed', 'responsive', 'proportional']

/** Canvas layer properties */
export const LAYER_TYPE_VALUES = ['background', 'content', 'overlay', 'decoration']

/** Visual style characteristics */
export const VISUAL_DENSITY_VALUES = ['minimal', 'balanced', 'rich', 'maximalist']
export const COLOR_HARMONY_VALUES = ['monochromatic', 'analogous', 'complementary', 'triadic']
export const VISUAL_FLOW_VALUES = ['linear', 'circular', 'scattered', 'hierarchical']

/** Template composition guidelines */
export const BALANCE_VALUES = ['symmetric', 'asymmetric', 'radial', 'dynamic']
export const FOCUS_STRATEGY_VALUES = ['single-point', 'multi-focal', 'distributed']
export const LAYER_DEPTH_VALUES = ['flat', 'subtle', 'pronounced']
export const OVERLAP_STRATEGY_VALUES = ['avoid', 'minimal', 'artistic', 'intentional']

/** Background rendering types */
export const BACKGROUND_TYPES = ['solid', 'gradient', 'transparent']

/** AI context analysis levels */
export const CONTEXT_LEVELS = ['none', 'partial', 'sufficient']

/** AI-detected user intent types for template operations */
export const TEMPLATE_INTENT_TYPES = [
  'template_create',
  'template_edit',
  'layer_create',
  'layer_edit',
  'layer_delete',
  'option_set_create',
  'option_set_edit',
  'option_set_delete',
  'general_template',
  'unknown',
]

/** Template purpose categories for user context analysis */
export const PURPOSE_TYPES = ['gift', 'business', 'personal', 'event', 'other', 'missing']

/** Text content creation sources */
export const TEXT_CREATED_BY_VALUES = ['merchant', 'customers']

/** Physical measurement units for template dimensions */
export const MEASUREMENT_UNIT_KEYS = Object.keys(MEASUREMENT_UNITS)

/** Standard DPI resolution values for print quality */
export const RESOLUTION_KEYS = [300, 150, 72, 36]

/** Print production quality requirements */
export const PRODUCTION_REQUIREMENTS = [
  'high_resolution',
  'color_accuracy',
  'bleed_margins',
  'safe_zones',
  'print_quality',
  'material_compatibility',
  'size_constraints',
  'text_readability',
  'contrast_requirements',
  'file_format_specs',
]

/** Regex pattern for validating hexadecimal color codes */
export const HEX_COLOR_PATTERN = '^#[0-9a-fA-F]{6}$'

/** Regex pattern for validating UUIDs */
export const UUID_PATTERN = '^[A-Za-z0-9]{8}-[A-Za-z0-9]{4}-4[A-Za-z0-9]{3}-[A-Za-z0-9]{4}-[A-Za-z0-9]{12}$'
