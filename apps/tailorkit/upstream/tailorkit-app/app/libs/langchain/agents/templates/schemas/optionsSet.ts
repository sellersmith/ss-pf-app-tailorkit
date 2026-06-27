/* eslint-disable max-len */
/**
 * Option set schema definitions for customizable layer options.
 * Defines schemas for text, color, font, and image option sets with validation.
 */

import { EOptionSet } from '~/types/psd'
import { CommonSchemas } from './common'
import { UUID_PATTERN } from '../constants/schema-enums'
import { DEFAULT_DISPLAY_STYLES, DISPLAY_STYLE_OPTIONS } from '~/modules/TemplateEditor/elements/constants'

const LABEL_ON_STOREFRONT_SCHEMA = {
  type: 'string',
  description:
    'The label shown on the storefront - this is the text that will be shown on the storefront for buyers to see',
} as const

const TEXT_OPTION_DATA_SCHEMA = {
  type: 'object',
  properties: {
    texts: {
      type: 'array',
      description:
        'Available text options related to the layer. MUST provide at least 3 different text variations for user choice.',
      minItems: 3,
      items: {
        type: 'object',
        properties: {
          _id: { type: 'string', description: 'Text option id', pattern: UUID_PATTERN },
          name: { type: 'string', description: 'Text option name' },
          selecting: { type: 'boolean', default: false, description: 'Whether selected by default' },
        },
        required: ['_id', 'name', 'selecting'],
        additionalProperties: false,
      },
    },
    displayStyle: {
      type: 'string',
      description: 'Display style for texts',
      enum: DISPLAY_STYLE_OPTIONS[EOptionSet.TEXT_OPTION],
      default: DEFAULT_DISPLAY_STYLES[EOptionSet.TEXT_OPTION],
    },
  },
  required: ['texts', 'displayStyle'],
  additionalProperties: false,
} as const

const COLOR_OPTION_DATA_SCHEMA = {
  type: 'object',
  properties: {
    colors: {
      type: 'array',
      description: 'Available color options. MUST provide at least 3 different color variations for user choice.',
      minItems: 3,
      items: {
        type: 'object',
        properties: {
          _id: { type: 'string', description: 'Color option id', pattern: UUID_PATTERN },
          name: { type: 'string', description: 'Color option name' },
          selecting: { type: 'boolean', default: false, description: 'Whether selected by default' },
          value: { ...CommonSchemas.hexColor, description: 'Color value in hex' },
        },
        required: ['_id', 'name', 'selecting', 'value'],
        additionalProperties: false,
      },
    },
    displayStyle: {
      type: 'string',
      description: 'Display style for colors',
      enum: DISPLAY_STYLE_OPTIONS[EOptionSet.COLOR_OPTION],
      default: DEFAULT_DISPLAY_STYLES[EOptionSet.COLOR_OPTION],
    },
  },
  required: ['colors', 'displayStyle'],
  additionalProperties: false,
} as const

const FONT_OPTION_DATA_SCHEMA = {
  type: 'object',
  properties: {
    fonts: {
      type: 'array',
      description: 'Available font options. MUST provide at least 3 different font families for user choice.',
      minItems: 3,
      items: {
        type: 'object',
        properties: {
          _id: { type: 'string', description: 'Font option id', pattern: UUID_PATTERN },
          name: { type: 'string', description: 'Font display name' },
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
          svgString: { type: 'string', description: 'SVG path data for preview' },
          selecting: { type: 'boolean', description: 'Whether selected by default' },
          fontSource: {
            type: 'string',
            enum: ['google'],
            description: 'Font source type, only google is supported',
          },
        },
        required: ['_id', 'name', 'family', 'src', 'svgString', 'selecting', 'fontSource'],
        additionalProperties: false,
      },
    },
    displayStyle: {
      type: 'string',
      description: 'Display style for fonts',
      enum: DISPLAY_STYLE_OPTIONS[EOptionSet.FONT_OPTION],
      default: DEFAULT_DISPLAY_STYLES[EOptionSet.FONT_OPTION],
    },
  },
  required: ['fonts', 'displayStyle'],
  additionalProperties: false,
} as const

const IMAGE_OPTION_DATA_SCHEMA = {
  type: 'object',
  properties: {
    files: {
      type: 'array',
      description: 'Available image options. MUST provide at least 3 different image variations for user choice.',
      minItems: 3,
      items: {
        type: 'object',
        properties: {
          _id: { type: 'string', description: 'Image id', pattern: UUID_PATTERN },
          name: { type: 'string', description: 'Image name' },
          src: { type: 'string', description: 'Image URL' },
          selecting: { type: 'boolean', default: false, description: 'Whether selected by default' },
          imagePrompt: {
            type: 'string',
            description: [
              '- Standalone prompt for AI image generation of this option.',
              "- Must describe a SINGLE SUBJECT clearly, derived from the parent layer's label and base imagePrompt.",
              '- Should include details about appearance (hair, skin, clothing, colors, pose, expression).',
              '- Must NOT reference IDs or other elements.',
              '- Do NOT generate black-and-white silhouettes or purely geometric placeholders; those belong to MASK OPTION SET.',
              '- If the user explicitly requests a simple geometric decorative image (not a mask), name the shape (circle, heart, flower, arrow, etc.), keep it as a SINGLE centered subject consistent with the canvas framing.',
              'Example: "Full-body man, mid-30s, short black hair, olive skin, wearing gray button-up shirt and trousers, standing with arms crossed, neutral expression."',
            ].join('\n'),
          },
          imageStyle: {
            type: 'string',
            description: [
              'Consistent style context applied to all options in this set.',
              "Derived from the parent layer's imageStyle.",
              'Example: "Semi-realistic European-American POD style, sharp, natural, lifelike, high resolution."',
            ].join('\n'),
          },
        },
        required: ['_id', 'name', 'src', 'selecting', 'imagePrompt', 'imageStyle'],
        additionalProperties: false,
      },
    },
    displayStyle: {
      type: 'string',
      description: 'Display style for files',
      enum: DISPLAY_STYLE_OPTIONS[EOptionSet.IMAGE_OPTION],
      default: DEFAULT_DISPLAY_STYLES[EOptionSet.IMAGE_OPTION],
    },
  },
  required: ['files', 'displayStyle'],
  additionalProperties: false,
}

const MASK_OPTION_DATA_SCHEMA = {
  type: 'object',
  properties: {
    masks: {
      type: 'array',
      description: 'Available mask options. MUST provide at least 3 different mask shape variations for user choice.',
      minItems: 3,
      items: {
        type: 'object',
        properties: {
          _id: { type: 'string', description: 'Mask id', pattern: UUID_PATTERN },
          name: { type: 'string', description: 'Mask name' },
          src: { type: 'string', description: 'Mask URL' },
          selecting: { type: 'boolean', default: false, description: 'Whether selected by default' },
          imagePrompt: {
            type: 'string',
            description: [
              'Prompt for AI image generation to create a black-and-white mask image.',
              '- The placeholder shape must be solid black (#000000).',
              '- The background must be pure white (#FFFFFF).',
              '- Shape must be sharp, clean, and centered.',
              '- No gradients, shadows, textures, or decorative elements.',
              '- This prompt MUST BE standalone and describe a SINGLE SHAPE ONLY.',
              '- Do not reference labels, IDs, or any other elements.',
              '- Geometric mode: You MUST explicitly request a simple geometric shape (circle, diamond, hexagon, pentagon, heart, flower/daisy, arrow, badge, cloud, arch, house, etc.).',
              '- The result MUST be vector-like, flat 2D, one contiguous filled silhouette with no interior holes and no outlines/strokes.',
              'Example: "A solid black heart shape centered on a pure white background."',
            ].join('\n'),
          },
          imageStyle: {
            type: 'string',
            description:
              'Black-and-white mask style: solid black shape on pure white background, no gradients, no textures, no shadows.',
          },
        },
        required: ['_id', 'name', 'src', 'selecting', 'imagePrompt', 'imageStyle'],
        additionalProperties: false,
      },
    },
    displayStyle: {
      type: 'string',
      description: 'Display style for files',
      enum: DISPLAY_STYLE_OPTIONS[EOptionSet.MASK_OPTION],
      default: DEFAULT_DISPLAY_STYLES[EOptionSet.MASK_OPTION],
    },
  },
  required: ['masks', 'displayStyle'],
  additionalProperties: false,
} as const

/** Text option set schema - defines available text options */
export const TEXT_OPTION_SET_SCHEMA = {
  type: 'object',
  description: 'Text option set for text layers',
  properties: {
    _id: { type: 'string', description: 'Option set identifier', pattern: UUID_PATTERN },
    type: { type: 'string', enum: [EOptionSet.TEXT_OPTION], description: 'Option set type' },
    label: { type: 'string', description: 'Internal label' },
    labelOnStoreFront: LABEL_ON_STOREFRONT_SCHEMA,
    data: {
      anyOf: [TEXT_OPTION_DATA_SCHEMA, { type: 'null' }],
      description: 'Option set data (null if not loaded)',
    },
  },
  required: ['_id', 'type', 'label', 'labelOnStoreFront', 'data'],
  additionalProperties: false,
} as const

/** Color option set schema - defines available color options */
export const COLOR_OPTION_SET_SCHEMA = {
  type: 'object',
  description: 'Color option set for text layers',
  properties: {
    _id: { type: 'string', description: 'Option set identifier', pattern: UUID_PATTERN },
    type: { type: 'string', enum: [EOptionSet.COLOR_OPTION], description: 'Option set type' },
    label: { type: 'string', description: 'Internal label' },
    labelOnStoreFront: LABEL_ON_STOREFRONT_SCHEMA,
    data: {
      anyOf: [COLOR_OPTION_DATA_SCHEMA, { type: 'null' }],
      description: 'Option set data (null if not loaded)',
    },
  },
  required: ['_id', 'type', 'label', 'labelOnStoreFront', 'data'],
  additionalProperties: false,
} as const

/** Font option set schema - defines available font options */
export const FONT_OPTION_SET_SCHEMA = {
  type: 'object',
  description: 'Font option set for text layers',
  properties: {
    _id: { type: 'string', description: 'Option set identifier', pattern: UUID_PATTERN },
    type: { type: 'string', enum: [EOptionSet.FONT_OPTION], description: 'Option set type' },
    label: { type: 'string', description: 'Internal label' },
    labelOnStoreFront: LABEL_ON_STOREFRONT_SCHEMA,
    data: {
      anyOf: [FONT_OPTION_DATA_SCHEMA, { type: 'null' }],
      description: 'Option set data (null if not loaded)',
    },
  },
  required: ['_id', 'type', 'label', 'labelOnStoreFront', 'data'],
  additionalProperties: false,
} as const

/** Image option set schema - defines available image options */
export const IMAGE_OPTION_SET_SCHEMA = {
  type: 'object',
  description: 'Image option set for image layers',
  properties: {
    _id: { type: 'string', description: 'Option set identifier', pattern: UUID_PATTERN },
    type: { type: 'string', enum: [EOptionSet.IMAGE_OPTION], description: 'Option set type' },
    label: { type: 'string', description: 'Internal label' },
    labelOnStoreFront: LABEL_ON_STOREFRONT_SCHEMA,
    data: {
      anyOf: [IMAGE_OPTION_DATA_SCHEMA, { type: 'null' }],
      description: 'Option set data (null if not loaded)',
    },
  },
  required: ['_id', 'type', 'label', 'labelOnStoreFront', 'data'],
  additionalProperties: false,
} as const

/** Mask option set schema - defines available mask options */
export const MASK_OPTION_SET_SCHEMA = {
  type: 'object',
  description: 'Mask option set for mask layers',
  properties: {
    _id: { type: 'string', description: 'Option set identifier', pattern: UUID_PATTERN },
    type: { type: 'string', enum: [EOptionSet.MASK_OPTION], description: 'Option set type' },
    label: { type: 'string', description: 'Internal label' },
    labelOnStoreFront: LABEL_ON_STOREFRONT_SCHEMA,
    data: {
      anyOf: [MASK_OPTION_DATA_SCHEMA, { type: 'null' }],
      description: 'Option set data (null if not loaded)',
    },
  },
  required: ['_id', 'type', 'label', 'labelOnStoreFront', 'data'],
  additionalProperties: false,
} as const

/**
 * Delta schemas for option set EDIT operations.
 * LLM should return only the changes: edits, creates, deleteIds.
 */
const TEXT_OPTION_SET_DELTA_SCHEMA = {
  type: 'object',
  description: 'Delta payload for text_option edits (partial update)',
  properties: {
    edits: {
      type: 'array',
      description: 'Items to update (must include existing _id)',
      items: {
        type: 'object',
        properties: TEXT_OPTION_DATA_SCHEMA.properties.texts.items.properties,
        required: TEXT_OPTION_DATA_SCHEMA.properties.texts.items.required,
        additionalProperties: false,
      },
    },
    creates: {
      type: 'array',
      description: 'New items to create',
      items: {
        type: 'object',
        properties: TEXT_OPTION_DATA_SCHEMA.properties.texts.items.properties,
        required: TEXT_OPTION_DATA_SCHEMA.properties.texts.items.required,
        additionalProperties: false,
      },
    },
    deleteIds: {
      type: 'array',
      description: 'IDs of existing items to delete',
      items: { type: 'string', description: 'Existing option id to delete', pattern: UUID_PATTERN },
    },
  },
  additionalProperties: false,
} as const

const COLOR_OPTION_SET_DELTA_SCHEMA = {
  type: 'object',
  description: 'Delta payload for color_option edits (partial update)',
  properties: {
    edits: {
      type: 'array',
      description: 'Items to update (must include existing _id)',
      items: {
        type: 'object',
        properties: COLOR_OPTION_DATA_SCHEMA.properties.colors.items.properties,
        required: COLOR_OPTION_DATA_SCHEMA.properties.colors.items.required,
        additionalProperties: false,
      },
    },
    creates: {
      type: 'array',
      description: 'New items to create',
      items: {
        type: 'object',
        properties: COLOR_OPTION_DATA_SCHEMA.properties.colors.items.properties,
        required: COLOR_OPTION_DATA_SCHEMA.properties.colors.items.required,
        additionalProperties: false,
      },
    },
    deleteIds: {
      type: 'array',
      description: 'IDs of existing items to delete',
      items: { type: 'string', description: 'Existing option id to delete', pattern: UUID_PATTERN },
    },
  },
  additionalProperties: false,
} as const

const FONT_OPTION_SET_DELTA_SCHEMA = {
  type: 'object',
  description: 'Delta payload for font_option edits (partial update)',
  properties: {
    edits: {
      type: 'array',
      description: 'Items to update (must include existing _id)',
      items: {
        type: 'object',
        properties: FONT_OPTION_DATA_SCHEMA.properties.fonts.items.properties,
        required: FONT_OPTION_DATA_SCHEMA.properties.fonts.items.required,
        additionalProperties: false,
      },
    },
    creates: {
      type: 'array',
      description: 'New font items to create',
      items: {
        type: 'object',
        properties: FONT_OPTION_DATA_SCHEMA.properties.fonts.items.properties,
        required: FONT_OPTION_DATA_SCHEMA.properties.fonts.items.required,
        additionalProperties: false,
      },
    },
    deleteIds: {
      type: 'array',
      description: 'IDs of existing items to delete',
      items: { type: 'string', description: 'Existing option id to delete', pattern: UUID_PATTERN },
    },
  },
  additionalProperties: false,
} as const

const IMAGE_OPTION_SET_DELTA_SCHEMA = {
  type: 'object',
  description: 'Delta payload for image_option edits (partial update)',
  properties: {
    edits: {
      type: 'array',
      description: 'Items to update (must include existing _id)',
      items: {
        type: 'object',
        properties: IMAGE_OPTION_DATA_SCHEMA.properties.files.items.properties,
        required: IMAGE_OPTION_DATA_SCHEMA.properties.files.items.required,
        additionalProperties: false,
      },
    },
    creates: {
      type: 'array',
      description: 'New image items to create',
      items: {
        type: 'object',
        properties: IMAGE_OPTION_DATA_SCHEMA.properties.files.items.properties,
        required: IMAGE_OPTION_DATA_SCHEMA.properties.files.items.required,
        additionalProperties: false,
      },
    },
    deleteIds: {
      type: 'array',
      description: 'IDs of existing items to delete',
      items: { type: 'string', description: 'Existing option id to delete', pattern: UUID_PATTERN },
    },
  },
  additionalProperties: false,
} as const

const MASK_OPTION_SET_DELTA_SCHEMA = {
  type: 'object',
  description: 'Delta payload for mask_option edits (partial update)',
  properties: {
    edits: {
      type: 'array',
      description: 'Items to update (must include existing _id)',
      items: {
        type: 'object',
        properties: MASK_OPTION_DATA_SCHEMA.properties.masks.items.properties,
        required: MASK_OPTION_DATA_SCHEMA.properties.masks.items.required,
        additionalProperties: false,
      },
    },
    creates: {
      type: 'array',
      description: 'New mask items to create',
      items: {
        type: 'object',
        properties: MASK_OPTION_DATA_SCHEMA.properties.masks.items.properties,
        required: MASK_OPTION_DATA_SCHEMA.properties.masks.items.required,
        additionalProperties: false,
      },
    },
    deleteIds: {
      type: 'array',
      description: 'IDs of existing items to delete',
      items: { type: 'string', description: 'Existing option id to delete', pattern: UUID_PATTERN },
    },
  },
  additionalProperties: false,
} as const

/**
 * Creates complete option set apply schema for AI agents.
 * @returns JSON schema for full updated option set entity
 */
export const createOptionSetApplySchema = () => ({
  type: 'object',
  description: 'Full updated option set after applying edits',
  properties: {
    _id: { type: 'string', description: 'Option set identifier to update', pattern: UUID_PATTERN },
    type: { type: 'string', enum: Object.values(EOptionSet), description: 'Type of option set' },
    label: { type: 'string', description: 'Internal label' },
    labelOnStoreFront: LABEL_ON_STOREFRONT_SCHEMA,
    data: {
      type: 'object',
      description: 'Structured data payload for specific option types',
      anyOf: [
        TEXT_OPTION_DATA_SCHEMA,
        COLOR_OPTION_DATA_SCHEMA,
        FONT_OPTION_DATA_SCHEMA,
        IMAGE_OPTION_DATA_SCHEMA,
        MASK_OPTION_DATA_SCHEMA,
      ],
      additionalProperties: false,
    },
  },
  required: ['_id', 'type', 'label', 'labelOnStoreFront', 'data'],
  additionalProperties: false,
})

// Strict schema for EDIT (delta payload only)
export const createOptionSetApplyDeltaSchema = () => ({
  type: 'object',
  description: 'Edit option set (delta only)',
  properties: {
    _id: { type: 'string', description: 'Option set identifier to update', pattern: UUID_PATTERN },
    type: { type: 'string', enum: Object.values(EOptionSet), description: 'Type of option set' },
    label: { type: 'string', description: 'Internal label' },
    labelOnStoreFront: LABEL_ON_STOREFRONT_SCHEMA,
    data: {
      type: 'object',
      description: 'Delta payload for specific option types',
      anyOf: [
        TEXT_OPTION_SET_DELTA_SCHEMA,
        COLOR_OPTION_SET_DELTA_SCHEMA,
        FONT_OPTION_SET_DELTA_SCHEMA,
        IMAGE_OPTION_SET_DELTA_SCHEMA,
        MASK_OPTION_SET_DELTA_SCHEMA,
      ],
      additionalProperties: false,
    },
  },
  required: ['_id', 'type', 'label', 'labelOnStoreFront', 'data'],
  additionalProperties: false,
})
