/**
 * Text preset factory functions.
 *
 * Each function returns a TextPresetResult containing one or more element configs.
 * The CALLER is responsible for invoking addElements() and handling postActions.
 *
 * Effect configs are built using the existing presets from effects/presets.ts.
 */

import {
  createNeonPreset,
  createEmbossPreset,
  createDebossPreset,
} from '~/modules/TemplateEditor/elements/effects/presets'
import {
  updateEmbossDirection,
  updateEmbossDepth,
  updateNeonIntensity,
} from '~/modules/TemplateEditor/elements/effects/preset-utils'
import type { TextPresetResult, PostAction } from './types'
import type { TextSettings } from '~/types/psd'

// ============================================================================
// Font catalogue
// ============================================================================

const FONT_SPECIAL_ELITE = {
  family: 'Special Elite',
  src: 'https://fonts.gstatic.com/s/specialelite/v20/XLYgIZbkc4JPUL5CVArUVL0nhnc.ttf',
}

const FONT_BEBAS_NEUE = {
  family: 'Bebas Neue',
  src: 'https://fonts.gstatic.com/s/bebasneue/v16/JTUSjIg69CK48gW7PXooxW4.ttf',
}

const FONT_CINZEL = {
  family: 'Cinzel',
  src: 'https://fonts.gstatic.com/s/cinzel/v26/8vIU7ww63mVu7gtR-kwKxNvkNOjw-tbnTYo.ttf',
}

// ============================================================================
// Base settings builder
// ============================================================================

function buildBaseSettings(overrides: Partial<TextSettings> = {}): TextSettings {
  return {
    fontFamily: FONT_SPECIAL_ELITE,
    fontSize: 120,
    textColor: '#000000ff',
    textStyle: [],
    autoFitToContainer: true,
    content: 'Enter message',
    ...overrides,
  }
}

// ============================================================================
// 1. Text input preset
// ============================================================================

/**
 * Creates a simple text layer pre-configured for buyer text input.
 * Post-action: opens Personalize Text > Buyers panel.
 */
export function applyTextInputPreset(): TextPresetResult {
  const postActions: PostAction[] = [
    {
      type: 'open-personalize-text',
      config: {
        section: 'buyers',
        label: 'Enter message',
        placeholder: 'Enter message',
        required: true,
        fieldType: 'single-line',
        characterLimit: 20,
      },
    },
  ]

  return {
    elements: [
      {
        settings: buildBaseSettings({ content: 'Enter message' }),
        postActions,
      },
    ],
  }
}

// ============================================================================
// 2. Text options preset
// ============================================================================

/**
 * Creates a text layer pre-configured for seller-defined options (dropdown).
 * Post-action: opens Personalize Text > Yourself with an option set.
 */
export function applyTextOptionsPreset(): TextPresetResult {
  const postActions: PostAction[] = [
    {
      type: 'open-personalize-text',
      config: {
        section: 'yourself',
        label: 'Select message',
        optionSet: {
          label: 'Select message',
          options: ['Message 1', 'Message 2', 'Message 3'],
        },
      },
    },
  ]

  return {
    elements: [
      {
        settings: buildBaseSettings({ content: 'Message 1' }),
        postActions,
      },
    ],
  }
}

// ============================================================================
// 3. Engraving preset — 2 elements (debossed + embossed)
// ============================================================================

/**
 * Creates two text layers demonstrating deboss and emboss engraving effects.
 * Each layer gets a buyer personalization post-action.
 */
export function applyEngravingPreset(): TextPresetResult {
  const debossPreset = createDebossPreset()
  const embossPreset = createEmbossPreset()

  // Deboss: direction 280°, depth 45%
  let debossEffects = updateEmbossDirection(debossPreset.effects, 280, 'deboss')
  debossEffects = updateEmbossDepth(debossEffects, 45, 'deboss')

  const debossedSettings: TextSettings = {
    fontFamily: FONT_SPECIAL_ELITE,
    fontSize: 75,
    textColor: 'rgba(152, 75, 9, 1)',
    textStyle: [],
    autoFitToContainer: true,
    content: 'Debossed text',
    effects: debossEffects,
    metadata: {
      effectStyle: 'deboss',
      applyColorOverlay: true,
    },
  }

  // Emboss: direction 270° (default), depth 50% (default)
  const embossedSettings: TextSettings = {
    fontFamily: FONT_BEBAS_NEUE,
    fontSize: 90,
    textColor: '#9c6e40ff',
    textStyle: [],
    autoFitToContainer: true,
    content: 'Embossed text',
    effects: embossPreset.effects,
    metadata: {
      effectStyle: 'emboss',
      applyColorOverlay: false,
    },
  }

  return {
    elements: [
      {
        settings: debossedSettings,
        postActions: [
          {
            type: 'open-personalize-text',
            config: {
              section: 'buyers',
              label: 'Enter debossed text',
              placeholder: 'Debossed text',
              required: true,
              fieldType: 'single-line',
              characterLimit: 20,
            },
          },
        ],
      },
      {
        settings: embossedSettings,
        postActions: [
          {
            type: 'open-personalize-text',
            config: {
              section: 'buyers',
              label: 'Enter embossed text',
              placeholder: 'Embossed text',
              required: true,
              fieldType: 'single-line',
              characterLimit: 20,
            },
          },
        ],
      },
    ],
  }
}

// ============================================================================
// 4. Curve / circle preset — 2 elements
// ============================================================================

/**
 * Creates two text layers: one with a curve shape and one with a full circle shape.
 * Each layer gets a buyer personalization post-action.
 */
export function applyCurveCirclePreset(): TextPresetResult {
  // Curve: peaks=1, bend=92%
  const curveSettings: TextSettings = {
    ...buildBaseSettings({ content: 'Curve text' }),
    textShape: 'curve',
    curvePeaks: 1,
    curveBend: 92,
    letterSpacing: 5,
    lineHeight: 1.2,
    verticalAlign: 'middle',
  }

  // Circle: full circle (start=0, end=2π)
  const circleSettings: TextSettings = {
    ...buildBaseSettings({ content: 'This is circle text' }),
    textShape: 'circle',
    circleStartAngle: 0,
    circleEndAngle: Math.PI * 2,
    letterSpacing: 5,
    lineHeight: 1.2,
    verticalAlign: 'middle',
  }

  return {
    elements: [
      {
        settings: curveSettings,
        postActions: [
          {
            type: 'open-personalize-text',
            config: {
              section: 'buyers',
              label: 'Enter curve text',
              placeholder: 'Curve text',
              required: true,
              fieldType: 'single-line',
              characterLimit: 20,
            },
          },
        ],
      },
      {
        settings: circleSettings,
        postActions: [
          {
            type: 'open-personalize-text',
            config: {
              section: 'buyers',
              label: 'Enter circle text',
              placeholder: 'This is circle text',
              required: true,
              fieldType: 'single-line',
              characterLimit: 20,
            },
          },
        ],
      },
    ],
  }
}

// ============================================================================
// 5. Neon preset
// ============================================================================

/**
 * Creates a text layer with a neon glow effect.
 * Color: rgb(245,166,35), intensity: 70%.
 * Post-action: opens Personalize Text > Buyers.
 */
export function applyNeonPreset(): TextPresetResult {
  const neonPreset = createNeonPreset()
  // Apply 70% intensity to effects (maps to ~14.6% radiusPercent)
  const neonEffects = updateNeonIntensity(neonPreset.effects, 70)

  const neonSettings: TextSettings = {
    ...buildBaseSettings({ content: 'Neon text' }),
    textColor: 'rgb(245,166,35)',
    effects: neonEffects,
    metadata: {
      effectStyle: 'neon',
    },
  }

  return {
    elements: [
      {
        settings: neonSettings,
        postActions: [
          {
            type: 'open-personalize-text',
            config: {
              section: 'buyers',
              label: 'Enter neon text',
              placeholder: 'Neon text',
              required: true,
              fieldType: 'single-line',
              characterLimit: 20,
            },
          },
        ],
      },
    ],
  }
}

// ============================================================================
// 6. Font color options preset
// ============================================================================

/**
 * Creates a text layer with buyer text input and a color personalization option.
 * Post-actions: opens Personalize Text + Personalize Color.
 */
export function applyFontColorPreset(): TextPresetResult {
  const postActions: PostAction[] = [
    {
      type: 'open-personalize-text',
      config: {
        section: 'buyers',
        label: 'Enter message',
        placeholder: 'Enter message',
        required: true,
        fieldType: 'single-line',
        characterLimit: 20,
      },
    },
    {
      type: 'open-personalize-color',
      config: {
        label: 'Select font color',
        options: [
          { name: 'Black', value: '#000000ff' },
          { name: 'Green', value: '#417505ff' },
          { name: 'Red', value: '#bc1e1eff' },
        ],
      },
    },
  ]

  return {
    elements: [
      {
        settings: buildBaseSettings({ content: 'Enter message' }),
        postActions,
      },
    ],
  }
}

// ============================================================================
// 7. Font family options preset
// ============================================================================

/**
 * Creates a text layer with buyer text input and a font family personalization option.
 * Post-actions: opens Personalize Text + Personalize Font.
 */
export function applyFontFamilyPreset(): TextPresetResult {
  const postActions: PostAction[] = [
    {
      type: 'open-personalize-text',
      config: {
        section: 'buyers',
        label: 'Enter message',
        placeholder: 'Enter message',
        required: true,
        fieldType: 'single-line',
        characterLimit: 20,
      },
    },
    {
      type: 'open-personalize-font',
      config: {
        label: 'Select font family',
        options: [
          { family: FONT_SPECIAL_ELITE.family, src: FONT_SPECIAL_ELITE.src },
          { family: FONT_CINZEL.family, src: FONT_CINZEL.src },
          { family: FONT_BEBAS_NEUE.family, src: FONT_BEBAS_NEUE.src },
        ],
      },
    },
  ]

  return {
    elements: [
      {
        settings: buildBaseSettings({ content: 'Enter message' }),
        postActions,
      },
    ],
  }
}
