/* eslint-disable max-len */
/* eslint-disable max-lines */
/**
 * Common schema building blocks for template validation.
 * Provides reusable schemas for colors, dimensions, fonts, and complex objects.
 */
import type { JSONSchema } from 'openai/lib/jsonschema.mjs'
import {
  BLEND_MODES,
  CONTEXT_LEVELS,
  HEX_COLOR_PATTERN,
  LAYER_TYPES,
  MEASUREMENT_UNIT_KEYS,
  PRODUCTION_REQUIREMENTS,
  PURPOSE_TYPES,
  RESOLUTION_KEYS,
  TEXT_ALIGN_VALUES,
  TEXT_CASE_VALUES,
  TEXT_CREATED_BY_VALUES,
  TEXT_SHAPE_VALUES,
  TEXT_VERTICAL_ALIGN_VALUES,
  TEXT_NEON_MODE_VALUES,
  TEXT_STYLES,
} from '../constants/schema-enums'

/** Creates transform schema with position, size, and rotation properties */
export const createTransformSchema = () => ({
  type: 'object',
  properties: {
    x: {
      type: 'number',
      minimum: 0,
      description: 'X position in pixels from left edge',
    },
    y: {
      type: 'number',
      minimum: 0,
      description: 'Y position in pixels from top edge',
    },
    width: {
      type: 'number',
      minimum: 16,
      description: 'Width of element in pixels (min 16 to avoid placeholder values)',
    },
    height: {
      type: 'number',
      minimum: 16,
      description: 'Height of element in pixels (min 16 to avoid placeholder values)',
    },
    rotation: {
      type: 'number',
      minimum: 0,
      maximum: 360,
      description: 'Rotation angle in degrees',
    },
    scaleX: {
      type: 'number',
      description: 'Horizontal scale factor',
    },
    scaleY: {
      type: 'number',
      description: 'Vertical scale factor',
    },
  },
  required: ['x', 'y', 'width', 'height', 'rotation', 'scaleX', 'scaleY'],
  additionalProperties: false,
})

/** Creates shadow schema with color, blur, and offset properties */
export const createShadowSchema = () => ({
  shadowColor: { ...CommonSchemas.hexColor, description: 'Shadow color in hex format (e.g., #000000)' },
  shadowBlur: { type: 'number', minimum: 0, description: 'Shadow blur radius in pixels' },
  shadowOffset: {
    type: 'object',
    properties: {
      x: { type: 'number', description: 'Horizontal shadow offset (pixels)' },
      y: { type: 'number', description: 'Vertical shadow offset (pixels)' },
    },
    required: ['x', 'y'],
    additionalProperties: false,
  },
})

/** Creates font family schema with Google Fonts validation */
export const createFontFamilySchema = () => ({
  type: 'object',
  properties: {
    family: {
      type: 'string',
      description: 'Google font family name (e.g., Inter, Roboto)',
      pattern: '^[A-Za-z0-9 ]+$',
    },
    src: {
      type: 'string',
      description: 'Google Fonts source URL (woff/woff2/ttf)',
      pattern: '^https://fonts\\.gstatic\\.com/.*',
    },
  },
  description: 'Google Font family configuration (object: { family, src })',
  required: ['family', 'src'],
  additionalProperties: false,
})

/** Creates stroke schema for text/image outlines */
export const createStrokeSchema = () => ({
  strokeColor: { ...CommonSchemas.hexColor, description: 'Stroke color of the element in hex (e.g., #FFFFFF)' },
  strokeWeight: {
    type: 'number',
    minimum: 0,
    description: 'Width of text/image stroke/outline in pixels',
  },
})

/** Creates neon effect schema with mode, intensity, and offset */
export const createNeonSchema = () => ({
  neonMode: {
    type: 'string',
    enum: TEXT_NEON_MODE_VALUES,
    description: 'Neon glow effect mode for text styling',
  },
  neonIntensity: {
    type: 'number',
    minimum: 0,
    maximum: 1,
    description: 'Intensity of neon effect from 0 (none) to 1 (maximum)',
  },
  neonOffsetX: { type: 'number', description: 'Neon effect shadow offset X (pixels)' },
  neonOffsetY: { type: 'number', description: 'Neon effect shadow offset Y (pixels)' },
})

/** Common schema building blocks for validation primitives */
export const CommonSchemas: Record<string, JSONSchema> = {
  // Basic types
  hexColor: {
    type: 'string',
    pattern: HEX_COLOR_PATTERN,
    description: 'Color in hex format (e.g., #FF0000)',
  },

  colorArray: {
    type: 'array',
    items: {
      type: 'string',
      pattern: HEX_COLOR_PATTERN,
    },
    maxItems: 5,
    description: 'Array of hex colors (max 5 items)',
  },

  stringArray: {
    type: 'array',
    items: { type: 'string' },
    maxItems: 5,
    description: 'Array of strings (max 5 items)',
  },

  confidence: {
    type: 'number',
    minimum: 0,
    maximum: 1,
    description: 'Confidence level from 0 to 1',
  },

  dimension: {
    type: 'number',
    minimum: 0,
    description: 'Dimension value (non-negative)',
  },

  percentage: {
    type: 'number',
    minimum: 0,
    maximum: 100,
    description: 'Percentage value from 0 to 100',
  },

  opacity: {
    type: 'number',
    minimum: 0,
    maximum: 1,
    description: 'Opacity value from 0 (transparent) to 1 (opaque)',
  },

  // Measurement unit with enum
  measurementUnit: {
    type: 'string',
    enum: MEASUREMENT_UNIT_KEYS,
    description: 'Unit of measurement for dimensions',
  },

  // Resolution
  resolution: {
    type: 'number',
    enum: RESOLUTION_KEYS,
    description: 'Print resolution in PPI (pixels per inch)',
  },

  // Purpose types
  purposeType: {
    type: 'string',
    enum: PURPOSE_TYPES,
    description: 'Purpose category for the template',
  },

  // Context levels
  contextLevel: {
    type: 'string',
    enum: CONTEXT_LEVELS,
    description: 'Amount of context available',
  },

  // Layer types
  layerType: {
    type: 'string',
    enum: LAYER_TYPES,
    description: 'Type of canvas layer',
  },

  // Text styles
  textStyle: {
    type: 'string',
    enum: TEXT_STYLES,
    description: 'Typography style option',
  },

  // Blend modes
  blendMode: {
    type: 'string',
    enum: BLEND_MODES,
    description: 'Layer blending mode',
  },

  // NEW: Semantic context enums
  semanticRole: {
    type: 'string',
    description: 'Semantic role of element in composition',
  },

  relationshipType: {
    type: 'string',
    description: 'Type of relationship between elements',
  },

  proximityLevel: {
    type: 'string',
    description: 'Physical proximity level between elements',
  },

  orientationType: {
    type: 'string',
    description: 'Spatial orientation between elements',
  },

  postureType: {
    type: 'string',
    description: 'Physical posture or stance',
  },

  emotionalConnectionLevel: {
    type: 'string',
    description: 'Strength of emotional connection',
  },

  sceneType: {
    type: 'string',
    description: 'Overall scene or mood type',
  },

  spatialArrangement: {
    type: 'string',
    description: 'Spatial arrangement pattern',
  },

  energyLevel: {
    type: 'string',
    description: 'Energy level of the scene',
  },
}

/** Complex reusable schema components for composite objects */
export const ComplexSchemas = {
  // Color scheme object
  colorScheme: {
    type: 'object',
    properties: {
      primary: {
        ...CommonSchemas.colorArray,
        description: 'Primary colors in hex format',
      },
      secondary: {
        ...CommonSchemas.colorArray,
        description: 'Secondary colors in hex format',
      },
      accent: {
        ...CommonSchemas.colorArray,
        description: 'Accent colors in hex format',
      },
    },
    required: ['primary', 'secondary', 'accent'],
    additionalProperties: false,
  },

  // Typography configuration
  typography: {
    type: 'object',
    properties: {
      headingStyle: {
        type: 'string',
        description: 'Typography style for headings (e.g., bold, elegant, playful)',
      },
      bodyStyle: {
        type: 'string',
        description: 'Typography style for body text (e.g., clean, readable, decorative)',
      },
      recommended: {
        ...CommonSchemas.stringArray,
        description: 'Recommended font families or styles',
      },
    },
    required: ['headingStyle', 'bodyStyle', 'recommended'],
    additionalProperties: false,
  },

  // Visual elements
  visualElements: {
    type: 'object',
    properties: {
      shapes: {
        ...CommonSchemas.stringArray,
        description: 'Geometric shapes that fit the style',
      },
      patterns: {
        ...CommonSchemas.stringArray,
        description: 'Visual patterns that complement the theme',
      },
      icons: {
        ...CommonSchemas.stringArray,
        description: 'Icon styles or types that match the aesthetic',
      },
    },
    required: ['shapes', 'patterns', 'icons'],
    additionalProperties: false,
  },

  // Printable area dimensions
  printableArea: {
    type: 'object',
    properties: {
      width: {
        ...CommonSchemas.dimension,
        description: 'Width of printable area',
      },
      height: {
        ...CommonSchemas.dimension,
        description: 'Height of printable area',
      },
      measurementUnit: CommonSchemas.measurementUnit,
      resolution: CommonSchemas.resolution,
    },
    required: ['width', 'height', 'measurementUnit', 'resolution'],
    additionalProperties: false,
  },

  // Canvas element positioning
  position: {
    type: 'object',
    properties: {
      x: {
        ...CommonSchemas.dimension,
        description: 'Horizontal position in pixels',
      },
      y: {
        ...CommonSchemas.dimension,
        description: 'Vertical position in pixels',
      },
      z: {
        type: 'number',
        minimum: 0,
        description: 'Layer depth (z-index)',
      },
    },
    required: ['x', 'y', 'z'],
    additionalProperties: false,
  },

  // Element dimensions
  size: {
    type: 'object',
    properties: {
      width: {
        ...CommonSchemas.dimension,
        description: 'Element width in pixels',
      },
      height: {
        ...CommonSchemas.dimension,
        description: 'Element height in pixels',
      },
    },
    required: ['width', 'height'],
    additionalProperties: false,
  },

  // NEW: Semantic context for elements - FIXED for strict mode
  semanticContext: {
    type: 'object',
    properties: {
      role: CommonSchemas.semanticRole,
      relationshipType: CommonSchemas.relationshipType,
      connectionTo: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of element IDs that this element is connected to',
      },
      spatialHints: {
        type: 'object',
        properties: {
          proximityLevel: CommonSchemas.proximityLevel,
          orientation: CommonSchemas.orientationType,
          posture: CommonSchemas.postureType,
        },
        required: ['proximityLevel', 'orientation', 'posture'],
        additionalProperties: false,
      },
      interactionCues: {
        type: 'object',
        properties: {
          eyeContact: {
            type: 'boolean',
            description: 'Whether elements should show eye contact',
          },
          physicalConnection: {
            type: 'boolean',
            description: 'Whether elements should show physical connection',
          },
          sharedActivity: {
            type: 'string',
            description: 'Activity or action shared between elements',
          },
          emotionalConnection: CommonSchemas.emotionalConnectionLevel,
        },
        required: ['eyeContact', 'physicalConnection', 'sharedActivity', 'emotionalConnection'],
        additionalProperties: false,
      },
    },
    // CRITICAL FIX: Include ALL properties when using strict mode
    required: ['role', 'relationshipType', 'connectionTo', 'spatialHints', 'interactionCues'],
    additionalProperties: false,
  },

  // NEW: Scene context for overall composition
  sceneContext: {
    type: 'object',
    properties: {
      sceneType: {
        type: 'string',
        minLength: 1,
        maxLength: 60,
        description: 'Short descriptor of the scene/mood (e.g., celebratory, intimate, dynamic)',
      },
      spatialArrangement: {
        type: 'string',
        minLength: 1,
        maxLength: 60,
        description: 'Short descriptor of spatial layout (e.g., clustered, linear, circular)',
      },
      energyLevel: {
        type: 'string',
        minLength: 1,
        maxLength: 40,
        description: 'Single word or short phrase describing energy (e.g., calm, joyful)',
      },
      dominantMood: {
        type: 'array',
        items: {
          type: 'string',
          minLength: 1,
          maxLength: 40,
          description: 'One mood keyword (short)',
        },
        maxItems: 3,
        description: 'Primary mood keywords (<= 3 items)',
      },
    },
    // FIXED: Include ALL properties for strict mode
    required: ['sceneType', 'spatialArrangement', 'energyLevel', 'dominantMood'],
    additionalProperties: false,
  },

  // Production requirements
  productionRequirements: {
    type: 'object',
    properties: {
      resolution: CommonSchemas.resolution,
      colorMode: {
        type: 'string',
        enum: ['RGB', 'CMYK'],
        description: 'Color space for production',
      },
      bleed: {
        ...CommonSchemas.dimension,
        description: 'Bleed area in pixels',
      },
      safeZone: {
        ...CommonSchemas.dimension,
        description: 'Safe area margin in pixels',
      },
      requirements: {
        type: 'array',
        items: {
          type: 'string',
          enum: PRODUCTION_REQUIREMENTS,
        },
        maxItems: 10,
        description: 'Production-specific requirements',
      },
    },
    required: ['resolution', 'colorMode', 'bleed', 'safeZone', 'requirements'],
    additionalProperties: false,
  },
}

/** Atomic field schemas for text and image settings */
export const SettingsFieldSchemas = {
  textSetting: {
    content: { type: 'string', description: 'Content of the text' },
    wrap: { type: 'string', enum: ['none', 'word', 'char'], description: 'Text wrapping mode' },
    tempContent: { type: 'string', description: 'Temporary content of the text' },
    fontFamily: { ...createFontFamilySchema(), description: 'Font family configuration (family and src)' },
    fontSize: { type: 'number', minimum: 1, description: 'Font size of the text (pixels)' },
    lineHeight: { type: 'number', description: 'Line height of the text' },
    letterSpacing: { type: 'number', description: 'Letter spacing (pixels). Positive widens, negative tightens' },
    storefrontLabel: {
      type: 'string',
      description:
        'The label shown on the storefront - this is the text that will be shown on the storefront for buyers to see',
    },
    placeholder: { type: 'string', description: 'Placeholder of the text' },
    required: { type: 'boolean', description: 'Whether the text field is required' },
    textStyle: { type: 'array', items: { type: 'string', enum: TEXT_STYLES }, description: 'Style flags of the text' },
    textColor: { ...CommonSchemas.hexColor, description: 'Color of the text in hex' },
    textAlign: { type: 'string', enum: TEXT_ALIGN_VALUES, description: 'Horizontal alignment of the text' },
    verticalAlign: { type: 'string', enum: TEXT_VERTICAL_ALIGN_VALUES, description: 'Vertical alignment of the text' },
    textCreatedBy: { type: 'string', enum: TEXT_CREATED_BY_VALUES, description: 'Created by of the text' },
    characterLimit: { type: 'number', minimum: 0, description: 'Character limit for text' },
    allowMultiLineText: { type: 'boolean', description: 'Allow buyers to input multi-line text' },
    notesForCustomers: { type: 'string', description: 'Notes for buyers' },
    autoFitToContainer: { type: 'boolean', description: 'Auto fit text to the container' },
    generateTextWithAI: {
      type: 'object',
      properties: {
        allow: { type: 'boolean', description: 'Whether AI text generation is allowed' },
        settings: {
          type: 'object',
          properties: {
            color: { ...CommonSchemas.hexColor, description: 'Preferred AI text color in hex' },
          },
          required: ['color'],
          additionalProperties: false,
        },
      },
      description: 'Allow buyers to generate text with AI',
      required: ['allow', 'settings'],
      additionalProperties: false,
    },
    strokeColor: { ...CommonSchemas.hexColor, description: 'Stroke color of the text in hex' },
    strokeWeight: { type: 'number', minimum: 0, description: 'Width of text stroke/outline (pixels)' },
    neonMode: { type: 'string', enum: TEXT_NEON_MODE_VALUES, description: 'Neon glow effect mode' },
    neonIntensity: { type: 'number', minimum: 0, maximum: 1, description: 'Neon effect intensity (0-1)' },
    neonOffsetX: { type: 'number', description: 'Neon effect shadow offset X (pixels)' },
    neonOffsetY: { type: 'number', description: 'Neon effect shadow offset Y (pixels)' },
    styleCase: { type: 'string', enum: TEXT_CASE_VALUES, description: 'Style case of the text' },
    textShape: { type: 'string', enum: TEXT_SHAPE_VALUES, description: 'Text shape mode' },
    curvePeaks: { type: 'number', description: 'Number of curve peaks for curve text shape' },
    curveBend: { type: 'number', description: 'Bend percentage for curve text shape (-100 to 100)' },
    circleStartAngle: { type: 'number', description: 'Start angle for circular text shape (radians)' },
    circleEndAngle: { type: 'number', description: 'End angle for circular text shape (radians)' },
  },
  imageSetting: {
    storefrontLabel: {
      type: 'string',
      description:
        'The label shown on the storefront - this is the text that will be shown on the storefront for buyers to see',
    },
    imageType: {
      type: 'string',
      description: 'Only for image layer. Type of image content (e.g., illustration, photo, icon, pattern, background)',
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
      description:
        'Only for image layer. Style description for image generation (e.g., cartoon, realistic, minimalist).',
    },
    opacity: { ...CommonSchemas.opacity },
    imageUploaderOptions: {
      type: 'object',
      properties: {
        allowCustomerUploadImage: { type: 'boolean', description: 'Allow buyer to upload image' },
        allowCustomerGenerateImageWithAI: { type: 'boolean', description: 'Allow buyer to generate image with AI' },
        allowCustomerToEditImage: {
          type: 'object',
          properties: {
            allowTransform: { type: 'boolean', description: 'Allow transform operation' },
            allowRotate: { type: 'boolean', description: 'Allow rotate operation' },
            allowZoom: { type: 'boolean', description: 'Allow zoom operation' },
            allowRemoveBackground: { type: 'boolean', description: 'Allow remove background operation' },
          },
          required: ['allowTransform', 'allowRotate', 'allowZoom', 'allowRemoveBackground'],
          additionalProperties: false,
        },
        allowCustomerUseImageOptionSet: { type: 'boolean', description: 'Allow buyer to use image option set' },
      },
      required: [
        'allowCustomerUploadImage',
        'allowCustomerGenerateImageWithAI',
        'allowCustomerToEditImage',
        'allowCustomerUseImageOptionSet',
      ],
      additionalProperties: false,
    },
  },
}

/**
 * Creates text settings schema for text layer configuration.
 * @returns JSON schema with font, color, and typography properties
 */
export const createTextSettingsSchema = (): JSONSchema => ({
  type: 'object',
  properties: {
    content: SettingsFieldSchemas.textSetting.content,
    wrap: SettingsFieldSchemas.textSetting.wrap,
    fontFamily: SettingsFieldSchemas.textSetting.fontFamily,
    fontSize: SettingsFieldSchemas.textSetting.fontSize,
    lineHeight: SettingsFieldSchemas.textSetting.lineHeight,
    letterSpacing: SettingsFieldSchemas.textSetting.letterSpacing,
    storefrontLabel: SettingsFieldSchemas.textSetting.storefrontLabel,
    placeholder: SettingsFieldSchemas.textSetting.placeholder,
    required: SettingsFieldSchemas.textSetting.required,
    textStyle: SettingsFieldSchemas.textSetting.textStyle,
    textColor: SettingsFieldSchemas.textSetting.textColor,
    textAlign: SettingsFieldSchemas.textSetting.textAlign,
    verticalAlign: SettingsFieldSchemas.textSetting.verticalAlign,
    textCreatedBy: SettingsFieldSchemas.textSetting.textCreatedBy,
    characterLimit: SettingsFieldSchemas.textSetting.characterLimit,
    allowMultiLineText: SettingsFieldSchemas.textSetting.allowMultiLineText,
    notesForCustomers: SettingsFieldSchemas.textSetting.notesForCustomers,
    autoFitToContainer: SettingsFieldSchemas.textSetting.autoFitToContainer,
    generateTextWithAI: {
      type: 'object',
      description: 'Allow buyers to generate text with AI',
      properties: {
        allow: SettingsFieldSchemas.textSetting.generateTextWithAI.properties.allow,
        settings: SettingsFieldSchemas.textSetting.generateTextWithAI.properties.settings,
      },
      required: ['allow', 'settings'],
      additionalProperties: false,
    },
    strokeColor: SettingsFieldSchemas.textSetting.strokeColor,
    strokeWeight: SettingsFieldSchemas.textSetting.strokeWeight,
    neonMode: SettingsFieldSchemas.textSetting.neonMode,
    neonIntensity: SettingsFieldSchemas.textSetting.neonIntensity,
    neonOffsetX: SettingsFieldSchemas.textSetting.neonOffsetX,
    neonOffsetY: SettingsFieldSchemas.textSetting.neonOffsetY,
    styleCase: SettingsFieldSchemas.textSetting.styleCase,
    textShape: SettingsFieldSchemas.textSetting.textShape,
    curvePeaks: SettingsFieldSchemas.textSetting.curvePeaks,
    curveBend: SettingsFieldSchemas.textSetting.curveBend,
    circleStartAngle: SettingsFieldSchemas.textSetting.circleStartAngle,
    circleEndAngle: SettingsFieldSchemas.textSetting.circleEndAngle,
  },
  additionalProperties: false,
})

/**
 * Creates image settings schema for image layer configuration.
 * @returns JSON schema with uploader options and permissions
 */
export const createImageSettingsSchema = (): JSONSchema => ({
  type: 'object',
  properties: {
    storefrontLabel: SettingsFieldSchemas.imageSetting.storefrontLabel,
    imageUploaderOptions: {
      type: 'object',
      description: 'Image uploader options',
      properties: {
        allowCustomerUploadImage:
          SettingsFieldSchemas.imageSetting.imageUploaderOptions.properties.allowCustomerUploadImage,
        allowCustomerGenerateImageWithAI:
          SettingsFieldSchemas.imageSetting.imageUploaderOptions.properties.allowCustomerGenerateImageWithAI,
        allowCustomerToEditImage: {
          type: 'object',
          description: 'Allow buyer to edit image',
          properties: {
            allowTransform:
              SettingsFieldSchemas.imageSetting.imageUploaderOptions.properties.allowCustomerToEditImage.properties
                .allowTransform,
            allowRotate:
              SettingsFieldSchemas.imageSetting.imageUploaderOptions.properties.allowCustomerToEditImage.properties
                .allowRotate,
            allowZoom:
              SettingsFieldSchemas.imageSetting.imageUploaderOptions.properties.allowCustomerToEditImage.properties
                .allowZoom,
            allowRemoveBackground:
              SettingsFieldSchemas.imageSetting.imageUploaderOptions.properties.allowCustomerToEditImage.properties
                .allowRemoveBackground,
          },
          required: ['allowTransform', 'allowRotate', 'allowZoom', 'allowRemoveBackground'],
          additionalProperties: false,
        },
        allowCustomerUseImageOptionSet:
          SettingsFieldSchemas.imageSetting.imageUploaderOptions.properties.allowCustomerUseImageOptionSet,
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
})
