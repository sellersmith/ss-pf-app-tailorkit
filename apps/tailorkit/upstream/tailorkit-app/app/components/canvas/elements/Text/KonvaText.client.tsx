import type { FontLoader } from 'extensions/tailorkit-src/src/assets/utils/font-loader'
import { computeTextMeasurementPadding } from 'extensions/tailorkit-src/src/shared/libraries/konva/text'
import type Konva from 'konva'
import type { ComponentProps } from 'react'
import { memo, useMemo } from 'react'
import type { Text } from 'react-konva'
import { Group, Rect } from 'react-konva'
import { DEFAULT_TEXT_AUTO_FIT_TO_CONTAINER } from '~/constants/inspector/text'
import type { EffectConfig } from '~/modules/TemplateEditor/elements/effects/types'
import type { TextSettings } from '~/types/psd'
import type { Paint, StrokeConfig } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import { useAutoTextScale, useTextEffectsRenderer } from './hooks'
import { SVGTextWithEffects, type SVGTextWithEffectsProps } from './SVGTextWithEffects.client'

interface KonvaTextProps extends Omit<ComponentProps<typeof Text>, 'fill'> {
  width: number
  height: number
  content: string
  style: Partial<Konva.TextConfig>
  shape?: string
  previewMode?: boolean
  fontLoader: FontLoader
  spriteRef: any
  autoFitToContainer?: boolean
  effects?: EffectConfig[]
  currentTextColor?: string
  /** Paint fill (takes precedence over color when provided) */
  fill?: Paint
  /** Paint stroke (supports solid, image, gradient) - legacy single stroke */
  strokePaint?: Paint
  /** Multiple strokes array (TextStudio-style wrapping) */
  strokes?: StrokeConfig[]
}

function KonvaTextComponent(props: KonvaTextProps) {
  const {
    width,
    height,
    content = '',
    style,
    previewMode = false,
    spriteRef,
    onReady,
    fontLoader,
    autoFitToContainer = DEFAULT_TEXT_AUTO_FIT_TO_CONTAINER,
    effects = [],
    currentTextColor = '#000000',
    fill,
    strokePaint,
    strokes,
    ...otherProps
  } = props

  const {
    fontFamily = 'Arial',
    fontSrc,
    fontSize: maxFontSize = 16,
    color,
    align,
    verticalAlign,
    lineHeight,
    wrap,
    letterSpacing = 0,
    textAlign,
    fontWeight,
    fontStyle,
    padding,
    ellipsis,
    emojiFontFamily,
    emojiFontSrc,
    ...otherStylesProps
  } = style as Partial<Konva.TextConfig> & { emojiFontFamily?: string; emojiFontSrc?: string }

  // Use shared text effects renderer hook
  const { isReady } = useTextEffectsRenderer({
    fontFamily,
    fontSrc,
    fontLoader,
    effects,
    spriteRef,
  })

  // Use auto-scaling when autoFitToContainer is true
  const shouldAutoFit = autoFitToContainer

  // Get font size - either auto-scaled or fixed
  const { fontSize } = useAutoTextScale({
    text: content,
    width,
    height,
    // Use measurement-only padding so neon intensity (shadowBlur) doesn't shrink available area
    padding: useMemo(() => computeTextMeasurementPadding(otherStylesProps as any), [otherStylesProps]),
    // If not auto-fitting, set minFontSize=maxFontSize to force that exact size
    minFontSize: shouldAutoFit ? 1 : maxFontSize,
    maxFontSize: maxFontSize,
    lineHeight: lineHeight,
    fontFamily: fontFamily || 'Arial',
    fontStyle: fontStyle,
    wrap: (wrap as TextSettings['wrap']) ?? 'none',
    letterSpacing: letterSpacing,
    align: textAlign,
    debounceMs: previewMode ? 50 : 0,
    dependencies: [isReady, content, fontFamily, fontSrc, shouldAutoFit, maxFontSize, width, height, lineHeight, wrap],
  })

  return (
    <Group>
      {/* Invisible background for reliable click detection when effects are enabled */}
      <Rect
        ref={spriteRef}
        {...otherProps}
        width={width}
        height={height}
        listening={true}
        fill="rgba(0,0,0,0)"
        clipFunc={null}
      />

      <SVGTextWithEffects
        width={width}
        height={height}
        content={content}
        fontSize={shouldAutoFit ? fontSize : maxFontSize}
        fontFamily={fontFamily}
        fontWeight={fontWeight}
        fontStyle={fontStyle}
        color={color || currentTextColor}
        letterSpacing={letterSpacing}
        // Pass all layout props for full Konva.Text support
        align={align as SVGTextWithEffectsProps['align']}
        verticalAlign={verticalAlign as SVGTextWithEffectsProps['verticalAlign']}
        lineHeight={lineHeight}
        wrap={wrap as SVGTextWithEffectsProps['wrap']}
        padding={padding}
        ellipsis={ellipsis}
        effects={effects}
        fontLoader={fontLoader}
        fontSrc={fontSrc}
        emojiFontFamily={emojiFontFamily as string}
        emojiFontSrc={emojiFontSrc as string}
        // Paint fill (takes precedence over color)
        fill={fill}
        // Paint stroke (supports solid, image, gradient) - legacy
        strokePaint={strokePaint}
        // Multiple strokes array (TextStudio-style wrapping)
        strokes={strokes}
        // Pass through transform properties for proper rotation/scale handling
        x={otherProps.x}
        y={otherProps.y}
        rotation={otherProps.rotation}
        scaleX={otherProps.scaleX}
        scaleY={otherProps.scaleY}
        offsetX={otherProps.offsetX}
        offsetY={otherProps.offsetY}
        skewX={otherProps.skewX}
        skewY={otherProps.skewY}
        listening={false}
      />
    </Group>
  )
}

export const KonvaText = memo(KonvaTextComponent)
