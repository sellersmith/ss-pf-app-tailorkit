/* eslint-disable max-len */
/**
 * Centralized schema registry for template AI agents.
 * Provides pre-configured schemas for template operations and validation.
 */

import { BACKGROUND_TYPES, TEMPLATE_INTENT_TYPES, UUID_PATTERN } from '../constants/schema-enums'
import type { InteropZodObject } from '@langchain/core/utils/types'
import type { ResponseFormatJSONSchema } from 'openai/resources/shared.mjs'
import {
  createTextElementSchema,
  createImageElementSchema,
  createTextProductionElementSchema,
  createImageProductionElementSchema,
  createStyleCharacteristicsSchema,
  createCompositionGuidelinesSchema,
  createTemplateApplySchema,
  createLayerApplySchema,
  createOptionSetApplySchema,
  createOptionSetApplyDeltaSchema,
  CommonSchemas,
  ComplexSchemas,
} from './schema-builders'

/** Available schema keys for template agent operations */
export type TemplateSchemaKeys =
  | 'subjectExtraction'
  | 'templateIntentAnalysis'
  | 'templateContextAnalysis'
  | 'canvasStyleMapping'
  | 'productCanvasComposition'
  | 'operationApply_templateEdit'
  | 'operationApply_layerEdit'
  | 'operationApply_optionSetEdit'
  | 'operationApply_optionSetCreate'

/** Pre-configured schema definitions mapped to operation keys */
export const TemplateSchemas: Record<
  TemplateSchemaKeys,
  Omit<ResponseFormatJSONSchema['json_schema'], 'schema'> & {
    /**
     * The schema for the response format, described as a JSON Schema object
     * or a Zod object.
     */
    schema: Record<string, any> | InteropZodObject
  }
> = {
  /** Extracts distinct visual subjects from user prompts */
  subjectExtraction: {
    name: 'subject_extraction',
    description: 'Extract distinct visual subjects and their relationships from user prompt',
    strict: false,
    schema: {
      type: 'object',
      properties: {
        mainSubjects: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Unique identifier for the subject',
              },
              label: {
                type: 'string',
                description: 'Human-readable name for the subject',
              },
              type: {
                type: 'string',
                description: 'Type of subject (e.g., person, animal, object)',
              },
              description: {
                type: 'string',
                description: 'Detailed description of the subject',
              },
              keyPhrases: {
                type: 'array',
                items: { type: 'string' },
                description: 'Key descriptive phrases from the prompt',
              },
            },
            required: ['id', 'label', 'type', 'description'],
            additionalProperties: false,
          },
        },
        supportingElements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Unique identifier for the element',
              },
              label: {
                type: 'string',
                description: 'Human-readable name for the element',
              },
              type: {
                type: 'string',
                description: 'Type of element (e.g., decoration, background)',
              },
              description: {
                type: 'string',
                description: 'Detailed description of the element',
              },
              keyPhrases: {
                type: 'array',
                items: { type: 'string' },
                description: 'Key descriptive phrases from the prompt',
              },
            },
            required: ['id', 'label', 'type', 'description'],
            additionalProperties: false,
          },
        },
        textContents: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Unique identifier for the text content',
              },
              role: {
                type: 'string',
                description: 'Role of the text (e.g., heading, caption, detail)',
              },
              content: {
                type: 'string',
                description: 'The actual text content',
              },
            },
            required: ['id', 'role', 'content'],
            additionalProperties: false,
          },
        },
      },
      required: ['mainSubjects', 'supportingElements', 'textContents'],
      additionalProperties: false,
    },
  },

  /** Analyzes user intent for template operations */
  templateIntentAnalysis: {
    name: 'template_intent_analysis',
    description: 'Analysis of user conversation to determine template operation intent and context requirements',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        intentType: {
          type: 'string',
          enum: TEMPLATE_INTENT_TYPES,
          description: 'Type of template operation being requested',
        },
        confidence: CommonSchemas.confidence,
        operation: {
          type: 'string',
          description: 'Brief snake_case description of the specific operation',
        },
        needsContext: {
          type: 'boolean',
          description: 'Whether additional context is required before proceeding',
        },
        contextLevel: CommonSchemas.contextLevel,
      },
      required: ['intentType', 'confidence', 'operation', 'needsContext', 'contextLevel'],
      additionalProperties: false,
    },
  },

  /** Extracts comprehensive context for template creation */
  templateContextAnalysis: {
    name: 'template_context_analysis',
    description:
      'Comprehensive extraction of product, style, and purpose context from user requests for template creation',
    strict: false,
    schema: {
      type: 'object',
      properties: {
        product: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              description: 'Product type (e.g., t-shirt, mug, poster) or "missing" if unclear',
            },
            category: {
              type: 'string',
              description: 'Product category (e.g., apparel, drinkware, home-decor) or "missing" if unclear',
            },
            printableAreas: ComplexSchemas.printableArea,
          },
          required: ['type', 'category', 'printableAreas'],
          additionalProperties: false,
        },
        style: {
          type: 'object',
          properties: {
            theme: {
              type: 'string',
              description: 'Design theme (e.g., minimalist, vintage, modern) or "missing" if unclear',
            },
            mood: {
              ...CommonSchemas.stringArray,
              description: 'Mood keywords describing the desired aesthetic',
            },
            colorScheme: ComplexSchemas.colorScheme,
            typography: ComplexSchemas.typography,
            visualElements: ComplexSchemas.visualElements,
          },
          required: ['theme', 'mood', 'colorScheme', 'typography', 'visualElements'],
          additionalProperties: false,
        },
        purpose: {
          type: 'object',
          properties: {
            type: CommonSchemas.purposeType,
            occasion: {
              type: 'string',
              description: 'Specific occasion or event (use "general" if not specified)',
            },
            audience: {
              ...CommonSchemas.stringArray,
              description: 'Target audience demographics or characteristics',
            },
            requirements: {
              ...CommonSchemas.stringArray,
              description: 'Specific requirements or constraints mentioned',
            },
          },
          required: ['type', 'occasion', 'audience', 'requirements'],
          additionalProperties: false,
        },
        confidence: CommonSchemas.confidence,
        templateName: {
          type: 'string',
          description: 'Meaningful template name generated from context',
        },
      },
      required: ['product', 'style', 'purpose', 'confidence', 'templateName'],
      additionalProperties: false,
    },
  },

  /** Maps style requirements to visual elements and composition */
  canvasStyleMapping: {
    name: 'canvas_style_mapping',
    description:
      'Style-appropriate visual elements and composition guidelines for canvas-based template design with semantic relationships',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        elements: {
          type: 'array',
          items: {
            anyOf: [
              createTextElementSchema(ComplexSchemas.semanticContext),
              createImageElementSchema(ComplexSchemas.semanticContext),
            ],
          },
        },
        styleCharacteristics: createStyleCharacteristicsSchema(),
        compositionGuidelines: createCompositionGuidelinesSchema(),
        sceneContext: ComplexSchemas.sceneContext,
      },
      required: ['elements', 'styleCharacteristics', 'compositionGuidelines', 'sceneContext'],
      additionalProperties: false,
    },
  },

  /** Creates production-ready canvas with precise positioning */
  productCanvasComposition: {
    name: 'product_canvas_composition',
    description:
      'Production-ready canvas composition with precise element positioning, sizing, and manufacturing constraints',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        elements: {
          type: 'array',
          items: {
            anyOf: [createTextProductionElementSchema(), createImageProductionElementSchema()],
          },
        },
        canvasProperties: {
          type: 'object',
          properties: {
            dimension: {
              type: 'object',
              description: 'Canvas size and resolution specifications',
              properties: {
                width: {
                  type: 'number',
                  minimum: 1,
                  description: 'Canvas width in pixels',
                },
                height: {
                  type: 'number',
                  minimum: 1,
                  description: 'Canvas height in pixels',
                },
                measurementUnit: {
                  type: 'string',
                  enum: ['px'],
                  description: 'Unit of measurement (always pixels for canvas)',
                },
                resolution: CommonSchemas.resolution,
              },
              required: ['width', 'height', 'measurementUnit', 'resolution'],
              additionalProperties: false,
            },
            safeZone: {
              type: 'object',
              properties: {
                top: {
                  type: 'number',
                  minimum: 0,
                  description: 'Top margin in pixels',
                },
                right: {
                  type: 'number',
                  minimum: 0,
                  description: 'Right margin in pixels',
                },
                bottom: {
                  type: 'number',
                  minimum: 0,
                  description: 'Bottom margin in pixels',
                },
                left: {
                  type: 'number',
                  minimum: 0,
                  description: 'Left margin in pixels',
                },
              },
              required: ['top', 'right', 'bottom', 'left'],
              additionalProperties: false,
            },
            backgroundColor: {
              ...CommonSchemas.hexColor,
              description: 'Background color in hex format (e.g., #FFFFFF)',
            },
            backgroundType: {
              type: 'string',
              enum: BACKGROUND_TYPES,
            },
          },
          required: ['dimension', 'safeZone', 'backgroundColor', 'backgroundType'],
          additionalProperties: false,
        },
        composition: {
          type: 'object',
          properties: {
            focalPoint: {
              type: 'object',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
              },
              required: ['x', 'y'],
              additionalProperties: false,
            },
            visualFlow: {
              type: 'string',
              description: 'Description of how the eye moves through the composition',
            },
            layerInteractions: {
              type: 'object',
              properties: {
                hasOverlaps: {
                  type: 'boolean',
                  description: 'Whether any elements intentionally overlap',
                },
                intentionalOverlaps: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      element1: {
                        type: 'string',
                        description: 'ID of first overlapping element',
                      },
                      element2: {
                        type: 'string',
                        description: 'ID of second overlapping element',
                      },
                    },
                    required: ['element1', 'element2'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['hasOverlaps', 'intentionalOverlaps'],
              additionalProperties: false,
            },
          },
          required: ['focalPoint', 'visualFlow', 'layerInteractions'],
          additionalProperties: false,
        },
        productionGuidelines: {
          type: 'object',
          properties: {
            printingConstraints: {
              type: 'array',
              items: { type: 'string' },
              description: 'Production constraints for printing this design',
            },
            qualityRequirements: {
              type: 'array',
              items: { type: 'string' },
              description: 'Quality standards that must be met',
            },
            safetyChecks: {
              type: 'array',
              items: { type: 'string' },
              description: 'Safety validations to perform before production',
            },
          },
          required: ['printingConstraints', 'qualityRequirements', 'safetyChecks'],
          additionalProperties: false,
        },
      },
      required: ['elements', 'canvasProperties', 'composition', 'productionGuidelines'],
      additionalProperties: false,
    },
  },

  /** Template edit operation schema returning updated entity */
  operationApply_templateEdit: {
    name: 'operation_apply_template_edit',
    description: 'Return full updated template entity after applying user request',
    strict: false,
    schema: {
      type: 'object',
      properties: {
        updatedTemplate: createTemplateApplySchema(),
        contextualReasons: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    },
  },

  /** Layer edit operation schema returning updated layer */
  operationApply_layerEdit: {
    name: 'operation_apply_layer_edit',
    description: 'Return only changed fields for the layer after applying user request',
    strict: false,
    schema: {
      type: 'object',
      properties: {
        updatedLayer: createLayerApplySchema(),
        targetLayer: {
          type: 'string',
          pattern: UUID_PATTERN,
          description: 'The unique identifier of the layer to update',
        },
        contextualReasons: { type: 'array', items: { type: 'string' } },
        positionOps: {
          type: 'array',
          description:
            'Optional movement ops when LLM prefers to return deltas; extractor may compute absolute positions',
          items: {
            type: 'object',
            properties: {
              target: { type: 'string', enum: ['x', 'y', 'both'] },
              type: { type: 'string', enum: ['set', 'add'] },
              value: { type: 'number' },
              unit: { type: 'string', enum: ['px', '%'] },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
  },

  /** Option set edit operation schema returning updated options */
  operationApply_optionSetEdit: {
    name: 'operation_apply_option_set_edit',
    description: 'Return only changed fields for the option set after applying user request',
    strict: false,
    schema: {
      type: 'object',
      properties: {
        updatedOptionSet: createOptionSetApplyDeltaSchema(),
        targetLayer: {
          type: 'string',
          pattern: UUID_PATTERN,
          description: 'The unique identifier of the layer to update',
        },
        contextualReasons: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    },
  },

  /** Option set create operation schema requiring full payload */
  operationApply_optionSetCreate: {
    name: 'operation_apply_option_set_create',
    description:
      'Return full option set for CREATE. Do NOT include delta fields (edits/creates/deleteIds). Provide full data.* array with at least 3 NEW items (no duplicates of existing values). System will assign _id if missing.',
    strict: false,
    schema: {
      type: 'object',
      properties: {
        updatedOptionSet: createOptionSetApplySchema(),
        targetLayer: {
          type: 'string',
          pattern: UUID_PATTERN,
          description: 'The unique identifier of the layer to attach option set',
        },
        contextualReasons: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    },
  },
}

/** Schema factory for creating OpenAI response formats */
export class SchemaFactory {
  /**
   * Creates OpenAI response format from schema key.
   * @param schemaKey - Key from TemplateSchemas registry
   * @returns OpenAI structured output format
   */
  static createResponseFormat(schemaKey: keyof typeof TemplateSchemas) {
    const schema = TemplateSchemas[schemaKey]
    if (!schema) {
      throw new Error(`Schema '${schemaKey}' not found`)
    }
    return {
      type: 'json_schema' as const,
      json_schema: schema,
    }
  }
}
