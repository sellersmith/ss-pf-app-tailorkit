/* eslint-disable max-len */

import { templateTypes } from './taxonomies/templateTypes'
import { visualStyles } from './taxonomies/visualStyles'
import { contentThemes } from './taxonomies/contentThemes'

// ============================================================================
// QUICK PROMPT PARSING
// ============================================================================

/**
 * Parse quick prompt format to extract explicit dimension specifications
 * Handles formats like: "Template Type: text-layout (centered subtype) or badge (circular subtype)"
 */
function parseQuickPromptDimensions(userPrompt: string): {
  template?: string
  style?: string
  theme?: string
  cleanedPrompt: string
} {
  const result = {
    template: undefined as string | undefined,
    style: undefined as string | undefined,
    theme: undefined as string | undefined,
    cleanedPrompt: userPrompt,
  }

  // Patterns to match structured declarations
  const patterns = {
    template: /Template Type:\s*([^.\n]+)/i,
    style: /Visual Style:\s*([^.\n]+)/i,
    theme: /Content Theme:\s*([^.\n]+)/i,
  }

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = userPrompt.match(pattern)
    if (match) {
      const declaration = match[1].trim()

      // Split by "or" to get options
      const options = declaration.split(/\s+or\s+/i).map(opt => {
        // Extract ID from formats like "line-art (thin-line variant)" or just "line-art"
        const idMatch = opt.match(/^([a-z-]+)/)
        return idMatch ? idMatch[1] : opt.trim()
      })

      // Randomly select one option
      const selected = options[Math.floor(Math.random() * options.length)]

      result[key as 'template' | 'style' | 'theme'] = selected

      // Clean up the prompt by replacing multi-option with selected option
      result.cleanedPrompt = result.cleanedPrompt.replace(match[0], `${match[0].split(':')[0]}: ${selected}`)
    }
  }

  return result
}

// ============================================================================
// KEYWORD EXTRACTION & DETECTION LOGIC
// ============================================================================

/**
 * Extract keywords from taxonomy items for matching
 */
function extractKeywords(item: any, type: 'template' | 'style' | 'theme'): string[] {
  const keywords: string[] = []

  // Add name and ID
  keywords.push(item.name.toLowerCase(), item.id.toLowerCase())

  // Add description words
  if (item.description) {
    keywords.push(...item.description.toLowerCase().split(/\s+/))
  }

  // Type-specific keyword extraction
  if (type === 'template') {
    // Add subtype names and use cases
    if (item.subtypes) {
      item.subtypes.forEach((subtype: any) => {
        keywords.push(subtype.name.toLowerCase())
        if (subtype.use_cases) {
          subtype.use_cases.forEach((uc: string) => keywords.push(uc.toLowerCase()))
        }
      })
    }
    if (item.best_for) {
      item.best_for.forEach((bf: string) => keywords.push(bf.toLowerCase()))
    }
  }

  if (type === 'style') {
    // Add variant names and characteristics
    if (item.variants) {
      item.variants.forEach((variant: any) => {
        keywords.push(variant.name.toLowerCase())
      })
    }
    if (item.characteristics) {
      item.characteristics.forEach((char: string) => keywords.push(char.toLowerCase()))
    }
    if (item.ideal_for) {
      item.ideal_for.forEach((ideal: string) => keywords.push(ideal.toLowerCase()))
    }
  }

  if (type === 'theme') {
    // Add includes and common use cases
    if (item.includes) {
      item.includes.forEach((inc: string) => keywords.push(inc.toLowerCase()))
    }
    if (item.common_use_cases) {
      item.common_use_cases.forEach((uc: string) => keywords.push(uc.toLowerCase()))
    }
  }

  return [...new Set(keywords)] // Remove duplicates
}

/**
 * Build keyword maps for all taxonomies
 */
const templateKeywordMap = new Map(templateTypes.map(t => [t.id, extractKeywords(t, 'template')]))

const styleKeywordMap = new Map(visualStyles.map(s => [s.id, extractKeywords(s, 'style')]))

const themeKeywordMap = new Map(contentThemes.map(t => [t.id, extractKeywords(t, 'theme')]))

/**
 * Score an item based on keyword matches in user prompt
 */
function scoreMatch(userPrompt: string, keywords: string[]): number {
  const lowerPrompt = userPrompt.toLowerCase()
  let score = 0

  keywords.forEach(keyword => {
    // Multi-word phrases get higher scores
    const words = keyword.split(/[-_\s]+/)
    const phrase = words.join(' ')

    if (lowerPrompt.includes(phrase)) {
      // Exact phrase match gets bonus
      score += words.length * 2
    } else {
      // Individual word matches
      words.forEach(word => {
        if (word.length > 2 && lowerPrompt.includes(word)) {
          score += 0.5
        }
      })
    }
  })

  return score
}

/**
 * Detect best template type from user prompt
 */
function detectTemplateType(userPrompt: string): string | undefined {
  let bestMatch = { id: undefined as string | undefined, score: 0 }

  templateKeywordMap.forEach((keywords, id) => {
    const score = scoreMatch(userPrompt, keywords)
    if (score > bestMatch.score) {
      bestMatch = { id, score }
    }
  })

  // Require minimum score threshold
  return bestMatch.score > 2 ? bestMatch.id : undefined
}

/**
 * Detect best visual style from user prompt
 */
function detectVisualStyle(userPrompt: string): string | undefined {
  let bestMatch = { id: undefined as string | undefined, score: 0 }

  styleKeywordMap.forEach((keywords, id) => {
    const score = scoreMatch(userPrompt, keywords)
    if (score > bestMatch.score) {
      bestMatch = { id, score }
    }
  })

  // Require minimum score threshold
  return bestMatch.score > 2 ? bestMatch.id : undefined
}

/**
 * Detect best content theme from user prompt
 */
function detectContentTheme(userPrompt: string): string | undefined {
  let bestMatch = { id: undefined as string | undefined, score: 0 }

  themeKeywordMap.forEach((keywords, id) => {
    const score = scoreMatch(userPrompt, keywords)
    if (score > bestMatch.score) {
      bestMatch = { id, score }
    }
  })

  // Require minimum score threshold
  return bestMatch.score > 2 ? bestMatch.id : undefined
}

// ============================================================================
// VARIANT SELECTION LOGIC
// ============================================================================

interface VariantKeywords {
  [variantId: string]: string[]
}

// Template type variant keywords
const templateVariantKeywords: Record<string, VariantKeywords> = {
  'text-layout': {
    centered: ['center', 'centered', 'middle', 'symmetric', 'balanced'],
    arched: ['arch', 'arched', 'curved', 'curve', 'circular', 'round'],
    stacked: ['stack', 'stacked', 'vertical', 'multiple lines', 'multi-line'],
  },
  frame: {
    'corner-elements': ['corner', 'corners', 'minimal', 'simple frame', 'accent'],
    'full-border': ['border', 'full border', 'complete', 'surround', 'perimeter'],
    wreath: ['wreath', 'circular', 'round', 'ring', 'circle'],
  },
  badge: {
    circular: ['circle', 'circular', 'round', 'seal', 'coin'],
    shield: ['shield', 'crest', 'heraldic', 'emblem'],
    ribbon: ['ribbon', 'banner', 'award', 'label'],
  },
  portrait: {
    'head-only': ['head', 'face', 'headshot', 'close-up', 'facial'],
    bust: ['bust', 'upper body', 'shoulders', 'chest'],
    'full-figure': ['full body', 'full-figure', 'whole', 'complete', 'standing'],
  },
  'icon-set': {
    'single-icon': ['single', 'one icon', 'simple icon', 'logo'],
    'icon-group': ['group', 'multiple', 'set', 'collection', 'several'],
    pictogram: ['pictogram', 'symbol', 'universal', 'sign', 'simple'],
  },
  pattern: {
    'seamless-repeat': ['seamless', 'tile', 'repeat', 'repeating', 'wallpaper'],
    'border-pattern': ['border', 'edge', 'trim', 'strip', 'ribbon'],
    scattered: ['scatter', 'scattered', 'random', 'dispersed', 'spread'],
  },
  'data-display': {
    'stats-grid': ['stats', 'statistics', 'grid', 'data', 'numbers'],
    timeline: ['timeline', 'chronological', 'history', 'progression', 'sequence'],
    'labeled-diagram': ['diagram', 'chart', 'labeled', 'annotated', 'infographic'],
  },
  map: {
    'location-pin': ['location', 'place', 'pin', 'marker', 'spot'],
    route: ['route', 'path', 'journey', 'travel', 'direction'],
    'star-chart': ['star', 'constellation', 'celestial', 'night sky', 'astronomy'],
  },
  'full-illustration': {
    scene: ['scene', 'landscape', 'environment', 'setting', 'background'],
    'object-study': ['object', 'product', 'item', 'single', 'focus'],
    'abstract-composition': ['abstract', 'composition', 'non-representational', 'shapes'],
  },
}

// Visual style variant keywords (reserved for future use)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const styleVariantKeywords: Record<string, VariantKeywords> = {
  'line-art': {
    'thin-line': ['thin', 'delicate', 'fine', 'detailed', 'intricate', 'elegant', 'precise'],
    'bold-line': ['bold', 'thick', 'strong', 'heavy', 'visible', 'prominent'],
    crosshatch: ['crosshatch', 'hatching', 'stipple', 'shading', 'etching', 'engraving'],
  },
  silhouette: {
    'pure-silhouette': ['pure', 'simple', 'clean', 'solid', 'filled'],
    stencil: ['stencil', 'cut', 'spray', 'bridges', 'physical'],
    cutout: ['cutout', 'layered', 'layers', 'overlap', 'paper'],
  },
  'flat-graphic': {
    geometric: ['geometric', 'angular', 'shapes', 'precise', 'mathematical'],
    character: ['character', 'cute', 'cartoon', 'friendly', 'mascot'],
    modern: ['modern', 'contemporary', 'clean', 'sophisticated', 'minimal'],
  },
  painterly: {
    watercolor: ['watercolor', 'wash', 'fluid', 'transparent', 'soft', 'bleed'],
    'gradient-blend': ['gradient', 'blend', 'smooth', 'transition', 'fade'],
    'fluid-art': ['fluid', 'pour', 'marble', 'swirl', 'flow', 'organic'],
  },
  ornamental: {
    mandala: ['mandala', 'radial', 'circular', 'symmetrical', 'center'],
    filigree: ['filigree', 'delicate', 'scrollwork', 'decorative', 'ornate'],
    'geometric-pattern': ['geometric pattern', 'tessellation', 'sacred geometry', 'precise'],
  },
  'hand-drawn': {
    sketch: ['sketch', 'rough', 'draft', 'loose', 'construction'],
    doodle: ['doodle', 'playful', 'casual', 'fun', 'whimsical'],
    brush: ['brush', 'brushstroke', 'paint', 'expressive', 'gestural'],
  },
  retro: {
    'vintage-poster': ['vintage', 'poster', '1950s', '1960s', 'mid-century', 'classic'],
    'pop-art': ['pop art', 'halftone', 'dots', 'comic', 'warhol', '1970s'],
    y2k: ['y2k', 'chrome', 'metallic', '2000s', 'futuristic', 'digital'],
  },
  'pixel-art': {
    '8bit': ['8bit', '8-bit', 'retro', 'gameboy', 'nes', 'simple', 'chunky'],
    '16bit': ['16bit', '16-bit', 'snes', 'genesis', 'detailed', 'advanced'],
    isometric: ['isometric', 'iso', 'angled', '3d', 'perspective'],
  },
  'semi-realistic': {
    'illustrated-portrait': ['portrait', 'realistic', 'likeness', 'person', 'face'],
    'cel-shaded': ['cel shaded', 'anime', 'manga', 'flat shading', 'cartoon'],
    editorial: ['editorial', 'professional', 'magazine', 'sophisticated', 'refined'],
  },
}

// Default variants (used when no keywords match)
const defaultVariants: Record<string, Record<string, string>> = {
  template: {
    'text-layout': 'centered',
    frame: 'wreath',
    badge: 'circular',
    portrait: 'head-only',
    'icon-set': 'single-icon',
    pattern: 'seamless-repeat',
    'data-display': 'stats-grid',
    map: 'location-pin',
    'full-illustration': 'scene',
  },
  style: {
    'line-art': 'bold-line',
    silhouette: 'pure-silhouette',
    'flat-graphic': 'modern',
    painterly: 'watercolor',
    ornamental: 'filigree',
    'hand-drawn': 'sketch',
    retro: 'vintage-poster',
    'pixel-art': '8bit',
    'semi-realistic': 'illustrated-portrait',
  },
}

/**
 * Select best variant based on user prompt keywords
 */
function selectVariant(
  categoryId: string,
  userPrompt: string,
  variantKeywords: Record<string, VariantKeywords>,
  defaultVariant: string
): string {
  const lowerPrompt = userPrompt.toLowerCase()
  const keywords = variantKeywords[categoryId]

  if (!keywords) return defaultVariant

  // Score each variant based on keyword matches
  const scores: Record<string, number> = {}

  for (const [variantId, variantKeywordList] of Object.entries(keywords)) {
    scores[variantId] = 0
    for (const keyword of variantKeywordList) {
      if (lowerPrompt.includes(keyword)) {
        // Longer keywords get higher weight (more specific)
        scores[variantId] += keyword.split(' ').length
      }
    }
  }

  // Find variant with highest score
  const bestVariant = Object.entries(scores).reduce(
    (best, [variantId, score]) => {
      return score > best.score ? { variantId, score } : best
    },
    { variantId: defaultVariant, score: 0 }
  )

  return bestVariant.variantId
}

// ============================================================================
// PROMPT BUILDER
// ============================================================================

interface PromptBuilderOptions {
  userPrompt: string
  templateId?: string
  templateName?: string
  styleId?: string
  styleName?: string
  themeId?: string
  themeName?: string
  aspectRatio?: string
  userVariables?: Record<string, string>
}

interface PromptBuildResult {
  finalPrompt: string
  selectedVariants: {
    template?: string
    style?: string
  }
  detectedDimensions: {
    template?: string
    style?: string
    theme?: string
  }
  metadata: {
    templateName?: string
    styleName?: string
    themeName?: string
  }
}

/**
 * Build complete AI prompt with intelligent detection and variant selection
 */
function buildImageGenerationPrompt(options: PromptBuilderOptions): PromptBuildResult {
  const { userPrompt, templateName, styleName, themeName, aspectRatio, userVariables = {} } = options

  let { templateId, styleId, themeId } = options

  const selectedVariants: { template?: string; style?: string } = {}
  const detectedDimensions: { template?: string; style?: string; theme?: string } = {}
  const metadata: { templateName?: string; styleName?: string; themeName?: string } = {}

  // STEP 1: PARSE QUICK PROMPT FORMAT (if present)
  const parsedQuickPrompt = parseQuickPromptDimensions(userPrompt)
  const cleanedUserPrompt = parsedQuickPrompt.cleanedPrompt

  // Use parsed values from quick prompt if available
  if (parsedQuickPrompt.template && !templateId && !templateName) {
    templateId = parsedQuickPrompt.template
    detectedDimensions.template = parsedQuickPrompt.template
  }
  if (parsedQuickPrompt.style && !styleId && !styleName) {
    styleId = parsedQuickPrompt.style
    detectedDimensions.style = parsedQuickPrompt.style
  }
  if (parsedQuickPrompt.theme && !themeId && !themeName) {
    themeId = parsedQuickPrompt.theme
    detectedDimensions.theme = parsedQuickPrompt.theme
  }

  // STEP 2: AUTO-DETECT MISSING DIMENSIONS (fallback)
  if (!templateId && !templateName) {
    const detected = detectTemplateType(userPrompt)
    if (detected) {
      templateId = detected
      detectedDimensions.template = detected
    }
  }

  if (!styleId && !styleName) {
    const detected = detectVisualStyle(userPrompt)
    if (detected) {
      styleId = detected
      detectedDimensions.style = detected
    }
  }

  if (!themeId && !themeName) {
    const detected = detectContentTheme(userPrompt)
    if (detected) {
      themeId = detected
      detectedDimensions.theme = detected
    }
  }

  let finalPrompt = ''

  // SECTION 1: USER REQUEST (Highest Priority - use cleaned prompt)
  finalPrompt += `USER REQUEST:\n${cleanedUserPrompt}\n\n`

  // EXPLICIT OVERRIDE: When user states style/realism/medium/use-case, it trumps all
  finalPrompt += `EXPLICIT USER STYLE/USE-CASE OVERRIDE:\n`
  finalPrompt += `If the user explicitly specifies style, realism, medium, a conversion (e.g., turn this image into cartoon), or the target context (e.g., for screen/web), strictly follow the user's instruction and let it override any reference image guidance and all subsequent system/template/style/theme instructions. Do not rely on fixed keywords; interpret natural-language intent directly.\n\n`

  // SECTION 2: TEMPLATE STRUCTURE (with variant selection)
  if (templateId || templateName) {
    const template = templateTypes.find(t => [t.id, t.name].includes(templateId || (templateName as string)))
    if (template) {
      metadata.templateName = template.name

      // Select best variant based on user prompt
      const selectedVariantId = selectVariant(
        template.id,
        userPrompt,
        templateVariantKeywords,
        defaultVariants.template[template.id]
      )
      selectedVariants.template = selectedVariantId

      const subtype = template.subtypes.find(s => s.id === selectedVariantId)

      finalPrompt += `TEMPLATE STRUCTURE (${template.name} - ${subtype?.name}):\n`
    }
  }

  // SECTION 5: ASPECT RATIO
  if (aspectRatio) {
    finalPrompt += `REQUIRED ASPECT RATIO: ${aspectRatio}\n\n`
  }

  // SECTION 6: TECHNICAL SPECIFICATIONS
  finalPrompt += `TECHNICAL SPECIFICATIONS:\n`
  finalPrompt += `- Target resolution: 3000x3000 pixels (or match specified aspect ratio)\n`
  finalPrompt += `- Composition: Centered with balanced negative space (unless user explicitly requests otherwise)\n`
  finalPrompt += `- Edge quality: Crisp edges without halos or artifacts\n\n`

  // SCREEN/WEB OVERRIDE MODE
  finalPrompt += `SCREEN/WEB OVERRIDE MODE (activated only when user explicitly requests screen/web use or a style conversion such as cartoon/realistic):\n`
  finalPrompt += `- Follow the user's requested style/realism/medium/background exactly; ignore print-only constraints\n`
  finalPrompt += `- Allow natural or reference-derived backgrounds; do NOT force white background\n`
  finalPrompt += `- Preserve photographic gradients, textures, and soft edges when consistent with the user's request\n\n`

  // DEFAULT PRINT MODE (when no explicit screen/web override is present)
  finalPrompt += `DEFAULT PRINT MODE (applies only if user did not explicitly request screen/web or a style conversion):\n`
  finalPrompt += `- Background: SOLID WHITE (#FFFFFF) ONLY — no transparent, checkerboard, gradient, or patterned backgrounds\n`
  finalPrompt += `- CRITICAL: Place all design elements on pure white background for optimal background removal processing\n`
  finalPrompt += `- Print-ready: Optimized for the specified production method\n\n`

  // SECTION 7: NORMALIZATION RULES
  finalPrompt += `OUTPUT NORMALIZATION FOR PRINT/ENGRAVE SAFETY (apply ONLY when SCREEN/WEB OVERRIDE MODE is NOT activated):\n\n`
  finalPrompt += `Background rules for print mode:\n`
  finalPrompt += `- Use solid white (#FFFFFF) background\n`
  finalPrompt += `- Do not generate transparent, checkerboard, or patterned backgrounds\n`
  finalPrompt += `- Do not show transparency indicators or alpha channel effects\n`
  finalPrompt += `- Design elements must contrast clearly against white background\n`
  finalPrompt += `- If user explicitly requests a colored/non-white background, honor it; otherwise keep WHITE\n\n`

  finalPrompt += `Print method handling:\n`
  finalPrompt += `- If print method specified (DTG, ScreenPrint, UV, LaserEngrave): follow it strictly\n`
  finalPrompt += `- If no method specified: use print-safe defaults with crisp edges, limited palette\n\n`

  finalPrompt += `Single-color/engraving requirements (print mode only):\n`
  finalPrompt += `- Avoid gradients, halftones, photo textures, or soft edges unless explicitly requested\n`
  finalPrompt += `- Prefer single-color vector/line or solid silhouette\n`
  finalPrompt += `- Minimum stroke thickness: 2px at 300 DPI\n\n`

  finalPrompt += `Text legibility:\n`
  finalPrompt += `- All text MUST remain fully readable with NO overlaps\n`
  finalPrompt += `- Maintain 8-12% safe margin from edges\n\n`

  finalPrompt += `Style enforcement (only when not overridden by explicit user style):\n`
  finalPrompt += `- Pixel-art: STRICT pixel grid, NO anti-aliasing, blocky edges only\n`
  finalPrompt += `- Line-art: NO fills whatsoever, outlines only\n`
  finalPrompt += `- Silhouette: Solid fill only, NO internal details\n\n`

  finalPrompt += `PRIORITY ORDER: User prompt takes absolute priority (over reference images and system guidance) → Reference image (contextual only; do not override explicit user intent) → Visual style requirements → Template structure → All must comply with safety rules above\n`

  // SECTION 8: VARIABLE INTERPOLATION
  if (Object.keys(userVariables).length > 0) {
    Object.entries(userVariables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      finalPrompt = finalPrompt.replace(regex, value)
    })
  }

  return {
    finalPrompt,
    selectedVariants,
    detectedDimensions,
    metadata,
  }
}

/**
 * Analyzes a user prompt to determine if it's requesting images for engraving
 * @param {string} prompt - The user's input prompt
 * @returns {Object} Analysis result with detection details
 */
function isEngravingRequest(prompt: string) {
  if (!prompt || typeof prompt !== 'string') {
    return {
      isEngraving: false,
      confidence: 'none',
      detectedStyles: [],
      matchedKeywords: [],
    }
  }

  const normalizedPrompt = prompt.toLowerCase()
  const matchedKeywords: string[] = []
  const detectedStyles: Set<string> = new Set()

  // Engraving application keywords (highest confidence)
  const engravingKeywords = [
    'engrav',
    'etch',
    'carv',
    'laser cut',
    'laser engrav',
    'laser etch',
    'cnc',
    'vinyl cut',
    'vinyl decal',
  ]

  // Line Art style keywords
  const lineArtKeywords = [
    'line art',
    'line drawing',
    'line work',
    'linework',
    'outline',
    'contour',
    'pen and ink',
    'ink drawing',
    'stroke',
    'continuous line',
    'no fill',
    'unfilled',
    'outline only',
    'vector line',
    'thin line',
    'fine line',
    'bold line',
    'thick line',
    'crosshatch',
    'cross-hatch',
    'hatching',
    'stipple',
    'stippling',
    'dotwork',
    'clean lines',
    'crisp edge',
    'single color',
    'monochrome',
    'screen print',
    'silkscreen',
  ]

  // Ornamental style keywords
  const ornamentalKeywords = [
    'ornamental',
    'ornate',
    'decorative',
    'intricate',
    'elaborate',
    'detailed pattern',
    'filigree',
    'arabesque',
    'rococo',
    'mandala',
    'geometric pattern',
    'sacred geometry',
    'kaleidoscope',
    'symmetrical',
    'symmetric',
    'symmetry',
    'radial',
    'circular pattern',
    'repetitive',
    'repeating pattern',
    'motif',
    'baroque',
    'victorian',
    'art nouveau',
    'lace-like',
    'delicate pattern',
    'flourish',
    'scrollwork',
    'jewelry design',
    'medallion',
    'border',
    'decorative frame',
  ]

  // Check for engraving application keywords
  engravingKeywords.forEach(keyword => {
    if (normalizedPrompt.includes(keyword)) {
      matchedKeywords.push(keyword)
    }
  })

  // Check for Line Art keywords
  lineArtKeywords.forEach(keyword => {
    if (normalizedPrompt.includes(keyword)) {
      matchedKeywords.push(keyword)
      detectedStyles.add('line-art')
    }
  })

  // Check for Ornamental keywords
  ornamentalKeywords.forEach(keyword => {
    if (normalizedPrompt.includes(keyword)) {
      matchedKeywords.push(keyword)
      detectedStyles.add('ornamental')
    }
  })

  // Determine confidence level
  let confidence = 'none'
  const hasEngravingKeyword = engravingKeywords.some(kw => normalizedPrompt.includes(kw))
  const styleKeywordCount = matchedKeywords.length

  if (hasEngravingKeyword) {
    confidence = 'high'
  } else if (styleKeywordCount >= 3) {
    confidence = 'high'
  } else if (styleKeywordCount >= 2) {
    confidence = 'medium'
  } else if (styleKeywordCount >= 1) {
    confidence = 'low'
  }

  return {
    isEngraving: matchedKeywords.length > 0,
    confidence,
    detectedStyles: Array.from(detectedStyles),
    matchedKeywords: [...new Set(matchedKeywords)],
    recommendedStyle: determineRecommendedStyle(detectedStyles, matchedKeywords),
  }
}

/**
 * Determines which visual style to recommend based on detected keywords
 * @param {Set} detectedStyles - Set of detected style IDs
 * @param {Array} matchedKeywords - Array of matched keywords
 * @returns {string|null} Recommended style ID
 */
function determineRecommendedStyle(detectedStyles: Set<string>, matchedKeywords: string[]) {
  const styles = Array.from(detectedStyles)

  if (styles.length === 0) return null
  if (styles.length === 1) return styles[0]

  // If both styles detected, prioritize based on specific keywords
  const ornamentalPriority = ['mandala', 'filigree', 'ornate', 'intricate', 'symmetrical']

  const hasOrnamentalPriority = ornamentalPriority.some(kw => matchedKeywords.some(mk => mk.includes(kw)))

  return hasOrnamentalPriority ? 'ornamental' : 'line-art'
}

export {
  buildImageGenerationPrompt,
  detectTemplateType,
  detectVisualStyle,
  detectContentTheme,
  parseQuickPromptDimensions,
  isEngravingRequest,
  determineRecommendedStyle,
  type PromptBuilderOptions,
  type PromptBuildResult,
}
