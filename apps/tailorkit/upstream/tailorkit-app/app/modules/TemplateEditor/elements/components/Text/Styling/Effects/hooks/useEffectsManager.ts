import { useCallback, useMemo, useState } from 'react'
import type { EffectConfig, EffectPreset } from '~/modules/TemplateEditor/elements/effects/types'
import { uuid } from '~/utils/uuid'
import type TemplateElement from '../../../..'
import {
  createDebossPreset,
  createEmbossPreset,
  createNeonPreset,
  createEmbroideryPreset,
  EMBOSS_ALPHA_DEFAULT,
  EMBOSS_ALPHA_OVERLAY,
  DEBOSS_ALPHA_DEFAULT,
  DEBOSS_ALPHA_OVERLAY,
} from '~/modules/TemplateEditor/elements/effects/presets'
import { TemplateEditorStore } from '~/stores/modules/template'
import { useStore } from '~/libs/external-store'
import { sampleAverageColorUnderNode } from '~/utils/canvas/samplePixelColor'
import { parseColor, toRgba, lightenColorHsl } from 'extensions/tailorkit-src/src/shared/libraries/svg/svg-color-utils'
import type { EffectStyleType } from '../EffectPresets'
import {
  getNeonIntensity,
  getEmbossDirection,
  getEmbossDepth,
  updatePresetParameter,
  getEdgeStyle,
  updateEdgeStyle,
  getEmbroiderySheen,
  getEmbroideryDepth,
  getEmbroideryDirection,
  type EdgeStyleType,
} from '~/modules/TemplateEditor/elements/effects/preset-utils'
import type { Paint } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import { colorToSolidPaint, isSolidPaint } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import type { TLayerStore } from '~/stores/modules/layer'

interface UseEffectsManagerProps {
  element: TemplateElement<any, any>
  clickedLayerStore?: TLayerStore | null
}

interface UseEffectsManagerReturn {
  // State (from element settings)
  effects: EffectConfig[]
  effectStyle: EffectStyleType
  textColor: string
  fontSize: number
  strokeWeight: number
  strokeColor: string
  /** Paint-based stroke (supports solid, image, gradient) */
  strokePaint: Paint | undefined
  applyColorOverlay: boolean
  fill: Paint | string | undefined

  // UI State (local)
  settingsOpen: Record<string, boolean>
  showAdvanced: boolean
  toggleSettingsOpen: (id: string) => void
  closeSettings: (id: string) => void
  setShowAdvanced: (show: boolean) => void

  // Effect handlers
  handleAddEffect: (type: EffectConfig['type'], openSettings?: boolean) => void
  handleToggleVisible: (index: number, checked: boolean) => void
  handleChangeType: (index: number, type: EffectConfig['type']) => void
  handleRemove: (index: number) => void
  handleUpdateEffect: (index: number, patch: Partial<EffectConfig>) => void
  handleReorder: (items: Array<{ id: string; payload: unknown }>) => void

  // Preset handlers
  handleSelectPreset: (preset: EffectStyleType) => void
  handlePresetParamChange: (param: 'intensity' | 'direction' | 'depth' | 'sheen', value: number) => void
  handleApplyColorOverlayChange: () => void
  handleOverlayColorChange: (color: string) => void
  handleNeonColorChange: (color: string) => void
  handleStrokeWeightChange: (weight: number) => void
  handleStrokeColorChange: (color: string) => void
  /** Handler for Paint-based stroke changes */
  handleStrokePaintChange: (paint: Paint) => void
  handleEdgeStyleChange: (edgeStyle: EdgeStyleType) => void
  handleFillChange: (fill: Paint) => void

  // Computed values
  neonIntensity: number
  embossDirection: number
  embossDepth: number
  edgeStyle: EdgeStyleType
  embroiderySheen: number
  embroideryDepth: number
  embroideryDirection: number
}

/**
 * Hook that manages all effects-related state and handlers for the EffectsStack component.
 * Separates business logic from UI rendering for better maintainability.
 */
export function useEffectsManager({ element, clickedLayerStore }: UseEffectsManagerProps): UseEffectsManagerReturn {
  // ============================================================================
  // Determine target layer store (for nested elements in multi-layout)
  // ============================================================================

  const targetLayerStore = useMemo(() => {
    // For nested elements (e.g., text in multi-layout), use clickedLayerStore
    // Otherwise use element's layerStore
    if (clickedLayerStore && clickedLayerStore.getState()._id !== element.state._id) {
      return clickedLayerStore
    }
    return element.props.layerStore
  }, [clickedLayerStore, element])

  // Subscribe to targetLayerStore changes for settings
  // The store state IS the layer object, which has settings property
  const settings = useStore(targetLayerStore, state => (state as any).settings || {})

  // ============================================================================
  // State from element settings
  // ============================================================================

  const effects: EffectConfig[] = useMemo(() => {
    return settings?.effects || []
  }, [settings])

  const textColor = useMemo(() => {
    return settings?.textColor || 'currentColor'
  }, [settings])

  const fontSize = useMemo(() => {
    return settings?.fontSize || 48
  }, [settings])

  // Read effectStyle from metadata
  const effectStyle = useMemo(() => {
    return (settings?.metadata?.effectStyle as EffectStyleType) || null
  }, [settings])

  // Stroke settings for outline preset
  const strokeWeight = useMemo(() => {
    return settings?.strokeWeight || 0
  }, [settings])

  const strokeColor = useMemo(() => {
    return settings?.strokeColor || 'rgb(0, 0, 0)'
  }, [settings])

  // Paint-based stroke (from strokes array, like Figma)
  // Prefers strokes array over legacy strokeColor
  const strokePaint = useMemo((): Paint | undefined => {
    // Check for new strokes array first
    if (settings?.strokes && Array.isArray(settings.strokes) && settings.strokes.length > 0) {
      return settings.strokes[0] as Paint
    }
    // Fall back to converting legacy strokeColor to SolidPaint
    if (settings?.strokeColor && settings?.strokeWeight > 0) {
      return colorToSolidPaint(settings.strokeColor)
    }
    return undefined
  }, [settings])

  // Read applyColorOverlay from metadata
  const applyColorOverlay = useMemo(() => {
    return settings?.metadata?.applyColorOverlay ?? false
  }, [settings])

  // Read fill (Paint) from settings - used for embroidery image fills
  // Reads from fills array (consistent with renderer and FillPanel)
  const fill = useMemo(() => {
    if (settings?.fills && Array.isArray(settings.fills) && settings.fills.length > 0) {
      return settings.fills[0] as Paint | string | undefined
    }
    return undefined
  }, [settings])

  // ============================================================================
  // UI State
  // ============================================================================

  const [settingsOpen, setSettingsOpen] = useState<Record<string, boolean>>({})
  const [showAdvanced, setShowAdvanced] = useState(false)

  const toggleSettingsOpen = useCallback((id: string) => {
    setSettingsOpen(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const closeSettings = useCallback((id: string) => {
    setSettingsOpen(prev => ({ ...prev, [id]: false }))
  }, [])

  // ============================================================================
  // Stage reference for pixel color sampling
  // ============================================================================

  const stageRef = useStore(TemplateEditorStore, state => state.stageRef)

  // ============================================================================
  // Helper functions
  // ============================================================================

  const setEffects = useCallback(
    (newEffects: EffectConfig[]) => {
      const currentSettings = targetLayerStore.getState().settings || {}
      targetLayerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            settings: { ...currentSettings, effects: newEffects },
          },
        },
      })
    },
    [targetLayerStore]
  )

  const setSetting = useCallback(
    (key: string, value: unknown) => {
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

  const updateSettingsWithMetadata = useCallback(
    (settingsUpdate: Record<string, unknown>, metadataUpdate: Record<string, unknown>) => {
      const currentSettings = targetLayerStore.getState().settings || {}
      const metadata = currentSettings.metadata || {}
      targetLayerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            settings: {
              ...currentSettings,
              ...settingsUpdate,
              metadata: { ...metadata, ...metadataUpdate },
            },
          },
        },
      })
    },
    [targetLayerStore]
  )

  // ============================================================================
  // Effect Handlers
  // ============================================================================

  const handleAddEffect = useCallback(
    (type: EffectConfig['type'], openSettings: boolean = false) => {
      const base = { visible: true } as const
      const newId = uuid().split('-')[0]

      const create = (): EffectConfig => {
        if (type === 'DROP_SHADOW') {
          return { _id: newId, type, ...base, color: 'rgba(156,156,156,1)', offsetX: 0, offsetY: 4, radius: 4 }
        }
        if (type === 'INNER_SHADOW') {
          return { _id: newId, type, ...base, color: 'rgba(0,0,0,0.9)', offsetX: 0, offsetY: 2, radius: 1 }
        }
        if (type === 'LAYER_BLUR' || type === 'BACKGROUND_BLUR') {
          return { _id: newId, type, ...base, radius: 5 } as EffectConfig
        }
        return { _id: newId, type: 'NOISE', ...base, density: 0.2, size: 2 } as EffectConfig
      }

      const next = [...(effects || []), create()]
      updateSettingsWithMetadata({ effects: next }, { effectStyle: null })

      if (openSettings) {
        setTimeout(() => {
          const addedIndex = next.length - 1
          const added = next[addedIndex]
          const key = added._id ? String(added._id) : String(addedIndex)
          setSettingsOpen(prev => {
            const newState: Record<string, boolean> = {}
            Object.keys(prev).forEach(k => {
              newState[k] = false
            })
            newState[key] = true
            return newState
          })
        }, 50)
      }
    },
    [effects, updateSettingsWithMetadata]
  )

  const handleToggleVisible = useCallback(
    (index: number, checked: boolean) => {
      const next = [...effects]
      next[index] = { ...next[index], visible: checked } as EffectConfig
      setEffects(next)
    },
    [effects, setEffects]
  )

  const handleChangeType = useCallback(
    (index: number, type: EffectConfig['type']) => {
      const current = effects[index] as any
      const base = { visible: current.visible ?? true } as const
      let updated: EffectConfig

      if (type === 'DROP_SHADOW') {
        const c = current
        updated = {
          _id: c._id,
          type,
          ...base,
          color: (c.color as string) ?? 'currentColor',
          offsetX: (c.offsetX as number) ?? 0,
          offsetY: (c.offsetY as number) ?? 0,
          radius: (c.radius as number) ?? 4,
          spread: (c.spread as number) ?? 0,
          opacity: (c.opacity as number) ?? 1,
        }
      } else if (type === 'INNER_SHADOW') {
        const c = current
        updated = {
          _id: c._id,
          type,
          ...base,
          color: (c.color as string) ?? 'rgba(0,0,0,0.6)',
          offsetX: (c.offsetX as number) ?? 1,
          offsetY: (c.offsetY as number) ?? 1,
          radius: (c.radius as number) ?? 2,
          spread: (c.spread as number) ?? 0,
          opacity: (c.opacity as number) ?? 1,
        }
      } else if (type === 'LAYER_BLUR' || type === 'BACKGROUND_BLUR') {
        updated = { _id: current._id, type, ...base, radius: current.radius ?? 4 } as EffectConfig
      } else {
        updated = { _id: current._id, type, ...base, density: 0.2, size: 2 } as EffectConfig
      }

      const next = [...effects]
      next[index] = updated
      updateSettingsWithMetadata({ effects: next }, { effectStyle: null })
    },
    [effects, updateSettingsWithMetadata]
  )

  const handleRemove = useCallback(
    (index: number) => {
      const next = effects.slice(0, index).concat(effects.slice(index + 1))
      updateSettingsWithMetadata({ effects: next }, { effectStyle: null })
    },
    [effects, updateSettingsWithMetadata]
  )

  const handleUpdateEffect = useCallback(
    (index: number, patch: Partial<EffectConfig>) => {
      const next = [...effects]
      next[index] = { ...next[index], ...patch } as EffectConfig
      updateSettingsWithMetadata({ effects: next }, { effectStyle: null })
    },
    [effects, updateSettingsWithMetadata]
  )

  const handleReorder = useCallback(
    (items: Array<{ id: string; payload: unknown }>) => {
      const next = items.map(it => it.payload as EffectConfig)
      updateSettingsWithMetadata({ effects: next }, { effectStyle: null })
    },
    [updateSettingsWithMetadata]
  )

  // ============================================================================
  // Preset Handlers
  // ============================================================================

  const sampleTextCenterColor = useCallback(() => {
    try {
      const stage = stageRef?.current
      if (!stage) return null

      const layerId = targetLayerStore.getState()._id
      const textNode = stage.findOne(`#${layerId}`)
      if (!textNode) return null

      return sampleAverageColorUnderNode(stage, textNode)
    } catch (error) {
      console.error('Error sampling text color:', error)
      return null
    }
  }, [targetLayerStore, stageRef])

  const applyEffectsPreset = useCallback(
    (preset: EffectPreset, shouldSampleColor = false) => {
      const current = targetLayerStore.getState().settings || {}
      const metadata = current.metadata || {}

      // Auto-apply color overlay only for deboss preset (not emboss)
      const shouldApplyColorOverlay = preset.id === 'deboss'

      let finalTextColor: string | null = null
      if (shouldSampleColor) {
        const sampledColor = sampleTextCenterColor()
        if (sampledColor) {
          let { r, g, b } = parseColor(sampledColor)

          if (preset.id === 'neon') {
            const lightened = lightenColorHsl(r, g, b, 0.25)
            r = lightened.r
            g = lightened.g
            b = lightened.b
          }

          // Use overlay alpha for deboss when auto-applying color overlay
          const alpha = shouldApplyColorOverlay ? DEBOSS_ALPHA_OVERLAY : (preset.textColorAlpha ?? 1)
          finalTextColor = toRgba(r, g, b, alpha)
        }
      }

      targetLayerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            settings: {
              ...current,
              effects: preset.effects,
              strokeWeight: 0,
              metadata: {
                ...metadata,
                effectStyle: preset.id,
                applyColorOverlay: shouldApplyColorOverlay,
              },
              ...(finalTextColor ? { textColor: finalTextColor, textStyle: ['bold'] } : {}),
            },
          },
        },
      })
    },
    [targetLayerStore, sampleTextCenterColor]
  )

  const handleSelectPreset = useCallback(
    (preset: EffectStyleType) => {
      const currentSettings = targetLayerStore.getState().settings || {}
      const metadata = currentSettings.metadata || {}

      if (preset === 'none') {
        const currentTextColor = currentSettings.textColor || textColor
        const { r, g, b } = parseColor(currentTextColor)

        targetLayerStore.dispatch({
          type: 'UPDATE_LAYER',
          payload: {
            state: {
              settings: {
                ...currentSettings,
                effects: [],
                strokeWeight: 0,
                textColor: toRgba(r, g, b, 1),
                metadata: {
                  ...metadata,
                  effectStyle: 'none',
                  applyColorOverlay: false,
                },
              },
            },
          },
        })
      } else if (preset === 'outline') {
        const { r, g, b, a } = parseColor(textColor)
        targetLayerStore.dispatch({
          type: 'UPDATE_LAYER',
          payload: {
            state: {
              settings: {
                ...currentSettings,
                effects: [],
                textColor: a < 1 ? toRgba(r, g, b, 1) : textColor,
                strokeWeight: strokeWeight > 0 ? strokeWeight : 2,
                strokeColor: strokeColor || 'rgb(255,255,255)',
                metadata: {
                  ...metadata,
                  effectStyle: 'outline',
                },
              },
            },
          },
        })
      } else if (preset === 'neon') {
        const currentTextColor = currentSettings.textColor || textColor
        const { r, g, b } = parseColor(currentTextColor)
        const lightened = lightenColorHsl(r, g, b, 0.15)
        const neonPreset = createNeonPreset()

        targetLayerStore.dispatch({
          type: 'UPDATE_LAYER',
          payload: {
            state: {
              settings: {
                ...currentSettings,
                effects: neonPreset.effects,
                strokeWeight: 0,
                textColor: toRgba(lightened.r, lightened.g, lightened.b, 1),
                textStyle: ['bold'],
                metadata: {
                  ...metadata,
                  effectStyle: 'neon',
                  applyColorOverlay: false,
                },
              },
            },
          },
        })
      } else if (preset === 'emboss') {
        applyEffectsPreset(createEmbossPreset(), true)
      } else if (preset === 'deboss') {
        applyEffectsPreset(createDebossPreset(), true)
      } else if (preset === 'embroidery') {
        applyEffectsPreset(createEmbroideryPreset(), false)
      }
    },
    [targetLayerStore, textColor, strokeWeight, strokeColor, applyEffectsPreset]
  )

  const handlePresetParamChange = useCallback(
    (param: 'intensity' | 'direction' | 'depth' | 'sheen', value: number) => {
      const updatedEffects = updatePresetParameter(effects, effectStyle, param, value)
      setEffects(updatedEffects)
    },
    [effects, effectStyle, setEffects]
  )

  const handleApplyColorOverlayChange = useCallback(() => {
    const currentSettings = targetLayerStore.getState().settings || {}
    const metadata = currentSettings.metadata || {}
    const currentTextColor = currentSettings.textColor || textColor
    const { r, g, b } = parseColor(currentTextColor)
    const newApplyColorOverlay = !applyColorOverlay

    let targetAlpha: number
    if (effectStyle === 'emboss') {
      targetAlpha = newApplyColorOverlay ? EMBOSS_ALPHA_OVERLAY : EMBOSS_ALPHA_DEFAULT
    } else {
      targetAlpha = newApplyColorOverlay ? DEBOSS_ALPHA_OVERLAY : DEBOSS_ALPHA_DEFAULT
    }

    targetLayerStore.dispatch({
      type: 'UPDATE_LAYER',
      payload: {
        state: {
          settings: {
            ...currentSettings,
            textColor: toRgba(r, g, b, targetAlpha),
            metadata: {
              ...metadata,
              applyColorOverlay: newApplyColorOverlay,
            },
          },
        },
      },
    })
  }, [targetLayerStore, effectStyle, textColor, applyColorOverlay])

  const handleOverlayColorChange = useCallback(
    (color: string) => {
      const currentSettings = targetLayerStore.getState().settings || {}
      const { r, g, b, a } = parseColor(color)

      targetLayerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            settings: {
              ...currentSettings,
              textColor: toRgba(r, g, b, a),
            },
          },
        },
      })
    },
    [targetLayerStore]
  )

  const handleNeonColorChange = useCallback(
    (color: string) => {
      setSetting('textColor', color)
    },
    [setSetting]
  )

  const handleStrokeWeightChange = useCallback(
    (weight: number) => {
      setSetting('strokeWeight', weight)
    },
    [setSetting]
  )

  const handleStrokeColorChange = useCallback(
    (color: string) => {
      const currentSettings = targetLayerStore.getState().settings || {}
      const currentStrokeWeight = currentSettings?.strokeWeight || 0

      // Auto-set strokeWeight to 1 if it's 0 so user can see the stroke
      if (currentStrokeWeight === 0) {
        targetLayerStore.dispatch({
          type: 'UPDATE_LAYER',
          payload: {
            state: {
              settings: {
                ...currentSettings,
                strokeColor: color,
                strokeWeight: 1,
              },
            },
          },
        })
      } else {
        setSetting('strokeColor', color)
      }
    },
    [targetLayerStore, setSetting]
  )

  // Paint-based stroke change handler
  // Writes to strokes array (new format) and also updates legacy strokeColor for compatibility
  const handleStrokePaintChange = useCallback(
    (paint: Paint) => {
      const currentSettings = targetLayerStore.getState().settings || {}
      const currentStrokeWeight = currentSettings?.strokeWeight || 0

      // Build update object
      const update: Record<string, unknown> = {
        strokes: [paint],
      }

      // Auto-set strokeWeight to 1 if it's 0 so user can see the stroke
      if (currentStrokeWeight === 0) {
        update.strokeWeight = 1
      }

      // Also update legacy strokeColor for backward compatibility (if solid paint)
      if (isSolidPaint(paint)) {
        update.strokeColor = paint.color
      }

      targetLayerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            settings: {
              ...currentSettings,
              ...update,
            },
          },
        },
      })
    },
    [targetLayerStore]
  )

  const handleEdgeStyleChange = useCallback(
    (newEdgeStyle: EdgeStyleType) => {
      const updatedEffects = updateEdgeStyle(effects, newEdgeStyle, effectStyle)
      updateSettingsWithMetadata({ effects: updatedEffects }, { edgeStyle: newEdgeStyle })
    },
    [effects, effectStyle, updateSettingsWithMetadata]
  )

  const handleFillChange = useCallback(
    (newFill: Paint) => {
      // Write to fills array (consistent with renderer and FillPanel)
      setSetting('fills', [newFill])
    },
    [setSetting]
  )

  // ============================================================================
  // Computed Values
  // ============================================================================

  const neonIntensity = useMemo(() => getNeonIntensity(effects), [effects])
  const embossDirection = useMemo(() => getEmbossDirection(effects), [effects])
  const embossDepth = useMemo(() => getEmbossDepth(effects, effectStyle), [effects, effectStyle])
  const edgeStyle = useMemo(() => getEdgeStyle(effects, effectStyle), [effects, effectStyle])

  // Embroidery computed values
  const embroiderySheen = useMemo(() => getEmbroiderySheen(effects), [effects])
  const embroideryDepth = useMemo(() => getEmbroideryDepth(effects), [effects])
  const embroideryDirection = useMemo(() => getEmbroideryDirection(effects), [effects])

  return {
    // State
    effects,
    effectStyle,
    textColor,
    fontSize,
    strokeWeight,
    strokeColor,
    strokePaint,
    applyColorOverlay,
    fill,

    // UI State
    settingsOpen,
    showAdvanced,
    toggleSettingsOpen,
    closeSettings,
    setShowAdvanced,

    // Effect handlers
    handleAddEffect,
    handleToggleVisible,
    handleChangeType,
    handleRemove,
    handleUpdateEffect,
    handleReorder,

    // Preset handlers
    handleSelectPreset,
    handlePresetParamChange,
    handleApplyColorOverlayChange,
    handleOverlayColorChange,
    handleNeonColorChange,
    handleStrokeWeightChange,
    handleStrokeColorChange,
    handleStrokePaintChange,
    handleEdgeStyleChange,
    handleFillChange,

    // Computed values
    neonIntensity,
    embossDirection,
    embossDepth,
    edgeStyle,
    embroiderySheen,
    embroideryDepth,
    embroideryDirection,
  }
}
