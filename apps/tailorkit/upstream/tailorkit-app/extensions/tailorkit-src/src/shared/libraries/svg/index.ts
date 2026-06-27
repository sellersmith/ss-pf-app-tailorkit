/**
 * SVG Text Rendering Library
 *
 * A modular library for creating and rendering SVG text with effects.
 * Designed following SOLID principles for maintainability and testability.
 *
 * @module shared/libraries/svg
 */

// Color utilities
export {
  parseColor,
  toFloodColor,
  getFloodOpacity,
  extractRgbColor,
  extractAlpha,
  rgbToHex,
  toRgba,
  type RgbaColor,
} from './svg-color-utils'

// Font management
export {
  normalizeFontWeight,
  fetchGoogleFontCss,
  fetchCustomFontAsBase64,
  embedFontInSvg,
  clearFontCache,
  getFontCacheSize,
} from './svg-font-manager'

// Padding calculations
export {
  calculateItalicPadding,
  calculateDescenderPadding,
  calculateStrokePadding,
  calculateDynamicPadding,
  calculateSimplePadding,
  type EffectForPadding,
  type PaddingValues,
} from './svg-padding-calculator'

// Text layout
export {
  getTextAnchor,
  getXPosition,
  wrapText,
  getFontMetrics,
  getVerticalOffset,
  calculateTotalTextHeight,
  getTextPathStartOffset,
  type TextAlign,
  type VerticalAlign,
  type TextWrap,
  type FontMetrics,
} from './svg-text-layout'

// SVG text creation
export { createSVGText, type SVGTextConfig, type SVGTextResult } from './svg-text-creator'

// SVG text path creation
export { createSVGTextPath, type SVGTextPathConfig, type SVGTextPathResult } from './svg-text-path-creator'

// SVG to image conversion
export {
  svgToImage,
  getTextElement,
  getAllTextElements,
  getTextFillElements,
  getTextStrokeElements,
  getTextShadowElements,
} from './svg-image-converter'

// Filter building
export {
  addEffectsFilter,
  addInnerShadowFilter,
  applyFilterToText,
  hasVisibleEffects,
  buildEffectsFilterXML,
  buildInnerShadowFilterXML,
  buildBlurFilterXML,
  addBlurFilter,
  calculateFilterBounds,
  type EffectsFilterConfig,
} from './svg-filter-builder'

// Render orchestration
export {
  renderSVGTextWithEffects,
  renderSVGTextPathWithEffects,
  type RenderSVGTextOptions,
  type RenderSVGTextPathOptions,
  type RenderSVGTextResult,
  type RenderSVGTextPathResult,
} from './svg-render-orchestrator'

// Text render utilities (shared by React and Native JS)
export {
  separateEffects,
  calculateCombinedFillOpacity,
  prepareTextColor,
  prepareEffectsConfig,
  type SeparatedEffects,
  type CombinedOpacityResult,
} from './svg-text-render-utils'

// Render caching for performance optimization
export {
  getCacheKey,
  getCachedResult,
  setCachedResult,
  clearRenderCache,
  getRenderCacheSize,
  hasCachedResult,
  type CachedRenderResult,
  type CachedTextRenderResult,
  type CachedTextPathRenderResult,
} from './svg-render-cache'

// BBox measurement for accurate bounds
export { measureSVGBounds, cleanupMeasurementContainer, type MeasuredBounds } from './svg-bbox-calculator'

// Envelope distortion (text fills closed shapes)
export {
  createEnvelopeText,
  createEnvelopeTextPreview,
  getEnvelopeTextRenderInstructions,
  type EnvelopeTextOptions,
  type EnvelopeTextResult,
  type CanvasRenderInstruction,
} from './svg-envelope-text-creator'

export {
  processEnvelopeText,
  calculateEnvelopeDistortion,
  estimateTextWidth,
  type TextMetrics,
  type WarpedCharacter,
  type WarpedLine,
  type EnvelopeDistortionResult,
  type ShapeBounds,
} from './svg-envelope-distortion'

export { autoClosePath, isPathClosed } from './svg-envelope-boundary'

export {
  parseSvgPath,
  serializePathCommands,
  calculatePathBounds,
  type PathCommand,
  type Point,
} from './svg-path-utils'

// Print document builder (for generating print-ready SVG files)
export {
  SvgPrintDocument,
  createSvgPrintDocument,
  prepareFontCss,
  imageUrlToBase64,
  isSvgSource,
  fetchSvgContent,
  buildPrintSvg,
  type SvgPrintDocumentConfig,
  type TextLayerData,
  type ImageLayerData,
  type ImageOverlayData,
} from './svg-print-document-builder'
