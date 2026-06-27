import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BlockStack, Button, Checkbox, Divider, Icon, InlineStack, Popover, RadioButton, Text } from '@shopify/polaris'
import { ZONE_STROKE_COLOR } from 'extensions/tailorkit-src/src/shared/constants/movement-zone'
import type { TextSettings, MovementBounds, MovementZoneType } from '~/types/psd'
import PopoverAIContentGenerator from '~/components/AITextField/PopoverAIContentGenerator'
import { MagicIcon } from '@shopify/polaris-icons'
// Using shared web component for input rendering
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useLocation } from '@remix-run/react'
import { useStore } from '~/libs/external-store'
import type { TLayerStore } from '~/stores/modules/layer'
import { useTranslation } from 'react-i18next'
import { MODAL_ID } from '~/constants/modal'
import { useModal } from '~/utils/hooks/useModal'
import VectorEditor from '~/modules/VectorEditor'
import { decodeSvgDataUri } from '~/modules/VectorEditor/utils/svg/pathParsing'
import { extractFirstPathData } from '~/components/canvas/elements/Text/utils/scaleCustomPathToFit'
import { TemplateEditorStore } from '~/stores/modules/template'
import { lengthUnitToPixels } from '~/utils/lengthUnitToPixels'
import { prepareStageForExport } from '~/modules/TemplateEditor/utilities/canvas'
import InlineImageBrowser from '~/modules/VectorEditor/components/EditorSidebar/InlineImageBrowser'
import {
  translateSvgPath,
  computeSvgPathBoundingBox,
} from '~/components/canvas/elements/Text/utils/movement-zone-path-transform.client'
import { showToast } from '~/utils/toastEvents'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'

const selectEmojiPicker = (state: ReturnType<TLayerStore['getState']>) =>
  (state.settings as TextSettings | undefined)?.emojiPicker

export const TextCreatedByCustomers = (props: {
  settings: TextSettings & { storefrontOptionSetLabels: { text_customer?: string } }
  value?: string
  onChange: (value: string) => void
  layerStore: TLayerStore
  /** Resolved font for the input preview (font option selection > layer default) */
  previewFont?: { family: string; src: string }
}) => {
  const { settings, value = '', onChange, layerStore, previewFont } = props
  const fieldsetRef = useRef<HTMLFieldSetElement>(null)
  const layerId = useStore(layerStore, state => state._id)
  // Subscribe directly to store so nested emojiPicker changes trigger re-render
  // (shallow prop diff from parent would miss nested mutations)
  const emojiPickerFromStore = useStore(layerStore, selectEmojiPicker)
  const {
    storefrontLabel: baseStorefrontLabel,
    storefrontOptionSetLabels,
    characterLimit = 20,
    notesForCustomers,
    generateTextWithAI = {},
    required,
    placeholder,
    allowMultiLineText = false,
  } = settings || {}
  // Prefer the resolved preview font (reflects font option set selection); fall back to layer default
  const inputFont = previewFont ?? settings?.fontFamily
  const emojiPicker = emojiPickerFromStore ?? settings?.emojiPicker
  const { allow: allowGenerateTextWithAI } = generateTextWithAI || { allow: false }

  // Use storefrontOptionSetLabels['text_customer'] to match option sets behavior (with postfix)
  // Fallback to storefrontLabel for backward compatibility with old templates
  const storefrontLabel = storefrontOptionSetLabels?.['text_customer'] || baseStorefrontLabel

  // Bridge web component event to React handler
  useEffect(() => {
    const fieldset = fieldsetRef.current
    if (!fieldset) return
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ value: string }>
      if (custom?.detail?.value !== undefined) {
        onChange(custom.detail.value)
      }
    }
    fieldset.addEventListener('emtlkit:textChanged', handler as EventListener)
    return () => fieldset.removeEventListener('emtlkit:textChanged', handler as EventListener)
  }, [onChange])

  const renderLabel = (
    <div
      className="emtlkit--d-flex emtlkit--flex-center emtlkit--flex-space-between"
      style={{ width: '100%', marginBottom: 4 }}
    >
      <label
        htmlFor=""
        className={`emtlkit--option-set-label ${required ? 'emtlkit--required-indicator' : ''}`}
        style={{ marginBottom: '0' }}
        data-label={storefrontLabel}
      >
        {storefrontLabel}
      </label>
      {allowGenerateTextWithAI && <MagicIconWithPopover settings={settings} onChange={onChange} />}
    </div>
  )

  return (
    <div className="emtlkit--option-set-container" data-item-id={`${layerId}::text_customer`}>
      <fieldset ref={fieldsetRef} className="emtlkit--option-set" data-layer-id={layerId}>
        {renderLabel}
        {React.createElement('tailorkit-text-customer-input', {
          value: value,
          'data-character-limit': String(characterLimit),
          'data-placeholder': placeholder || 'Input your text',
          'data-allow-multiline': allowMultiLineText ? 'true' : 'false',
          ...(inputFont?.family
            ? {
                'data-font-family': inputFont.family,
                'data-font-src': inputFont.src || '',
              }
            : {}),
          ...(emojiPicker?.enabled && emojiPicker?.emojis
            ? {
                'data-emoji-picker': emojiPicker.emojis,
                ...(emojiPicker.font
                  ? {
                      'data-emoji-font-family': emojiPicker.font.family,
                      'data-emoji-font-src': emojiPicker.font.src,
                    }
                  : {}),
              }
            : {}),
        })}

        <span className="emtlkit--input-note">{notesForCustomers}</span>
      </fieldset>
    </div>
  )
}

const MagicIconWithPopover = (props: { settings: TextSettings; onChange: (value: string) => void }) => {
  const { settings, onChange } = props
  const { storefrontLabel, characterLimit } = settings
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

  const { trackEvent } = useEventsTracking()
  const location = useLocation()
  const isTemplatePreview = location.pathname.includes('templates')

  const togglePopoverOpen = useCallback(() => {
    setIsPopoverOpen(!isPopoverOpen)

    if (!isPopoverOpen) {
      trackEvent(EVENTS_TRACKING.AI_GENERATE_TEXT, {
        [EVENTS_PARAMETERS_NAME.AI_GENERATE_FROM]: isTemplatePreview ? 'template_preview' : 'onboarding',
      })
    }
  }, [isPopoverOpen, trackEvent, isTemplatePreview])

  return (
    <Popover
      active={isPopoverOpen}
      onClose={togglePopoverOpen}
      activator={
        <div onClick={togglePopoverOpen} className="emtlkit--success-icon emtlkit--d-flex emtlkit--flex-center">
          <Icon source={MagicIcon} tone="success" />
        </div>
      }
      preferredPosition="below"
      zIndexOverride={1000}
    >
      <PopoverAIContentGenerator
        title={'Generate text with AI'}
        value={storefrontLabel}
        mainTextLabel={'What is this text about?'}
        optionalTextLabel={'Special instructions (optional)'}
        maxContentLength={characterLimit}
        showInstruction={false}
        onSelectOptionAfterGenerating={(options: string[]) => {
          onChange(options[0])
        }}
        onTogglePopoverActive={togglePopoverOpen}
      />
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// Admin-side Buyer Interaction inspector section
// ---------------------------------------------------------------------------

/** Max guide image resolution to avoid multi-MB data URLs that lag the editor */
const MAX_GUIDE_PX = 1200

const selectShapeSettings = (state: ReturnType<TLayerStore['getState']>) => state.shapeSettings
const selectLayerLeft = (state: ReturnType<TLayerStore['getState']>) => state.left ?? 0
const selectLayerTop = (state: ReturnType<TLayerStore['getState']>) => state.top ?? 0
const selectLayerWidth = (state: ReturnType<TLayerStore['getState']>) => state.width ?? 100
const selectLayerHeight = (state: ReturnType<TLayerStore['getState']>) => state.height ?? 50

function svgToDataUri(svgString: string): string {
  const encoded = encodeURIComponent(svgString).replace(/'/g, '%27').replace(/"/g, '%22')
  return `data:image/svg+xml,${encoded}`
}

/**
 * Inner component for the Movement Zone VectorEditor modal.
 * Opened when the user clicks "Edit Path" in the Buyer Interaction section.
 *
 * Fixes:
 * - Canvas sized to full template dimensions (not zone dims) so merchant draws at correct scale
 * - Existing pathData translated to template coords and shown immediately (no blank canvas)
 * - Reference image selected in BuyerInteractionSection passed via modal state as background
 */
function MovementZoneEditorModalInner({
  layerStore,
  isOpen,
  onClose,
}: {
  layerStore: TLayerStore
  isOpen: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()

  const shapeSettings = useStore(layerStore, selectShapeSettings)

  const templateDimension = useStore(TemplateEditorStore, s => s.dimension)

  // Canvas must match template pixel dimensions so drawn coords align with admin canvas
  const templatePixelDims = useMemo(() => {
    const w = lengthUnitToPixels(
      templateDimension.width,
      templateDimension.measurementUnit,
      templateDimension.resolution
    )
    const h = lengthUnitToPixels(
      templateDimension.height,
      templateDimension.measurementUnit,
      templateDimension.resolution
    )
    return { width: w, height: h }
  }, [templateDimension])

  // Guide image state — lives here because it's an editor tool, not a configuration setting
  const [guideImageUrl, setGuideImageUrl] = useState<string | undefined>(undefined)

  // Capture the template editor's canvas as a guide image
  const stageRef = useStore(TemplateEditorStore, s => s.stageRef)
  const handleCaptureCanvas = useCallback(() => {
    if (!stageRef?.current) return
    try {
      const { width, height } = templatePixelDims
      // IMPORTANT: clone at FULL template dimensions (not downscaled) and use pixelRatio
      // to downscale on output. This ensures the guide image covers the entire template
      // (not just the top-left crop) and guide image pixels map correctly to template coords.
      const downscale = Math.min(1, MAX_GUIDE_PX / Math.max(width, height))
      const { clonedStage } = prepareStageForExport(stageRef.current, width, height, true)
      const dataUrl = clonedStage.toDataURL({ pixelRatio: downscale })
      clonedStage.destroy()
      setGuideImageUrl(dataUrl)
    } catch (err) {
      console.error('[GuideImage] Canvas capture failed:', err)
    }
  }, [stageRef, templatePixelDims])

  // Auto-capture canvas snapshot when modal opens so merchant sees template context immediately
  useEffect(() => {
    if (isOpen) handleCaptureCanvas()
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Inline image browser rendered directly in the sidebar (no modal)
  const imageBrowser = useMemo(() => <InlineImageBrowser onSelectImage={(url: string) => setGuideImageUrl(url)} />, [])

  // Build SVG data URI for VectorEditor.
  // IMPORTANT: Only put ONE path in the SVG — extractFirstPathData on save extracts the
  // FIRST path from VectorEditor's output. If we include a hint rect here, the hint rect
  // becomes the first path and extractFirstPathData picks it instead of the drawn polygon.
  //
  // Strategy:
  //   - Existing pathData: translate zone-local → template coords and load in editor
  //   - No pathData: pass undefined → VectorEditor starts blank (user draws from scratch)
  const svgDataUri = useMemo(() => {
    const { width: tw, height: th } = templatePixelDims
    const bounds = shapeSettings?.movementBounds

    if (bounds?.pathData && bounds.pathViewBox) {
      // Re-editing: translate zone-local → template coords so path appears at correct position
      const translatedPath = translateSvgPath(bounds.pathData, bounds.x ?? 0, bounds.y ?? 0)
      const strokeW = (Math.max(tw, th) * 0.002).toFixed(2)
      const svg
        = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tw} ${th}" width="${tw}" height="${th}">`
        + `<path d="${translatedPath}" fill="none" stroke="${ZONE_STROKE_COLOR}" stroke-width="${strokeW}"/></svg>`
      return svgToDataUri(svg)
    }

    // First time: no SVG — VectorEditor starts with blank canvas.
    // Merchant uses floating "Add background image" button to select a reference image.
    return undefined
  }, [shapeSettings?.movementBounds, templatePixelDims])

  const handleSave = useCallback(
    (savedSvgDataUri: string) => {
      try {
        const svgString = decodeSvgDataUri(savedSvgDataUri)
        // Count total <path> elements to detect if VectorEditor added extra paths
        const allPathMatches = svgString.match(/<path[^>]*d="[^"]*"/gi) || []
        const pathData = extractFirstPathData(svgString)

        if (!pathData) {
          console.warn(
            '[ZoneSave] extractFirstPathData returned null — no <path d="..."> found in SVG. Total paths:',
            allPathMatches.length
          )
          onClose()
          return
        }

        // Compute bbox in template coords to derive zone position + size
        const bbox = computeSvgPathBoundingBox(pathData)
        if (!bbox || bbox.width < 1 || bbox.height < 1) {
          console.warn('[ZoneSave] bbox invalid, aborting', bbox)
          onClose()
          return
        }

        // Convert path from template coords → zone-local (0,0 = top-left of bbox)
        const zoneLocalPath = translateSvgPath(pathData, -bbox.x, -bbox.y)

        const currentLayerState = layerStore.getState()
        const ss = currentLayerState.shapeSettings || {}

        // Position text inside the new zone.
        // Zone Group is at (bounds.x, bounds.y); Translation Group cancels it with (-bounds.x, -bounds.y)
        // so TextRendererDirect uses canvas coords (state.left, state.top) directly.
        //
        // state.left/top = TOP-LEFT corner of the text layer in canvas coords.
        // To visually CENTER text in the bbox we must subtract half the layer's own dimensions:
        //   centerX = bbox.x + bbox.width/2
        //   left    = centerX - layerWidth/2   ← top-left lands at (centerX - halfW)
        //
        // ALWAYS center in new bbox — NEVER preserve old offsets.
        // Reason: old offsets from a different zone shape are in wrong coordinate space.
        // Bbox center is guaranteed inside any convex polygon.
        // Merchant repositions text via double-click content mode after zone is drawn.
        const layerWidth = currentLayerState.width || 0
        const layerHeight = currentLayerState.height || 0
        const newLeft = bbox.x + bbox.width / 2 - layerWidth / 2
        const newTop = bbox.y + bbox.height / 2 - layerHeight / 2

        const dispatchPayload = {
          left: newLeft,
          top: newTop,
          shapeSettings: {
            ...ss,
            movementBounds: {
              ...(ss.movementBounds || {}),
              type: 'path' as MovementZoneType,
              x: bbox.x,
              y: bbox.y,
              width: bbox.width,
              height: bbox.height,
              pathData: zoneLocalPath,
              pathViewBox: { width: bbox.width, height: bbox.height },
            },
            // Reset offset relative to new zone origin
            defaultOffsetX: newLeft - bbox.x,
            defaultOffsetY: newTop - bbox.y,
            // No longer storing editable SVG separately — pathData + translateSvgPath handles display
            movementBoundsEditableSvg: undefined,
          },
        }
        layerStore.dispatch({
          type: 'UPDATE_LAYER',
          payload: { state: dispatchPayload },
        })

        onClose()
      } catch (err) {
        console.error('Failed to save movement zone path:', err)
        showToast(t('failed-to-save-movement-zone-please-try-again'), { isError: true })
      }
    },
    [layerStore, onClose, t]
  )

  return (
    <VectorEditor
      isModal={true}
      modalOpen={isOpen}
      modalTitle={t('draw-movement-zone-path')}
      onModalClose={onClose}
      onSave={handleSave}
      rasterImageUrl={guideImageUrl}
      guideImageProps={{
        imageUrl: guideImageUrl,
        onCaptureCanvas: handleCaptureCanvas,
        onRemoveImage: () => setGuideImageUrl(undefined),
        imageBrowser,
      }}
      svgDataUri={svgDataUri}
      allowBlankCanvas={true}
      initialDimensions={templatePixelDims}
    />
  )
}

/**
 * Movement Zone VectorEditor modal.
 * Controlled by MODAL_ID.MOVEMENT_ZONE_EDITOR_MODAL.
 */
export function MovementZoneEditorModal({ layerStore }: { layerStore: TLayerStore }) {
  const { state, closeModal } = useModal()
  const isOpen = Boolean(state[MODAL_ID.MOVEMENT_ZONE_EDITOR_MODAL]?.active)

  const handleClose = useCallback(() => {
    closeModal(MODAL_ID.MOVEMENT_ZONE_EDITOR_MODAL)
  }, [closeModal])

  useEffect(() => {
    return () => {
      closeModal(MODAL_ID.MOVEMENT_ZONE_EDITOR_MODAL)
    }
  }, [closeModal])

  if (!isOpen || !layerStore) return null

  return <MovementZoneEditorModalInner layerStore={layerStore} isOpen={isOpen} onClose={handleClose} />
}

/**
 * Admin-side "Buyer Interaction" section for text layers where textCreatedBy === 'customers'.
 *
 * Controls:
 * - movable / resizable / rotatable toggles
 * - When movable: zone shape selector (rectangle | ellipse | path)
 * - Zone X / Y / W / H numeric inputs (fallback inspector)
 * - "Edit Path" button that opens MovementZoneEditorModal (Custom Path only)
 */
export function BuyerInteractionSection({ layerStore }: { layerStore: TLayerStore }) {
  const { t } = useTranslation()
  const { openModal } = useModal()
  const { trackAction } = useFeatureTracking('buyer_text_movement_zone')

  const shapeSettings = useStore(layerStore, selectShapeSettings)
  const layerLeft = useStore(layerStore, selectLayerLeft)
  const layerTop = useStore(layerStore, selectLayerTop)
  const layerWidth = useStore(layerStore, selectLayerWidth)
  const layerHeight = useStore(layerStore, selectLayerHeight)

  const movable = shapeSettings?.movable ?? false
  const resizable = shapeSettings?.resizable ?? false
  const rotatable = shapeSettings?.rotatable ?? false
  const movementBounds: MovementBounds | undefined = shapeSettings?.movementBounds
  const isZoneMode = Boolean(shapeSettings?.movementBounds)
  const zoneType: MovementZoneType = movementBounds?.type ?? 'rectangle'

  const handleToggleMovable = useCallback(() => {
    const currentState = layerStore.getState()
    const nextMovable = !movable
    if (nextMovable) trackAction('enabled_movable')
    layerStore.dispatch({
      type: 'UPDATE_LAYER',
      payload: {
        state: {
          shapeSettings: {
            ...(currentState.shapeSettings || {}),
            movable: nextMovable,
          },
        },
      },
    })
  }, [layerStore, movable, trackAction])

  const handleMovementModeChange = useCallback(
    (mode: 'free' | 'zone') => {
      trackAction('selected_movement_mode', { mode })
      const currentState = layerStore.getState()
      if (mode === 'zone') {
        // Auto-initialize movement bounds centered around the layer
        const zoneX = Math.max(0, (currentState.left ?? 0) - 20)
        const zoneY = Math.max(0, (currentState.top ?? 0) - 20)
        layerStore.dispatch({
          type: 'UPDATE_LAYER',
          payload: {
            state: {
              shapeSettings: {
                ...(currentState.shapeSettings || {}),
                movementBounds: {
                  type: 'rectangle' as MovementZoneType,
                  x: zoneX,
                  y: zoneY,
                  width: (currentState.width ?? 100) + 40,
                  height: (currentState.height ?? 50) + 40,
                },
                defaultOffsetX: (currentState.left ?? 0) - zoneX,
                defaultOffsetY: (currentState.top ?? 0) - zoneY,
              },
            },
          },
        })
      } else {
        // Clear movement bounds (free movement)
        layerStore.dispatch({
          type: 'UPDATE_LAYER',
          payload: {
            state: {
              shapeSettings: {
                ...(currentState.shapeSettings || {}),
                movementBounds: undefined,
                defaultOffsetX: undefined,
                defaultOffsetY: undefined,
              },
            },
          },
        })
      }
    },
    [layerStore, trackAction]
  )

  const handleToggleResizable = useCallback(() => {
    const currentState = layerStore.getState()
    const nextResizable = !resizable
    if (nextResizable) trackAction('enabled_resizable')
    layerStore.dispatch({
      type: 'UPDATE_LAYER',
      payload: {
        state: {
          shapeSettings: {
            ...(currentState.shapeSettings || {}),
            resizable: nextResizable,
          },
        },
      },
    })
  }, [layerStore, resizable, trackAction])

  const handleToggleRotatable = useCallback(() => {
    const currentState = layerStore.getState()
    const nextRotatable = !rotatable
    if (nextRotatable) trackAction('enabled_rotatable')
    layerStore.dispatch({
      type: 'UPDATE_LAYER',
      payload: {
        state: {
          shapeSettings: {
            ...(currentState.shapeSettings || {}),
            rotatable: nextRotatable,
          },
        },
      },
    })
  }, [layerStore, rotatable, trackAction])

  const handleZoneTypeChange = useCallback(
    (type: MovementZoneType) => {
      trackAction('selected_zone_shape', { zone_shape: type })
      const currentState = layerStore.getState()
      const existing = currentState.shapeSettings?.movementBounds
      layerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            shapeSettings: {
              ...(currentState.shapeSettings || {}),
              movementBounds: {
                ...(existing || {
                  x: Math.max(0, layerLeft - 20),
                  y: Math.max(0, layerTop - 20),
                  width: layerWidth + 40,
                  height: layerHeight + 40,
                }),
                type,
              },
            },
          },
        },
      })
    },
    [layerStore, layerLeft, layerTop, layerWidth, layerHeight, trackAction]
  )

  const handleOpenPathEditor = useCallback(() => {
    trackAction('opened_path_editor')
    openModal(MODAL_ID.MOVEMENT_ZONE_EDITOR_MODAL)
  }, [openModal, trackAction])

  return (
    <BlockStack gap="300">
      <Divider />
      <Text as="h3" variant="headingSm">
        {t('buyer-interaction')}
      </Text>
      <BlockStack gap="200">
        <Checkbox label={t('allow-buyer-to-move-text')} checked={movable} onChange={handleToggleMovable} />
        <Checkbox label={t('allow-buyer-to-resize-text')} checked={resizable} onChange={handleToggleResizable} />
        <Checkbox label={t('allow-buyer-to-rotate-text')} checked={rotatable} onChange={handleToggleRotatable} />
      </BlockStack>

      {movable && (
        <BlockStack gap="200">
          <Text as="span" variant="bodyMd">
            {t('movement-mode')}
          </Text>
          <InlineStack gap="300">
            <RadioButton
              label={t('free-movement')}
              helpText={t('buyer-can-drag-anywhere-on-canvas')}
              checked={!isZoneMode}
              id="movement-mode-free"
              name="movement-mode"
              onChange={() => handleMovementModeChange('free')}
            />
            <RadioButton
              label={t('within-zone')}
              helpText={t('buyer-can-only-drag-within-a-defined-area')}
              checked={isZoneMode}
              id="movement-mode-zone"
              name="movement-mode"
              onChange={() => handleMovementModeChange('zone')}
            />
          </InlineStack>
        </BlockStack>
      )}

      {isZoneMode && movable && (
        <BlockStack gap="300">
          <BlockStack gap="100">
            <Text as="span" variant="bodyMd">
              {t('zone-shape')}
            </Text>
            <InlineStack gap="300">
              <RadioButton
                label={t('rectangle')}
                checked={zoneType === 'rectangle'}
                id="zone-type-rectangle"
                name="zone-type"
                onChange={() => handleZoneTypeChange('rectangle')}
              />
              <RadioButton
                label={t('ellipse')}
                checked={zoneType === 'ellipse'}
                id="zone-type-ellipse"
                name="zone-type"
                onChange={() => handleZoneTypeChange('ellipse')}
              />
              <RadioButton
                label={t('custom-path')}
                checked={zoneType === 'path'}
                id="zone-type-path"
                name="zone-type"
                onChange={() => handleZoneTypeChange('path')}
              />
            </InlineStack>
          </BlockStack>

          {zoneType === 'path' && (
            <Button onClick={handleOpenPathEditor} variant="secondary">
              {t('edit-path')}
            </Button>
          )}
        </BlockStack>
      )}

      <MovementZoneEditorModal layerStore={layerStore} />
    </BlockStack>
  )
}
