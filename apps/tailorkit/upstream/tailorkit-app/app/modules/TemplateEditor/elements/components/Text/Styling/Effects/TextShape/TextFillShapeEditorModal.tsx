import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { MODAL_ID } from '~/constants/modal'
import { useStore } from '~/libs/external-store'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '~/modules/TemplateEditor/constants'
import VectorEditor from '~/modules/VectorEditor'
import { decodeSvgDataUri } from '~/modules/VectorEditor/utils/svg/pathParsing'
import type { TLayerStore } from '~/stores/modules/layer'
import type { TextSettings } from '~/types/psd'
import { useModal } from '~/utils/hooks/useModal'
import {
  extractFirstPathData,
  extractViewBoxDimensions,
} from '~/components/canvas/elements/Text/utils/scaleCustomPathToFit'
import {
  autoClosePath,
  DEFAULT_FILL_SHAPE_VALUES,
} from 'extensions/tailorkit-src/src/shared/libraries/svg/svg-envelope-boundary'

interface TextFillShapeEditorModalProps {
  layerStore: TLayerStore
}

function svgToDataUri(svgString: string): string {
  const encoded = encodeURIComponent(svgString).replace(/'/g, '%27').replace(/"/g, '%22')
  return `data:image/svg+xml,${encoded}`
}

// Individual selectors for stable references
const selectWidth = (state: ReturnType<TLayerStore['getState']>) => state.width || 300
const selectHeight = (state: ReturnType<TLayerStore['getState']>) => state.height || 100
const selectEditableSvg = (state: ReturnType<TLayerStore['getState']>) =>
  (state.settings as TextSettings | undefined)?.fillShapeMetadata?.editableSvg

function TextFillShapeEditorModalInner({
  layerStore,
  isOpen,
  onClose,
}: {
  layerStore: TLayerStore
  isOpen: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()

  // Get layer dimensions for initial VectorEditor viewport
  const layerWidth = useStore(layerStore, selectWidth)
  const layerHeight = useStore(layerStore, selectHeight)

  // Get existing editable SVG from layer store
  const editableSvg = useStore(layerStore, selectEditableSvg)

  // Memoize initial dimensions
  const initialDimensions = useMemo(() => ({ width: layerWidth, height: layerHeight }), [layerWidth, layerHeight])

  // Get existing editable SVG for resuming editing
  const existingEditableSvg = useMemo(() => {
    if (!editableSvg) return undefined
    return svgToDataUri(editableSvg)
  }, [editableSvg])

  // Handle save from VectorEditor
  const handleSave = useCallback(
    (svgDataUri: string, dimensions?: { width: number; height: number }) => {
      try {
        // Decode the SVG
        const svgString = decodeSvgDataUri(svgDataUri)

        // Extract path data and viewBox dimensions
        let pathData = extractFirstPathData(svgString)
        const viewBoxDimensions = extractViewBoxDimensions(svgString)

        if (!pathData) {
          console.warn('No path found in VectorEditor output')
          onClose()
          return
        }

        // Auto-close the path if not already closed
        pathData = autoClosePath(pathData)

        // Update the SVG string with the closed path
        const closedSvgString = svgString.replace(/<path([^>]*d=)"([^"]*)"([^>]*)\/>/i, `<path$1"${pathData}"$3/>`)

        const currentState = layerStore.getState()
        const currentSettings = currentState.settings as TextSettings | undefined

        // Use default values for all shapes
        const presetValues = DEFAULT_FILL_SHAPE_VALUES

        // Get the final viewport dimensions from VectorEditor
        const finalWidth = viewBoxDimensions?.viewBoxWidth || dimensions?.width || layerWidth
        const finalHeight = viewBoxDimensions?.viewBoxHeight || dimensions?.height || layerHeight

        // Calculate position adjustment to keep the layer centered
        const currentX = currentState.left || 0
        const currentY = currentState.top || 0
        const currentWidth = currentState.width || layerWidth
        const currentHeight = currentState.height || layerHeight

        // Center the resized layer on the original position
        const newX = currentX + (currentWidth - finalWidth) / 2
        const newY = currentY + (currentHeight - finalHeight) / 2

        // Update layer with fill shape data and resize to match viewport
        // Auto-apply preset parameter values based on shape type
        layerStore.dispatch({
          type: 'UPDATE_LAYER',
          payload: {
            state: {
              // Resize layer to match VectorEditor viewport
              width: finalWidth,
              height: finalHeight,
              left: newX,
              top: newY,
              settings: {
                ...currentSettings,
                textShape: 'fill-shape',
                fillShapePathData: pathData,
                fillShapeMetadata: {
                  viewBoxWidth: finalWidth,
                  viewBoxHeight: finalHeight,
                  editableSvg: closedSvgString,
                },
                // Apply preset values based on shape type, or reset to defaults for other shapes
                fillShapeVerticalOffset: presetValues.verticalOffset,
                fillShapeVerticalScale: presetValues.verticalScale,
                fillShapeHorizontalOffset: presetValues.horizontalOffset,
                fillShapeHorizontalScale: presetValues.horizontalScale,
                fillShapeCharacterSpacing: presetValues.characterSpacing,
              },
            },
          },
        })

        // Update transformer after resize
        Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.HIDE_TRANSFORMER)
        requestAnimationFrame(() => {
          Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER)
        })

        onClose()
      } catch (error) {
        console.error('Failed to process VectorEditor output:', error)
        onClose()
      }
    },
    [layerStore, onClose, layerWidth, layerHeight]
  )

  return (
    <VectorEditor
      isModal={true}
      modalOpen={isOpen}
      modalTitle={t('draw-fill-shape')}
      onModalClose={onClose}
      onSave={handleSave}
      svgDataUri={existingEditableSvg}
      allowBlankCanvas={true}
      initialDimensions={initialDimensions}
    />
  )
}

/**
 * Modal for drawing fill shapes using VectorEditor
 * Opens in blank canvas mode sized to the text layer dimensions
 * Auto-closes paths and saves to fillShapePathData
 */
export function TextFillShapeEditorModal({ layerStore }: TextFillShapeEditorModalProps) {
  const { state, closeModal } = useModal()

  const isOpen = Boolean(state[MODAL_ID.TEXT_FILL_SHAPE_EDITOR_MODAL]?.active)

  const handleClose = useCallback(() => {
    closeModal(MODAL_ID.TEXT_FILL_SHAPE_EDITOR_MODAL)
  }, [closeModal])

  // Don't render if not open or no layer store
  if (!isOpen || !layerStore) return null

  return <TextFillShapeEditorModalInner layerStore={layerStore} isOpen={isOpen} onClose={handleClose} />
}
