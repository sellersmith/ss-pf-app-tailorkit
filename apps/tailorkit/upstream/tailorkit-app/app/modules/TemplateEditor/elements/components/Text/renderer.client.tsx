import type Konva from 'konva'
import { memo, useEffect, useMemo } from 'react'
import { TemplateEditorStore } from '~/stores/modules/template'
import { KonvaText } from '~/components/canvas/elements/Text/KonvaText.client'
import { KonvaTextPath } from '~/components/canvas/elements/Text/KonvaTextPath.client'
import { EMPTY_ARRAY } from '~/constants'
import { useStore } from '~/libs/external-store'
import withInteractiveElement, {
  type WithInteractiveElementProps,
} from '~/modules/TemplateEditor/components/Editor/withInteractiveElement.client'
import type { TLayerStore } from '~/stores/modules/layer'
import type { ColorOptionSet, FontOptionSet, OptionSet, TextSettings } from '~/types/psd'
import type { EffectConfig } from '~/modules/TemplateEditor/elements/effects/types'
import { EOptionSet } from '~/types/psd'
import { fontLoader } from './instances'
import { applyStyleCase } from 'extensions/tailorkit-src/src/assets/utils/render-text-layer-to-data-source'
import {
  DEFAULT_CIRCLE_END_ANGLE,
  DEFAULT_CIRCLE_START_ANGLE,
  DEFAULT_CURVE_BEND,
  DEFAULT_TEXT_AUTO_FIT_TO_CONTAINER,
} from '~/constants/inspector/text'
import type { Paint, StrokeConfig } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import { TextWithZoneGroupRenderer } from './TextWithZoneGroupRenderer.client'

// Extend the WithInteractiveElementProps interface to include our custom prop
interface TextCanvasProps extends WithInteractiveElementProps {
  layerStore: TLayerStore
  previewMode?: boolean
  onChangeCircleStartAngle?: (value: number) => void
  onChangeCircleEndAngle?: (value: number) => void
  onChangeCurveBend?: (value: number) => void
}

// Separate functional component for canvas rendering
function TextElementRendererComponent(props: TextCanvasProps) {
  const {
    layerStore,
    previewMode,
    onChangeCircleStartAngle,
    onChangeCircleEndAngle,
    onChangeCurveBend,
    ...otherProps
  } = props

  const width = useStore(layerStore, state => state.width || 0)
  const height = useStore(layerStore, state => state.height || 0)
  const x = useStore(layerStore, state => state.left || 0)
  const y = useStore(layerStore, state => state.top || 0)
  const visible = useStore(layerStore, state => state.visible || true)
  const rotation = useStore(layerStore, state => state.rotate || 0)

  const optionSetList = useStore(layerStore, state => state.optionSet) || EMPTY_ARRAY
  const style = useStore(layerStore, state => state.settings) as TextSettings & {
    _previewFontFamily?: { family: string; src: string }
  }

  const {
    textColor,
    fontFamily,
    textAlign,
    textStyle,
    strokeColor,
    strokeWeight,
    /** @deprecated */
    neonMode,
    neonIntensity,
    neonOffsetX,
    neonOffsetY,
    /** ------- */
    textCreatedBy,
    tempContent,
    content,
    autoFitToContainer = DEFAULT_TEXT_AUTO_FIT_TO_CONTAINER,
    styleCase = 'none',
    textShape = 'none',
    curvePeaks = 1,
    curveBend = DEFAULT_CURVE_BEND,
    circleStartAngle = DEFAULT_CIRCLE_START_ANGLE,
    circleEndAngle = DEFAULT_CIRCLE_END_ANGLE,
    customPathData,
    customPathMetadata,
    customPathInverted = false,
    fillShapePathData,
    fillShapeMetadata,
    fillShapeVerticalOffset,
    fillShapeVerticalScale,
    fillShapeHorizontalOffset,
    fillShapeHorizontalScale,
    fillShapeCharacterSpacing,
    circleInverted = false,
    _previewFontFamily, // Hover preview font (from FontFamilyInspectorPanel)
    fills, // New Paint-based fill system
    strokes, // New Paint-based stroke system
    emojiPicker, // Custom emoji font config
    ...otherStyles
  } = style as TextSettings & {
    _previewFontFamily?: { family: string; src: string }
  }

  /**
   * Font family resolution with 3-tier priority system:
   *
   * Priority 1: Hover preview font (_previewFontFamily)
   *   - Highest priority for instant preview when hovering over font options
   *   - Set via FontFamilyInspectorPanel when user hovers over a font
   *   - Cleared when hover ends or layer/font source changes
   *   - Uses skipTrace to avoid polluting undo history
   *
   * Priority 2: Option set preview (previewMode)
   *   - Active when in option set preview mode
   *   - Shows font from selected font option set
   *   - Used for product customization preview
   *
   * Priority 3: Actual font family
   *   - Default font family from layer settings
   *   - The permanent font selection for this layer
   */
  const _fontFamily = useMemo(() => {
    // Priority 1: Hover preview font (highest priority for instant preview)
    if (_previewFontFamily) {
      return _previewFontFamily
    }

    // Priority 2: Font option set selection (always applied for real-time preview panel sync)
    const fontOptionSet = optionSetList.find((option: OptionSet) => option.type === EOptionSet.FONT_OPTION)
    const fontOptionSetSelecting = fontOptionSet?.data?.fonts?.find((font: FontOptionSet) => font.selecting)

    if (fontOptionSetSelecting) {
      return { family: fontOptionSetSelecting.family, src: fontOptionSetSelecting.src }
    }

    // Priority 3: Actual font family
    return fontFamily
  }, [_previewFontFamily, fontFamily, optionSetList])

  // Load emoji font for CSS/HTML rendering (input fields, emoji picker buttons)
  useEffect(() => {
    if (emojiPicker?.font?.family && emojiPicker?.font?.src) {
      fontLoader.loadFont(emojiPicker.font.family, emojiPicker.font.src)
    }
  }, [emojiPicker?.font?.family, emojiPicker?.font?.src])

  const textContent = useMemo(() => {
    if (textCreatedBy === 'customers') {
      return tempContent || content
    }

    const textOptionSet = optionSetList.find((option: OptionSet) => option.type === EOptionSet.TEXT_OPTION)

    return textOptionSet?.data?.texts?.find(text => text.selecting)?.name || content
  }, [textCreatedBy, tempContent, content, optionSetList])

  // Apply style case transformation
  const transformedTextContent = useMemo(() => applyStyleCase(textContent || '', styleCase), [textContent, styleCase])

  const colorOptionSetSelecting = useMemo(() => {
    const colorOptionSet = optionSetList.find((option: OptionSet) => option.type === EOptionSet.COLOR_OPTION)

    return colorOptionSet?.data?.colors?.find((color: ColorOptionSet) => color.selecting) || null
  }, [optionSetList])

  // can be 'normal', 'italic', or 'bold', '500' or even 'italic bold'. 'normal' is the default.
  // textStyle is an array of strings, so we need combine them into a single string
  const fontStyle = useMemo(
    () => (style.textStyle || EMPTY_ARRAY).filter(style => style !== 'normal' && style !== 'underline').join(' '),
    [style.textStyle]
  )

  // Build effects props via composable pipeline.
  // Backward compatibility: if no effects configured, derive from neon settings when active.
  const effectsBuild = useMemo(() => {
    const effects = style.effects
    let derivedEffects: EffectConfig[] = []

    if (effects && effects.length > 0) {
      derivedEffects = effects
    } else if (neonMode && neonMode !== 'none') {
      // Migrate legacy neon settings to preset-based effects
      const preset = (() => {
        const near = Math.max(2, Math.round((neonIntensity || 12) * 0.6))
        const far = Math.max(6, Math.round((neonIntensity || 12) * 1.6))
        const color = 'currentColor'
        return [
          {
            type: 'DROP_SHADOW',
            visible: true,
            color,
            offsetX: neonOffsetX || 0,
            offsetY: neonOffsetY || 0,
            radius: near,
          },
          {
            type: 'DROP_SHADOW',
            visible: true,
            color,
            offsetX: neonOffsetX || 0,
            offsetY: neonOffsetY || 0,
            radius: far,
          },
          {
            type: 'INNER_SHADOW',
            visible: true,
            color: 'rgb(255, 255, 255)',
            offsetX: neonOffsetX || 0,
            offsetY: neonOffsetY || 0,
            radius: 100,
          },
        ]
      })()
      derivedEffects = preset
    }

    return {
      build: {
        effects: derivedEffects,
      },
      hasAnyEffects: derivedEffects.length > 0,
    }
  }, [style, neonMode, neonIntensity, neonOffsetX, neonOffsetY])

  // Get current fill - new Paint system takes precedence over legacy textColor.
  // When a color option set is selected, clear paint fills so the selected color takes effect,
  // because paint fills would otherwise override the solid color from the option set.
  const currentFill = useMemo((): Paint | undefined => {
    if (colorOptionSetSelecting?.value) return undefined

    if (fills && Array.isArray(fills) && fills.length > 0) {
      return fills[0]
    }
    return undefined
  }, [fills, colorOptionSetSelecting?.value])

  // Get current stroke paint - new Paint system takes precedence over legacy strokeColor
  const currentStrokePaint = useMemo((): Paint | undefined => {
    if (strokes && Array.isArray(strokes) && strokes.length > 0) {
      return strokes[0]
    }
    return undefined
  }, [strokes])

  const konvaTextStyle: Partial<Konva.TextConfig> = useMemo(() => {
    return {
      // Other style props
      ...otherStyles,

      // Evaluated style props - handle text color based on neon mode
      color: colorOptionSetSelecting?.value || textColor,
      textDecoration: (textStyle || EMPTY_ARRAY).includes('underline') ? 'underline' : '',
      fontFamily: _fontFamily.family,
      fontSrc: _fontFamily.src,
      // Emoji font for PUA character rendering in SVG
      emojiFontFamily: emojiPicker?.font?.family,
      emojiFontSrc: emojiPicker?.font?.src,
      text: transformedTextContent,
      align: textAlign,
      stroke: neonMode === 'inverse' ? colorOptionSetSelecting?.value || textColor : strokeColor,
      strokeWidth: strokeWeight,
      fontStyle,

      // Effects pipeline (includes backwards neon mapping)
      ...(effectsBuild.hasAnyEffects ? { perfectDrawEnabled: false } : {}),
      // ...effectsBuild.build.baseTextProps,
    }
  }, [
    otherStyles,
    neonMode,
    colorOptionSetSelecting?.value,
    textColor,
    textStyle,
    _fontFamily.family,
    _fontFamily.src,
    transformedTextContent,
    textAlign,
    strokeColor,
    strokeWeight,
    fontStyle,
    effectsBuild,
    emojiPicker?.font?.family,
    emojiPicker?.font?.src,
  ])

  // Use KonvaTextPath for shaped text, KonvaText for normal text
  if (textShape !== 'none') {
    return (
      <KonvaTextPath
        x={x}
        y={y}
        width={width}
        height={height}
        content={transformedTextContent || ''}
        rotation={rotation}
        visible={visible}
        style={konvaTextStyle}
        textShape={textShape}
        circleStartAngle={circleStartAngle}
        circleEndAngle={circleEndAngle}
        circleInverted={circleInverted}
        curvePeaks={curvePeaks}
        curveBend={curveBend}
        customPathData={customPathData}
        customPathMetadata={customPathMetadata}
        customPathInverted={customPathInverted}
        fillShapePathData={fillShapePathData}
        fillShapeMetadata={fillShapeMetadata}
        fillShapeVerticalOffset={fillShapeVerticalOffset}
        fillShapeVerticalScale={fillShapeVerticalScale}
        fillShapeHorizontalOffset={fillShapeHorizontalOffset}
        fillShapeHorizontalScale={fillShapeHorizontalScale}
        fillShapeCharacterSpacing={fillShapeCharacterSpacing}
        fillAfterStrokeEnabled={true}
        fontLoader={fontLoader}
        autoFitToContainer={autoFitToContainer}
        effects={effectsBuild.build.effects || EMPTY_ARRAY}
        currentTextColor={colorOptionSetSelecting?.value || textColor || 'rgb(0, 0, 0)'}
        fill={currentFill}
        strokePaint={currentStrokePaint}
        strokes={strokes as StrokeConfig[] | undefined}
        onChangeCircleStartAngle={onChangeCircleStartAngle}
        onChangeCircleEndAngle={onChangeCircleEndAngle}
        onChangeCurveBend={onChangeCurveBend}
        previewMode={previewMode}
        {...otherProps}
      />
    )
  }

  return (
    <KonvaText
      x={x}
      y={y}
      width={width}
      height={height}
      content={transformedTextContent || ''}
      rotation={rotation}
      visible={visible}
      style={konvaTextStyle}
      fillAfterStrokeEnabled={true}
      fontLoader={fontLoader}
      autoFitToContainer={autoFitToContainer}
      previewMode={previewMode}
      effects={effectsBuild.build.effects || EMPTY_ARRAY}
      currentTextColor={colorOptionSetSelecting?.value || textColor || 'rgb(0, 0, 0)'}
      fill={currentFill}
      strokePaint={currentStrokePaint}
      strokes={strokes as StrokeConfig[] | undefined}
      {...otherProps}
    />
  )
}

export const TextElementRenderer = memo(withInteractiveElement(TextElementRendererComponent, true))

// Export the raw (un-HOC-wrapped) component for use inside TextWithZoneGroupRenderer,
// where the zone Group is the interactive element rather than the text node itself.
export { TextElementRendererComponent }

// ─── Zone-aware wrapper ────────────────────────────────────────────────────────

/**
 * Props for the canvas section that combines text rendering with zone overlay.
 * Exported from renderCanvas() in Text/index.tsx.
 */
export interface TextCanvasWithZoneProps {
  layerStore: TLayerStore
  previewMode?: boolean
  onChangeCircleStartAngle?: (value: number) => void
  onChangeCircleEndAngle?: (value: number) => void
  onChangeCurveBend?: (value: number) => void
}

/**
 * Routes text layer rendering based on whether a movement zone is configured:
 *
 * - No zone → TextElementRenderer (standard withInteractiveElement HOC)
 * - Has zone → TextWithZoneGroupRenderer (Zone Group as Transformer target, Image+Mask pattern)
 * - Free movement (buyer interaction, no zone) in preview → HOC stays interactive with snapshot/restore
 */
function TextCanvasWithZoneComponent({
  layerStore,
  previewMode,
  onChangeCircleStartAngle,
  onChangeCircleEndAngle,
  onChangeCurveBend,
}: TextCanvasWithZoneProps) {
  const layerId = useStore(layerStore, state => state._id)
  const shapeSettings = useStore(layerStore, state => state.shapeSettings)
  const textCreatedBy = useStore(layerStore, state => state.settings?.textCreatedBy)
  const templateDimension = useStore(TemplateEditorStore, state => state.dimension)

  const isCustomerText = textCreatedBy === 'customers'
  const hasBuyerInteraction = Boolean(
    isCustomerText && (shapeSettings?.movable || shapeSettings?.resizable || shapeSettings?.rotatable)
  )
  const hasZone = Boolean(hasBuyerInteraction && shapeSettings?.movementBounds)

  // Preview: route ALL buyer-interactive text to zone renderer (handles movable/resizable/rotatable correctly).
  // No zone → pass virtual bounds (full template) so zone renderer has a boundary to work with.
  const useZoneRenderer = hasZone || (Boolean(previewMode) && hasBuyerInteraction)

  if (useZoneRenderer) {
    return (
      <TextWithZoneGroupRenderer
        layerStore={layerStore}
        previewMode={previewMode}
        virtualBounds={
          !hasZone
            ? { type: 'rectangle', x: 0, y: 0, width: templateDimension.width, height: templateDimension.height }
            : undefined
        }
        onChangeCircleStartAngle={onChangeCircleStartAngle}
        onChangeCircleEndAngle={onChangeCircleEndAngle}
        onChangeCurveBend={onChangeCurveBend}
      />
    )
  }

  return (
    <TextElementRenderer
      id={layerId}
      layerStore={layerStore}
      previewMode={previewMode}
      onChangeCircleStartAngle={onChangeCircleStartAngle}
      onChangeCircleEndAngle={onChangeCircleEndAngle}
      onChangeCurveBend={onChangeCurveBend}
    />
  )
}

export const TextCanvasWithZone = memo(TextCanvasWithZoneComponent)
