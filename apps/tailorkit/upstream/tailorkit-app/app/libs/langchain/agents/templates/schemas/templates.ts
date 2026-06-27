/* eslint-disable max-len */
/* eslint-disable max-len */
/* eslint-disable max-lines */
/**
 * Template schema builders for visual elements and composition guidelines.
 * Provides reusable schemas for text/image elements, styling, and layout constraints.
 */
import { ELayerType } from '~/types/psd'
import {
  TEXT_STYLES,
  TEXT_ALIGN_VALUES,
  TEXT_SHAPE_VALUES,
  TEXT_CASE_VALUES,
  TEXT_VERTICAL_ALIGN_VALUES,
  PURPOSE_VALUES,
  POSITION_VALUES,
  SCALING_BEHAVIOR_VALUES,
  LAYER_TYPE_VALUES,
  BLEND_MODES,
  TEXT_CREATED_BY_VALUES,
  VISUAL_DENSITY_VALUES,
  COLOR_HARMONY_VALUES,
  VISUAL_FLOW_VALUES,
  BALANCE_VALUES,
  FOCUS_STRATEGY_VALUES,
  LAYER_DEPTH_VALUES,
  OVERLAP_STRATEGY_VALUES,
  MEASUREMENT_UNIT_KEYS,
  RESOLUTION_KEYS,
} from '../constants/schema-enums'
import {
  createTransformSchema,
  CommonSchemas,
  createFontFamilySchema,
  createShadowSchema,
  SettingsFieldSchemas,
} from './common'

/** Creates layering schema with z-index and blending properties */
export const createLayeringSchema = () => ({
  type: 'object',
  properties: {
    zIndex: {
      type: 'number',
      description: 'Layer order - higher numbers appear on top',
    },
    blendMode: {
      type: 'string',
      enum: BLEND_MODES,
      description: 'Layer blending mode for visual effects',
    },
    mask: {
      type: 'string',
      description: 'CSS mask or clipping path for the element',
    },
  },
  required: ['zIndex', 'blendMode', 'mask'],
  additionalProperties: false,
})

/** Creates behavior schema for element interaction and locking */
export const createBehaviorSchema = () => ({
  type: 'object',
  properties: {
    isInteractive: {
      type: 'boolean',
      description: 'Whether customers can interact with this element',
    },
    isLocked: {
      type: 'boolean',
      description: 'Whether this element is locked from editing',
    },
    maintainAspectRatio: {
      type: 'boolean',
      description: 'Whether to preserve aspect ratio when resizing',
    },
  },
  required: ['isInteractive', 'isLocked', 'maintainAspectRatio'],
  additionalProperties: false,
})

/** Creates design intent schema for element purpose and positioning */
export const createDesignIntentSchema = () => ({
  type: 'object',
  properties: {
    purpose: {
      type: 'string',
      enum: PURPOSE_VALUES,
      description: 'Primary purpose or role of this element in the design',
    },
    visualWeight: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Visual importance from 0 (background) to 1 (primary focus)',
    },
    preferredPosition: {
      type: 'string',
      enum: POSITION_VALUES,
      description: 'Preferred positioning within the canvas layout',
    },
    scalingBehavior: {
      type: 'string',
      enum: SCALING_BEHAVIOR_VALUES,
      description: 'How this element should behave when the canvas is resized',
    },
  },
  required: ['purpose', 'visualWeight', 'preferredPosition', 'scalingBehavior'],
  additionalProperties: false,
})

/** Creates canvas properties schema for layer types and constraints */
export const createCanvasPropertiesSchema = () => ({
  type: 'object',
  properties: {
    layerType: {
      type: 'string',
      enum: LAYER_TYPE_VALUES,
      description: 'Category of layer for rendering and interaction',
    },
    zIndexRange: {
      type: 'object',
      properties: {
        min: {
          type: 'number',
          description: 'Minimum z-index for this element type',
        },
        max: {
          type: 'number',
          description: 'Maximum z-index for this element type',
        },
      },
      required: ['min', 'max'],
      additionalProperties: false,
      description: 'Z-index range constraints for proper layering',
    },
    blendMode: {
      type: 'string',
      enum: BLEND_MODES,
      description: 'Blending mode for visual effects',
    },
    allowOverlap: {
      type: 'boolean',
      description: 'Whether this element can overlap with others',
    },
  },
  required: ['layerType', 'zIndexRange', 'blendMode', 'allowOverlap'],
  additionalProperties: false,
})

/** Creates text style settings schema for font, color, and typography */
export const createTextStyleSettingsSchema = () => ({
  type: 'object',
  properties: {
    storefrontLabel: {
      type: 'string',
      description: 'User-facing label for this element in the editor',
    },
    content: {
      type: 'string',
      description:
        'Default text content. Extract from the user request if available else keep concise: 1-4 words for headings, ≤8 words for body.',
    },
    fontFamily: createFontFamilySchema(),
    fontSize: { type: 'number', minimum: 1, description: 'Font size in pixels' },
    textStyle: { type: 'array', items: { type: 'string', enum: TEXT_STYLES } },
    textColor: CommonSchemas.hexColor,
    textAlign: { type: 'string', enum: TEXT_ALIGN_VALUES },
    textShape: { type: 'string', enum: TEXT_SHAPE_VALUES },
    curvePeaks: { type: 'number', minimum: 1, description: 'Number of curve peaks (for curve shape)' },
    curveBend: {
      type: 'number',
      minimum: -100,
      maximum: 100,
      description: 'Bend percentage for curve shape (-100 to 100)',
    },
    circleStartAngle: { type: 'number', description: 'Start angle in radians for circle shape' },
    circleEndAngle: { type: 'number', description: 'End angle in radians for circle shape' },
    opacity: CommonSchemas.opacity,
    ...createShadowSchema(),
    autoFitToContainer: {
      type: 'boolean',
      default: true,
      description: 'Auto fit text to the container. Defaults to true.',
    },
    styleCase: { type: 'string', enum: TEXT_CASE_VALUES },
    verticalAlign: { type: 'string', enum: TEXT_VERTICAL_ALIGN_VALUES },
    strokeColor: SettingsFieldSchemas.textSetting.strokeColor,
    strokeWeight: SettingsFieldSchemas.textSetting.strokeWeight,
    neonMode: SettingsFieldSchemas.textSetting.neonMode,
    neonIntensity: SettingsFieldSchemas.textSetting.neonIntensity,
    neonOffsetX: SettingsFieldSchemas.textSetting.neonOffsetX,
    neonOffsetY: SettingsFieldSchemas.textSetting.neonOffsetY,
  },
  required: [
    'storefrontLabel',
    'content',
    'fontFamily',
    'fontSize',
    'textStyle',
    'textColor',
    'textAlign',
    'textShape',
    'opacity',
    'shadowColor',
    'shadowBlur',
    'shadowOffset',
    'styleCase',
    'verticalAlign',
    'strokeColor',
    'strokeWeight',
    'neonMode',
    'neonIntensity',
    'neonOffsetX',
    'neonOffsetY',
  ],
  additionalProperties: false,
})

/** Creates text production settings schema with storefront and validation fields */
export const createTextProductionSettingsSchema = () => ({
  type: 'object',
  properties: {
    storefrontLabel: SettingsFieldSchemas.textSetting.storefrontLabel,
    content: {
      type: 'string',
      description:
        'Default text content for text elements. MUST extract from the user request if available else keep concise: 1-4 words for headings, ≤8 words for body.',
    },
    fontFamily: createFontFamilySchema(),
    fontSize: { type: 'number', minimum: 1, description: 'Font size in pixels' },
    textStyle: { type: 'array', items: { type: 'string', enum: TEXT_STYLES } },
    textColor: { ...CommonSchemas.hexColor, description: 'Text color in hex format (e.g., #FF0000)' },
    textAlign: {
      type: 'string',
      enum: TEXT_ALIGN_VALUES,
      description: 'Text alignment within the element',
    },
    textShape: { type: 'string', enum: TEXT_SHAPE_VALUES },
    curvePeaks: { type: 'number', minimum: 1, description: 'Number of curve peaks (for curve shape)' },
    curveBend: {
      type: 'number',
      minimum: -100,
      maximum: 100,
      description: 'Bend percentage for curve shape (-100 to 100)',
    },
    circleStartAngle: { type: 'number', description: 'Start angle in radians for circle shape' },
    circleEndAngle: { type: 'number', description: 'End angle in radians for circle shape' },
    autoFitToContainer: {
      type: 'boolean',
      default: true,
      description: 'Whether text should automatically resize to fit container. Defaults to true.',
    },
    placeholder: {
      type: 'string',
      description: 'Placeholder text shown in editor when content is empty',
    },
    required: {
      type: 'boolean',
      description: 'Whether this field is required for customers to fill',
    },
    textCreatedBy: {
      type: 'string',
      enum: TEXT_CREATED_BY_VALUES,
      description: 'Who created this text element - merchant or customers',
    },
    characterLimit: {
      type: 'number',
      minimum: 0,
      description: 'Maximum number of characters allowed in this text field',
    },
    notesForCustomers: {
      type: 'string',
      description: 'Helpful notes or instructions for customers editing this element',
    },
    productionSafe: {
      type: 'boolean',
      description: 'Whether this element meets production safety requirements',
    },
    scaledForProduct: {
      type: 'boolean',
      description: 'Whether this element was scaled to fit within product constraints',
    },
    styleCase: { type: 'string', enum: TEXT_CASE_VALUES },
    verticalAlign: { type: 'string', enum: TEXT_VERTICAL_ALIGN_VALUES },
    strokeColor: SettingsFieldSchemas.textSetting.strokeColor,
    strokeWeight: SettingsFieldSchemas.textSetting.strokeWeight,
    neonMode: SettingsFieldSchemas.textSetting.neonMode,
    neonIntensity: SettingsFieldSchemas.textSetting.neonIntensity,
    neonOffsetX: SettingsFieldSchemas.textSetting.neonOffsetX,
    neonOffsetY: SettingsFieldSchemas.textSetting.neonOffsetY,
  },
  required: [
    'storefrontLabel',
    'content',
    'fontFamily',
    'fontSize',
    'textStyle',
    'textColor',
    'textAlign',
    'textShape',
    'autoFitToContainer',
    'placeholder',
    'required',
    'textCreatedBy',
    'characterLimit',
    'notesForCustomers',
    'productionSafe',
    'scaledForProduct',
    'styleCase',
    'verticalAlign',
    'strokeColor',
    'strokeWeight',
    'neonMode',
    'neonIntensity',
    'neonOffsetX',
    'neonOffsetY',
  ],
  additionalProperties: false,
})

/** Creates image style settings schema with generation prompts */
export const createImageStyleSettingsSchema = () => ({
  type: 'object',
  properties: {
    storefrontLabel: SettingsFieldSchemas.imageSetting.storefrontLabel,
    imageType: {
      type: 'string',
      description:
        'Free-form image type (e.g., illustration, photo, icon, pattern, background). No enum to allow flexibility.',
    },
    imagePrompt: {
      type: 'string',
      description: [
        'Enhanced prompt for AI image generation describing a SINGLE SUBJECT with clear appearance details (age, gender, clothing, colors, pose, expression).',
        'The prompt MUST specify positioning, framing (e.g., full-body, half-body), and relationship context within the canvas.',
        'It MUST be standalone, without referencing labels, IDs, or other elements.',
        'Output should be consistent with the required design style (e.g., semi-realistic, POD-ready, high resolution).',
      ].join('\n'),
    },
    imageStyle: {
      type: 'string',
      description: 'Style description for image generation (e.g., minimalist, detailed, vintage)',
    },
    opacity: CommonSchemas.opacity,
  },
  required: ['storefrontLabel', 'imageType', 'imagePrompt', 'imageStyle', 'opacity'],
  additionalProperties: false,
})

/** Creates image production settings schema with safety requirements */
export const createImageProductionSettingsSchema = () => ({
  type: 'object',
  properties: {
    storefrontLabel: {
      type: 'string',
      description: 'User-facing label for this element in the editor',
    },
    imageType: {
      type: 'string',
      description: 'Type of image content (e.g., illustration, photo, icon, pattern, background)',
    },
    imagePrompt: {
      type: 'string',
      description: [
        'Enhanced prompt for AI image generation describing a SINGLE SUBJECT with clear appearance details (age, gender, clothing, colors, pose, expression).',
        'The prompt MUST specify positioning, framing (e.g., full-body, half-body), and relationship context within the canvas.',
        'It MUST be standalone, without referencing labels, IDs, or other elements.',
        'Output should be consistent with the required design style (e.g., semi-realistic, POD-ready, high resolution).',
      ].join('\n'),
    },
    imageStyle: {
      type: 'string',
      description: 'Style description for image generation (e.g., cartoon, realistic, minimalist)',
    },
    opacity: CommonSchemas.opacity,
    ...createShadowSchema(),
    productionSafe: {
      type: 'boolean',
      description: 'Whether this element meets production safety requirements',
    },
    scaledForProduct: {
      type: 'boolean',
      description: 'Whether this element was scaled to fit within product constraints',
    },
  },
  required: [
    'storefrontLabel',
    'imageType',
    'imagePrompt',
    'imageStyle',
    'opacity',
    'shadowColor',
    'shadowBlur',
    'shadowOffset',
    'productionSafe',
    'scaledForProduct',
  ],
  additionalProperties: false,
})

/** Creates text element schema for style mapping with semantic context */
export const createTextElementSchema = (semanticContextSchema: any) => ({
  type: 'object',
  properties: {
    id: { type: 'string' },
    label: { type: 'string' },
    type: { type: 'string', enum: [ELayerType.TEXT] },
    styleSettings: createTextStyleSettingsSchema(),
    designIntent: createDesignIntentSchema(),
    canvasProperties: createCanvasPropertiesSchema(),
    semanticContext: semanticContextSchema,
  },
  required: ['id', 'label', 'type', 'styleSettings', 'designIntent', 'canvasProperties', 'semanticContext'],
  additionalProperties: false,
})

/** Creates image element schema for style mapping with semantic context */
export const createImageElementSchema = (semanticContextSchema: any) => ({
  type: 'object',
  properties: {
    id: { type: 'string' },
    label: { type: 'string' },
    type: { type: 'string', enum: [ELayerType.IMAGE] },
    styleSettings: createImageStyleSettingsSchema(),
    designIntent: createDesignIntentSchema(),
    canvasProperties: createCanvasPropertiesSchema(),
    semanticContext: semanticContextSchema,
  },
  required: ['id', 'label', 'type', 'styleSettings', 'designIntent', 'canvasProperties', 'semanticContext'],
  additionalProperties: false,
})

/** Creates text element schema for production with transform and behavior */
export const createTextProductionElementSchema = () => ({
  type: 'object',
  properties: {
    id: { type: 'string' },
    label: { type: 'string' },
    type: { type: 'string', enum: [ELayerType.TEXT] },
    settings: createTextProductionSettingsSchema(),
    transform: createTransformSchema(),
    layering: createLayeringSchema(),
    behavior: createBehaviorSchema(),
    designIntent: createDesignIntentSchema(),
  },
  required: ['id', 'label', 'type', 'settings', 'transform', 'layering', 'behavior', 'designIntent'],
  additionalProperties: false,
})

/** Creates image element schema for production with transform and behavior */
export const createImageProductionElementSchema = () => ({
  type: 'object',
  properties: {
    id: { type: 'string' },
    label: { type: 'string' },
    type: { type: 'string', enum: [ELayerType.IMAGE] },
    settings: createImageProductionSettingsSchema(),
    transform: createTransformSchema(),
    layering: createLayeringSchema(),
    behavior: createBehaviorSchema(),
    designIntent: createDesignIntentSchema(),
  },
  required: ['id', 'label', 'type', 'settings', 'transform', 'layering', 'behavior', 'designIntent'],
  additionalProperties: false,
})

/** Creates style characteristics schema for visual density and typography */
export const createStyleCharacteristicsSchema = () => ({
  type: 'object',
  description: 'Overall characteristics of the visual style',
  properties: {
    visualDensity: {
      type: 'string',
      enum: VISUAL_DENSITY_VALUES,
      description: 'Amount of visual elements and detail in the design',
    },
    colorHarmony: {
      type: 'string',
      enum: COLOR_HARMONY_VALUES,
      description: 'Color relationship strategy for the design palette',
    },
    typographyScale: {
      type: 'object',
      properties: {
        base: {
          type: 'number',
          minimum: 1,
          description: 'Base font size in pixels',
        },
        ratio: {
          type: 'number',
          minimum: 1,
          description: 'Scaling ratio between font sizes',
        },
      },
      required: ['base', 'ratio'],
      additionalProperties: false,
    },
    visualFlow: {
      type: 'string',
      enum: VISUAL_FLOW_VALUES,
      description: 'How the eye moves through the composition',
    },
  },
  required: ['visualDensity', 'colorHarmony', 'typographyScale', 'visualFlow'],
  additionalProperties: false,
})

/** Creates composition guidelines schema for balance and focus strategies */
export const createCompositionGuidelinesSchema = () => ({
  type: 'object',
  description: 'Guidelines for arranging elements in the composition',
  properties: {
    balance: {
      type: 'string',
      enum: BALANCE_VALUES,
      description: 'Type of visual balance in the composition',
    },
    focusStrategy: {
      type: 'string',
      enum: FOCUS_STRATEGY_VALUES,
      description: 'Strategy for directing viewer attention',
    },
    layerDepth: {
      type: 'string',
      enum: LAYER_DEPTH_VALUES,
      description: 'Amount of perceived depth between layers',
    },
    overlapStrategy: {
      type: 'string',
      enum: OVERLAP_STRATEGY_VALUES,
      description: 'How elements should interact and overlap',
    },
  },
  required: ['balance', 'focusStrategy', 'layerDepth', 'overlapStrategy'],
  additionalProperties: false,
})

/**
 * Creates complete template apply schema for AI agents.
 * @returns JSON schema for full updated template entity
 */
export const createTemplateApplySchema = () => ({
  type: 'object',
  description: 'Full updated template object after applying edits',
  properties: {
    id: { type: 'string', description: 'Template identifier' },
    name: { type: 'string', description: 'Updated template name' },
    dimension: {
      type: 'object',
      properties: {
        width: { type: 'number', description: 'Width of the template' },
        height: { type: 'number', description: 'Height of the template' },
        measurementUnit: {
          type: 'string',
          enum: MEASUREMENT_UNIT_KEYS,
          description: 'Measurement unit of the template',
          default: 'px',
        },
        resolution: {
          type: 'number',
          enum: RESOLUTION_KEYS,
          description: 'Resolution of the template',
          default: 300,
        },
      },
      // required: ['width', 'height', 'measurementUnit', 'resolution'],
      additionalProperties: false,
    },
  },
  // required: ['id', 'name', 'dimension'],
  additionalProperties: false,
})
