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

interface TextPathEditorModalProps {
  layerStore: TLayerStore
}

function svgToDataUri(svgString: string): string {
  const encoded = encodeURIComponent(svgString).replace(/'/g, '%27').replace(/"/g, '%22')
  return `data:image/svg+xml,${encoded}`
}

/**
 * Inner component that handles the VectorEditor integration
 */
// Individual selectors for stable references (Object.is comparison in useStore)
const selectWidth = (state: ReturnType<TLayerStore['getState']>) => state.width || 300
const selectHeight = (state: ReturnType<TLayerStore['getState']>) => state.height || 100
const selectEditableSvg = (state: ReturnType<TLayerStore['getState']>) =>
  (state.settings as TextSettings | undefined)?.customPathMetadata?.editableSvg

function TextPathEditorModalInner({
  layerStore,
  isOpen,
  onClose,
}: {
  layerStore: TLayerStore
  isOpen: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()

  // Get layer dimensions for initial VectorEditor viewport (user can resize)
  const layerWidth = useStore(layerStore, selectWidth)
  const layerHeight = useStore(layerStore, selectHeight)

  // Get existing editable SVG from layer store
  const editableSvg = useStore(layerStore, selectEditableSvg)

  // Memoize initial dimensions using layer size (user can resize in VectorEditor)
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
        const pathData = extractFirstPathData(svgString)
        const viewBoxDimensions = extractViewBoxDimensions(svgString)

        if (!pathData) {
          console.warn('No path found in VectorEditor output')
          onClose()
          return
        }

        const currentState = layerStore.getState()
        const currentSettings = currentState.settings as TextSettings | undefined

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

        // Update layer with custom path data and resize to match viewport
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
                textShape: 'custom',
                customPathData: pathData,
                customPathMetadata: {
                  viewBoxWidth: finalWidth,
                  viewBoxHeight: finalHeight,
                  editableSvg: svgString,
                },
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
      modalTitle={t('draw-text-path')}
      onModalClose={onClose}
      onSave={handleSave}
      svgDataUri={existingEditableSvg}
      allowBlankCanvas={true}
      initialDimensions={initialDimensions}
    />
  )
}

/**
 * Modal for drawing custom text paths using VectorEditor
 * Opens in blank canvas mode sized to the text layer dimensions
 * On save, auto-resizes the text layer to match the VectorEditor viewport
 */
export function TextPathEditorModal({ layerStore }: TextPathEditorModalProps) {
  const { state, closeModal } = useModal()

  const isOpen = Boolean(state[MODAL_ID.TEXT_PATH_EDITOR_MODAL]?.active)

  const handleClose = useCallback(() => {
    closeModal(MODAL_ID.TEXT_PATH_EDITOR_MODAL)
  }, [closeModal])

  // Don't render if not open or no layer store
  if (!isOpen || !layerStore) return null

  return <TextPathEditorModalInner layerStore={layerStore} isOpen={isOpen} onClose={handleClose} />
}
