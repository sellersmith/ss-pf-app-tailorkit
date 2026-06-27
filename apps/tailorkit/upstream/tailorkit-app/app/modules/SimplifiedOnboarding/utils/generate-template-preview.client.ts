/* eslint-disable max-len */
/**
 * Client-side template preview generator.
 *
 * Creates a hidden Konva canvas matching the user-drawn selection dimensions,
 * renders text/image elements centered with effects, and exports to data URI.
 *
 * - Text templates: Konva.Text with auto-fit and shadow effects (emboss/deboss from TemplateEditor presets).
 * - Vector templates (initial/monogram): AI Vector Generation API → SVG with real SVG filter primitives
 *   from VectorEditor pathFilterPresets (embossing, debossing, laser-annealing, laser-engraving, hot-foil-stamping).
 * - Image templates (illustration/portrait/pattern): AI Image Generation API → Konva.Image.
 */

import Konva from 'konva'
import type { TemplateType } from '../types'
import type { EffectConfig } from '~/modules/TemplateEditor/elements/effects/types'
import { createDebossPreset, createEmbossPreset } from '~/modules/TemplateEditor/elements/effects/presets'
import { updateEmbossDirection, updateEmbossDepth } from '~/modules/TemplateEditor/elements/effects/preset-utils'
import { resolveEffectsToAbsolute } from '~/modules/TemplateEditor/elements/effects/relative-shadow-utils'
// VectorEditor filter imports are loaded lazily inside applyPathFilter() to avoid
// loading 37K+ tokens of pathFilterPresets.ts for instant text templates.
import { authenticatedFetch } from '~/shopify/fns.client'
import { AI_ASSISTANT_SUGGESTION_ACTION } from '~/routes/api.ai-assistant.suggestion/constants'

// ============================================================================
// Types
// ============================================================================

interface TemplatePreviewOptions {
  templateType: TemplateType
  /** Canvas width (from user-drawn selection) */
  width: number
  /** Canvas height (from user-drawn selection) */
  height: number
  /** Product image URL — used to sample surface color for debossed templates */
  productImageUrl?: string
  /** Personalization-area rect in normalized coords (0..1) relative to the product image.
   *  When provided, surface-color sampling targets this region instead of image center.
   *  Used only by templates whose manufacturing method inherits the material's surface
   *  color (currently only `debossed-monogram`). */
  printAreaRect?: { x: number; y: number; width: number; height: number }
}

// ============================================================================
// Font loading
// ============================================================================

const fontCache = new Map<string, boolean>()

async function loadFont(family: string, src: string): Promise<void> {
  if (fontCache.has(family)) return
  // Mark as attempted immediately to prevent concurrent retries
  fontCache.set(family, false)
  try {
    const font = new FontFace(family, `url(${src})`)
    // Race font loading against a 5s timeout — FontFace.load() can hang
    // in Shopify iframe if CSP blocks the font URL or network is slow
    const loaded = await Promise.race([
      font.load(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Font load timeout for ${family}`)), 5000)),
    ])
    document.fonts.add(loaded)
    fontCache.set(family, true)
  } catch (err) {
    console.warn(`[generateTemplatePreview] Font ${family} unavailable, using fallback:`, err)
  }
}

// ============================================================================
// Template config types
// ============================================================================

interface TextTemplateConfig {
  kind: 'text'
  text: string
  fontFamily: string
  fontSrc: string
  textColor: string
  textColorAlpha: number
  effects: EffectConfig[]
}

interface VectorTemplateConfig {
  kind: 'vector'
  prompt: string
  /** VectorEditor path filter preset ID to apply as CSS filter (e.g. 'debossing', 'embossing') */
  filterPresetId: string | null
}

interface ImageTemplateConfig {
  kind: 'image'
  prompt: string
}

type TemplateConfig = TextTemplateConfig | VectorTemplateConfig | ImageTemplateConfig

// ============================================================================
// Shared constants
// ============================================================================

const SPECIAL_ELITE_FONT = {
  family: 'Special Elite',
  src: 'https://fonts.gstatic.com/s/specialelite/v20/XLYgIZbkc4JPUL5CVArUVL0nhnc.ttf',
}

const CINZEL_FONT = {
  family: 'Cinzel',
  src: 'https://fonts.gstatic.com/s/cinzel/v26/8vIU7ww63mVu7gtR-kwKxNvkNOjw-tbnTYo.ttf',
}

const INITIAL_PROMPT = 'Elegant serif letter A initial monogram, black on white background, clean minimalist design'
const MONOGRAM_PROMPT = 'Elegant serif monogram ABC letters intertwined, black on white background, classic design'

// Portrait prompt variants — randomly selected for variety across 4 art styles
const PET_PORTRAIT_PROMPTS = [
  // Line-art
  'Golden retriever dog portrait, elegant line-art drawing, fine ink lines, crosshatching for shading, no color fill, black ink on solid white background, no transparency',
  // Vector-like
  'Golden retriever dog portrait, clean vector art style, bold outlines, flat color fills, minimal shading, warm tones, solid white background, no transparency',
  // Painterly
  'Golden retriever dog portrait, loose painterly oil painting style, visible brushstrokes, rich impasto texture, warm golden lighting, expressive eyes, solid white background, no transparency',
  // Semi-realistic
  'Golden retriever dog portrait, semi-realistic digital art, soft fur detail with gentle highlights, warm natural lighting, expressive eyes, muted earth-tone palette, solid white background, no transparency',
]

const PERSON_PORTRAIT_PROMPTS = [
  // Line-art
  'Woman portrait, elegant line-art drawing, fine ink lines, crosshatching for shading, no color fill, black ink on solid white background, no transparency',
  // Vector-like
  'Woman portrait, clean vector art style, bold outlines, flat color fills, minimal shading, stylized features, warm skin tones, solid white background, no transparency',
  // Painterly
  'Woman portrait, loose painterly oil painting style, visible brushstrokes, rich impasto texture, warm studio lighting, natural expression, solid white background, no transparency',
  // Semi-realistic
  'Woman portrait, semi-realistic digital art, soft skin detail with subtle highlights, warm studio lighting, natural expression, muted warm palette, solid white background, no transparency',
]

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ============================================================================
// Effect helpers
// ============================================================================

function getDebossEffects(): EffectConfig[] {
  const preset = createDebossPreset()
  let effects = updateEmbossDirection(preset.effects, 280, 'deboss')
  effects = updateEmbossDepth(effects, 45, 'deboss')
  return effects
}

function getEmbossEffects(): EffectConfig[] {
  const preset = createEmbossPreset()
  let effects = updateEmbossDirection(preset.effects, 135, 'emboss')
  effects = updateEmbossDepth(effects, 50, 'emboss')
  return effects
}

// ============================================================================
// Template configs (20 types)
// ============================================================================

function getTemplateConfig(templateType: TemplateType): TemplateConfig {
  switch (templateType) {
    // --- Text templates (instant, rendered via Konva.Text) ---
    case 'plain-custom-text':
      return {
        kind: 'text',
        text: 'Your Text',
        fontFamily: SPECIAL_ELITE_FONT.family,
        fontSrc: SPECIAL_ELITE_FONT.src,
        textColor: '#000000',
        textColorAlpha: 1,
        effects: [],
      }

    case 'embossed-custom-text': {
      const preset = createEmbossPreset()
      return {
        kind: 'text',
        text: 'Your Text',
        fontFamily: SPECIAL_ELITE_FONT.family,
        fontSrc: SPECIAL_ELITE_FONT.src,
        textColor: '#000000',
        textColorAlpha: preset.textColorAlpha ?? 0.15,
        effects: getEmbossEffects(),
      }
    }

    case 'debossed-custom-text': {
      const preset = createDebossPreset()
      return {
        kind: 'text',
        text: 'Your Text',
        fontFamily: SPECIAL_ELITE_FONT.family,
        fontSrc: SPECIAL_ELITE_FONT.src,
        textColor: 'rgba(152, 75, 9, 1)',
        textColorAlpha: preset.textColorAlpha ?? 0.3,
        effects: getDebossEffects(),
      }
    }

    // --- Initial templates (SVG vector + optional VectorEditor filter) ---
    case 'plain-initial':
      return { kind: 'vector', prompt: INITIAL_PROMPT, filterPresetId: null }
    case 'laser-engraving-initial':
      return { kind: 'vector', prompt: INITIAL_PROMPT, filterPresetId: 'laser-engraving' }

    // --- Monogram templates (SVG vector + optional VectorEditor filter) ---
    case 'plain-monogram':
      return { kind: 'vector', prompt: MONOGRAM_PROMPT, filterPresetId: null }
    case 'debossed-monogram':
      return { kind: 'vector', prompt: MONOGRAM_PROMPT, filterPresetId: 'debossing' }
    case 'hot-foil-stamping-monogram':
      return { kind: 'vector', prompt: MONOGRAM_PROMPT, filterPresetId: 'hot-foil-stamping' }

    // --- Image/illustration templates (AI image generation) ---
    // All prompts: flat design only (no gradient, no shadow, no highlight), solid white background
    case 'custom-illustration':
      return {
        kind: 'image',
        prompt:
          'Simple storytelling illustration, flat design, solid colors only, no gradients, no shadows, no highlights, clean lines, whimsical hand-drawn style, warm colors, solid white background, no transparency',
      }
    case 'custom-pet-portrait':
      return { kind: 'image', prompt: randomChoice(PET_PORTRAIT_PROMPTS) }
    case 'custom-person-portrait':
      return { kind: 'image', prompt: randomChoice(PERSON_PORTRAIT_PROMPTS) }
    case 'custom-accent-motif-pattern':
      return {
        kind: 'image',
        prompt:
          'Elegant accent motif decorative pattern, flat design, solid colors only, no gradients, no shadows, no highlights, symmetrical ornamental design, gold and black, solid white background, no transparency, seamless tile',
      }
  }
}

// ============================================================================
// Text rendering with auto-fit
// ============================================================================

function renderTextTemplate(
  _stage: Konva.Stage,
  layer: Konva.Layer,
  config: TextTemplateConfig,
  width: number,
  height: number
): void {
  // Use the same font size formula as the publish API (buildTextLayerSettings)
  // so the preview matches the actual editor/storefront rendering.
  // The editor uses autoFitToContainer with this as maxFontSize and no padding.
  const maxFontSize = Math.round(Math.min(width, height) * 0.8 * 0.3)

  // Binary search for optimal font size that fits within bounds (no padding —
  // matches editor/storefront auto-fit which uses the full container area).
  let low = 8
  let high = Math.min(maxFontSize, Math.min(width, height))
  let bestSize = low

  const measureNode = new Konva.Text({
    text: config.text,
    fontFamily: config.fontFamily,
    fontSize: high,
    wrap: 'none',
  })

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    measureNode.fontSize(mid)
    const textWidth = measureNode.getTextWidth()
    const textHeight = measureNode.height()

    if (textWidth <= width && textHeight <= height) {
      bestSize = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  measureNode.destroy()

  // Apply textColorAlpha
  let fillColor = config.textColor
  if (config.textColorAlpha < 1) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = config.textColor
      const hex = ctx.fillStyle
      if (hex.startsWith('#')) {
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        fillColor = `rgba(${r}, ${g}, ${b}, ${config.textColorAlpha})`
      }
    }
  }

  // Resolve relative effects to absolute pixel values
  const resolvedEffects = config.effects.length > 0 ? resolveEffectsToAbsolute(config.effects, bestSize) : []

  // Measure actual text height at final size, then manually center vertically.
  // Konva's verticalAlign:'middle' can misalign with custom web fonts loaded via FontFace API
  // because canvas text metrics may not reflect the newly loaded font.
  const sizeProbe = new Konva.Text({
    text: config.text,
    fontFamily: config.fontFamily,
    fontSize: bestSize,
    wrap: 'none',
  })
  const measuredHeight = sizeProbe.height()
  const measuredWidth = sizeProbe.getTextWidth()
  sizeProbe.destroy()

  const textNode = new Konva.Text({
    text: config.text,
    fontFamily: config.fontFamily,
    fontSize: bestSize,
    fill: fillColor,
    x: (width - measuredWidth) / 2,
    y: (height - measuredHeight) / 2,
    wrap: 'none',
  })

  // Apply shadow effects
  if (resolvedEffects.length > 0) {
    const shadows = resolvedEffects.filter(
      (e): e is EffectConfig & { offsetX: number; offsetY: number; radius: number; color: string } =>
        (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') && 'offsetX' in e
    )

    // Apply strongest shadow as the native Konva shadow
    if (shadows.length > 0) {
      const strongest = shadows.reduce((a, b) =>
        Math.abs(b.offsetX) + Math.abs(b.offsetY) > Math.abs(a.offsetX) + Math.abs(a.offsetY) ? b : a
      )
      textNode.shadowColor(strongest.color)
      textNode.shadowOffsetX(strongest.offsetX)
      textNode.shadowOffsetY(strongest.offsetY)
      textNode.shadowBlur(strongest.radius)
      textNode.shadowEnabled(true)
    }

    // Add additional drop shadows as cloned nodes behind the text
    const dropShadows = shadows.filter(s => s.type === 'DROP_SHADOW')
    for (const shadow of dropShadows.slice(0, 2)) {
      // limit to 2 extra shadows
      const shadowNode = textNode.clone({
        shadowColor: shadow.color,
        shadowOffsetX: shadow.offsetX,
        shadowOffsetY: shadow.offsetY,
        shadowBlur: shadow.radius,
        shadowEnabled: true,
        fill: 'transparent',
      })
      layer.add(shadowNode)
    }
  }

  layer.add(textNode)
}

// ============================================================================
// SVG filter application for VectorEditor path filter presets
// ============================================================================

/**
 * Apply a VectorEditor path filter preset using real SVG filter primitives.
 *
 * Pipeline:
 * 1. Build FilterPrimitive[] via buildPathFilterPrimitives(preset, params)
 * 2. Serialize primitives into a `<filter>` element via serializeSvgFilter()
 * 3. Create a wrapper SVG with `<defs>` containing the filter, and an `<image>`
 *    element referencing the source image with `filter="url(#id)"` applied
 * 4. Convert wrapper SVG to blob URL → load as image → draw onto canvas
 * 5. Return the filtered result as an HTMLImageElement
 *
 * This produces the same visual effect as VectorEditor's SVGPreviewLayer,
 * using the actual SVG filter primitives (feOffset, feGaussianBlur, feFlood,
 * feComposite, feMerge, feTurbulence, etc.) instead of a CSS approximation.
 */
/** Result of applying a path filter — includes both the rendered image and the SVG source */
interface PathFilterResult {
  image: HTMLImageElement
  /** SVG data URI with the filter embedded — use for sourceImageUrl so the filter is preserved */
  svgDataUri: string
  /** Raw SVG string (not URI-encoded) — store as overlaySvg on the layer for storefront filter extraction */
  overlaySvg: string
}

async function applyPathFilter(
  sourceImg: HTMLImageElement,
  filterPresetId: string,
  drawW: number,
  drawH: number
): Promise<PathFilterResult> {
  // Lazy-load VectorEditor filter utilities (heavy module, ~37K tokens)
  const [{ getPathFilterPresetById, getPathFilterDefaultParams, buildPathFilterPrimitives }, { serializeSvgFilter }]
    = await Promise.all([
      import('~/modules/VectorEditor/utils/filters/pathFilterPresets'),
      import('./serialize-svg-filter-primitives'),
    ])

  const preset = getPathFilterPresetById(filterPresetId)
  if (!preset) return { image: sourceImg, svgDataUri: sourceImg.src }

  const defaultParams = getPathFilterDefaultParams(preset)
  const primitives = buildPathFilterPrimitives(preset, defaultParams)
  if (primitives.length === 0) return { image: sourceImg, svgDataUri: sourceImg.src }

  // Serialize the filter primitives into SVG markup (with data-preset-id for storefront extraction)
  const filterId = `preset-filter-${filterPresetId}`
  const filterMarkup = serializeSvgFilter(filterId, primitives, filterPresetId)

  // Rasterize the source image to a data URI for embedding in the wrapper SVG
  // (SVG <image> with external URLs may be blocked by CORS/security policies)
  const rasterCanvas = document.createElement('canvas')
  rasterCanvas.width = drawW
  rasterCanvas.height = drawH
  const rasterCtx = rasterCanvas.getContext('2d')
  if (!rasterCtx) return sourceImg
  rasterCtx.drawImage(sourceImg, 0, 0, drawW, drawH)
  const rasterDataUri = rasterCanvas.toDataURL('image/png')

  // Build a wrapper SVG that applies the filter to the embedded image
  const svgString = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${drawW}" height="${drawH}">`,
    `<defs>${filterMarkup}</defs>`,
    `<image href="${rasterDataUri}" width="${drawW}" height="${drawH}" filter="url(#${filterId})"/>`,
    `</svg>`,
  ].join('')

  // Convert wrapper SVG to data URI (persists as sourceImageUrl with filter embedded)
  const svgDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`
  const image = await loadImage(svgDataUri)
  return { image, svgDataUri, overlaySvg: svgString }
}

// ============================================================================
// Surface color sampling
// ============================================================================

/**
 * Sample the product image to pick the dominant surface color, used as fill/stroke
 * on vector templates whose manufacturing method inherits the material's color
 * (currently only debossing — a pressure imprint that adds no pigment).
 *
 * - When `printAreaRect` is provided (normalized 0..1 coords), samples the center
 *   60% of that rect (20% inset per side to skip edge artifacts).
 * - Otherwise falls back to sampling the center 20% of the image.
 *
 * Returns average RGB as a hex string. Falls back to warm leather brown on any
 * failure (load error, tainted canvas, all-transparent region).
 */
async function sampleSurfaceColor(
  productImageUrl: string,
  printAreaRect?: { x: number; y: number; width: number; height: number }
): Promise<string> {
  const fallback = '#8B7355' // Warm leather brown
  try {
    const img = await loadImage(productImageUrl)
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return fallback

    ctx.drawImage(img, 0, 0)

    // Sample region: center 60% of the print-area rect when provided (20% inset on each side
    // skips edge artifacts from shape-drawing imprecision). Fallback: center 20% of the image.
    let sx: number, sy: number, sw: number, sh: number
    if (printAreaRect && printAreaRect.width > 0 && printAreaRect.height > 0) {
      const rx = printAreaRect.x * img.width
      const ry = printAreaRect.y * img.height
      const rw = printAreaRect.width * img.width
      const rh = printAreaRect.height * img.height
      const insetW = rw * 0.2
      const insetH = rh * 0.2
      sx = Math.max(0, Math.round(rx + insetW))
      sy = Math.max(0, Math.round(ry + insetH))
      sw = Math.max(1, Math.min(Math.round(rw - 2 * insetW), img.width - sx))
      sh = Math.max(1, Math.min(Math.round(rh - 2 * insetH), img.height - sy))
    } else {
      const sampleSize = Math.round(Math.min(img.width, img.height) * 0.2)
      sx = Math.round((img.width - sampleSize) / 2)
      sy = Math.round((img.height - sampleSize) / 2)
      sw = sampleSize
      sh = sampleSize
    }
    const imageData = ctx.getImageData(sx, sy, sw, sh)
    const data = imageData.data

    // Average RGB over all sampled pixels (skip transparent pixels)
    let r = 0,
      g = 0,
      b = 0,
      count = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue // skip transparent
      r += data[i]
      g += data[i + 1]
      b += data[i + 2]
      count++
    }

    if (count === 0) return fallback
    r = Math.round(r / count)
    g = Math.round(g / count)
    b = Math.round(b / count)

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  } catch {
    return fallback
  }
}

/**
 * Parse an SVG (from data URI or URL) and set fill/stroke color on all shape elements.
 * Returns a new data URI of the recolored SVG, ready to be loaded as an image.
 */
async function recolorSvgPaths(svgSrc: string, color: string): Promise<string> {
  // Fetch SVG content from data URI or URL
  let svgText: string
  if (svgSrc.startsWith('data:')) {
    // Decode data URI (handles both base64 and raw)
    const commaIdx = svgSrc.indexOf(',')
    const meta = svgSrc.slice(0, commaIdx)
    const encoded = svgSrc.slice(commaIdx + 1)
    svgText = meta.includes('base64') ? atob(encoded) : decodeURIComponent(encoded)
  } else {
    const res = await fetch(svgSrc)
    svgText = await res.text()
  }

  // Parse and recolor shape elements
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgText, 'image/svg+xml')
  const shapes = Array.from(doc.querySelectorAll('path, rect, circle, ellipse, polygon, polyline, line, text'))
  for (const el of shapes) {
    const currentFill = el.getAttribute('fill')
    // Set fill to surface color (skip elements with 'none' fill, e.g. stroke-only shapes)
    if (currentFill !== 'none') {
      el.setAttribute('fill', color)
    }
    // Set stroke to a slightly darker shade if the element has an existing stroke
    const currentStroke = el.getAttribute('stroke')
    if (currentStroke && currentStroke !== 'none') {
      el.setAttribute('stroke', color)
    }
  }

  // Re-serialize to data URI
  const serializer = new XMLSerializer()
  const recoloredSvg = serializer.serializeToString(doc.documentElement)
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(recoloredSvg)}`
}

// ============================================================================
// AI generation helpers
// ============================================================================

async function generateVector(prompt: string, aspectRatio: string = '1:1'): Promise<string | null> {
  try {
    const response = await authenticatedFetch('/api/ai-assistant/suggestion', {
      method: 'POST',
      body: JSON.stringify({
        action: AI_ASSISTANT_SUGGESTION_ACTION.GENERATE_VECTOR,
        prompt,
        aspectRatio,
      }),
    })
    if (response?.success) {
      return response.svgDataUri || response.svgUrl || null
    }
    console.error('[generateTemplatePreview] Vector generation failed:', response?.error)
    return null
  } catch (err) {
    console.error('[generateTemplatePreview] Vector generation error:', err)
    return null
  }
}

// ============================================================================
// Aspect ratio helpers for Gemini image generation
// ============================================================================

/** Gemini-supported aspect ratios for image generation.
 * Full list: 1:1, 1:4, 1:8, 2:3, 3:2, 3:4, 4:1, 4:3, 4:5, 5:4, 8:1, 9:16, 16:9, 21:9
 * Ratios outside this list get silently replaced with '1:1' by the server sanitizer. */
const ALLOWED_ASPECT_RATIOS: [number, number][] = [
  [1, 1],
  [1, 4],
  [2, 3],
  [3, 2],
  [3, 4],
  [4, 3],
  [4, 5],
  [5, 4],
  [9, 16],
  [16, 9],
]

/**
 * Find the closest Gemini-supported aspect ratio that fits inside the given bounding box.
 * "Fits inside" means the generated image (at that ratio) can be contained
 * within boxWidth × boxHeight without exceeding either dimension.
 */
function findBestAspectRatio(boxWidth: number, boxHeight: number): string {
  const boxRatio = boxWidth / boxHeight
  let bestRatio: [number, number] = [1, 1]
  let bestDiff = Infinity

  for (const [w, h] of ALLOWED_ASPECT_RATIOS) {
    const candidateRatio = w / h
    // Candidate fits inside box if its ratio doesn't exceed the box ratio
    // in a way that would overflow. We just pick the closest match.
    const diff = Math.abs(candidateRatio - boxRatio)
    if (diff < bestDiff) {
      bestDiff = diff
      bestRatio = [w, h]
    }
  }

  return `${bestRatio[0]}:${bestRatio[1]}`
}

async function generateImage(prompt: string, aspectRatio: string = '1:1'): Promise<string | null> {
  try {
    const response = await authenticatedFetch('/api/ai-assistant/suggestion', {
      method: 'POST',
      body: JSON.stringify({
        action: AI_ASSISTANT_SUGGESTION_ACTION.GENERATE_IMAGES,
        prompt,
        aspectRatio,
        numberGeneratedImages: 1,
      }),
    })
    if (response?.success) {
      const images = response.uploadedImages?.uploadedFiles || []
      if (images.length > 0) {
        return images[0].image?.originalSrc || images[0].image?.src || null
      }
    }
    console.error('[generateTemplatePreview] Image generation failed:', response?.error)
    return null
  } catch (err) {
    console.error('[generateTemplatePreview] Image generation error:', err)
    return null
  }
}

// ============================================================================
// Background color sampling for generated images
// ============================================================================

/** Load an image URL into an HTMLImageElement */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 80)}`))
    img.src = src
  })
}

// ============================================================================
// Main generator
// ============================================================================

export interface TemplatePreviewResult {
  /** Konva-rendered composite thumbnail as data URI */
  thumbnailDataUrl: string
  /** Original AI-generated image URL (CDN URL for vector/image templates, null for text) */
  sourceImageUrl: string | null
  /** SVG overlay string with embedded filter primitives (for storefront to extract filterPresetId).
   *  Only set for vector templates with a filter preset (debossed, hot-foil-stamping, etc.). */
  overlaySvg: string | null
}

/**
 * Generate a template preview data URI using a hidden Konva canvas.
 * Text templates render instantly. AI templates (vector/image) call the API.
 * Returns both the thumbnail and the raw AI-generated source image URL.
 */
export async function generateTemplatePreview(options: TemplatePreviewOptions): Promise<TemplatePreviewResult> {
  const { templateType, width, height, productImageUrl, printAreaRect } = options
  const config = getTemplateConfig(templateType)
  // Track the raw AI-generated image URL (before compositing into Konva)
  let sourceImageUrl: string | null = null
  // SVG overlay with filter primitives (for storefront to re-apply filter to new images)
  let overlaySvg: string | null = null

  // Create a hidden container for Konva
  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.top = '-9999px'
  document.body.appendChild(container)

  try {
    const stage = new Konva.Stage({ container, width, height })
    const layer = new Konva.Layer()
    stage.add(layer)

    if (config.kind === 'text') {
      // Load font, then wait for document.fonts.ready so the canvas context
      // picks up the new FontFace — without this, Konva measures with fallback
      // font metrics (smaller) but renders with the custom font (wider), causing overflow.
      await loadFont(config.fontFamily, config.fontSrc)
      await document.fonts.ready
      renderTextTemplate(stage, layer, config, width, height)
    } else if (config.kind === 'vector') {
      // Generate SVG via AI Vector Generation API with matching aspect ratio
      const vectorAR = findBestAspectRatio(width, height)
      const svgUrl = await generateVector(config.prompt, vectorAR)
      if (svgUrl) {
        sourceImageUrl = svgUrl
        let img = await loadImage(svgUrl)
        // Scale to FIT within canvas (contain mode — no cropping, centered)
        const scale = Math.min(width / img.width, height / img.height)
        const drawW = Math.round(img.width * scale)
        const drawH = Math.round(img.height * scale)

        // Apply VectorEditor filter preset. Override sourceImageUrl with the SVG that
        // has the filter embedded so the uploaded artwork preserves the filter effect
        // in the editor and storefront.
        //
        // Recolor paths to the product surface color ONLY for debossing: debossing is a
        // pressure imprint that adds no pigment, so the imprinted paths inherit the
        // material's surface color (shadow/highlight lighting alone gives visual depth).
        // Laser-engraving burns/carbonizes the material (own dark burn color) and
        // hot-foil-stamping applies metallic foil on top (own foil color) — both overlay
        // their own manufacturing color, so recoloring would break visual realism.
        if (config.filterPresetId) {
          let filterInput = img
          if (templateType === 'debossed-monogram') {
            const surfaceColor = productImageUrl ? await sampleSurfaceColor(productImageUrl, printAreaRect) : '#8B7355'
            const recoloredSvgUri = await recolorSvgPaths(svgUrl, surfaceColor)
            filterInput = await loadImage(recoloredSvgUri)
          }
          const filterResult = await applyPathFilter(filterInput, config.filterPresetId, drawW, drawH)
          img = filterResult.image
          sourceImageUrl = filterResult.svgDataUri
          overlaySvg = filterResult.overlaySvg
        }

        const konvaImg = new Konva.Image({
          image: img,
          x: (width - drawW) / 2,
          y: (height - drawH) / 2,
          width: drawW,
          height: drawH,
        })
        layer.add(konvaImg)
      } else {
        // Fallback: render text placeholder with matching effect style
        const fallbackText = templateType.includes('initial') ? 'A' : 'ABC'
        const isDebossed = config.filterPresetId === 'debossing'
        const isEmbossed = config.filterPresetId === 'embossing'
        renderTextTemplate(
          stage,
          layer,
          {
            kind: 'text',
            text: fallbackText,
            fontFamily: CINZEL_FONT.family,
            fontSrc: CINZEL_FONT.src,
            textColor: isDebossed ? 'rgba(152, 75, 9, 1)' : '#333333',
            textColorAlpha: isDebossed ? 0.3 : isEmbossed ? 0.15 : 1,
            effects: isDebossed ? getDebossEffects() : isEmbossed ? getEmbossEffects() : [],
          },
          width,
          height
        )
      }
    } else if (config.kind === 'image') {
      // Compute best aspect ratio from bounding box
      const bestAR = findBestAspectRatio(width, height)

      // Generate image via AI with matching aspect ratio
      const imageUrl = await generateImage(config.prompt, bestAR)
      if (imageUrl) {
        sourceImageUrl = imageUrl
        const img = await loadImage(imageUrl)

        // Place generated image centered on template dimensions (no background expansion)
        const containScale = Math.min(width / img.width, height / img.height)
        const drawW = img.width * containScale
        const drawH = img.height * containScale

        const konvaImg = new Konva.Image({
          image: img,
          x: (width - drawW) / 2,
          y: (height - drawH) / 2,
          width: drawW,
          height: drawH,
        })
        layer.add(konvaImg)
      } else {
        // Fallback: colored rectangle with icon
        const iconSize = Math.min(width, height) * 0.4
        layer.add(
          new Konva.Rect({
            x: (width - iconSize) / 2,
            y: (height - iconSize) / 2,
            width: iconSize,
            height: iconSize,
            fill: '#f0f0f0',
            stroke: '#cccccc',
            strokeWidth: 2,
            cornerRadius: 8,
          })
        )
        layer.add(
          new Konva.Text({
            text: '🖼',
            fontSize: iconSize * 0.4,
            x: 0,
            y: 0,
            width,
            height,
            align: 'center',
            verticalAlign: 'middle',
          })
        )
      }
    }

    layer.draw()
    const dataUrl = stage.toDataURL({ mimeType: 'image/png', pixelRatio: 1 })
    stage.destroy()
    return { thumbnailDataUrl: dataUrl, sourceImageUrl, overlaySvg }
  } finally {
    document.body.removeChild(container)
  }
}
