import type { PromptPresetDocument } from './PromptPreset'
import mongoose from '~/bootstrap/db/connect-db.server'

const promptPresetSchema = new mongoose.Schema<PromptPresetDocument>(
  {
    name: {
      type: String,
      index: true,
      required: true,
    },
    alias: {
      type: String,
      unique: true,
      index: true,
    },
    ordering: {
      type: Number,
      index: true,
      default: 99,
    },
    thumbnail: [
      {
        type: String,
        index: true,
      },
    ],
    instruction: {
      type: String,
      required: true,
    },
    imported: {
      type: Boolean,
      index: true,
      default: false,
    },
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
    type: {
      type: String,
      index: true,
      default: 'quick_prompt',
      enum: ['quick_prompt', 'template_type', 'visual_style', 'content_theme'],
    },
    hot: {
      type: Boolean,
      index: true,
    },
    category: {
      type: String,
      index: true,
      default: null,
      enum: [null, 'engraved', 'illustrative', 'festive'],
    },
    presetVersion: {
      type: Number,
      index: true,
    },
  },
  { timestamps: true }
)

const PromptPreset
  = mongoose.models.PromptPreset || mongoose.model('PromptPreset', promptPresetSchema, 'prompt_presets')

export default PromptPreset
