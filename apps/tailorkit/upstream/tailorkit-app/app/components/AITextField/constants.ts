const TEXT_TONE_KEY = {
  DARING: 'daring',
  EXPERT: 'expert',
  PERSUASIVE: 'persuasive',
  PLAYFUL: 'playful',
  PROFESSIONAL: 'professional',
  SOPHISTICATED: 'sophisticated',
  SUPPORTIVE: 'supportive',
}

const TEXT_TONE_OPTIONS_MAP = {
  [TEXT_TONE_KEY.DARING]: {
    labelKey: 'daring',
    value: TEXT_TONE_KEY.DARING,
  },
  [TEXT_TONE_KEY.EXPERT]: {
    labelKey: 'expert',
    value: TEXT_TONE_KEY.EXPERT,
  },
  [TEXT_TONE_KEY.PERSUASIVE]: {
    labelKey: 'persuasive',
    value: TEXT_TONE_KEY.PERSUASIVE,
  },
  [TEXT_TONE_KEY.PLAYFUL]: {
    labelKey: 'playful',
    value: TEXT_TONE_KEY.PLAYFUL,
  },
  [TEXT_TONE_KEY.PROFESSIONAL]: {
    labelKey: 'professional',
    value: TEXT_TONE_KEY.PROFESSIONAL,
  },
  [TEXT_TONE_KEY.SOPHISTICATED]: {
    labelKey: 'sophisticated',
    value: TEXT_TONE_KEY.SOPHISTICATED,
  },
  [TEXT_TONE_KEY.SUPPORTIVE]: {
    labelKey: 'supportive',
    value: TEXT_TONE_KEY.SUPPORTIVE,
  },
}

const IMAGE_STYLE_KEY = {
  ABSTRACT: 'abstract',
  ANIME: 'anime',
  CARTOON: 'cartoon',
  CINEMATIC: 'cinematic',
  COLLAGE: 'collage',
  CYBERPUNK: 'cyberpunk',
  DIGITAL_ART: 'digital-art',
  FANTASY: 'fantasy',
  FLAT_DESIGN: 'flat-design',
  GHIBLI: 'ghibli',
  GRAFFITI: 'graffiti',
  LINE_ART: 'line-art',
  LOW_POLY: 'low-poly',
  MINIMALIST: 'minimalist',
  NEON: 'neon',
  NONE: 'none',
  OIL_PAINTING: 'oil-painting',
  PHOTOGRAPHIC: 'photographic',
  PIXEL_ART: 'pixel-art',
  POP_ART: 'pop-art',
  REALISTIC: 'realistic',
  RETRO: 'retro',
  SKETCH: 'sketch',
  STEAMPUNK: 'steampunk',
  SURREAL: 'surreal',
  THREE_D: '3d',
  VINTAGE: 'vintage',
  WATERCOLOR: 'watercolor',
}

const IMAGE_STYLE_OPTIONS_MAP = {
  [IMAGE_STYLE_KEY.ABSTRACT]: {
    labelKey: 'abstract',
    value: IMAGE_STYLE_KEY.ABSTRACT,
  },
  [IMAGE_STYLE_KEY.ANIME]: {
    labelKey: 'anime',
    value: IMAGE_STYLE_KEY.ANIME,
  },
  [IMAGE_STYLE_KEY.CARTOON]: {
    labelKey: 'cartoon',
    value: IMAGE_STYLE_KEY.CARTOON,
  },
  [IMAGE_STYLE_KEY.CINEMATIC]: {
    labelKey: 'cinematic',
    value: IMAGE_STYLE_KEY.CINEMATIC,
  },
  [IMAGE_STYLE_KEY.COLLAGE]: {
    labelKey: 'collage',
    value: IMAGE_STYLE_KEY.COLLAGE,
  },
  [IMAGE_STYLE_KEY.CYBERPUNK]: {
    labelKey: 'cyberpunk',
    value: IMAGE_STYLE_KEY.CYBERPUNK,
  },
  [IMAGE_STYLE_KEY.DIGITAL_ART]: {
    labelKey: 'digital-art',
    value: IMAGE_STYLE_KEY.DIGITAL_ART,
  },
  [IMAGE_STYLE_KEY.FANTASY]: {
    labelKey: 'fantasy',
    value: IMAGE_STYLE_KEY.FANTASY,
  },
  [IMAGE_STYLE_KEY.FLAT_DESIGN]: {
    labelKey: 'flat-design',
    value: IMAGE_STYLE_KEY.FLAT_DESIGN,
  },
  [IMAGE_STYLE_KEY.GHIBLI]: {
    labelKey: 'ghibli',
    value: IMAGE_STYLE_KEY.GHIBLI,
  },
  [IMAGE_STYLE_KEY.GRAFFITI]: {
    labelKey: 'graffiti',
    value: IMAGE_STYLE_KEY.GRAFFITI,
  },
  [IMAGE_STYLE_KEY.LINE_ART]: {
    labelKey: 'line-art',
    value: IMAGE_STYLE_KEY.LINE_ART,
  },
  [IMAGE_STYLE_KEY.LOW_POLY]: {
    labelKey: 'low-poly',
    value: IMAGE_STYLE_KEY.LOW_POLY,
  },
  [IMAGE_STYLE_KEY.MINIMALIST]: {
    labelKey: 'minimalist',
    value: IMAGE_STYLE_KEY.MINIMALIST,
  },
  [IMAGE_STYLE_KEY.NEON]: {
    labelKey: 'neon',
    value: IMAGE_STYLE_KEY.NEON,
  },
  [IMAGE_STYLE_KEY.NONE]: {
    labelKey: 'none',
    value: IMAGE_STYLE_KEY.NONE,
  },
  [IMAGE_STYLE_KEY.OIL_PAINTING]: {
    labelKey: 'oil-painting',
    value: IMAGE_STYLE_KEY.OIL_PAINTING,
  },
  [IMAGE_STYLE_KEY.PHOTOGRAPHIC]: {
    labelKey: 'photographic',
    value: IMAGE_STYLE_KEY.PHOTOGRAPHIC,
  },
  [IMAGE_STYLE_KEY.PIXEL_ART]: {
    labelKey: 'pixel-art',
    value: IMAGE_STYLE_KEY.PIXEL_ART,
  },
  [IMAGE_STYLE_KEY.POP_ART]: {
    labelKey: 'pop-art',
    value: IMAGE_STYLE_KEY.POP_ART,
  },
  [IMAGE_STYLE_KEY.REALISTIC]: {
    labelKey: 'realistic',
    value: IMAGE_STYLE_KEY.REALISTIC,
  },
  [IMAGE_STYLE_KEY.RETRO]: {
    labelKey: 'retro',
    value: IMAGE_STYLE_KEY.RETRO,
  },
  [IMAGE_STYLE_KEY.SKETCH]: {
    labelKey: 'sketch',
    value: IMAGE_STYLE_KEY.SKETCH,
  },
  [IMAGE_STYLE_KEY.STEAMPUNK]: {
    labelKey: 'steampunk',
    value: IMAGE_STYLE_KEY.STEAMPUNK,
  },
  [IMAGE_STYLE_KEY.SURREAL]: {
    labelKey: 'surreal',
    value: IMAGE_STYLE_KEY.SURREAL,
  },
  [IMAGE_STYLE_KEY.THREE_D]: {
    labelKey: '3d',
    value: IMAGE_STYLE_KEY.THREE_D,
  },
  [IMAGE_STYLE_KEY.VINTAGE]: {
    labelKey: 'vintage',
    value: IMAGE_STYLE_KEY.VINTAGE,
  },
  [IMAGE_STYLE_KEY.WATERCOLOR]: {
    labelKey: 'watercolor',
    value: IMAGE_STYLE_KEY.WATERCOLOR,
  },
}

const TONE_TYPE = {
  TEXT: 'text',
  IMAGE: 'image',
}

const MAX_LENGTH_PROMPT = {
  [TONE_TYPE.TEXT]: 500,
  [TONE_TYPE.IMAGE]: 2000,
}

const imagePromptSuggestions = [
  {
    labelKey: 'suggest-image-prompt-1-label',
    prompt: 'suggest-image-prompt-1-description',
  },
  {
    labelKey: 'suggest-image-prompt-2-label',
    prompt: 'suggest-image-prompt-2-description',
  },
  {
    labelKey: 'suggest-image-prompt-3-label',
    prompt: 'suggest-image-prompt-3-description',
  },
  {
    labelKey: 'suggest-image-prompt-4-label',
    prompt: 'suggest-image-prompt-4-description',
  },
  {
    labelKey: 'suggest-image-prompt-5-label',
    prompt: 'suggest-image-prompt-5-description',
  },
]

export {
  TONE_TYPE,
  TEXT_TONE_OPTIONS_MAP,
  IMAGE_STYLE_OPTIONS_MAP,
  TEXT_TONE_KEY,
  IMAGE_STYLE_KEY,
  MAX_LENGTH_PROMPT,
  imagePromptSuggestions,
}
