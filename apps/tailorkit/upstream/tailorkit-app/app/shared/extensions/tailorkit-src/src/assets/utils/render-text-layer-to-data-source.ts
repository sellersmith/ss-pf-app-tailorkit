import type { Layer } from '../type'
import type { KonvaCanvasManager } from '../../shared/libraries/konva/core/konva-canvas-manager'
import { isEmpty } from './helpers'

/** Interface for components that provide canvas manager */
interface CanvasManagerProvider {
  canvasManager: KonvaCanvasManager
}

// Utility: apply style case to text
export const applyStyleCase = (text: string, styleCase: string | undefined) => {
  switch (styleCase) {
    case 'uppercase':
      return text.toLocaleUpperCase()
    case 'lowercase':
      return text.toLocaleLowerCase()
    case 'title': {
      // Capitalize each word, Unicode-aware
      return text.replace(/\p{L}[\p{L}\p{M}\p{Pc}\p{Pd}'’]*/gu, word => {
        const [first, ...rest] = word
        return first.toLocaleUpperCase() + rest.join('').toLocaleLowerCase()
      })
    }
    case 'sentence': {
      if (!text) return text
      const [first, ...rest] = text
      return first.toLocaleUpperCase() + rest.join('').toLocaleLowerCase()
    }
    default:
      return text
  }
}

type TextStyle = {
  fontSize: number
  textStyle: string[]
  fontFamily: { family: string; src: string }
  strokeColor?: string
  strokeWeight?: number
  textAlign: string
  verticalAlign: string
  content: string
  fill: string
  /** Paint-based fills (image/gradient fills) */
  fills?: unknown[]
  /** Paint-based strokes */
  strokes?: unknown[]
  // neonMode: string
  // neonIntensity: number
  // neonOffsetX: number
  // neonOffsetY: number
  styleCase?: string
}
export const sanitizeTextProps = (style: TextStyle) => {
  const textStyle = style.textStyle || []
  const fontStyle = textStyle.filter((_style: string) => _style !== 'normal' && _style !== 'underline').join(' ')

  let fontSrc = style.fontFamily.src
  try {
    const fontFromOptionSetParsed = JSON.parse(fontSrc)
    fontSrc = fontFromOptionSetParsed.src || fontSrc
  } catch (error) {
    // Do nothing
  }

  return {
    ...style,
    fontSize: style.fontSize,
    fill: style.fill,
    fills: style.fills,
    strokes: style.strokes,
    fontStyle,
    fontFamily: style.fontFamily.family,
    fontSrc,
    stroke: style.strokeColor,
    strokeWidth: style.strokeWeight,
    textAlign: style.textAlign,
    verticalAlign: style.verticalAlign,
    text: style.content,
    align: style.textAlign,
    textDecoration: textStyle.includes('underline') ? 'underline' : 'none',
    // neonMode: style.neonMode,
    // neonIntensity: style.neonIntensity,
    // neonOffsetX: style.neonOffsetX,
    // neonOffsetY: style.neonOffsetY,
  }
}

export const renderTextLayer = async (layer: Layer, element: CanvasManagerProvider) => {
  const {
    s: { content, textCreatedBy, autoFitToContainer = false, allowToGenerateTextWithAI = false },
    s,
    // ss,
    ds,
    optionSelectors,
  } = layer

  const textByCustomer = optionSelectors['text_customer']?.selector?.getAttribute('value')
  const merchantText = optionSelectors['text_option']?.selector?.getAttribute('value')
  const textColorFromOptionSet = optionSelectors['color_option']?.selector?.getAttribute('value')
  let fontSrcFromOptionSet = optionSelectors['font_option']?.selector?.getAttribute('value')
  try {
    const fontFromOptionSetParsed = JSON.parse(fontSrcFromOptionSet)
    fontSrcFromOptionSet = fontFromOptionSetParsed.src || fontSrcFromOptionSet
  } catch (error) {
    // Do nothing
  }
  const fontFamilyFromOptionSet = optionSelectors['font_option']?.selector?.getAttribute('data-family')
  const styleCase = s?.styleCase as string | undefined
  const rawContent = (textCreatedBy === 'customers' ? textByCustomer : merchantText) || content
  const textContent = applyStyleCase(rawContent || '', styleCase)

  // For customer text: check hideWhenEmpty setting when input is empty
  // This provides a simple way to hide empty optional text without needing imageless/conditional logic
  const hideWhenEmpty = s?.hideWhenEmpty ?? false
  if (textCreatedBy === 'customers' && hideWhenEmpty && isEmpty(textByCustomer)) {
    return
  }

  const textColor = s?.textColor

  // Paint fills can be stored at layer level or in settings - check both locations
  const fills = s?.fills || layer.fills
  const strokes = s?.strokes || layer.strokes

  // When a color option set is selected, clear paint fills so the selected color takes effect.
  // Paint fills (gradients/images) would otherwise override the solid color from the option set
  // because the SVG renderer gives paint fills precedence over the string fill/color prop.
  const effectiveFills = textColorFromOptionSet ? undefined : fills

  const textProps = sanitizeTextProps({
    ...s,
    content: textContent,
    fill: textColorFromOptionSet || textColor,
    fills: effectiveFills,
    strokes,
    // shape,
  })

  await element.canvasManager.addTextLayer({
    ...textProps,
    fontFamily: fontFamilyFromOptionSet || textProps.fontFamily,
    fontSrc: fontSrcFromOptionSet || textProps.fontSrc,
    x: ds.l,
    y: ds.t,
    width: ds.w,
    height: ds.h,
    rotation: ds.r || 0,
    autoFitToContainer,
    allowToGenerateTextWithAI,
    // HOTFIX: Pass updatedAt for text layer rendering version control (remove after July 2026)
    updatedAt: layer.updatedAt,
    // Custom emoji font for PUA characters
    ...(s?.emojiPicker?.font
      ? {
          emojiFontFamily: s.emojiPicker.font.family,
          emojiFontSrc: s.emojiPicker.font.src,
        }
      : {}),
  })
}
