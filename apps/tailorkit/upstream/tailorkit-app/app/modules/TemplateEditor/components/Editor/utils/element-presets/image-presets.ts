/**
 * Image Preset Config Functions
 *
 * Returns configuration objects that tell the panel orchestrator (Phase 6) how to
 * handle image element creation. Image presets open an existing panel first, then
 * apply personalization configuration after the user adds an image.
 */

import type { ImagePresetResult } from './types'

// ---------------------------------------------------------------------------
// Preset 1: Image Upload
// Opens image panel; after user adds image, auto-configures buyer upload.
// ---------------------------------------------------------------------------

export function getImageUploadPreset(): ImagePresetResult {
  return {
    action: 'open-panel',
    panel: 'image',
    postAddActions: [
      {
        type: 'personalize-image',
        config: {
          label: 'Upload your image',
          source: 'buyer',
          enableUpload: true,
          enableEditAll: true,
          required: true,
        },
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Preset 2: Image Options (seller-curated option set)
// Opens image panel; after add, configures a seller option set (empty by default).
// ---------------------------------------------------------------------------

export function getImageOptionsPreset(): ImagePresetResult {
  return {
    action: 'open-panel',
    panel: 'image',
    postAddActions: [
      {
        type: 'personalize-image',
        config: {
          label: 'Select image',
          source: 'seller',
          optionSet: { label: 'Select image', options: [] },
        },
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Preset 3: AI Effects for Buyers
// Opens image panel; after add, enables buyer upload + AI style effects.
// ---------------------------------------------------------------------------

export function getAIEffectsBuyersPreset(): ImagePresetResult {
  return {
    action: 'open-panel',
    panel: 'image',
    postAddActions: [
      {
        type: 'personalize-image',
        config: {
          label: 'Upload image and apply AI effects',
          source: 'buyer',
          enableUpload: true,
          enableEditAll: true,
          required: true,
          enableAIEffects: true,
          aiEffectStyles: ['Flat Graphic', 'Hand-Drawn', 'Pixel Art', 'Retro', 'Semi-Realistic', 'Painterly'],
          advancedOptionCount: 2,
        },
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Preset 4: AI Effects for Sellers
// Simply opens the existing AI Image panel — no post-add actions needed.
// ---------------------------------------------------------------------------

export function getAIEffectsSellersPreset(): ImagePresetResult {
  return {
    action: 'open-panel',
    panel: 'ai-image',
    postAddActions: [
      {
        type: 'personalize-image',
        config: {
          label: 'Upload your image',
          source: 'buyer',
          enableUpload: true,
          enableEditAll: true,
          required: true,
        },
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Preset 5: Image Shapes
// Opens image panel; after add, configures buyer upload AND mask option set.
// ---------------------------------------------------------------------------

export function getImageShapesPreset(): ImagePresetResult {
  return {
    action: 'open-panel',
    panel: 'image',
    postAddActions: [
      {
        type: 'personalize-image',
        config: {
          label: 'Upload your image',
          source: 'buyer',
          enableUpload: true,
          enableEditAll: true,
          required: true,
        },
      },
      {
        type: 'personalize-mask',
        config: {
          label: 'Select image shape',
          maskShapes: ['Circle', 'Heart'],
        },
      },
    ],
  }
}
