/* eslint-disable max-len */
import type { TemplateContextAnalyze, ExtractedSubjects } from '../context/ContextAnalyzer'
import type { StyleMapping } from '../services/CanvasStyleEngine'

/**
 * Picks the best aspect ratio based on layer dimensions to minimize distortion.
 * Maps to supported API aspect ratios: '1:1' | '4:3' | '3:4' | '16:9' | '9:16'
 * - Ultra wide (ratio > 4) → '16:9' (widest available)
 * - Very wide (ratio > 2.5) → '16:9'
 * - Moderately wide (1.2 < ratio < 2.5) → '4:3'
 * - Near square (0.83 < ratio < 1.2) → '1:1'
 * - Moderately tall (0.4 < ratio < 0.83) → '3:4'
 * - Very tall (ratio < 0.4) → '9:16' (tallest available)
 */
export function pickBestImageSize(
  width: number,
  height: number
): {
  aspectRatio: '1:1' | '4:3' | '3:4' | '16:9' | '9:16'
  size: '256x256' | '512x512' | '1024x1024' | '1024x1792' | '1792x1024'
} {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const ratio = w / h

  // Map layer aspect ratios to supported API aspect ratios and sizes
  if (ratio > 4) {
    // Ultra wide elements (like bunting flags) - use widest available format
    return { aspectRatio: '16:9', size: '1792x1024' }
  }
  if (ratio > 2.5) {
    // Very wide elements
    return { aspectRatio: '16:9', size: '1792x1024' }
  }
  if (ratio > 1.2) {
    // Moderately wide (1.33:1)
    return { aspectRatio: '4:3', size: '1024x1024' }
  }
  if (ratio < 0.25) {
    // Ultra tall elements - use tallest available format
    return { aspectRatio: '9:16', size: '1024x1792' }
  }
  if (ratio < 0.4) {
    // Very tall elements
    return { aspectRatio: '9:16', size: '1024x1792' }
  }
  if (ratio < 0.83) {
    // Moderately tall (0.75:1)
    return { aspectRatio: '3:4', size: '1024x1024' }
  }
  // Near square
  return { aspectRatio: '1:1', size: '1024x1024' }
}

type Layer = {
  id?: string
  _id?: string
  label: string
  settings?: {
    storefrontLabel?: string
    imagePrompt?: string
  } & Record<string, unknown>
  semanticContext?: {
    role?: string
  }
  position?: {
    x: number
    y: number
    width: number
    height: number
  }
}

/**
 * Builds a focused image prompt for a single subject/layer
 */
export function buildImagePrompt(args: {
  basePrompt: string
  layer: Layer
  templateContext: TemplateContextAnalyze
  styleMapping: StyleMapping
}): string {
  const { layer, templateContext, styleMapping } = args

  // Extract subject-specific context
  const subjectContext = {
    label: layer.settings?.storefrontLabel || layer.label,
    role: layer.semanticContext?.role || 'subject',
    visualStyle: `${styleMapping.styleCharacteristics.visualDensity}, ${styleMapping.styleCharacteristics.colorHarmony} style`,
    mood: templateContext.style.mood.join(', '),
  }

  // Dynamically collect identifiers for other subjects (no hardcoded values)
  const otherTokens = (styleMapping.elements || [])
    .filter(e => (e?.styleSettings?.storefrontLabel || e?.id || '').toString().trim())
    .map(e => String(e?.styleSettings?.storefrontLabel || e?.id || '').toLowerCase())
    .filter(t => t && t !== String(subjectContext.label).toLowerCase())
    // de-duplicate
    .filter((t, i, arr) => arr.indexOf(t) === i)

  // Try to enrich with extractedSubjects (if available) without relying on fixed categories
  const extracted: ExtractedSubjects | undefined = (templateContext as any)?.style?.extractedSubjects
  const candidates = [subjectContext.label.toLowerCase()]
  let enriched: ExtractedSubjects['mainSubjects'][number] | ExtractedSubjects['supportingElements'][number] | undefined
  if (extracted) {
    const allSubjects = [...(extracted.mainSubjects || []), ...(extracted.supportingElements || [])]
    enriched = allSubjects.find(s => {
      const lbl = String(s?.label || '').toLowerCase()
      return !!lbl && candidates.includes(lbl)
    })
  }

  const shortDesc = enriched?.description ? ` ${enriched.description}.` : ''

  // Build compact final prompt
  // Enrichment helpers (keep generic, no hardcoded assumptions)
  const medium = deriveMedium(styleMapping, layer)
  const framing = deriveFraming(layer)
  const lighting = deriveLighting(templateContext)
  const background = deriveBackground()
  const detailLevel = deriveDetailLevel(styleMapping)

  // Prefer a neutral, count-agnostic descriptor to avoid the model
  // interpreting numerals in labels (e.g., "member 3") as quantity.
  const descriptor = enriched?.type ? `a single ${String(enriched.type).toLowerCase()}` : 'a single subject'

  const subjectPrompt = [
    // Medium + subject (intentionally avoid raw label tokens that may contain numerals)
    `${medium} of ${descriptor}`.trim(),
    // Expression/role/mood
    subjectContext.role ? `role: ${subjectContext.role.toLowerCase()}.` : '',
    shortDesc,
    framing ? `${framing}.` : '',
    lighting ? `${lighting}.` : '',
    `${background}.`,
    `${detailLevel}.`,
    `${subjectContext.visualStyle}.`,
    `Mood: ${subjectContext.mood}.`,
  ]
    .filter(Boolean)
    .join(' ')

  // Calculate aspect ratio for prompt enhancement
  const pos = layer.position
  const aspectRatio = pos ? pos.width / Math.max(1, pos.height) : 1

  // Keep only parts of basePrompt that do NOT mention other subjects (no hardcoded relational lists)
  const base = String(args.basePrompt || '')
  const baseClean = base
    .split(/[\n\.]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .filter(s => {
      const lower = s.toLowerCase()
      return !otherTokens.some(tok => lower.includes(tok))
    })
    .join('. ')

  // No text pattern matching - rely on structured data and aspect ratio guidance
  // Strong single-subject constraint tail with aspect-aware scaling

  let scalingInstruction = 'Scale object to fill image optimally'
  if (aspectRatio > 4) {
    scalingInstruction
      = 'Create single continuous horizontal line spanning full image width, no multiple rows or stacked elements'
  } else if (aspectRatio < 0.25) {
    scalingInstruction = 'Scale object to fill image height completely, allowing natural width proportions'
  }

  const singleSubjectConstraint = [
    'Single subject only. Ignore any relational instructions or other subject names.',
    'Isolated subject, solid white background.',
    `${scalingInstruction}.`,
    'Perfectly centered with minimal margins.',
    'Object must be sole dominant subject filling the image optimally.',
    'Solid white background, no text, no letters, no numbers, no words, no typography, no characters, no logos, no brands, no trademarks, no products, no mockups, clean edges for printing.',
  ].join(' ')

  // Order matters: place the strong single-subject instruction first,
  // then the subject description, and only then any residual base context.
  return [singleSubjectConstraint, subjectPrompt, baseClean].filter(Boolean).join('\n').trim()
}

/**
 * Pick an appropriate artistic medium/style phrase using available mapping.
 * Keeps consistency with vector-first pipeline by default.
 */
function deriveMedium(styleMapping: StyleMapping, layer: Layer): string {
  const styleEl = styleMapping.elements.find(e => e.id === (layer.id || layer._id))
  const imageStyle = String(styleEl?.styleSettings?.imageStyle || '').trim()
  if (imageStyle) return `a detailed ${imageStyle}`
  return 'a detailed artwork'
}

/**
 * Suggest framing based on element size, with special handling for extreme aspect ratios.
 */
function deriveFraming(layer: Layer): string {
  const pos = layer.position
  if (!pos || !pos.width || !pos.height) {
    return 'object scaled to fill image optimally, perfectly centered'
  }
  const ratio = pos.width / Math.max(1, pos.height)

  if (ratio > 4) {
    // Ultra wide elements like bunting flags - fill image width, allow padding
    return 'ultra wide orientation, single continuous horizontal line spanning the full image width, object scaled to fill image width completely with left and right edges touching image borders, centered vertically'
  }
  if (ratio > 2.5) {
    // Very wide elements - fill image width
    return 'wide landscape orientation, object scaled to fill image width with left and right edges touching image borders, centered vertically'
  }
  if (ratio > 1.2) {
    // Moderately wide
    return 'landscape orientation, object scaled to fill image optimally, centered'
  }
  if (ratio < 0.25) {
    // Ultra tall elements - fill image height
    return 'ultra tall orientation, object scaled to fill image height completely with top and bottom edges touching image borders, centered horizontally with natural proportions'
  }
  if (ratio < 0.4) {
    // Very tall elements
    return 'tall portrait orientation, object scaled to fill image height with top and bottom edges touching image borders, centered horizontally'
  }
  if (ratio < 0.83) {
    // Moderately tall
    return 'portrait orientation, object scaled to fill image optimally, centered'
  }
  // Square-ish
  return 'square orientation, object scaled to fill image optimally, perfectly centered'
}

/**
 * Map mood keywords into a short lighting guideline; fallback to soft lighting.
 */
function deriveLighting(templateContext: TemplateContextAnalyze): string {
  const mood = (templateContext?.style?.mood || []).filter(Boolean)
  if (mood.length > 0) {
    return `lighting that complements the mood (${mood.join(', ')}), while keeping the subject clear and well-defined`
  }
  return 'clear, flattering lighting that highlights the subject'
}

/**
 * Background guidance stays neutral/clean to respect single-subject constraint.
 */
function deriveBackground(): string {
  return 'a solid white background with no distracting elements to keep the focus on the subject'
}

/**
 * Express detail density in a concise, style-aware way.
 */
function deriveDetailLevel(styleMapping: StyleMapping): string {
  const density = styleMapping?.styleCharacteristics?.visualDensity
  if (density) return `detail level aligned with ${density} visual density`
  return 'a balanced level of detail'
}

/**
 * Safe accessor for potential future scene data on templateContext.style
 */
// scene-based branching was removed to avoid hard assumptions
