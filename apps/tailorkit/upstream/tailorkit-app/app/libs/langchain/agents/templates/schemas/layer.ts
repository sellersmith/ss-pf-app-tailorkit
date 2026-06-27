/**
 * Layer schema definitions for AI agents validating canvas layer structures.
 * Provides validation for text/image layers with positioning, settings, and option sets.
 */

import { LAYER_TYPES } from '../constants/schema-enums'
import { createImageSettingsSchema, createTextSettingsSchema, SettingsFieldSchemas } from './common'

/**
 * Creates complete layer apply schema for AI agents to return full layer entities.
 * @returns JSON schema defining layer structure with positioning, settings, and options
 */
export const createLayerApplySchema = () => ({
  type: 'object',
  description: 'Full updated layer after applying edits',
  properties: {
    _id: { type: 'string', description: 'Layer identifier' },
    type: { type: 'string', enum: LAYER_TYPES, description: 'Type of the layer' },
    label: { type: 'string', description: 'Label of the layer' },
    visible: { type: 'boolean', description: 'Visibility of the layer' },
    locked: { type: 'boolean', description: 'Locked state of the layer' },
    open: { type: 'boolean', description: 'Expanded/collapsed state in editor' },
    parent: { type: 'string', description: 'Parent layer id' },
    left: { type: 'number', minimum: 0, description: 'Left position of the layer' },
    top: { type: 'number', minimum: 0, description: 'Top position of the layer' },
    right: { type: 'number', minimum: 0, description: 'Right position of the layer' },
    bottom: { type: 'number', minimum: 0, description: 'Bottom position of the layer' },
    width: { type: 'number', minimum: 0, description: 'Width of the layer' },
    height: { type: 'number', minimum: 0, description: 'Height of the layer' },
    rotate: { type: 'number', minimum: 0, maximum: 360, description: 'Rotation of the layer' },
    opacity: SettingsFieldSchemas.imageSetting.opacity,
    settings: {
      type: 'object',
      description: 'Settings of the layer (text or image)',
      anyOf: [createTextSettingsSchema(), createImageSettingsSchema()],
      additionalProperties: false,
    },
    templateId: { type: 'string', description: 'Template id reference' },
    image: {
      type: 'object',
      description:
        'Image object used for rendering this layer. Authoritative prompt MUST be provided at image.generativeOptions.prompt.',
      properties: {
        _id: { type: 'string', description: 'Generated image id' },
        src: { type: 'string', description: 'Image source URL' },
        imageName: { type: 'string', description: 'Original image filename or friendly name' },
        width: { type: 'number', minimum: 0, description: 'Intrinsic image width' },
        height: { type: 'number', minimum: 0, description: 'Intrinsic image height' },
        generativeOptions: {
          type: 'object',
          description: 'Generative options for AI image generation',
          properties: {
            imageType: SettingsFieldSchemas.imageSetting.imageType,
            prompt: SettingsFieldSchemas.imageSetting.imagePrompt,
            imageStyle: SettingsFieldSchemas.imageSetting.imageStyle,
            aspectRatio: { type: 'string', description: 'Optional aspect ratio constraint' },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    children: { type: 'array', items: { type: 'string' }, description: 'Children layer ids' },
  },
  required: ['_id', 'type'],
  additionalProperties: false,
})
