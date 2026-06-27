import { BlockStack, Divider } from '@shopify/polaris'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_CIRCLE_END_ANGLE, DEFAULT_CIRCLE_START_ANGLE } from '~/constants/inspector/text'
import { MODAL_ID } from '~/constants/modal'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '~/modules/TemplateEditor/constants'
import type { TextSettings } from '~/types/psd'
import { useModal } from '~/utils/hooks/useModal'
import type TemplateElement from '../../..'
import type { EffectStyleType } from './EffectPresets'
import { useEffectsManager } from './hooks/useEffectsManager'
import { StrokesStack } from '../Strokes'
import { TextShape } from './TextShape'
import { TextPathEditorModal } from './TextShape/TextPathEditorModal'
import { TextFillShapeEditorModal } from './TextShape/TextFillShapeEditorModal'
import { calculateCircleContainerSize } from './utils/calculateCircleContainerSize'
import type { TLayerStore } from '~/stores/modules/layer'
import { useStore } from '~/libs/external-store'

interface EffectsPanelProps {
  element: TemplateElement<any, any>
  clickedLayerStore?: TLayerStore | null
}

export function EffectsPanel({ element, clickedLayerStore }: EffectsPanelProps) {
  const { t } = useTranslation()
  const { openModal } = useModal()

  // Determine target layer store (for nested elements)
  const targetLayerStore = useMemo(() => {
    if (clickedLayerStore && clickedLayerStore.getState()._id !== element.state._id) {
      return clickedLayerStore
    }
    return element.props.layerStore
  }, [clickedLayerStore, element])

  // Subscribe to targetLayerStore for settings
  const settings = useStore(targetLayerStore, state => (state as any).settings || {})
  const metadata = (settings as any).metadata

  // Use shared effects manager for stroke handlers (DRY) - kept for legacy support
  const { strokePaint, strokeWeight } = useEffectsManager({
    element,
    clickedLayerStore,
  })

  // Check if custom path data exists
  const hasCustomPath = Boolean(settings.customPathData)

  // Check if fill shape data exists
  const hasFillShape = Boolean(settings.fillShapePathData)

  // Check if outline preset is selected (stroke controls shown in PresetSettings instead)
  const effectStyle = useMemo(() => {
    return (metadata?.effectStyle as EffectStyleType) || null
  }, [metadata])
  const isOutlinePreset = effectStyle === 'outline'

  // Provide default values for safety (text shape settings only - stroke from hook)
  const safeSettings = {
    strokePaint,
    strokeWeight,
    textShape: settings.textShape || 'none',
    circleInverted: settings.circleInverted ?? false,
    customPathInverted: settings.customPathInverted ?? false,
    curvePeaks: settings.curvePeaks || 1,
    curveBend: settings.curveBend || 50,
    fillShapeVerticalOffset: settings.fillShapeVerticalOffset ?? 0,
    fillShapeVerticalScale: settings.fillShapeVerticalScale ?? 1.0,
    fillShapeHorizontalOffset: settings.fillShapeHorizontalOffset ?? 0,
    fillShapeHorizontalScale: settings.fillShapeHorizontalScale ?? 1.0,
    fillShapeCharacterSpacing: settings.fillShapeCharacterSpacing ?? 0,
  }

  // Helper setters to reduce repetition and keep handlers stable
  // Use spread pattern to ensure new settings object reference for proper reactivity
  const setSetting = useCallback(
    <K extends keyof TextSettings>(key: K, value: TextSettings[K]) => {
      const currentSettings = targetLayerStore.getState().settings || {}
      targetLayerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            settings: { ...currentSettings, [key]: value },
          },
        },
      })
    },
    [targetLayerStore]
  )

  // Neon controls are deprecated; neon now provided via Effects presets in EffectsStack

  // Text shape
  const handleTextShapeChange = useCallback(
    (value: TextSettings['textShape']) => {
      if (value === 'circle') {
        const currentState = targetLayerStore.getState()
        const currentWidth = currentState.width
        const currentHeight = currentState.height
        const currentX = currentState.left
        const currentY = currentState.top
        const currentSettings = currentState.settings || {}

        // Calculate optimal circle size based on text content
        const squareSize = calculateCircleContainerSize({
          content: currentSettings.content || '',
          fontSize: currentSettings.fontSize || 16,
          fontFamily: currentSettings.fontFamily?.family || 'Arial',
          letterSpacing: currentSettings.letterSpacing || 0,
          startAngle: currentSettings.circleStartAngle ?? DEFAULT_CIRCLE_START_ANGLE,
          endAngle: currentSettings.circleEndAngle ?? DEFAULT_CIRCLE_END_ANGLE,
          currentWidth,
          currentHeight,
        })

        // Center the new square container on the original element position
        const newX = currentX + (currentWidth - squareSize) / 2
        const newY = currentY + (currentHeight - squareSize) / 2

        targetLayerStore.dispatch({
          type: 'UPDATE_LAYER',
          payload: {
            state: {
              settings: { ...currentSettings, textShape: value },
              width: squareSize,
              height: squareSize,
              left: newX,
              top: newY,
            },
          },
        })

        // Hide transformer before updating the transformer to avoid flickering
        Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.HIDE_TRANSFORMER)
        requestAnimationFrame(() => {
          Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER)
        })

        return
      }

      setSetting('textShape', value)

      // Hide transformer before updating the transformer to avoid flickering
      Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.HIDE_TRANSFORMER)
      requestAnimationFrame(() => {
        Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER)
      })
    },
    [targetLayerStore, setSetting]
  )

  const handleCircleInvertedChange = useCallback((value: boolean) => setSetting('circleInverted', value), [setSetting])
  const handleCustomPathInvertedChange = useCallback(
    (value: boolean) => setSetting('customPathInverted', value),
    [setSetting]
  )
  const handleCurvePeaksChange = useCallback((value: number) => setSetting('curvePeaks', value), [setSetting])
  const handleCurveBendChange = useCallback(
    (value: number) => {
      const currentSettings = targetLayerStore.getState().settings || {}
      targetLayerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            settings: { ...currentSettings, curveBend: value.toFixed(2) },
          },
        },
      })
    },
    [targetLayerStore]
  )

  // Custom path handlers
  const handleOpenCustomPathEditor = useCallback(() => {
    openModal(MODAL_ID.TEXT_PATH_EDITOR_MODAL)
  }, [openModal])

  const handleClearCustomPath = useCallback(() => {
    const currentSettings = targetLayerStore.getState().settings || {}
    targetLayerStore.dispatch({
      type: 'UPDATE_LAYER',
      payload: {
        state: {
          settings: {
            ...currentSettings,
            textShape: 'none',
            customPathData: undefined,
            customPathMetadata: undefined,
          },
        },
      },
    })

    // Update transformer after clearing
    Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.HIDE_TRANSFORMER)
    requestAnimationFrame(() => {
      Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER)
    })
  }, [targetLayerStore])

  // Fill shape handlers
  const handleOpenFillShapeEditor = useCallback(() => {
    openModal(MODAL_ID.TEXT_FILL_SHAPE_EDITOR_MODAL)
  }, [openModal])

  const handleClearFillShape = useCallback(() => {
    const currentSettings = targetLayerStore.getState().settings || {}
    targetLayerStore.dispatch({
      type: 'UPDATE_LAYER',
      payload: {
        state: {
          settings: {
            ...currentSettings,
            textShape: 'none',
            fillShapePathData: undefined,
            fillShapeMetadata: undefined,
            fillShapeVerticalOffset: undefined,
            fillShapeVerticalScale: undefined,
            fillShapeHorizontalOffset: undefined,
            fillShapeHorizontalScale: undefined,
            fillShapeCharacterSpacing: undefined,
          },
        },
      },
    })

    // Update transformer after clearing
    Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.HIDE_TRANSFORMER)
    requestAnimationFrame(() => {
      Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER)
    })
  }, [targetLayerStore])

  // Fill shape vertical adjustment handlers
  const handleFillShapeVerticalOffsetChange = useCallback(
    (value: number) => setSetting('fillShapeVerticalOffset', value),
    [setSetting]
  )

  const handleFillShapeVerticalScaleChange = useCallback(
    (value: number) => setSetting('fillShapeVerticalScale', value),
    [setSetting]
  )

  // Fill shape horizontal adjustment handlers
  const handleFillShapeHorizontalOffsetChange = useCallback(
    (value: number) => setSetting('fillShapeHorizontalOffset', value),
    [setSetting]
  )

  const handleFillShapeHorizontalScaleChange = useCallback(
    (value: number) => setSetting('fillShapeHorizontalScale', value),
    [setSetting]
  )

  // Fill shape character spacing handler
  const handleFillShapeCharacterSpacingChange = useCallback(
    (value: number) => setSetting('fillShapeCharacterSpacing', value),
    [setSetting]
  )

  return (
    <BlockStack gap={'400'} align="center">
      {/* Hide StrokesStack when outline preset is selected (controls are in PresetSettings) */}
      {!isOutlinePreset && (
        <>
          <StrokesStack element={element} clickedLayerStore={clickedLayerStore} t={t} />
          <Divider />
        </>
      )}
      {/* NeonGlow removed; use Effects presets below */}
      <TextShape
        textShape={safeSettings.textShape}
        circleInverted={safeSettings.circleInverted}
        customPathInverted={safeSettings.customPathInverted}
        curvePeaks={safeSettings.curvePeaks}
        curveBend={safeSettings.curveBend}
        hasCustomPath={hasCustomPath}
        hasFillShape={hasFillShape}
        fillShapeVerticalOffset={safeSettings.fillShapeVerticalOffset}
        fillShapeVerticalScale={safeSettings.fillShapeVerticalScale}
        fillShapeHorizontalOffset={safeSettings.fillShapeHorizontalOffset}
        fillShapeHorizontalScale={safeSettings.fillShapeHorizontalScale}
        fillShapeCharacterSpacing={safeSettings.fillShapeCharacterSpacing}
        onChangeTextShape={handleTextShapeChange}
        onChangeCircleInverted={handleCircleInvertedChange}
        onChangeCustomPathInverted={handleCustomPathInvertedChange}
        onChangeCurvePeaks={handleCurvePeaksChange}
        onChangeCurveBend={handleCurveBendChange}
        onOpenCustomPathEditor={handleOpenCustomPathEditor}
        onClearCustomPath={handleClearCustomPath}
        onOpenFillShapeEditor={handleOpenFillShapeEditor}
        onClearFillShape={handleClearFillShape}
        onChangeFillShapeVerticalOffset={handleFillShapeVerticalOffsetChange}
        onChangeFillShapeVerticalScale={handleFillShapeVerticalScaleChange}
        onChangeFillShapeHorizontalOffset={handleFillShapeHorizontalOffsetChange}
        onChangeFillShapeHorizontalScale={handleFillShapeHorizontalScaleChange}
        onChangeFillShapeCharacterSpacing={handleFillShapeCharacterSpacingChange}
      />
      {/* Custom path editor modal */}
      <TextPathEditorModal layerStore={element.props.layerStore} />
      {/* Fill shape editor modal */}
      <TextFillShapeEditorModal layerStore={element.props.layerStore} />
    </BlockStack>
  )
}
