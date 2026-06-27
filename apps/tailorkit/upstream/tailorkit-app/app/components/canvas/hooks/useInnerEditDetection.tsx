import { useState, useEffect, useRef } from 'react'
import type Konva from 'konva'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '~/modules/TemplateEditor/constants'
import { useStore } from '~/libs/external-store'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { INNER_EDIT_NODE_NAME } from '~/constants/canvas'

/**
 * Hook to detect if any transformer is currently bound to an inner-edit-node
 * This provides per-layer detection instead of global state
 */
export function useInnerEditDetection(transformerRef: React.RefObject<Konva.Transformer | null>) {
  const [isInnerEditMode, setIsInnerEditMode] = useState(false)
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Listen to selection changes directly from the store
  const clickedLayerStore = useStore(LayerStoreSelection, state => state.clickedLayerStore)

  useEffect(() => {
    function checkInnerEditMode() {
      // Clear any pending check
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current)
      }

      // Schedule check after transformer updates
      checkTimeoutRef.current = setTimeout(() => {
        if (!transformerRef.current) {
          setIsInnerEditMode(false)
          return
        }

        const transformer = transformerRef.current
        const nodes = transformer.nodes()

        // If no nodes are bound to transformer, definitely not in inner edit mode
        if (!nodes || nodes.length === 0) {
          setIsInnerEditMode(false)
          return
        }

        // Check if any bound node has 'inner-edit-node' name
        const hasInnerEditNode = nodes.some(
          node => node && typeof node.hasName === 'function' && node.hasName(INNER_EDIT_NODE_NAME)
        )

        setIsInnerEditMode(hasInnerEditNode)
      }, 50) // Longer delay to ensure transformer is properly updated
    }

    // Initial check
    checkInnerEditMode()

    // Listen for transformer updates
    Transmitter.listen(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER, checkInnerEditMode)

    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current)
      }
      Transmitter.remove(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER, checkInnerEditMode)
    }
  }, [transformerRef])

  // Separate effect to handle selection changes
  useEffect(() => {
    // When selection changes (especially when cleared), check inner edit mode
    function checkOnSelectionChange() {
      // Small delay to ensure transformer updates are complete
      setTimeout(() => {
        if (!transformerRef.current) {
          setIsInnerEditMode(false)
          return
        }

        const transformer = transformerRef.current
        const nodes = transformer.nodes()

        // If no layer is selected, definitely not in inner edit mode
        if (!clickedLayerStore || !nodes || nodes.length === 0) {
          setIsInnerEditMode(false)
          return
        }

        // Check if bound to inner-edit-node
        const hasInnerEditNode = nodes.some(
          node => node && typeof node.hasName === 'function' && node.hasName(INNER_EDIT_NODE_NAME)
        )

        setIsInnerEditMode(hasInnerEditNode)
      }, 50)
    }

    checkOnSelectionChange()
  }, [clickedLayerStore, transformerRef])

  return isInnerEditMode
}
