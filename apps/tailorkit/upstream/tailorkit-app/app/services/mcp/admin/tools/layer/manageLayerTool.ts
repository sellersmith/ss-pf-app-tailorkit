/* eslint-disable max-len */
import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import { MCP_TOOLS } from '~/routes/api.mcp.$tool/constants'
import { RGB_COLOR_PATTERN, UUID_PATTERN } from '../constants'
import { ELayerType } from '~/types/psd'

// Tool description with clear distinction from assistant tool
const manageLayerToolDescription = `
  Use this tool for both CREATING new layers and UPDATING existing layers in templates.

  CRITICAL BEHAVIOR: You must collect ALL required information in ONE conversation turn before calling this tool.

  REQUIRED INFORMATION TO COLLECT ALL AT ONCE:
  1. Action type: "create" or "update"
  2. Shop domain (must end with .myshopify.com)
  3. Template ID where the layer should be added/exists
  4. For CREATE: Layer type ("text" or "image"), content/image data
  5. For UPDATE: Layer ID to update, what properties to change

  EFFICIENT INTERACTION PATTERN:
  - When user requests layer creation/update, ask for ALL missing information in a SINGLE response
  - For CREATE: "To create your layer, I need: 1) Shop domain, 2) Template ID, 3) Layer type (text/image), 4) Content/image"
  - For UPDATE: "To update your layer, I need: 1) Template ID, 2) Layer ID, 3) What you want to change"
  - DO NOT ask for information one by one - collect everything at once
  - Only call this tool when you have ALL required parameters

  CONTEXT AWARENESS:
  - If shop domain is mentioned in conversation history, reuse it
  - If template ID is mentioned in conversation history, reuse it
  - If layer ID is mentioned in conversation history (for updates), reuse it
  - If layer type is clear from user request ("create text layer"), don't ask again
  - Only ask for truly missing information

  IMPORTANT RULES:
  - For CREATE: Generate unique UUIDs for layer._id and image._id (if image layer)
  - For UPDATE: Keep existing layer._id, only provide properties that are changing
  - For UPDATE with new image: Generate new image._id but keep layer._id
  - Never reuse templateId as layer._id or image._id

  DO NOT use this tool for questions, explanations, or guidance about layers.

  This tool performs layer creation and updates in the TailorKit system.`

const COMMON_LAYER_PROPERTIES = {
  _id: {
    type: 'string',
    description: 'For CREATE: Generate unique UUID. For UPDATE: Not needed (keep existing)',
    pattern: UUID_PATTERN,
  },
  top: {
    type: 'number',
    description: 'The top position of the layer in pixels',
    default: 0,
    minimum: 0,
  },
  left: {
    type: 'number',
    description: 'The left position of the layer in pixels',
    default: 0,
    minimum: 0,
  },
  width: {
    type: 'number',
    description: 'The width of the layer in pixels',
    default: 100,
    minimum: 1,
  },
  height: {
    type: 'number',
    description: 'The height of the layer in pixels',
    default: 100,
    minimum: 1,
  },
  rotate: {
    type: 'number',
    description: 'The rotation angle of the layer in degrees',
    default: 0,
    minimum: -360,
    maximum: 360,
  },
  visible: {
    type: 'boolean',
    description: 'Whether the layer is visible on the canvas',
    default: true,
  },
  label: {
    type: 'string',
    description: 'The display name/label of the layer',
    default: 'New Layer',
    minLength: 1,
    maxLength: 100,
  },
  shopDomain: {
    type: 'string',
    description: 'The shop domain ends with .myshopify.com.',
  },
  parent: {
    type: 'string',
    description: 'The parent layer ID if this layer is nested',
    pattern: UUID_PATTERN,
  },
}

const LAYER_SCHEMAS = {
  // Text Layer
  [ELayerType.TEXT]: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        const: ELayerType.TEXT,
        description: 'The type of the layer - text content',
      },
      ...COMMON_LAYER_PROPERTIES,
      settings: {
        type: 'object',
        description: 'The settings of the text layer',
        properties: {
          storefrontLabel: {
            type: 'string',
            description: 'The label of the layer shown on the storefront',
            default: '',
            maxLength: 100,
            minLength: 1,
          },
          content: {
            type: 'string',
            description: 'The text content of the layer',
            default: 'Enter text',
            maxLength: 512,
            minLength: 1,
          },
          textStyle: {
            type: 'array',
            description: 'The style of the text',
            default: [],
            items: {
              type: 'string',
              enum: ['bold', 'italic', 'underline'],
            },
          },
          textColor: {
            type: 'string',
            description: 'The color of the text',
            default: 'rgb(0, 0, 0)',
            pattern: RGB_COLOR_PATTERN,
          },
          fontFamily: {
            type: 'object',
            description: 'The font family of the text',
            properties: {
              family: {
                type: 'string',
                description: 'The name of the font family',
                default: 'Abril Fatface',
              },
              src: {
                type: 'string',
                description: 'The source URL of the font family',
                default: 'https://fonts.gstatic.com/s/abrilfatface/v23/zOL64pLDlL1D99S8g8PtiKchm-BsjOLhZBY.ttf',
              },
            },
          },
          textAlign: {
            type: 'string',
            description: 'The alignment of the text',
            default: 'center',
            enum: ['left', 'center', 'right'],
          },
          verticalAlign: {
            type: 'string',
            description: 'The vertical alignment of the text',
            default: 'middle',
            enum: ['left', 'middle', 'right'],
          },
          strokeColor: {
            type: 'string',
            description: 'The stroke color of the text',
            default: 'rgb(0, 0, 0)',
            pattern: RGB_COLOR_PATTERN,
          },
          strokeWeight: {
            type: 'number',
            description: 'The stroke weight of the text',
            default: 0,
            minimum: 0,
            maximum: 100,
          },
          autoFitToContainer: {
            type: 'boolean',
            description: 'Whether the text should be automatically resized to fit the container',
            default: true,
          },
          generateTextWithAI: {
            type: 'object',
            description: 'The settings for generating text with AI',
            properties: {
              allow: {
                type: 'boolean',
                description: 'Whether the text should be generated with AI',
                default: true,
              },
              settings: {
                type: 'object',
                description: 'The settings for icon of generating text with AI',
                properties: {
                  color: {
                    type: 'string',
                    description: 'The color of the icon',
                    default: 'rgba(4, 123, 93, 1)',
                    pattern: RGB_COLOR_PATTERN,
                  },
                },
              },
            },
          },
        },
      },
    },
    required: ['type'],
    additionalProperties: false,
  },

  // Image Layer
  [ELayerType.IMAGE]: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        const: ELayerType.IMAGE,
        description: 'The type of the layer - image content',
      },
      ...COMMON_LAYER_PROPERTIES,
      image: {
        type: 'object',
        description: 'The image properties and metadata',
        properties: {
          _id: {
            type: 'string',
            pattern: UUID_PATTERN,
            description: 'For CREATE: Generate unique UUID. For UPDATE: Generate new UUID if changing image',
          },
          width: {
            type: 'number',
            description: 'The original width of the image',
            minimum: 1,
          },
          height: {
            type: 'number',
            description: 'The original height of the image',
            minimum: 1,
          },
          src: {
            type: 'string',
            description: 'The source URL or data URL of the image',
            minLength: 1,
          },
          imageName: {
            type: 'string',
            description: 'The original filename of the image',
            maxLength: 255,
          },
        },
        required: ['_id', 'width', 'height', 'src', 'imageName'],
        additionalProperties: false,
      },
      dataSrc: {
        type: 'string',
        description: 'The data URL representation of the image',
        minLength: 1,
      },
      // Override width and height from COMMON_LAYER_PROPERTIES to match image dimensions
      width: {
        type: 'number',
        description: 'The display width of the layer, should match image width initially',
        minimum: 1,
      },
      height: {
        type: 'number',
        description: 'The display height of the layer, should match image height initially',
        minimum: 1,
      },
    },
    required: ['type', 'image', 'dataSrc', 'width', 'height'],
    additionalProperties: false,
  },

  // // Multi-layout Layer
  // [ELayerType.MULTI_LAYOUT]: {
  //   type: 'object',
  //   properties: {
  //     type: {
  //       type: 'string',
  //       const: ELayerType.MULTI_LAYOUT,
  //       description: 'The type of the layer - multi-layout container',
  //     },
  //     ...COMMON_LAYER_PROPERTIES,
  //     label: {
  //       type: 'string',
  //       description: 'The label of the layer',
  //       default: 'Multi-layout',
  //       minLength: 1,
  //       maxLength: 100,
  //     },
  //     optionSet: {
  //       type: 'array',
  //       description: 'The configuration options for multi-layout behavior',
  //       default: [],
  //       items: {
  //         type: 'object',
  //         description: 'Multi-layout option configuration',
  //         properties: {
  //           _id: {
  //             type: 'string',
  //             description: 'The unique identifier of the option set',
  //             pattern: UUID_PATTERN,
  //           },
  //           shopDomain: {
  //             type: 'string',
  //             description: 'The shop domain that owns this option set',
  //             pattern: '^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]\\.myshopify\\.com$',
  //           },
  //           labelOnStoreFront: {
  //             type: 'string',
  //             description: 'The display label shown to customers',
  //             default: '',
  //             maxLength: 100,
  //           },
  //           type: {
  //             type: 'string',
  //             const: EOptionSet.MULTI_LAYOUT_OPTION,
  //             description: 'The type of option set',
  //           },
  //           data: {
  //             type: 'object',
  //             description: 'The configuration data for multi-layout',
  //             properties: {
  //               multi_layout: {
  //                 type: 'object',
  //                 description: 'Multi-layout specific configuration',
  //                 properties: {
  //                   _id: {
  //                     type: 'string',
  //                     description: 'The identifier of the multi-layout configuration',
  //                     pattern: UUID_PATTERN,
  //                   },
  //                   layouts: {
  //                     type: 'array',
  //                     description: 'Available layout configurations',
  //                     default: [],
  //                     items: {
  //                       type: 'object',
  //                       description: 'Individual layout configuration',
  //                       properties: {
  //                         _id: {
  //                           type: 'string',
  //                           description: 'Layout unique identifier',
  //                           pattern: UUID_PATTERN,
  //                         },
  //                         name: {
  //                           type: 'string',
  //                           description: 'Display name of the layout',
  //                           minLength: 1,
  //                           maxLength: 50,
  //                         },
  //                         grid: {
  //                           type: 'object',
  //                           description: 'Grid system configuration for layout',
  //                           properties: {
  //                             columns: {
  //                               type: 'number',
  //                               minimum: 1,
  //                               maximum: 12,
  //                               description: 'Number of columns in the grid',
  //                             },
  //                             rows: {
  //                               type: 'number',
  //                               minimum: 1,
  //                               maximum: 12,
  //                               description: 'Number of rows in the grid',
  //                             },
  //                           },
  //                           required: ['columns', 'rows'],
  //                           additionalProperties: false,
  //                         },
  //                       },
  //                       required: ['_id', 'name', 'grid'],
  //                       additionalProperties: false,
  //                     },
  //                   },
  //                   layoutNumber: {
  //                     type: 'number',
  //                     description: 'The currently selected layout index',
  //                     default: 0,
  //                     minimum: 0,
  //                   },
  //                   originalLayersSelected: {
  //                     type: 'array',
  //                     description: 'Layer IDs that are affected by this multi-layout',
  //                     default: [],
  //                     items: {
  //                       type: 'string',
  //                       description: 'Layer identifier',
  //                       pattern: UUID_PATTERN,
  //                     },
  //                     maxItems: 50,
  //                   },
  //                 },
  //                 required: ['_id'],
  //                 additionalProperties: false,
  //               },
  //             },
  //             required: ['multi_layout'],
  //             additionalProperties: false,
  //           },
  //         },
  //         required: ['_id', 'type', 'data'],
  //         additionalProperties: false,
  //       },
  //       maxItems: 10,
  //     },
  //   },
  //   required: ['type'],
  //   additionalProperties: false,
  // },

  // // Imageless Layer
  // [ELayerType.IMAGELESS]: {
  //   type: 'object',
  //   properties: {
  //     type: {
  //       type: 'string',
  //       const: ELayerType.IMAGELESS,
  //       description: 'The type of the layer - conditional display layer',
  //     },
  //     ...COMMON_LAYER_PROPERTIES,
  //     label: {
  //       type: 'string',
  //       description: 'The label of the layer',
  //       default: 'Imageless',
  //       minLength: 1,
  //       maxLength: 100,
  //     },
  //     conditionalLogics: {
  //       type: 'array',
  //       description: 'Rules that control when and how this layer appears',
  //       default: [],
  //       items: {
  //         type: 'object',
  //         description: 'Individual conditional logic rule',
  //         properties: {
  //           condition: {
  //             type: 'string',
  //             description: 'The logical condition expression to evaluate',
  //             minLength: 1,
  //             maxLength: 500,
  //           },
  //           action: {
  //             type: 'string',
  //             enum: ['show', 'hide', 'transform', 'style'],
  //             description: 'Action to perform when condition is met',
  //           },
  //           value: {
  //             type: 'string',
  //             description: 'Value or parameter to apply with the action',
  //             maxLength: 200,
  //           },
  //         },
  //         required: ['condition', 'action'],
  //         additionalProperties: false,
  //       },
  //       maxItems: 20,
  //     },
  //   },
  //   required: ['type'],
  //   additionalProperties: false,
  // },
}

const MANAGE_LAYER_ACTIONS = {
  CREATE: MCP_TOOLS.CREATE_LAYER,
  UPDATE: MCP_TOOLS.UPDATE_LAYER,
}

const manageLayerTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: MCP_TOOLS.MANAGE_LAYER,
    description: manageLayerToolDescription,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: Object.values(MANAGE_LAYER_ACTIONS),
          description: `REQUIRED: The action to perform - "${MANAGE_LAYER_ACTIONS.CREATE}" for new layer, "${MANAGE_LAYER_ACTIONS.UPDATE}" for existing layer`,
        },
        shopDomain: {
          type: 'string',
          description: 'REQUIRED: The shop domain ends with .myshopify.com. Check conversation history first.',
        },
        templateId: {
          type: 'string',
          description: 'REQUIRED: The unique identifier of the template. Check conversation history first.',
          pattern: UUID_PATTERN,
        },
        layerId: {
          type: 'string',
          description: 'REQUIRED for UPDATE: The unique identifier of the layer to update. Not needed for CREATE.',
          pattern: UUID_PATTERN,
        },
        layer: {
          type: 'object',
          description: 'For CREATE: Complete layer data. For UPDATE: Only properties to change.',
          oneOf: Object.values(LAYER_SCHEMAS),
          required: ['type'],
        },
      },
      required: ['action', 'templateId', 'layer', 'shopDomain'],
      additionalProperties: false,
    },
  },
}

export default manageLayerTool
